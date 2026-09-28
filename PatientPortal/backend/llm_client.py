import os
import json
import re
import time
import logging
from google import genai
from google.genai import types as genai_types

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
# Models tested and working in this environment
MODELS_TO_TRY = ["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-2.5-flash"]

_client_instance = None

def _get_client():
    global _client_instance
    if not GEMINI_API_KEY:
        return None
    if _client_instance is None:
        _client_instance = genai.Client(api_key=GEMINI_API_KEY)
        logger.info("Gemini client initialized (singleton)")
    return _client_instance

def clean_and_parse_json(text: str) -> dict | None:
    """Safely extracts and parses a JSON object from text, even with markdown fences."""
    if not text:
        return None
    clean = text.strip()
    if clean.startswith("```json"):
        clean = clean[7:]
    elif clean.startswith("```"):
        clean = clean[3:]
    if clean.endswith("```"):
        clean = clean[:-3]
    clean = clean.strip()
    
    # 1. Direct parse attempt
    try:
        data = json.loads(clean)
        if isinstance(data, dict):
            return data
    except Exception:
        pass
        
    # 2. Regex search for { ... }
    m = re.search(r'\{[\s\S]*\}', clean)
    if m:
        try:
            data = json.loads(m.group(0))
            if isinstance(data, dict):
                return data
        except Exception:
            pass

    return None

def generate_portal_chat_structured(system_prompt: str, user_prompt: str, temperature: float = 0.4) -> dict:
    """
    Generates structured JSON response conforming to the SwasthyaSync AI specification.
    Returns a dict with: intent, response, sources, confidence, needs_clinician, emergency, suggested_followups.
    Guarantees that the 'response' key is ALWAYS a user-friendly conversational string, NEVER raw JSON.
    """
    client = _get_client()
    if not client:
        return {
            "intent": "UNKNOWN",
            "response": "I'm sorry, my AI systems are currently offline. Please try again later.",
            "sources": [],
            "confidence": "low",
            "needs_clinician": False,
            "emergency": False,
            "suggested_followups": []
        }

    last_exception = None

    # Step 1: Try JSON mode
    for model in MODELS_TO_TRY:
        for attempt in range(2):
            try:
                config = genai_types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type="application/json",
                    temperature=temperature,
                    max_output_tokens=768,
                )
                response = client.models.generate_content(
                    model=model,
                    contents=user_prompt,
                    config=config,
                )
                
                parsed = clean_and_parse_json(response.text)
                if parsed:
                    # If response is itself a nested JSON string, unwrap it
                    inner_resp = parsed.get("response") or parsed.get("reply", "")
                    if isinstance(inner_resp, str) and inner_resp.strip().startswith("{"):
                        inner_parsed = clean_and_parse_json(inner_resp)
                        if inner_parsed and "response" in inner_parsed:
                            parsed["response"] = inner_parsed["response"]
                    else:
                        parsed["response"] = str(inner_resp)

                    if "sources" not in parsed: parsed["sources"] = []
                    if "suggested_followups" not in parsed: parsed["suggested_followups"] = []
                    if "confidence" not in parsed: parsed["confidence"] = "high"
                    if "needs_clinician" not in parsed: parsed["needs_clinician"] = False
                    if "emergency" not in parsed: parsed["emergency"] = False
                    return parsed
                    
            except Exception as e:
                last_exception = e
                err_msg = str(e)
                if "503" in err_msg or "UNAVAILABLE" in err_msg or "NOT_FOUND" in err_msg:
                    break
                if attempt < 1:
                    time.sleep(0.5)

    # Step 2: Fallback to standard text generation if JSON mode encounters an issue
    try:
        plain_config = genai_types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=temperature,
            max_output_tokens=512,
        )
        plain_res = client.models.generate_content(
            model=MODELS_TO_TRY[0],
            contents=user_prompt,
            config=plain_config
        )
        if plain_res and plain_res.text:
            parsed = clean_and_parse_json(plain_res.text)
            if parsed and ("response" in parsed or "reply" in parsed):
                user_text = parsed.get("response") or parsed.get("reply", "")
                parsed["response"] = user_text
                return parsed

            # If plain text is not JSON, clean out any accidental schema text
            clean_text = plain_res.text.strip()
            # If it has ```json ... ```, strip it
            clean_text = re.sub(r'```json[\s\S]*?```', '', clean_text).strip() or plain_res.text.strip()
            return {
                "intent": "GENERAL_HEALTH",
                "response": clean_text,
                "sources": [],
                "confidence": "medium",
                "needs_clinician": False,
                "emergency": False,
                "suggested_followups": []
            }
    except Exception as fallback_err:
        logger.error(f"Fallback plain generation failed: {fallback_err}")

    logger.error(f"Gemini generation failed: {last_exception}")
    return {
        "intent": "UNKNOWN",
        "response": "I apologize, but I encountered an issue processing your medical question. Please speak directly with your doctor or clinical staff.",
        "sources": [],
        "confidence": "low",
        "needs_clinician": True,
        "emergency": False,
        "suggested_followups": []
    }

def generate_portal_chat_reply(system_prompt: str, user_prompt: str, temperature: float = 0.5) -> str:
    """Backward-compatible text generation wrapper."""
    result = generate_portal_chat_structured(system_prompt, user_prompt, temperature)
    return result.get("response", "")
