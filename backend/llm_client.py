"""
MediKiosk v3 — LLM Client (google.genai SDK)

Simplified for v3 architecture:
  - conversation_turn: The unified LLM call used by the conversation engine
  - classify_complaint: Classifies chief complaint into a category
  - extract_document_entities: Extracts entities from OCR text

The old ask_slot and extract_slots are REMOVED — replaced by the
single conversation_turn call that does everything in one shot.
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
GEMINI_MODEL = "gemini-3.5-flash-lite"

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
# Singleton Client
# ──────────────────────────────────────────────────────────────────────

_client_instance = None

def _get_client():
    global _client_instance
    if not HAS_GENAI or not GEMINI_API_KEY:
        return None
    if _client_instance is None:
        _client_instance = genai.Client(api_key=GEMINI_API_KEY)
        logger.info("Gemini client initialized (singleton)")
    return _client_instance


def _generate_json(client, system_prompt: str, user_prompt: str, temperature: float = 0.3) -> dict:
    """Call Gemini and parse JSON response. Logs timing."""
    t0 = time.time()
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=user_prompt,
        config=genai_types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            temperature=temperature,
        ),
    )
    elapsed = time.time() - t0
    logger.info(f"Gemini call took {elapsed:.2f}s (model={GEMINI_MODEL})")
    return json.loads(response.text)


# ──────────────────────────────────────────────────────────────────────
# CONTRACT 1: conversation_turn (NEW — the unified call)
# Used by conversation_engine.py for each turn of the conversation.
# One call does: question + extraction + options + completion check.
# ──────────────────────────────────────────────────────────────────────

def conversation_turn(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.4,
) -> dict:
    """
    Execute a single conversation turn via LLM.
    
    The system_prompt is built by clinical_prompts.build_conversation_system_prompt()
    and contains all the clinical guidelines, language rules, and output format.
    
    The user_prompt contains conversation history and patient context.
    
    Returns the parsed JSON response from the LLM containing:
    - spoken_text, suggested_options, section_complete, extracted_data,
      section_summary, red_flag_check, reasoning
    """
    client = _get_client()
    if client is None:
        return _mock_conversation_turn(user_prompt)

    try:
        return _generate_json(client, system_prompt, user_prompt, temperature)
    except json.JSONDecodeError as e:
        logger.error(f"conversation_turn JSON parse error: {e}")
        return _mock_conversation_turn(user_prompt)
    except Exception as e:
        logger.error(f"conversation_turn failed: {e}")
        return _mock_conversation_turn(user_prompt)


def _mock_conversation_turn(user_prompt: str) -> dict:
    """Mock conversation turn when LLM is unavailable."""
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
        "reasoning": "Mock response — LLM unavailable",
    }


# ──────────────────────────────────────────────────────────────────────
# CONTRACT 2: classify_complaint
# Classifies the chief complaint for FSM routing
# ──────────────────────────────────────────────────────────────────────

def classify_complaint(text: str, language: str = "en-IN") -> str:
    """
    Classify a chief complaint into one of the category set.
    Used by the dialogue manager to route FSM state.
    """
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
        result = _generate_json(client, system_prompt, f"Patient says: {text}", temperature=0.0)
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
# CONTRACT 3: extract_document_entities (OCR pipeline)
# ──────────────────────────────────────────────────────────────────────

def extract_document_entities(ocr_text: str, doc_type: str = "prescription") -> dict:
    """Extract medications, diagnoses, lab values from OCR text."""
    client = _get_client()
    if client is None:
        return _mock_doc_extract(ocr_text)

    system_prompt = """Extract structured clinical entities from this medical document text.

Output a JSON object with:
- "medications": [{"name": str, "dose": str, "frequency": str, "date": str}]
- "diagnoses": [{"name": str, "date": str}]
- "lab_results": [{"test": str, "result": str, "unit": str, "reference_range": str, "status": str, "date": str}]
- "procedures": [{"name": str, "date": str}]

Extract the dates associated with these events to help build a chronological timeline. If no specific date is present for an entity, but a general document date is, use the document date.
Only extract what is clearly present. Mark uncertain extractions."""

    try:
        return _generate_json(
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
            {"name": "Paracetamol", "dose": "500 mg", "frequency": "Twice a day", "date": "2023-10-01"},
            {"name": "Amlodipine", "dose": "5 mg", "frequency": "Once daily", "date": "2023-10-01"},
        ],
        "diagnoses": [{"name": "Hypertension", "date": "2023-01-15"}],
        "lab_results": [
            {"test": "Hemoglobin", "result": "13.2", "unit": "g/dL", "reference_range": "13.0-17.0", "status": "Normal", "date": "2023-09-28"},
            {"test": "WBC Count", "result": "8200", "unit": "/μL", "reference_range": "4000-11000", "status": "Normal", "date": "2023-09-28"},
        ],
        "procedures": [],
    }

def extract_document_entities_vlm(image_bytes: bytes, mime_type: str = "image/jpeg", doc_type: str = "prescription") -> dict:
    """Extract clinical entities directly from an image using the VLM."""
    client = _get_client()
    if client is None:
        return _mock_doc_extract_vlm()

    system_prompt = """You are a clinical document extraction VLM. 
Read the provided document image and extract structured clinical entities.

Critically, you must also provide a "vlm_confidence" score (0 to 100) based on the image's legibility and your confidence in extracting the text. If the image is blurry, cropped, or unreadable, give a low score (e.g., < 50).

Output a JSON object with:
- "vlm_confidence": int
- "ocr_text": "The full raw text you read from the image as a single string"
- "medications": [{"name": str, "dose": str, "frequency": str, "date": str}]
- "diagnoses": [{"name": str, "date": str}]
- "lab_results": [{"test": str, "result": str, "unit": str, "reference_range": str, "status": str, "date": str}]
- "procedures": [{"name": str, "date": str}]

Extract the dates associated with these events to help build a chronological timeline. If no specific date is present for an entity, but a general document date is, use the document date.
Only extract what is clearly present."""

    try:
        model_name = "gemini-2.5-flash"
        t0 = time.time()
        
        image_part = genai_types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
        
        response = client.models.generate_content(
            model=model_name,
            contents=[f"Document type: {doc_type}", image_part],
            config=genai_types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )
        elapsed = time.time() - t0
        logger.info(f"VLM extraction took {elapsed:.2f}s (model={model_name})")
        return json.loads(response.text)
    except Exception as e:
        logger.error(f"VLM extract_document_entities_vlm failed: {e}")
        return _mock_doc_extract_vlm()

def _mock_doc_extract_vlm() -> dict:
    mock_data = _mock_doc_extract("")
    mock_data["vlm_confidence"] = 85
    mock_data["ocr_text"] = "[Mock VLM extraction of image]"
    return mock_data
