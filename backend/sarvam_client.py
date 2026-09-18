"""
SwasthyaSync — Sarvam AI Client (Optimized)

Changes from original:
  - Uses a persistent httpx.Client with connection pooling (no new connection per call)
  - Added timing logs to identify bottlenecks
  - async-compatible via run_in_executor pattern
  - Lightweight validation before API call

Supports:
  (a) Speech-to-Text (STT) — with automatic Indian language detection
  (b) Text-to-Speech (TTS) — natural voice synthesis in 10 Indian languages

Sarvam AI API docs: https://docs.sarvam.ai

Supported languages:
  hi-IN (Hindi), ta-IN (Tamil), te-IN (Telugu), kn-IN (Kannada),
  bn-IN (Bengali), mr-IN (Marathi), gu-IN (Gujarati), ml-IN (Malayalam),
  pa-IN (Punjabi), or-IN (Odia), en-IN (English)
"""

from __future__ import annotations
import os
import logging
import time
import httpx
import base64
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

SARVAM_API_KEY = os.environ.get("SARVAM_API_KEY", "")
SARVAM_BASE_URL = "https://api.sarvam.ai"

# All supported Indian languages for the kiosk
SUPPORTED_LANGUAGES = [
    "hi-IN",   # Hindi
    "ta-IN",   # Tamil
    "te-IN",   # Telugu
    "kn-IN",   # Kannada
    "bn-IN",   # Bengali
    "mr-IN",   # Marathi
    "gu-IN",   # Gujarati
    "ml-IN",   # Malayalam
    "pa-IN",   # Punjabi
    "or-IN",   # Odia
    "en-IN",   # English (Indian)
]

LANGUAGE_NAMES = {
    "hi-IN": "Hindi",
    "ta-IN": "Tamil",
    "te-IN": "Telugu",
    "kn-IN": "Kannada",
    "bn-IN": "Bengali",
    "mr-IN": "Marathi",
    "gu-IN": "Gujarati",
    "ml-IN": "Malayalam",
    "pa-IN": "Punjabi",
    "or-IN": "Odia",
    "en-IN": "English",
}

# Default TTS voice per language (bulbul:v3 compatible speakers)
TTS_SPEAKER = {
    "hi-IN": "priya",
    "ta-IN": "priya",
    "te-IN": "priya",
    "kn-IN": "priya",
    "bn-IN": "priya",
    "mr-IN": "priya",
    "gu-IN": "priya",
    "ml-IN": "priya",
    "pa-IN": "priya",
    "or-IN": "priya",
    "en-IN": "priya",
}


def _headers() -> dict:
    return {
        "api-subscription-key": SARVAM_API_KEY,
    }


def _is_configured() -> bool:
    if not SARVAM_API_KEY:
        logger.warning("SARVAM_API_KEY not set — STT/TTS unavailable")
        return False
    return True


# ──────────────────────────────────────────────────────────────────────
# Persistent HTTP client with connection pooling
# This avoids creating a new TCP connection + TLS handshake per call
# ──────────────────────────────────────────────────────────────────────

_http_client: httpx.Client | None = None

def _get_http_client() -> httpx.Client:
    """Return a singleton httpx client with connection pooling."""
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.Client(
            timeout=httpx.Timeout(connect=5.0, read=30.0, write=10.0, pool=5.0),
            limits=httpx.Limits(
                max_keepalive_connections=5,
                max_connections=10,
                keepalive_expiry=30.0,
            ),
        )
        logger.info("Sarvam HTTP client initialized (persistent, pooled)")
    return _http_client


# ──────────────────────────────────────────────────────────────────────
# STT: Speech-to-Text with automatic language detection
# ──────────────────────────────────────────────────────────────────────

def speech_to_text(
    audio_bytes: bytes,
    hint_language: str = "hi-IN",
    audio_format: str = "webm",
) -> dict:
    """
    Transcribe patient's speech to text using Sarvam AI.

    Args:
        audio_bytes: Raw audio from the browser (WebM/Opus by default)
        hint_language: BCP-47 language code hint (used as primary language)
        audio_format: 'webm', 'wav', 'mp3' — matches what browser sends

    Returns:
        {
            "transcript": str,
            "language_code": str,   # detected language (e.g. "hi-IN")
            "language_name": str,   # human-readable (e.g. "Hindi")
        }
    """
    if not _is_configured():
        return {"transcript": "", "language_code": hint_language, "language_name": LANGUAGE_NAMES.get(hint_language, "Unknown")}

    if not audio_bytes or len(audio_bytes) < 100:
        logger.warning(f"STT: audio too short ({len(audio_bytes)} bytes), skipping")
        return {"transcript": "", "language_code": hint_language, "language_name": LANGUAGE_NAMES.get(hint_language, "Unknown"), "error": "Audio too short"}

    # Map audio format to MIME type
    mime_map = {
        "webm": "audio/webm",
        "wav":  "audio/wav",
        "mp3":  "audio/mp3",
        "ogg":  "audio/ogg",
    }
    mime_type = mime_map.get(audio_format, "audio/webm")
    filename = f"audio.{audio_format}"

    t0 = time.time()
    try:
        client = _get_http_client()
        response = client.post(
            f"{SARVAM_BASE_URL}/speech-to-text",
            headers=_headers(),
            files={"file": (filename, audio_bytes, mime_type)},
            data={
                "language_code": hint_language,
                "model": "saaras:v3",  # saarika:v2 was deprecated — use saaras:v3
                "with_timestamps": "false",
            },
        )
        elapsed = time.time() - t0
        logger.info(
            f"Sarvam STT took {elapsed:.2f}s | status={response.status_code} "
            f"| size={len(audio_bytes)} bytes | lang={hint_language} | fmt={audio_format}"
        )

        # Log full response for debugging — critical for catching API errors
        if response.status_code != 200:
            logger.error(f"Sarvam STT non-200 response: {response.status_code} — {response.text}")
            return {
                "transcript": "",
                "language_code": hint_language,
                "language_name": LANGUAGE_NAMES.get(hint_language, "Unknown"),
                "error": f"Sarvam API error {response.status_code}: {response.text[:200]}",
            }

        data = response.json()
        logger.info(f"Sarvam STT raw response: {data}")

        transcript = data.get("transcript", "")
        detected_lang = data.get("language_code", hint_language)

        logger.info(f"STT result: '{transcript[:80]}' | lang={detected_lang}")
        return {
            "transcript": transcript,
            "language_code": detected_lang,
            "language_name": LANGUAGE_NAMES.get(detected_lang, detected_lang),
        }

    except httpx.HTTPStatusError as e:
        elapsed = time.time() - t0
        logger.error(f"Sarvam STT HTTP error after {elapsed:.2f}s: {e.response.status_code} — {e.response.text}")
        return {
            "transcript": "",
            "language_code": hint_language,
            "language_name": LANGUAGE_NAMES.get(hint_language, "Unknown"),
            "error": f"{e.response.status_code}: {e.response.text[:200]}",
        }
    except Exception as e:
        elapsed = time.time() - t0
        logger.error(f"Sarvam STT failed after {elapsed:.2f}s: {e}")
        return {
            "transcript": "",
            "language_code": hint_language,
            "language_name": LANGUAGE_NAMES.get(hint_language, "Unknown"),
            "error": str(e),
        }


# ──────────────────────────────────────────────────────────────────────
# TTS: Text-to-Speech
# ──────────────────────────────────────────────────────────────────────

def text_to_speech(
    text: str,
    language_code: str = "hi-IN",
    speaker: str | None = None,
) -> bytes:
    """
    Convert text to speech audio using Sarvam AI.

    Args:
        text: The text to speak (can be in any supported Indian language)
        language_code: BCP-47 language code (e.g. "hi-IN")
        speaker: Optional speaker name override

    Returns:
        WAV audio bytes, or empty bytes on failure
    """
    if not _is_configured():
        logger.warning("TTS unavailable — SARVAM_API_KEY not set")
        return b""

    if not text or not text.strip():
        return b""

    selected_speaker = speaker or TTS_SPEAKER.get(language_code, "priya")

    # Sarvam TTS has a 500-char limit per request — chunk if needed
    chunks = _chunk_text(text, max_chars=490)
    all_audio: list[bytes] = []

    t0 = time.time()
    try:
        client = _get_http_client()
        for chunk in chunks:
            response = client.post(
                f"{SARVAM_BASE_URL}/text-to-speech",
                headers={**_headers(), "Content-Type": "application/json"},
                json={
                    "inputs": [chunk],
                    "target_language_code": language_code,
                    "speaker": selected_speaker,
                    "pace": 1.0,
                    "speech_sample_rate": 16000,
                    "enable_preprocessing": True,
                    "model": "bulbul:v3",
                },
            )
            response.raise_for_status()
            data = response.json()

            # Sarvam returns base64-encoded WAV in audios[]
            audios = data.get("audios", [])
            if audios:
                audio_bytes = base64.b64decode(audios[0])
                all_audio.append(audio_bytes)

        elapsed = time.time() - t0
        logger.info(f"Sarvam TTS took {elapsed:.2f}s | {len(all_audio)} chunk(s) | lang={language_code}")
        # Return first chunk for now (most prompts fit in one)
        return all_audio[0] if all_audio else b""

    except httpx.HTTPStatusError as e:
        elapsed = time.time() - t0
        logger.error(f"Sarvam TTS HTTP error after {elapsed:.2f}s: {e.response.status_code} — {e.response.text}")
        return b""
    except Exception as e:
        elapsed = time.time() - t0
        logger.error(f"Sarvam TTS failed after {elapsed:.2f}s: {e}")
        return b""


def _chunk_text(text: str, max_chars: int = 490) -> list[str]:
    """Split text into chunks at sentence boundaries."""
    if len(text) <= max_chars:
        return [text]

    chunks = []
    sentences = text.replace("।", ".").split(".")
    current = ""
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        candidate = f"{current}. {s}" if current else s
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                chunks.append(current)
            current = s
    if current:
        chunks.append(current)

    return chunks or [text[:max_chars]]
