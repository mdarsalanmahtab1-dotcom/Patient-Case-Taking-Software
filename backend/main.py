"""
MediKiosk — FastAPI Backend Server (Optimized)

Changes:
  - STT/TTS endpoints are now truly async (run blocking I/O in thread pool)
  - WebSocket handler times each step to identify bottlenecks
  - Added logging for every major operation

Endpoints:
  WebSocket /ws/session  — real-time conversation loop
  POST     /api/session   — create a new session
  POST     /api/ocr       — upload and process a document image
  GET      /api/record/{session_id} — get the patient record
  POST     /api/stt       — speech to text
  POST     /api/tts       — text to speech
"""

from __future__ import annotations
import json
import logging
import os
import time
import asyncio
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()  # Load .env before anything else

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from dialogue_manager import DialogueManager
from ocr_pipeline import process_document
import sarvam_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# In-memory session store (for hackathon; would be Redis/DB in production)
sessions: dict[str, DialogueManager] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("MediKiosk backend starting...")
    yield
    logger.info("MediKiosk backend shutting down.")


app = FastAPI(
    title="MediKiosk API",
    description="AI-powered clinical history-taking engine",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — lock down to the production Vercel frontend in prod, or all origins in dev
_allowed_origin = os.environ.get("ALLOWED_ORIGIN", "*")
_origins = [_allowed_origin] if _allowed_origin != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────────────────────────────
# Health Check (Railway / load balancer probe)
# ──────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "2.0.0"}


# ──────────────────────────────────────────────────────────────────────
# REST Endpoints
# ──────────────────────────────────────────────────────────────────────

@app.post("/api/session")
async def create_session(
    clinic_mode: str = "allopathic",
    language: str = "en-IN",
):
    """Create a new patient session and return the initial UI state."""
    dm = DialogueManager(clinic_mode=clinic_mode, language=language)
    ui = dm.start_session()
    session_id = dm.record.session_id
    sessions[session_id] = dm
    return {"session_id": session_id, "ui": ui}


@app.get("/api/record/{session_id}")
async def get_record(session_id: str):
    """Get the full patient record for a session."""
    dm = sessions.get(session_id)
    if not dm:
        return {"error": "Session not found"}
    return dm.get_record()


@app.post("/api/ocr")
async def upload_document(
    file: UploadFile = File(...),
    session_id: str = Form(""),
):
    """Upload a document image for OCR processing."""
    image_bytes = await file.read()
    result = process_document(image_bytes, filename=file.filename or "doc.jpg")

    # If we have a session, merge OCR entities into the patient record
    if session_id and session_id in sessions:
        dm = sessions[session_id]
        from patient_record import DocumentExtraction
        doc_ext = DocumentExtraction(
            doc_id=result["doc_id"],
            doc_type="prescription",
            ocr_path=result["ocr_path"],
            entities=result.get("entities", {}),
        )
        dm.record.document_extractions.append(doc_ext)

    return result


# ──────────────────────────────────────────────────────────────────────
# Sarvam AI — STT / TTS Endpoints (async, non-blocking)
# ──────────────────────────────────────────────────────────────────────

@app.post("/api/stt")
async def speech_to_text_endpoint(
    audio: UploadFile = File(...),
    language: str = Form("hi-IN"),
):
    """
    Convert patient voice to text using Sarvam AI.
    Accepts WebM/WAV/MP3 audio blob from the browser.
    Returns transcript and detected language.
    """
    t0 = time.time()
    audio_bytes = await audio.read()

    logger.info(f"STT endpoint: received {len(audio_bytes)} bytes, language={language}, content_type={audio.content_type}")

    # Detect format from content type or filename
    content_type = audio.content_type or "audio/webm"
    fmt = "webm"
    if "wav" in content_type:
        fmt = "wav"
    elif "mp3" in content_type or "mpeg" in content_type:
        fmt = "mp3"
    elif "ogg" in content_type:
        fmt = "ogg"

    # Run in thread pool — sarvam_client uses synchronous httpx
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        sarvam_client.speech_to_text,
        audio_bytes,
        language,
        fmt,
    )

    elapsed = time.time() - t0
    logger.info(f"STT endpoint total: {elapsed:.2f}s | transcript='{result.get('transcript', '')[:60]}'")
    return result


@app.post("/api/tts")
async def text_to_speech_endpoint(
    text: str = Form(...),
    language: str = Form("hi-IN"),
    speaker: str = Form(""),
):
    """
    Convert text to speech using Sarvam AI.
    Returns WAV audio bytes directly for browser playback.
    """
    t0 = time.time()
    logger.info(f"TTS endpoint: text='{text[:60]}', language={language}")

    # Run in thread pool — sarvam_client uses synchronous httpx
    loop = asyncio.get_event_loop()
    audio_bytes = await loop.run_in_executor(
        None,
        sarvam_client.text_to_speech,
        text,
        language,
        speaker if speaker else None,
    )

    elapsed = time.time() - t0
    logger.info(f"TTS endpoint total: {elapsed:.2f}s | audio_size={len(audio_bytes)} bytes")

    if not audio_bytes:
        return JSONResponse(status_code=503, content={"error": "TTS unavailable"})

    return Response(
        content=audio_bytes,
        media_type="audio/wav",
        headers={"Content-Disposition": "inline; filename=speech.wav"},
    )


# ──────────────────────────────────────────────────────────────────────
# WebSocket — Real-time Conversation
# ──────────────────────────────────────────────────────────────────────

@app.websocket("/ws/session")
async def websocket_session(ws: WebSocket):
    """
    Real-time conversation WebSocket.

    Client sends:
      {"type": "start", "clinic_mode": "allopathic", "language": "en-IN"}
      {"type": "input", "input_type": "tap"|"voice"|"skip"|"back"|"next", "value": "..."}
      {"type": "redflag"}
      {"type": "clear_redflag"}
      {"type": "get_record"}

    Server sends:
      {"type": "ui", ...}  — UI instruction from the Dialogue Manager
      {"type": "record", ...}  — Full patient record
      {"type": "error", "message": "..."}
    """
    await ws.accept()
    dm: DialogueManager | None = None

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "message": "Invalid JSON"})
                continue

            msg_type = msg.get("type", "")

            if msg_type == "start":
                clinic_mode = msg.get("clinic_mode", "allopathic")
                language = msg.get("language", "en-IN")
                dm = DialogueManager(clinic_mode=clinic_mode, language=language)

                # Set demographics if provided
                patient_name = msg.get("patient_name", "")
                patient_age = msg.get("patient_age")
                patient_sex = msg.get("patient_sex", "")
                if patient_name or patient_age or patient_sex:
                    dm.set_demographics(
                        name=patient_name,
                        age=int(patient_age) if patient_age else None,
                        sex=patient_sex,
                    )

                ui = dm.start_session()
                sessions[dm.record.session_id] = dm
                logger.info(f"Session started: {dm.record.session_id} | lang={language} | mode={clinic_mode} | name={patient_name}")
                await ws.send_json({"type": "ui", **ui})

            elif msg_type == "input":
                if not dm:
                    await ws.send_json({"type": "error", "message": "No active session"})
                    continue
                input_type = msg.get("input_type", "tap")
                value = msg.get("value", "")

                # Send "processing" state to the frontend immediately
                await ws.send_json({
                    "type": "orb_state",
                    "orb_state": "processing",
                })

                t0 = time.time()

                # Run the dialogue manager in thread pool (it calls LLM synchronously)
                loop = asyncio.get_event_loop()
                ui = await loop.run_in_executor(
                    None,
                    dm.process_patient_input,
                    input_type,
                    value,
                )
                dm.record.macro_state = dm.fsm.state

                elapsed = time.time() - t0
                logger.info(f"DialogueManager.process_patient_input took {elapsed:.2f}s | state={dm.fsm.state}")

                await ws.send_json({"type": "ui", **ui})

            elif msg_type == "redflag":
                if dm:
                    ui = dm.process_redflag()
                    await ws.send_json({"type": "ui", **ui})

            elif msg_type == "clear_redflag":
                if dm:
                    loop = asyncio.get_event_loop()
                    ui = await loop.run_in_executor(None, dm.clear_redflag)
                    await ws.send_json({"type": "ui", **ui})

            elif msg_type == "get_record":
                if dm:
                    await ws.send_json({"type": "record", **dm.get_record()})
                else:
                    await ws.send_json({"type": "error", "message": "No active session"})

            else:
                await ws.send_json({"type": "error", "message": f"Unknown type: {msg_type}"})

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
