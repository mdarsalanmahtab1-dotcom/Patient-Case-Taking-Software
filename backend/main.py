"""
SwasthyaSync — FastAPI Backend Server (Optimized)

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
import time
import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from contextlib import asynccontextmanager
from typing import List
from dotenv import load_dotenv

load_dotenv()  # Load .env before anything else

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import os

os.makedirs("uploads", exist_ok=True)

from dialogue_manager import DialogueManager
from ocr_pipeline import process_document
import sarvam_client
from routes_extended import extended_router, set_sessions_ref, escalate_queue_priority
from routes_admin import admin_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# In-memory session store (for hackathon; would be Redis/DB in production)
sessions: dict[str, DialogueManager] = {}

async def cleanup_stale_sessions():
    """Background task to remove sessions inactive for > 30 mins."""
    import time
    while True:
        try:
            await asyncio.sleep(60)  # Check every minute
            now = time.time()
            stale_keys = [
                sid for sid, dm in sessions.items()
                if (now - getattr(dm, 'last_active_time', now)) > 1800
            ]
            for sid in stale_keys:
                logger.info(f"Purging stale session: {sid}")
                sessions.pop(sid, None)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Error in cleanup task: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("SwasthyaSync backend starting...")
    from database import setup_database
    await setup_database()
    from pdf_generator import pdf_engine
    try:
        await pdf_engine.start()
        logger.info("PDFEngine started.")
    except Exception as e:
        logger.error(f"Failed to start PDFEngine: {e}")
        
    cleanup_task = asyncio.create_task(cleanup_stale_sessions())
    
    yield
    
    logger.info("SwasthyaSync backend shutting down.")
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    try:
        await pdf_engine.stop()
        logger.info("PDFEngine stopped.")
    except Exception as e:
        logger.error(f"Failed to stop PDFEngine: {e}")

app = FastAPI(
    title="SwasthyaSync API",
    description="AI-powered clinical history-taking engine",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — allow the Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(extended_router)
app.include_router(admin_router)
set_sessions_ref(sessions)  # Bridge: let routes_extended read live PatientRecord data

os.makedirs("static/prescriptions", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


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
    logger.info(f"Starting OCR upload for session_id: {session_id}, filename: {file.filename}")
    image_bytes = await file.read()
    content_type = file.content_type or "image/jpeg"
    
    from supabase import create_client
    import uuid
    safe_filename = f"{uuid.uuid4().hex[:8]}_{file.filename or 'doc.jpg'}"
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")

    if not (supabase_url and supabase_key):
        raise HTTPException(status_code=500, detail="Supabase configuration is missing.")

    supabase = create_client(supabase_url, supabase_key)
    storage_path = f"patient-documents/{safe_filename}"
    try:
        supabase.storage.from_("patient-records").upload(
            file=image_bytes,
            path=storage_path,
            file_options={"content-type": content_type}
        )
        url_resp = supabase.storage.from_("patient-records").create_signed_url(storage_path, 2592000)
        storage_path = url_resp.get("signedURL", storage_path)
    except Exception as e:
        logger.error(f"Supabase upload error: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload document to cloud storage.")
        
    result = await process_document(image_bytes, filename=file.filename or "doc.jpg", media_type=content_type)
    result["image_url"] = storage_path

    # If we have a session, merge OCR entities into the patient record
    logger.info(f"upload_document received session_id: {session_id}, in sessions? {session_id in sessions}")
    if session_id and session_id in sessions:
        logger.info(f"Found session in upload_document: {session_id}")
        logger.info(f"Entities to append: meds={len(result.get('medications', []))}, diags={len(result.get('diagnoses', []))}")
        dm = sessions[session_id]
        from patient_record import DocumentExtraction
        import database
        
        # Save to DB via asyncpg
        meds = result.get("medications", [])
        labs = result.get("lab_values", [])
        doc_id = await database.save_uploaded_document(
            session_id=session_id,
            file_path=storage_path,
            document_type=result.get("document_type", "OTHER"),
            ocr_raw=result,
            medications=meds,
            labs=labs
        )
        
        doc_ext = DocumentExtraction(
            doc_id=doc_id,
            doc_type=result.get("document_type", "unknown"),
            ocr_path=storage_path,
            entities=[result],
        )
        dm.record.document_extractions.append(doc_ext)
        
        # Pre-calculate unverifiable values so they can be shown in Screen 6
        from document_red_flags import check_document_flags
        check_document_flags([doc_ext.model_dump()], dm.record)

    return result

@app.post("/api/ocr/batch")
async def upload_document_batch(
    files: List[UploadFile] = File(...),
    session_id: str = Form(""),
    patient_name: str = Form("Unknown Patient")
):
    """Upload multiple document images for batch OCR processing."""
    if len(files) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 images allowed per batch.")

    image_bytes_list = []
    media_types = []
    storage_paths = []
    
    from supabase import create_client
    import uuid
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    if not (supabase_url and supabase_key):
        raise HTTPException(status_code=500, detail="Supabase configuration is missing.")
        
    supabase = create_client(supabase_url, supabase_key)
    
    for file in files:
        img_bytes = await file.read()
        image_bytes_list.append(img_bytes)
        ctype = file.content_type or "image/jpeg"
        media_types.append(ctype)
        
        safe_filename = f"{uuid.uuid4().hex[:8]}_{file.filename or 'doc.jpg'}"
        storage_path = f"patient-documents/{safe_filename}"
        try:
            supabase.storage.from_("patient-records").upload(
                file=img_bytes, path=storage_path, file_options={"content-type": ctype}
            )
            url_resp = supabase.storage.from_("patient-records").create_signed_url(storage_path, 2592000)
            storage_paths.append(url_resp.get("signedURL", storage_path))
        except Exception as e:
            logger.error(f"Supabase upload error: {e}")
            raise HTTPException(status_code=500, detail="Failed to upload document to cloud storage.")

    from ocr_pipeline import process_batch_ocr
    result = await process_batch_ocr(image_bytes_list, media_types, patient_name)
    
    if not result.get("is_valid_medical_document") or result.get("name_match") is False:
        return {"status": "rejected", "reason": result.get("rejection_reason", "Document rejected due to patient name mismatch or invalid format.")}
        
    logger.info(f"batch upload received session_id: {session_id}, in sessions? {session_id in sessions}")
    if session_id and session_id in sessions:
        dm = sessions[session_id]
        from patient_record import DocumentExtraction
        import database
        
        # Save to DB via asyncpg
        doc_id = await database.save_uploaded_document(
            session_id=session_id,
            file_path=",".join(storage_paths), # Multiple paths for PDF attachment later
            document_type=result.get("document_type", "batch"),
            ocr_raw=result,
            medications=result.get("medications", []),
            labs=result.get("lab_values", [])
        )
        
        doc_ext = DocumentExtraction(
            doc_id=doc_id,
            doc_type=result.get("document_type", "batch"),
            ocr_path=",".join(storage_paths),
            entities=[result],
        )
        dm.record.document_extractions.append(doc_ext)
            
        from document_red_flags import check_document_flags
        doc_extractions_raw = [ext.model_dump() for ext in dm.record.document_extractions]
        check_document_flags(doc_extractions_raw, dm.record)

    return {"status": "success", "results": [result]}

@app.get("/api/record/{session_id}/timeline")
async def get_patient_timeline(session_id: str):
    """Get a chronologically sorted timeline of patient documents with red flags."""
    dm = sessions.get(session_id)
    if not dm:
        return {"error": "Session not found"}
        
    from datetime import datetime
    
    docs = []
    for ext in dm.record.document_extractions:
        for ent in ext.entities:
            docs.append(ent)
            
    def parse_sort_date(doc: dict):
        issue_date = doc.get("issue_date")
        if not issue_date:
            return datetime.max
        try:
            return datetime.strptime(issue_date, "%Y-%m-%d")
        except ValueError:
            return datetime.max

    sorted_docs = sorted(docs, key=parse_sort_date)

    red_flags = []
    for doc in sorted_docs:
        for lab in doc.get("lab_values", []):
            if lab.get("is_abnormal"):
                test_name = lab.get("test_name", "Unknown Test")
                val = lab.get("value", "")
                unit = lab.get("unit", "")
                reason = lab.get("flag_reason", "Abnormal")
                red_flags.append(f"{test_name}: {val} {unit} — {reason}")

    return {
        "session_id": session_id,
        "total_documents": len(sorted_docs),
        "documents": sorted_docs,
        "critical_red_flags": red_flags
    }


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
@app.websocket("/ws/intake")
async def websocket_session(ws: WebSocket, session_id: str = Query(None)):
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

    if session_id and session_id in sessions:
        dm = sessions[session_id]
        logger.info(f"Rehydrated session: {session_id}")
        ui = dm.resume_session()
        await ws.send_json({"type": "ui", **ui})

    try:
        while True:
            raw = await ws.receive_text()
            try:
                import json as _json
                msg = _json.loads(raw)
            except _json.JSONDecodeError:
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
                patient_weight = msg.get("patient_weight")
                patient_height = msg.get("patient_height")
                patient_vitals = msg.get("patient_vitals")
                if patient_name or patient_age or patient_sex:
                    dm.set_demographics(
                        name=patient_name,
                        age=int(patient_age) if patient_age else None,
                        sex=patient_sex,
                        weight=float(patient_weight) if patient_weight else None,
                        height=patient_height,
                        vitals=patient_vitals,
                    )
                
                # Check for follow-up history
                previous_history = msg.get("previous_history")
                if previous_history:
                    dm.set_previous_history(previous_history)

                # Bridge: set patient_id so summaries/queue can find this patient
                patient_id = msg.get("patient_id")
                if patient_id:
                    dm.record.patient_id = patient_id

                # If a pre-created session_id was provided, use it instead of auto-generated
                provided_session_id = msg.get("session_id")
                if provided_session_id:
                    dm.record.session_id = provided_session_id
                    try:
                        import database
                        if database._pool:
                            async with database._pool.acquire() as conn:
                                doc_data = await conn.fetchrow("""
                                    SELECT d.custom_instructions
                                    FROM patient_sessions ps
                                    JOIN doctors d ON ps.doctor_id = d.doctor_id
                                    WHERE ps.session_id = $1
                                """, provided_session_id)
                                if doc_data and doc_data['custom_instructions']:
                                    dm.record.doctor_custom_instructions = doc_data['custom_instructions']
                    except Exception as e:
                        logger.error(f"Failed to fetch doctor custom instructions: {e}")

                ui = dm.start_session()
                sessions[dm.record.session_id] = dm
                logger.info(f"Session started: {dm.record.session_id} | lang={language} | mode={clinic_mode} | name={patient_name} | patient_id={patient_id}")
                await ws.send_json({"type": "ui", **ui})

            elif msg_type == "resume":
                provided_session_id = msg.get("session_id")
                if provided_session_id and provided_session_id in sessions:
                    dm = sessions[provided_session_id]
                    logger.info(f"Session resumed: {dm.record.session_id}")
                    ui = dm.resume_session()
                    await ws.send_json({"type": "ui", **ui})
                else:
                    await ws.send_json({"type": "error", "message": "Session not found or expired"})

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

                prev_state = dm.fsm.state if hasattr(dm, 'fsm') else ""
                
                # Run the dialogue manager in thread pool (it calls LLM synchronously)
                loop = asyncio.get_event_loop()
                ui = await loop.run_in_executor(
                    None,
                    dm.process_patient_input,
                    input_type,
                    value,
                )
                dm.record.macro_state = dm.fsm.state

                new_state = dm.fsm.state if hasattr(dm, 'fsm') else ""

                logger.info(f"State transition: {prev_state} -> {new_state} | session={dm.record.session_id}")

                # --- Gap A & Timing ---
                # Check safety ALONE after interview completes
                if prev_state == "DYNAMIC_INTERVIEW" and new_state == "DOCUMENT_SCAN":
                    import red_flag_library
                    flags = red_flag_library.check_safety(dm.record.filled_state)
                    if flags:
                        existing_ids = {f.rule_id for f in dm.record.red_flags}
                        new_flags = [f for f in flags if f.rule_id not in existing_ids]
                        if new_flags:
                            dm.record.red_flags.extend(new_flags)
                            reasons = "; ".join(f"{f.rule_id}: {f.description}" for f in new_flags)
                            escalate_queue_priority(dm.record.session_id, reasons)
                            
                # PDF Generation fires on-demand via the GET endpoint in routes_extended.py

                # Bridge: if red flags fired (from dialogue), escalate queue priority automatically
                if dm.record.red_flags and dm.fsm.state == "EMERGENCY_PROTOCOL":
                    latest_flag = dm.record.red_flags[-1]
                    escalate_queue_priority(
                        dm.record.session_id,
                        f"{latest_flag.rule_id}: {latest_flag.description}"
                    )

                # --- NEW: Safely save the session state to DB in the async loop ---
                try:
                    import database
                    record_payload = {
                        "filled_state": dm.record.filled_state,
                        "document_extractions": [e.model_dump() for e in dm.record.document_extractions],
                        "red_flags": [r.model_dump() for r in dm.record.red_flags]
                    }
                    has_red_flags = len(dm.record.red_flags) > 0
                    await database.commit_fsm_checkpoint(
                        session_id=dm.record.session_id,
                        filled_state=record_payload,
                        chief_complaint=str(dm.record.chief_complaint.value or "") if dm.record.chief_complaint else "",
                        interview_qa=dm.record.conversation_history,
                        priority_flag=has_red_flags,
                        status="IN_PROGRESS"
                    )
                except Exception as e:
                    logger.error(f"🚨 Checkpoint failed for session {dm.record.session_id} - {e}")

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
        # Session intentionally left in memory for rehydration
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
