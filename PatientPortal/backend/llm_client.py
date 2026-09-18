import os
import time
import logging
from google import genai
from google.genai import types as genai_types

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
PRIMARY_MODEL = "gemini-3.5-flash-lite"
FALLBACK_MODEL = "gemini-3.6-flash"

_client_instance = None

def _get_client():
    global _client_instance
    if not GEMINI_API_KEY:
        return None
    if _client_instance is None:
        _client_instance = genai.Client(api_key=GEMINI_API_KEY)
        logger.info("Gemini client initialized (singleton)")
    return _client_instance

def generate_portal_chat_reply(system_prompt: str, user_prompt: str, temperature: float = 0.5) -> str:
    """Standard text generation for the Patient Portal Chatbot with retry logic."""
    client = _get_client()
    if not client:
        return "I'm sorry, my AI systems are currently offline (API Key missing). Please try again later."
        
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
                return response.text
            except Exception as e:
                last_exception = e
                err_msg = str(e)
                if "503" in err_msg or "UNAVAILABLE" in err_msg:
                    break
                if attempt < 1:
                    time.sleep(0.5)
                    
    logger.error(f"Gemini generation failed: {last_exception}")
    return "I apologize, but I encountered an error while processing your request. Please ask your doctor for specific medical advice."
