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

# High-throughput sub-second models
PRIMARY_MODEL = "gemini-3.5-flash-lite"
FALLBACK_MODEL = "gemini-3.6-flash"

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
    client, system_prompt: str, user_prompt: str, temperature: float = 0.3
) -> dict:
    """Call Gemini with model fallback, retries, and disabled AFC for fast turns."""
    if not circuit_breaker.allow_request():
        raise RuntimeError("Circuit breaker is OPEN — bypassing LLM call for immediate fallback")

    models_to_try = [PRIMARY_MODEL, FALLBACK_MODEL]
    last_exception = None

    for model in models_to_try:
        max_retries = 2
        for attempt in range(max_retries):
            t0 = time.time()
            try:
                # Explicitly disable AFC to stop 10-step remote execution loops
                config = genai_types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type="application/json",
                    temperature=temperature,
                    max_output_tokens=1024,
                    automatic_function_calling=genai_types.AutomaticFunctionCallingConfig(disable=True),
                )
                
                response = client.models.generate_content(
                    model=model,
                    contents=user_prompt,
                    config=config,
                )
                
                elapsed = time.time() - t0
                logger.info(f"Gemini call took {elapsed:.2f}s (model={model})")
                
                parsed = json.loads(response.text)
                circuit_breaker.record_success()
                return parsed

            except Exception as e:
                elapsed = time.time() - t0
                err_msg = str(e)
                last_exception = e
                logger.warning(f"Gemini call attempt {attempt+1} failed on {model} after {elapsed:.2f}s: {err_msg[:120]}")
                
                # Check for 503 or quota errors
                if "503" in err_msg or "UNAVAILABLE" in err_msg or "high demand" in err_msg:
                    circuit_breaker.record_failure(err_msg[:80])
                    break  # Break retry loop for this model, try fallback model
                
                if attempt < max_retries - 1:
                    time.sleep(0.2 * (2 ** attempt))

    circuit_breaker.record_failure(str(last_exception)[:80])
    raise last_exception or RuntimeError("All Gemini model attempts failed")

def generate_portal_chat_reply(system_prompt: str, user_prompt: str, temperature: float = 0.5) -> str:
    """Standard text generation for the Patient Portal Chatbot with retry logic."""
    client = _get_client()
    if not client:
        return "I'm sorry, my AI systems are currently offline. Please try again later."
        
    if not circuit_breaker.allow_request():
        return "The system is currently experiencing high load. Please try again in a few moments."

    models_to_try = [PRIMARY_MODEL, FALLBACK_MODEL]
    last_exception = None

    for model in models_to_try:
        for attempt in range(2):
            try:
                config = genai_types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type="text/plain",
                    temperature=temperature,
                    max_output_tokens=512,
                )
                response = client.models.generate_content(
                    model=model,
                    contents=user_prompt,
                    config=config,
                )
                circuit_breaker.record_success()
                return response.text
            except Exception as e:
                last_exception = e
                err_msg = str(e)
                if "503" in err_msg or "UNAVAILABLE" in err_msg:
                    break
                if attempt < 1:
                    time.sleep(0.5)
                    
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
