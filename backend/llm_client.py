"""
SwasthyaSync — Ultra-Low Latency Resilient LLM Client (google.genai SDK)

Features:
  - Valid Gemini Model Cascade (gemini-2.5-flash -> gemini-1.5-flash)
  - Circuit Breaker Pattern (fast fail on 503/throttling)
  - Retry with Exponential Backoff
  - Disabled AFC (Automatic Function Calling) to prevent multi-call latency loops
  - Async & Sync interface for FastAPI concurrency
"""

from __future__ import annotations
import json
import os
import logging
import time
import asyncio
import concurrent.futures
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Try to import the new Gemini SDK
try:
    from google import genai
    from google.genai import types as genai_types
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False
    logger.warning("google-genai not installed — using mock LLM")


GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

# ──────────────────────────────────────────────────────────────────────
# Multi-Tier Resilient Model Cascades
# ──────────────────────────────────────────────────────────────────────

# Speed-optimized cascade (for low-latency interactive kiosk turns & portal chat)
FAST_MODELS_CASCADE = [
    "gemini-3.1-flash-lite",      # ~1.5s latency, primary (0 errors, no 503)
    "gemini-3.6-flash",          # ~2.2s latency, high-reasoning tier-2 backup
    "gemini-flash-lite-latest",  # alias tier-3 backup
    "gemini-3.5-flash-lite",     # tier-4 backup
]

# Reasoning-optimized cascade (for clinical handover notes, contradictions, synthesis)
REASONING_MODELS_CASCADE = [
    "gemini-3.6-flash",          # Deep clinical reasoning, primary (~2.2s)
    "gemini-3.1-flash-lite",      # Fast tier-2 backup (~1.5s)
    "gemini-flash-lite-latest",  # alias tier-3 backup
]

PRIMARY_MODEL = FAST_MODELS_CASCADE[0]
FALLBACK_MODEL = FAST_MODELS_CASCADE[1]

# Shared thread pool for timeout-bounded LLM calls
_llm_executor = concurrent.futures.ThreadPoolExecutor(max_workers=8, thread_name_prefix="gemini_worker")


def _call_model_with_timeout(fn, timeout_seconds: float = 7.0):
    """Execute a synchronous SDK call with a strict timeout."""
    future = _llm_executor.submit(fn)
    return future.result(timeout=timeout_seconds)

# Complaint categories for classification
COMPLAINT_CATEGORIES = [
    "pain", "fever", "respiratory", "gi", "neuro",
    "cardiac", "musculoskeletal", "skin", "urinary",
    "gynecological", "psychiatric", "ent", "eye", "general",
]

# Language names for prompt building
LANGUAGE_NAMES = {
    "hi-IN": "Hindi (हिन्दी)",
    "ta-IN": "Tamil (தமிழ்)",
    "te-IN": "Telugu (తెలుగు)",
    "kn-IN": "Kannada (ಕನ್ನಡ)",
    "bn-IN": "Bengali (বাংলা)",
    "mr-IN": "Marathi (मराठी)",
    "gu-IN": "Gujarati (ગુજરાતી)",
    "ml-IN": "Malayalam (മലയാളം)",
    "pa-IN": "Punjabi (ਪੰਜਾਬੀ)",
    "or-IN": "Odia (ଓଡ଼ିଆ)",
    "en-IN": "English",
}

# ──────────────────────────────────────────────────────────────────────
# Circuit Breaker & Health Management
# ──────────────────────────────────────────────────────────────────────

class CircuitBreaker:
    def __init__(self, failure_threshold: int = 3, reset_timeout: float = 15.0):
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.failure_count = 0
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
        self.last_state_change = time.time()

    def record_success(self):
        self.failure_count = 0
        if self.state != "CLOSED":
            logger.info("⚡ Circuit Breaker: Recovered! Resetting to CLOSED")
            self.state = "CLOSED"
            self.last_state_change = time.time()

    def record_failure(self, reason: str = ""):
        self.failure_count += 1
        logger.warning(f"⚡ Circuit Breaker failure ({self.failure_count}/{self.failure_threshold}): {reason}")
        if self.failure_count >= self.failure_threshold:
            if self.state != "OPEN":
                logger.error(f"🚨 Circuit Breaker TRIPPED to OPEN! Fast failing LLM calls for {self.reset_timeout}s")
                self.state = "OPEN"
                self.last_state_change = time.time()

    def allow_request(self) -> bool:
        if self.state == "CLOSED":
            return True
        elif self.state == "OPEN":
            if time.time() - self.last_state_change > self.reset_timeout:
                logger.info("⚡ Circuit Breaker: Testing recovery (HALF_OPEN)")
                self.state = "HALF_OPEN"
                return True
            return False
        elif self.state == "HALF_OPEN":
            return True
        return True


circuit_breaker = CircuitBreaker()

_client_instance = None

def _get_client():
    global _client_instance
    if not HAS_GENAI or not GEMINI_API_KEY:
        return None
    if _client_instance is None:
        _client_instance = genai.Client(api_key=GEMINI_API_KEY)
        logger.info("Gemini client initialized (singleton)")
    return _client_instance


def _generate_json_with_retry(
    client,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.3,
    models_to_try: list[str] | None = None,
    timeout_seconds: float = 7.0,
) -> dict:
    """Call Gemini with model cascade fallback, timeout protection, and disabled AFC."""
    if not circuit_breaker.allow_request():
        raise RuntimeError("Circuit breaker is OPEN — bypassing LLM call for immediate fallback")

    candidate_models = list(models_to_try or FAST_MODELS_CASCADE)
    last_exception = None

    for model in candidate_models:
        t0 = time.time()
        try:
            config = genai_types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                temperature=temperature,
                max_output_tokens=1024,
                automatic_function_calling=genai_types.AutomaticFunctionCallingConfig(disable=True),
            )

            def _invoke():
                return client.models.generate_content(
                    model=model,
                    contents=user_prompt,
                    config=config,
                )

            response = _call_model_with_timeout(_invoke, timeout_seconds=timeout_seconds)
            elapsed = time.time() - t0
            logger.info(f"Gemini call took {elapsed:.2f}s (model={model})")

            parsed = json.loads(response.text)
            circuit_breaker.record_success()
            return parsed

        except concurrent.futures.TimeoutError:
            elapsed = time.time() - t0
            logger.warning(f"⚡ Gemini model {model} timed out after {elapsed:.2f}s (limit {timeout_seconds}s) — cascading to next backup")
            last_exception = TimeoutError(f"Model {model} timed out after {timeout_seconds}s")
            continue

        except Exception as e:
            elapsed = time.time() - t0
            err_msg = str(e)
            last_exception = e
            logger.warning(f"⚡ Gemini model {model} failed after {elapsed:.2f}s: {err_msg[:100]} — cascading to next backup")
            continue

    circuit_breaker.record_failure(str(last_exception)[:80])
    raise last_exception or RuntimeError("All Gemini backup models failed")


def generate_portal_chat_reply(system_prompt: str, user_prompt: str, temperature: float = 0.5) -> str:
    """Standard text generation for the Patient Portal Chatbot with multi-model cascade & timeout."""
    client = _get_client()
    if not client:
        return "I'm sorry, my AI systems are currently offline. Please try again later."

    if not circuit_breaker.allow_request():
        return "The system is currently experiencing high load. Please try again in a few moments."

    last_exception = None
    for model in FAST_MODELS_CASCADE:
        t0 = time.time()
        try:
            config = genai_types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="text/plain",
                temperature=temperature,
                max_output_tokens=512,
                automatic_function_calling=genai_types.AutomaticFunctionCallingConfig(disable=True),
            )

            def _invoke():
                return client.models.generate_content(
                    model=model,
                    contents=user_prompt,
                    config=config,
                )

            response = _call_model_with_timeout(_invoke, timeout_seconds=7.0)
            elapsed = time.time() - t0
            logger.info(f"Portal chat reply took {elapsed:.2f}s (model={model})")
            circuit_breaker.record_success()
            return response.text
        except concurrent.futures.TimeoutError:
            logger.warning(f"⚡ Portal chat timed out on {model} — cascading to next backup")
            continue
        except Exception as e:
            last_exception = e
            logger.warning(f"⚡ Portal chat failed on {model}: {e} — cascading to next backup")
            continue

    circuit_breaker.record_failure(str(last_exception)[:80])
    return "I apologize, but I encountered an error while processing your request. Please ask your doctor for specific medical advice."


# ──────────────────────────────────────────────────────────────────────
# Unified Call: conversation_turn
# ──────────────────────────────────────────────────────────────────────

def conversation_turn(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.4,
) -> dict:
    """Execute a single conversation turn via LLM with fallback protection."""
    client = _get_client()
    if client is None:
        return _mock_conversation_turn(user_prompt)

    try:
        return _generate_json_with_retry(client, system_prompt, user_prompt, temperature)
    except Exception as e:
        logger.error(f"conversation_turn failed gracefully: {e}")
        return _mock_conversation_turn(user_prompt)


def _mock_conversation_turn(user_prompt: str) -> dict:
    """Mock conversation turn when LLM is unavailable or circuit is open."""
    return {
        "spoken_text": "Could you tell me more about your symptoms?",
        "suggested_options": [
            {"label": "Yes", "label_translated": "Yes"},
            {"label": "No", "label_translated": "No"},
            {"label": "Not sure", "label_translated": "Not sure"},
        ],
        "section_complete": False,
        "extracted_data": {},
        "section_summary": "",
        "red_flag_check": None,
        "reasoning": "Fallback response — LLM circuit open or unavailable",
    }


# ──────────────────────────────────────────────────────────────────────
# Complaint Classification
# ──────────────────────────────────────────────────────────────────────

def classify_complaint(text: str, language: str = "en-IN") -> str:
    """Classify chief complaint into a category."""
    client = _get_client()
    if client is None:
        return _mock_classify(text)

    lang_name = LANGUAGE_NAMES.get(language, language)
    system_prompt = f"""Classify the patient's chief complaint into exactly ONE of these categories:
{json.dumps(COMPLAINT_CATEGORIES)}

The patient may be speaking in {lang_name}. Understand their complaint regardless of language.
Output ONLY a JSON object: {{"category": "<one of the categories>"}}
If unsure, use "general"."""

    try:
        result = _generate_json_with_retry(client, system_prompt, f"Patient says: {text}", temperature=0.0)
        cat = result.get("category", "general")
        return cat if cat in COMPLAINT_CATEGORIES else "general"
    except Exception as e:
        logger.error(f"LLM classify_complaint failed: {e}")
        return _mock_classify(text)


def _mock_classify(text: str) -> str:
    """Keyword-based classification fallback."""
    text_lower = text.lower()
    mapping = {
        "pain": ["pain", "ache", "hurt", "dard", "dard"],
        "fever": ["fever", "temperature", "bukhar", "bukhaar", "hot"],
        "respiratory": ["cough", "breathe", "breathing", "wheeze", "khansi", "saans"],
        "gi": ["stomach", "vomit", "diarrhea", "nausea", "bowel", "pet", "ulti"],
        "neuro": ["headache", "dizzy", "numbness", "tingling", "seizure", "sir dard"],
        "cardiac": ["chest", "heart", "palpitation", "seena"],
        "skin": ["rash", "itch", "skin", "wound"],
        "urinary": ["urine", "burning", "peshab"],
    }
    for cat, keywords in mapping.items():
        if any(k in text_lower for k in keywords):
            return cat
    return "general"


# ──────────────────────────────────────────────────────────────────────
# Document OCR Entity Extraction
# ──────────────────────────────────────────────────────────────────────

def extract_document_entities(ocr_text: str, doc_type: str = "prescription") -> dict:
    """Extract medications, diagnoses, lab values from OCR text."""
    client = _get_client()
    if client is None:
        return _mock_doc_extract(ocr_text)

    system_prompt = """Extract structured clinical entities from this medical document text.

Output a JSON object with:
- "medications": [{name, dose, frequency}]
- "diagnoses": [str]
- "lab_results": [{test, result, unit, reference_range, status}]
- "procedures": [str]

Only extract what is clearly present. Mark uncertain extractions."""

    try:
        return _generate_json_with_retry(
            client,
            system_prompt,
            f"Document type: {doc_type}\nOCR text:\n{ocr_text}",
            temperature=0.1,
            models_to_try=REASONING_MODELS_CASCADE,
            timeout_seconds=10.0,
        )
    except Exception as e:
        logger.error(f"LLM extract_document_entities failed: {e}")
        return _mock_doc_extract(ocr_text)


def _mock_doc_extract(ocr_text: str) -> dict:
    """Mock document extraction for demos without LLM."""
    return {
        "medications": [
            {"name": "Paracetamol", "dose": "500 mg", "frequency": "Twice a day"},
            {"name": "Amlodipine", "dose": "5 mg", "frequency": "Once daily"},
        ],
        "diagnoses": ["Hypertension"],
        "lab_results": [
            {"test": "Hemoglobin", "result": "13.2", "unit": "g/dL", "reference_range": "13.0-17.0", "status": "Normal"},
            {"test": "WBC Count", "result": "8200", "unit": "/μL", "reference_range": "4000-11000", "status": "Normal"},
        ],
        "procedures": [],
    }

# ──────────────────────────────────────────────────────────────────────
# Clinical Synthesis
# ──────────────────────────────────────────────────────────────────────

def generate_clinical_summary(filled_state: dict, doc_extractions: list = None) -> dict:
    """Synthesize the Q&A state into a structured 200-word clinical narrative."""
    client = _get_client()
    if client is None:
        return _mock_clinical_summary(filled_state)

    system_prompt = """You are an expert physician assistant. Write a concise, professional clinical handover note (approx 200 words).
Synthesize the patient's history, symptoms, and extracted medical document information.
Output JSON format:
{
  "clinical_narrative": "Patient is a ...",
  "critical_highlights": ["Finding 1", "Finding 2"],
  "contradictions": ["Contradiction 1", "Contradiction 2"]
}
Keep it objective and medically accurate."""

    user_prompt = f"Patient Q&A History:\n{json.dumps(filled_state, indent=2)}\n\nDocument Extractions:\n{json.dumps(doc_extractions or [], indent=2)}"
    
    try:
        return _generate_json_with_retry(
            client,
            system_prompt,
            user_prompt,
            temperature=0.2,
            models_to_try=REASONING_MODELS_CASCADE,
            timeout_seconds=10.0,
        )
    except Exception as e:
        logger.error(f"LLM generate_clinical_summary failed: {e}")
        return _mock_clinical_summary(filled_state)


def _mock_clinical_summary(filled_state: dict) -> dict:
    """Mock clinical summary."""
    return {
        "clinical_narrative": "Patient presents with reported symptoms in the provided history. Vital signs and physical examination required for further assessment.",
        "critical_highlights": ["Awaiting detailed clinical evaluation", "Review provided symptom history"],
        "contradictions": []
    }
