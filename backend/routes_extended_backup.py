"""
SwasthyaSync — Extended Routes (Phase 1–5)

All new routes live here. Legacy main.py endpoints are untouched.
This module shares the `sessions` dict from main.py (injected at import time)
so that the queue system can read real PatientRecord state.
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import uuid
import json
import os
import logging
import hashlib
import secrets

logger = logging.getLogger(__name__)

extended_router = APIRouter()

import base64

def get_logo_b64() -> str:
    logo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "src", "assets", "logo.png")
    try:
        with open(logo_path, "rb") as f:
            encoded = base64.b64encode(f.read()).decode("utf-8")
            return f"data:image/png;base64,{encoded}"
    except Exception as e:
        logger.warning(f"Could not load logo for PDF: {e}")
        return ""

# ─────────────────────────────────────────────────────────────────────
# SQLite persistence (survives restarts)
# ─────────────────────────────────────────────────────────────────────
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), "swasthyasync.db")

def _get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def _init_db():
    conn = _get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS summaries (
            summary_id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            type TEXT NOT NULL,
            content TEXT,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS queue (
            token_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL UNIQUE,
            patient_id TEXT NOT NULL,
            priority_flag INTEGER DEFAULT 0,
            priority_reason TEXT,
            status TEXT DEFAULT 'waiting',
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS staff (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            password_hash TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS doctor_roster (
            doctor_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            department TEXT NOT NULL,
            room_number TEXT NOT NULL,
            shift TEXT NOT NULL
        );
    """)
    # Additive migration for pdf_path
    try:
        conn.execute("ALTER TABLE summaries ADD COLUMN pdf_path TEXT;")
    except sqlite3.OperationalError:
        pass # Column already exists
    conn.commit()
    conn.close()
    logger.info(f"SQLite database initialized at {DB_PATH}")

_init_db()


# ─────────────────────────────────────────────────────────────────────
# RBAC — real JWT-like token validation
# ─────────────────────────────────────────────────────────────────────
# For hackathon: simple token = "role:staff_id:random". Not crypto-grade
# but actually enforced — routes check the role before proceeding.

_active_tokens: dict[str, dict] = {}  # token_str -> {id, role, name}
security = HTTPBearer(auto_error=False)

def _hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

def _issue_token(staff_id: str, role: str, name: str) -> str:
    token = f"{role}:{staff_id}:{secrets.token_hex(8)}"
    _active_tokens[token] = {"id": staff_id, "role": role, "name": name}
    return token

def _get_current_staff(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not credentials:
        raise HTTPException(401, "Missing auth token")
    info = _active_tokens.get(credentials.credentials)
    if not info:
        raise HTTPException(401, "Invalid or expired token")
    return info

def _require_role(*allowed_roles):
    """Dependency factory: rejects requests whose token role is not in allowed_roles."""
    def checker(staff: dict = Depends(_get_current_staff)):
        if staff["role"] not in allowed_roles:
            raise HTTPException(403, f"Role '{staff['role']}' not authorized. Requires: {allowed_roles}")
        return staff
    return checker


# ─────────────────────────────────────────────────────────────────────
# Bridge: access the live DialogueManager sessions from main.py
# ─────────────────────────────────────────────────────────────────────
# main.py calls `set_sessions_ref(sessions)` after import so we can
# read PatientRecord data without circular imports.

_sessions_ref: dict = {}

def set_sessions_ref(ref: dict):
    global _sessions_ref
    _sessions_ref = ref

def _get_dm(session_id: str):
    """Get a live DialogueManager by session_id, or None."""
    return _sessions_ref.get(session_id)


# ─────────────────────────────────────────────────────────────────────
# Queue priority bridge: called FROM dialogue_manager when red flag fires
# ─────────────────────────────────────────────────────────────────────

def escalate_queue_priority(session_id: str, reason: str):
    """
    Called directly by the dialogue manager when a safety watchdog rule fires.
    This is the REAL wiring — not an HTTP endpoint the user calls manually.
    """
    conn = _get_db()
    row = conn.execute("SELECT token_id FROM queue WHERE session_id = ?", (session_id,)).fetchone()
    if row:
        conn.execute(
            "UPDATE queue SET priority_flag = 1, priority_reason = ? WHERE session_id = ?",
            (reason, session_id)
        )
        conn.commit()
        logger.warning(f"🚨 QUEUE ESCALATED: session={session_id} reason={reason}")
    else:
        logger.warning(f"Queue escalation requested but no queue entry for session {session_id}")
    conn.close()


# ═════════════════════════════════════════════════════════════════════
# API ROUTES
# ═════════════════════════════════════════════════════════════════════

# ── Phase 1: Staff Auth ──────────────────────────────────────────────

class StaffLoginReq(BaseModel):
    username: str
    password: str

@extended_router.post("/api/auth/staff/login")
async def staff_login(req: StaffLoginReq):
    conn = _get_db()
    row = conn.execute("SELECT * FROM staff WHERE name = ?", (req.username,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(401, "Invalid credentials")
    if row["password_hash"] != _hash_password(req.password):
        raise HTTPException(401, "Invalid credentials")
    token = _issue_token(row["id"], row["role"], row["name"])
    return {"token": token, "role": row["role"], "name": row["name"], "staff_id": row["id"]}

@extended_router.post("/api/auth/staff/logout")
async def staff_logout(staff: dict = Depends(_get_current_staff)):
    # Revoke token
    for tok, info in list(_active_tokens.items()):
        if info["id"] == staff["id"]:
            del _active_tokens[tok]
    return {"status": "logged_out"}

class StaffCreateReq(BaseModel):
    name: str
    role: str  # RECEPTIONIST, NURSE, DOCTOR, ADMIN
    password: str

@extended_router.post("/api/auth/staff/register")
async def staff_register(req: StaffCreateReq):
    """Bootstrap route to create staff. In production, this would be admin-only."""
    staff_id = f"stf_{uuid.uuid4().hex[:8]}"
    conn = _get_db()
    try:
        conn.execute(
            "INSERT INTO staff (id, name, role, password_hash) VALUES (?, ?, ?, ?)",
            (staff_id, req.name, req.role, _hash_password(req.password))
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(409, "Staff name already exists")
    conn.close()
    return {"staff_id": staff_id, "name": req.name, "role": req.role}


# ── Phase 2: Patient Identity & Session ──────────────────────────────

import database

class StartSessionPayload(BaseModel):
    patient_id: Optional[str] = None
    full_name: Optional[str] = None
    phone_number: str
    age: Optional[int] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None
    weight: Optional[float] = None
    height: Optional[str] = None
    address: Optional[str] = None
    abha_id: Optional[str] = None
    department: str
    doctor_id: Optional[str] = None

@extended_router.get("/api/auth/check-phone/{phone_number}")
async def check_phone(phone_number: str):
    """Returns a list of patients registered under this phone number."""
    patients = database.get_patients_by_phone(phone_number)
    for p in patients:
        last_visit = database.fetch_previous_history(p["patient_id"])
        if last_visit:
            p["last_visit"] = {
                "chief_complaint": last_visit.get("chief_complaint"),
                "completed_at": last_visit.get("completed_at"),
                "department": last_visit.get("department"),
            }
        else:
            p["last_visit"] = None
    return {"patients": patients}

@extended_router.get("/api/doctors")
async def get_doctors():
    import database
    doctors = database.get_active_doctors()
    return {"doctors": doctors}

@extended_router.get("/api/departments")
async def get_departments():
    conn = _get_db()
    cursor = conn.cursor()
    # If is_default column does not exist on older DBs, we'll try to query it or just return without it
    # We added it via ALTER TABLE earlier so it should exist
    try:
        cursor.execute("SELECT dept_id, name, is_default FROM departments")
        departments = [dict(row) for row in cursor.fetchall()]
    except Exception:
        cursor.execute("SELECT dept_id, name FROM departments")
        departments = [dict(row) for row in cursor.fetchall()]
        for d in departments: d["is_default"] = False
    conn.close()
    return {"departments": departments}

@extended_router.post("/api/session/start")
async def create_session(payload: StartSessionPayload):
    """Creates the patient (if new) and generates a collision-free token."""
    previous_history = None
    previous_history_json_str = None
    if payload.patient_id:
        previous_history = database.fetch_previous_history(payload.patient_id)
        if previous_history:
            previous_history_json_str = json.dumps(previous_history, default=str)

    db_data = database.start_kiosk_session(
        patient_data=payload.dict(),
        department=payload.department,
        previous_history_json=previous_history_json_str,
        doctor_id=payload.doctor_id
    )
    
    if db_data.get("conflict"):
        raise HTTPException(status_code=409, detail={"message": "Active session already exists", "existing_token": db_data.get("existing_token")})
    
    # Auto-enqueue the new session into the queue table so it shows up in Triage Dashboard
    conn = _get_db()
    now = datetime.utcnow().isoformat()
    conn.execute(
        "INSERT INTO queue (token_id, session_id, patient_id, priority_flag, status, created_at) VALUES (?, ?, ?, 0, 'waiting', ?)",
        (db_data["token_id"], db_data["session_id"], db_data["patient_id"], now)
    )
    conn.commit()
    conn.close()
    
    return {
        **db_data,
        "is_followup": previous_history is not None,
        "previous_history": previous_history if previous_history else None
    }


# ── Phase 2–3: Summaries (real content from PatientRecord) ───────────

@extended_router.post("/api/summary/{session_id}/doctor")
async def generate_doctor_summary(session_id: str, staff: dict = Depends(_require_role("DOCTOR", "ADMIN"))):
    """Doctor finalizes their consultation note."""
    conn = _get_db()
    sess = conn.execute("SELECT * FROM patient_sessions WHERE session_id = ?", (session_id,)).fetchone()
    if not sess:
        conn.close()
        raise HTTPException(404, "Session not found")
    
    # Pull real data
    dm = _get_dm(session_id)
    content = {}
    if dm:
        record = dm.record
        content = {
            "patient_name": record.patient_name,
            "chief_complaint": record.chief_complaint.value if record.chief_complaint else None,
            "filled_state": {k: v for k, v in record.filled_state.items() if isinstance(v, dict) and v.get("value")},
            "red_flags": [{"rule_id": f.rule_id, "description": f.description} for f in record.red_flags],
            "finalized_by": staff["name"],
            "finalized_role": staff["role"],
        }
    
    summary_id = f"sum_{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow().isoformat()
    conn.execute(
        "INSERT INTO summaries (summary_id, patient_id, session_id, type, content, created_at) VALUES (?, ?, ?, 'doctor', ?, ?)",
        (summary_id, sess["patient_id"], session_id, json.dumps(content, default=str), now)
    )
    conn.commit()
    conn.close()
    
    return {"summary_id": summary_id, "type": "doctor", "session_id": session_id, "content": content}

from fastapi.responses import FileResponse

@extended_router.get("/api/summary/{session_id}/pdf")
async def get_summary_pdf(session_id: str):
    conn = _get_db()
    # Try by session_id first (what the frontend sends), then fall back to summary_id
    row = conn.execute(
        "SELECT summary_id, pdf_file_path FROM clinical_summaries WHERE session_id = ? AND pdf_file_path IS NOT NULL ORDER BY generated_at DESC LIMIT 1",
        (session_id,)
    ).fetchone()
    if not row:
        # Fallback: maybe they passed a summary_id directly
        row = conn.execute("SELECT summary_id, pdf_file_path FROM clinical_summaries WHERE summary_id = ?", (session_id,)).fetchone()
    
    if row and row["pdf_file_path"] and os.path.exists(row["pdf_file_path"]):
        conn.close()
        return FileResponse(row["pdf_file_path"], media_type="application/pdf", filename=f"{row['summary_id']}.pdf")
    
    # ── On-demand PDF generation fallback ──
    # If no pre-generated PDF exists, generate it now from the live session
    dm = _get_dm(session_id)
    
    q_row = conn.execute("SELECT priority_flag, priority_reason, token_id FROM queue WHERE session_id = ?", (session_id,)).fetchone()
    p_sess = conn.execute("SELECT chief_complaint, patient_id, doctor_prescription FROM patient_sessions WHERE session_id = ?", (session_id,)).fetchone()
    p_info = None
    if p_sess:
        p_info = conn.execute("SELECT full_name, age, gender FROM patients WHERE patient_id = ?", (p_sess["patient_id"],)).fetchone()
        
    try:
        from pdf_generator import generate_summary_pdf
        
        extracted_medications = []
        extracted_labs = []
        uploaded_images = []
        
        if dm:
            from llm_client import generate_clinical_summary
            raw_extractions = [ext.model_dump() for ext in dm.record.document_extractions]
            for ext in raw_extractions:
                if "medications" in ext:
                    for med in ext["medications"]:
                        extracted_medications.append({
                            "name": med.get("name", ""),
                            "dosage": med.get("dose", ""),
                            "frequency": med.get("frequency", "")
                        })
                if "lab_results" in ext:
                    for lab in ext["lab_results"]:
                        extracted_labs.append({
                            "parameter": lab.get("test", ""),
                            "value": f"{lab.get('result', '')} {lab.get('unit', '')}",
                            "is_abnormal": str(lab.get("status", "")).lower() not in ["normal", ""]
                        })
            ocr_data = {
                "extracted_medications": extracted_medications,
                "extracted_labs": extracted_labs
            }
            
            uploaded_images = [
                os.path.join(os.path.dirname(__file__), ext.ocr_path.lstrip("/"))
                for ext in dm.record.document_extractions if ext.ocr_path
            ]
            
            # 1. Synthesize narrative using LLM
            ai_summary = generate_clinical_summary(dm.record.filled_state, raw_extractions)
        else:
            # Fallback dumb summary
            ai_summary = {
                "Narrative": p_sess["chief_complaint"] if p_sess else "No complaint recorded",
                "Assessment": ["Session restored from database (Legacy mode)"]
            }
            ocr_data = {
                "extracted_medications": [],
                "extracted_labs": []
            }
            
        prev_hist_raw = p_sess["previous_history_json"] if p_sess and "previous_history_json" in p_sess.keys() else None
        previous_history = json.loads(prev_hist_raw) if prev_hist_raw else None
        
        # Retroactive fix: if the session was created before pdf_file_path was added to history snapshot
        if previous_history and not previous_history.get("pdf_file_path"):
            old_session_id = previous_history.get("session_id")
            if old_session_id:
                try:
                    old_sum = conn.execute("SELECT pdf_file_path FROM clinical_summaries WHERE session_id = ?", (old_session_id,)).fetchone()
                    if old_sum and old_sum["pdf_file_path"]:
                        previous_history["pdf_file_path"] = old_sum["pdf_file_path"]
                except Exception as e:
                    logger.error(f"Failed to dynamically fetch old PDF path: {e}")

        # 2. Build template context
        context = {
            "patient": {
                "token": q_row["token_id"] if q_row else "",
                "abha_id": "Not Provided",
                "name": p_info["full_name"] if p_info else "Unknown",
                "gender": p_info["gender"] if p_info else "Unknown",
                "age": str(p_info["age"]) if p_info else "Unknown",
                "phone": "Not Provided",
                "visit_type": "OPD Intake"
            },
            "timestamp": datetime.utcnow().strftime("%d/%m/%Y %I:%M %p"),
            "department": "General Medicine",
            "doctor_name": "Duty Medical Officer",
            "room_no": "OPD Room 01",
            "vitals": {}, 
            "red_flag_active": bool(q_row["priority_flag"]) if q_row else False,
            "triage_reason": q_row["priority_reason"] if q_row else "",
            "ai_summary": ai_summary,
            "ocr_data": ocr_data,
            "uploaded_images": uploaded_images,
            "doctor_prescription": p_sess["doctor_prescription"] if p_sess and "doctor_prescription" in p_sess.keys() else "",
            "logo_b64": get_logo_b64(),
            "hospital_name": "SwasthyaSync Healthcare",
            "hospital_subtext": "Center for Clinical Excellence & OPD Intake",
            "previous_history": previous_history
        }
        
        # 3. Generate PDF (async)
        pdf_bytes = await generate_summary_pdf(session_id, context)
        
        # Merge previous PDF if it exists
        if previous_history and previous_history.get("pdf_file_path") and os.path.exists(previous_history["pdf_file_path"]):
            import PyPDF2
            import io
            try:
                merger = PyPDF2.PdfMerger()
                merger.append(io.BytesIO(pdf_bytes))
                merger.append(previous_history["pdf_file_path"])
                
                out_stream = io.BytesIO()
                merger.write(out_stream)
                merger.close()
                pdf_bytes = out_stream.getvalue()
            except Exception as merge_err:
                logger.error(f"Failed to merge previous PDF: {merge_err}")

        summary_id = f"sum_{uuid.uuid4().hex[:8]}"
        pdf_dir = os.path.join(os.path.dirname(__file__), "generated_pdfs")
        os.makedirs(pdf_dir, exist_ok=True)
        pdf_path = os.path.join(pdf_dir, f"{summary_id}.pdf")
        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)
        
        # Save to DB for future requests
        import database
        try:
            database.save_clinical_summary(
                session_id=session_id,
                small_summary=ai_summary.get("Narrative", ""),
                full_detailed_summary=json.dumps(ai_summary),
                critical_highlights=ai_summary.get("Assessment", []),
                contradictions_found=[c.model_dump() for c in getattr(dm.record, 'contradictions', [])] if dm and hasattr(dm.record, 'contradictions') else [],
                pdf_file_path=pdf_path
            )
        except Exception as db_err:
            logger.error(f"Failed to save clinical summary to DB (likely session not in patient_sessions): {db_err}")
        
        # Keep legacy summaries insert to avoid breaking old dashboards immediately
        sess = conn.execute("SELECT patient_id FROM patient_sessions WHERE session_id = ?", (session_id,)).fetchone()
        if sess:
            now = datetime.utcnow().isoformat()
            conn.execute(
                "INSERT INTO summaries (summary_id, patient_id, session_id, type, content, created_at, pdf_path) VALUES (?, ?, ?, 'kiosk', ?, ?, ?)",
                (summary_id, sess["patient_id"], session_id, json.dumps({"note": "On-demand PDF"}), now, pdf_path)
            )
            conn.commit()
        conn.close()
        
        logger.info(f"On-demand PDF generated for session {session_id} at {pdf_path}")
        return FileResponse(pdf_path, media_type="application/pdf", filename=f"SwasthyaSync_Summary_{session_id}.pdf")
    except Exception as e:
        conn.close()
        logger.error(f"On-demand PDF generation failed: {e}", exc_info=True)
        raise HTTPException(500, f"PDF generation failed: {str(e)}")

@extended_router.get("/api/patient/{patient_id}/summaries")
async def get_patient_summaries(patient_id: str):
    conn = _get_db()
    rows = conn.execute(
        "SELECT c.summary_id, c.session_id, p.patient_id, c.full_detailed_summary as content, c.generated_at as created_at, c.pdf_file_path as pdf_path FROM clinical_summaries c JOIN patient_sessions p ON c.session_id = p.session_id WHERE p.patient_id = ? ORDER BY c.generated_at DESC", (patient_id,)
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        entry = dict(r)
        # Parse stored JSON content back to dict
        if entry.get("content"):
            try:
                entry["content"] = json.loads(entry["content"])
            except (json.JSONDecodeError, TypeError):
                pass
        result.append(entry)
    return result


# ── Phase 2.5: OCR Confirmation (Screen 6 hook) ─────────────────────
# This is where both filled_state AND document_extractions first exist
# together.  We run contradiction checker + document red flag checker here.

from contradiction_checker import check_contradictions
from document_red_flags import check_document_flags

@extended_router.post("/api/ocr/{session_id}/confirm")
async def confirm_document_extraction(session_id: str):
    """
    Called when the patient taps 'Looks Good, Continue' on Screen 6.
    
    1. Runs contradiction checker (conv vs. doc) → stores on PatientRecord
    2. Runs document red flag checker (critical labs) → appends to red_flags
    3. If document red flags fire → escalates queue priority immediately
    
    Returns the contradictions and any new red flags for the frontend to display.
    """
    dm = _get_dm(session_id)
    if not dm:
        raise HTTPException(404, "Session not found or not in memory")
    
    record = dm.record
    
    # Serialize document extractions for the checkers
    doc_extractions_raw = [ext.model_dump() for ext in record.document_extractions]
    
    # ── Gap A: Contradiction check ──
    contradictions = check_contradictions(
        filled_state=record.filled_state,
        document_extractions=doc_extractions_raw,
    )
    # Store on the PatientRecord (additive — don't overwrite prior contradictions)
    from patient_record import Contradiction as ContrModel
    for c in contradictions:
        record.contradictions.append(ContrModel(
            field=c["field"],
            conversation_value=c["conversation_value"],
            document_value=c["document_value"],
            status=c["status"],
        ))
    
    # ── Gap B: Document red flag check ──
    doc_flags = check_document_flags(doc_extractions_raw, record)
    # Additive union with conversational red flags — never replace
    existing_rule_ids = {f.rule_id for f in record.red_flags}
    new_flags = [f for f in doc_flags if f.rule_id not in existing_rule_ids]
    record.red_flags.extend(new_flags)
    
    # If any document red flags fired → escalate queue priority RIGHT NOW.
    # The patient is still in the queue at this point.
    if new_flags:
        reasons = "; ".join(f"{f.rule_id}: {f.description}" for f in new_flags)
        escalate_queue_priority(session_id, reasons)
        logger.warning(f"🚨 Document red flags escalated queue for session={session_id}: {reasons}")
    
    return {
        "session_id": session_id,
        "contradictions": contradictions,
        "new_red_flags": [f.model_dump() for f in new_flags],
        "total_red_flags": len(record.red_flags),
        "total_contradictions": len(record.contradictions),
    }


# ── Phase 3: Queue ───────────────────────────────────────────────────

@extended_router.get("/api/queue")
async def get_queue():
    """Live queue sorted by priority DESC, then FIFO."""
    conn = _get_db()
    rows = conn.execute(
        "SELECT q.*, p.full_name as patient_name, p.phone_number as phone, p.age, p.gender "
        "FROM queue q JOIN patients p ON q.patient_id = p.patient_id "
        "WHERE q.status != 'completed' "
        "ORDER BY q.priority_flag DESC, q.created_at ASC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

class PriorityUpdate(BaseModel):
    priority_flag: bool

@extended_router.patch("/api/queue/{token_id}/priority")
async def update_queue_priority(token_id: str, payload: PriorityUpdate, staff: dict = Depends(_require_role("NURSE", "DOCTOR", "ADMIN"))):
    conn = _get_db()
    row = conn.execute("SELECT * FROM queue WHERE token_id = ?", (token_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Token not found")
    conn.execute(
        "UPDATE queue SET priority_flag = ? WHERE token_id = ?",
        (int(payload.priority_flag), token_id)
    )
    conn.commit()
    updated = dict(conn.execute("SELECT * FROM queue WHERE token_id = ?", (token_id,)).fetchone())
    conn.close()
    return updated

class StatusUpdate(BaseModel):
    status: str

@extended_router.patch("/api/queue/{token_id}/status")
async def update_queue_status(token_id: str, payload: StatusUpdate):
    conn = _get_db()
    row = conn.execute("SELECT * FROM queue WHERE token_id = ?", (token_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Token not found")
    conn.execute("UPDATE queue SET status = ? WHERE token_id = ?", (payload.status, token_id))
    conn.commit()
    updated = dict(conn.execute("SELECT * FROM queue WHERE token_id = ?", (token_id,)).fetchone())
    conn.close()
    return updated

@extended_router.get("/api/queue/token/{session_id}")
async def get_queue_token(session_id: str):
    """Get token information for the completion screen."""
    import database
    conn = database.get_connection()
    try:
        # Fetch from patient_sessions and doctors
        row = conn.execute('''
            SELECT ps.token_number, ps.token_id, d.full_name as doctor_name, d.room_number 
            FROM patient_sessions ps
            LEFT JOIN doctors d ON ps.doctor_id = d.doctor_id
            WHERE ps.session_id = ?
        ''', (session_id,)).fetchone()
        
        if not row:
            raise HTTPException(404, "Session not found")
            
        return {
            "token": row["token_number"] or row["token_id"],
            "doctor_name": row["doctor_name"],
            "room_number": row["room_number"],
            "position": row["token_number"] or 1
        }
    finally:
        conn.close()


# ── Phase 4: Doctor Dashboard ────────────────────────────────────────

@extended_router.get("/api/doctors")
async def get_doctors():
    conn = _get_db()
    rows = conn.execute("SELECT * FROM doctor_roster").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@extended_router.get("/api/doctor/{doctor_id}/queue")
async def get_doctor_queue(doctor_id: str, staff: dict = Depends(_require_role("DOCTOR", "ADMIN"))):
    conn = _get_db()
    rows = conn.execute(
        "SELECT q.*, p.full_name as patient_name, p.phone_number as phone, p.age, p.gender "
        "FROM queue q JOIN patients p ON q.patient_id = p.patient_id "
        "WHERE q.status != 'completed' "
        "ORDER BY q.priority_flag DESC, q.created_at ASC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@extended_router.get("/api/doctor/patient/{session_id}")
async def get_doctor_patient_view(session_id: str, staff: dict = Depends(_require_role("DOCTOR", "NURSE", "ADMIN"))):
    """Returns the REAL patient record for a doctor to review."""
    dm = _get_dm(session_id)
    if not dm:
        return {"error": "Session not in memory", "session_id": session_id}
    
    record = dm.record
    return {
        "session_id": session_id,
        "patient_name": record.patient_name,
        "patient_age": record.patient_age,
        "patient_sex": record.patient_sex,
        "chief_complaint": record.chief_complaint.value if record.chief_complaint else None,
        "complaint_category": record.complaint_category,
        "filled_state": record.filled_state,
        "red_flags": [{"rule_id": f.rule_id, "description": f.description} for f in record.red_flags],
        "document_extractions": [ext.model_dump() for ext in record.document_extractions],
        "macro_state": record.macro_state,
        "conversation_history": record.conversation_history,
    }

@extended_router.post("/api/doctor/patient/{session_id}/complete")
async def complete_patient_visit(session_id: str, staff: dict = Depends(_require_role("DOCTOR", "ADMIN"))):
    conn = _get_db()
    conn.execute("UPDATE queue SET status = 'completed' WHERE session_id = ?", (session_id,))
    conn.execute("UPDATE patient_sessions SET status = 'completed' WHERE session_id = ?", (session_id,))
    conn.commit()
    conn.close()
    return {"status": "completed", "session_id": session_id, "completed_by": staff["name"]}


# ── Phase 5: Reception & Admin ───────────────────────────────────────

# @extended_router.post("/api/reception/checkin")
# async def manual_checkin(req: dict):
#     pass


@extended_router.get("/api/admin/staff")
async def admin_get_staff(staff: dict = Depends(_require_role("ADMIN"))):
    conn = _get_db()
    rows = conn.execute("SELECT id, name, role FROM staff").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@extended_router.delete("/api/admin/staff/{staff_id}")
async def admin_delete_staff(staff_id: str, staff: dict = Depends(_require_role("ADMIN"))):
    conn = _get_db()
    conn.execute("DELETE FROM staff WHERE id = ?", (staff_id,))
    conn.commit()
    conn.close()
    return {"deleted": staff_id}



@extended_router.get("/api/admin/dashboard")
async def admin_dashboard(staff: dict = Depends(_require_role("ADMIN"))):
    conn = _get_db()
    stats = {
        "total_patients": conn.execute("SELECT COUNT(*) as c FROM patients").fetchone()["c"],
        "total_sessions": conn.execute("SELECT COUNT(*) as c FROM patient_sessions").fetchone()["c"],
        "queue_waiting": conn.execute("SELECT COUNT(*) as c FROM queue WHERE status = 'waiting'").fetchone()["c"],
        "queue_priority": conn.execute("SELECT COUNT(*) as c FROM queue WHERE priority_flag = 1 AND status != 'completed'").fetchone()["c"],
        "total_summaries": conn.execute("SELECT COUNT(*) as c FROM clinical_summaries").fetchone()["c"],
        "total_staff": conn.execute("SELECT COUNT(*) as c FROM staff").fetchone()["c"],
        "total_doctors": conn.execute("SELECT COUNT(*) as c FROM doctor_roster").fetchone()["c"],
    }
    conn.close()
    return stats

@extended_router.get("/api/ocr-audit/{session_id}")
async def get_ocr_audit(session_id: str):
    dm = _get_dm(session_id)
    if not dm:
        return {"session_id": session_id, "documents": [], "note": "Session not in memory"}
    return {
        "session_id": session_id,
        "documents": [ext.model_dump() for ext in dm.record.document_extractions],
    }

@extended_router.get("/api/triage/queue")
async def get_triage_queue(doctor_id: Optional[str] = None):
    import database
    queue = database.fetch_triage_queue(doctor_id)
    return {"queue": queue}

# -----------------------------------------------------------------------------
# PHASE 6: HMIS CLOSED-LOOP ENDPOINTS
# -----------------------------------------------------------------------------

class DoctorLoginReq(BaseModel):
    username: str
    password: str

class DoctorStatusReq(BaseModel):
    status: str

class DoctorNotifyReq(BaseModel):
    doctor_id: int
    message: str

class NurseTriageReq(BaseModel):
    nurse_triage_notes: str
    elevate_to_priority: bool

class CompleteSessionReq(BaseModel):
    doctor_prescription: str
    action: str

@extended_router.post("/api/doctor/login")
async def doctor_login(req: DoctorLoginReq):
    conn = _get_db()
    doctor = conn.execute("SELECT * FROM doctors WHERE username = ? AND password = ?", (req.username, req.password)).fetchone()
    conn.close()
    if not doctor:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {
        "doctor_id": doctor["doctor_id"],
        "full_name": doctor["full_name"],
        "dept_id": doctor["dept_id"],
        "room_number": doctor["room_number"],
        "current_status": dict(doctor).get("current_status", "Available")
    }

@extended_router.put("/api/doctor/{doctor_id}/status")
async def update_doctor_status(doctor_id: int, req: DoctorStatusReq):
    conn = _get_db()
    conn.execute("UPDATE doctors SET current_status = ? WHERE doctor_id = ?", (req.status, doctor_id))
    conn.commit()
    conn.close()
    return {"status": "success", "current_status": req.status}

@extended_router.post("/api/doctor/notify")
async def notify_admin(req: DoctorNotifyReq):
    import uuid
    conn = _get_db()
    notif_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO admin_notifications (notif_id, doctor_id, message) VALUES (?, ?, ?)",
        (notif_id, req.doctor_id, req.message)
    )
    conn.commit()
    conn.close()
    return {"status": "success", "notif_id": notif_id}

@extended_router.get("/api/admin/notifications")
async def get_admin_notifications():
    conn = _get_db()
    notifs = conn.execute("""
        SELECT n.*, d.full_name as doctor_name, d.room_number
        FROM admin_notifications n
        JOIN doctors d ON n.doctor_id = d.doctor_id
        WHERE n.is_read = 0
        ORDER BY n.timestamp DESC
    """).fetchall()
    conn.close()
    return {"notifications": [dict(n) for n in notifs]}

@extended_router.put("/api/admin/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str):
    conn = _get_db()
    conn.execute("UPDATE admin_notifications SET is_read = 1 WHERE notif_id = ?", (notif_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

@extended_router.put("/api/session/{session_id}/nurse-triage")
async def update_nurse_triage(session_id: str, req: NurseTriageReq):
    conn = _get_db()
    conn.execute("UPDATE patient_sessions SET nurse_triage_notes = ? WHERE session_id = ?", (req.nurse_triage_notes, session_id))
    if req.elevate_to_priority:
        conn.execute("UPDATE patient_sessions SET priority_flag = 1, priority_reason = ? WHERE session_id = ?", ("Elevated by Triage Nurse", session_id))
    conn.commit()
    conn.close()
    return {"status": "success"}

@extended_router.put("/api/session/{session_id}/complete")
async def complete_session_doctor(session_id: str, req: CompleteSessionReq):
    conn = _get_db()
    
    # Update first to save the action
    doc_prescription_str = f"[{req.action}] {req.doctor_prescription}"
    conn.execute(
        "UPDATE patient_sessions SET doctor_prescription = ?, session_status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE session_id = ?", 
        (doc_prescription_str, session_id)
    )
    conn.commit()
    
    # Fetch DM to rebuild full context, or fallback to minimal if not in memory
    dm = _get_dm(session_id)
    
    q_row = conn.execute("SELECT priority_flag, priority_reason, token_id FROM queue WHERE session_id = ?", (session_id,)).fetchone()
    p_sess = conn.execute("SELECT chief_complaint, patient_id FROM patient_sessions WHERE session_id = ?", (session_id,)).fetchone()
    p_info = None
    if p_sess:
        p_info = conn.execute("SELECT full_name, age, gender FROM patients WHERE patient_id = ?", (p_sess["patient_id"],)).fetchone()
    
    # Fetch previously stored AI summary so we don't regenerate it and lose consistency
    summary_row = conn.execute("SELECT full_detailed_summary, pdf_file_path FROM clinical_summaries WHERE session_id = ? ORDER BY generated_at DESC LIMIT 1", (session_id,)).fetchone()
    
    if summary_row and summary_row["full_detailed_summary"]:
        ai_summary = json.loads(summary_row["full_detailed_summary"])
        pdf_path = summary_row["pdf_file_path"]
        is_new_summary = False
    else:
        is_new_summary = True
        if dm:
            from llm_client import generate_clinical_summary
            raw_extractions = [ext.model_dump() for ext in dm.record.document_extractions]
            ai_summary = generate_clinical_summary(dm.record.filled_state, raw_extractions)
        else:
            # Fallback dumb summary
            ai_summary = {
                "Narrative": p_sess["chief_complaint"] if p_sess else "No complaint recorded",
                "Assessment": ["Session restored from database (Legacy mode)"]
            }
        pdf_path = None
        
    # Rebuild OCR data from DM if available
    extracted_medications = []
    extracted_labs = []
    uploaded_images = []
    if dm:
        raw_extractions = [ext.model_dump() for ext in dm.record.document_extractions]
        for ext in raw_extractions:
            if "medications" in ext:
                for med in ext["medications"]:
                    extracted_medications.append({
                        "name": med.get("name", ""),
                        "dosage": med.get("dose", ""),
                        "frequency": med.get("frequency", "")
                    })
            if "lab_results" in ext:
                for lab in ext["lab_results"]:
                    extracted_labs.append({
                        "parameter": lab.get("test", ""),
                        "value": f"{lab.get('result', '')} {lab.get('unit', '')}",
                        "is_abnormal": str(lab.get("status", "")).lower() not in ["normal", ""]
                    })
        uploaded_images = [
            os.path.join(os.path.dirname(__file__), ext.ocr_path.lstrip("/"))
            for ext in dm.record.document_extractions if ext.ocr_path
        ]
        
    ocr_data = {
        "extracted_medications": extracted_medications,
        "extracted_labs": extracted_labs
    }
    
    prev_hist_raw = p_sess["previous_history_json"] if p_sess and "previous_history_json" in p_sess.keys() else None
    previous_history = json.loads(prev_hist_raw) if prev_hist_raw else None

    # Build unified context
    context = {
        "patient": {
            "token": q_row["token_id"] if q_row else "",
            "abha_id": "Not Provided",
            "name": p_info["full_name"] if p_info else "Unknown",
            "gender": p_info["gender"] if p_info else "Unknown",
            "age": str(p_info["age"]) if p_info else "Unknown",
            "phone": "Not Provided",
            "visit_type": "OPD Intake"
        },
        "timestamp": datetime.utcnow().strftime("%d/%m/%Y %I:%M %p"),
        "department": "General Medicine",
        "doctor_name": "Duty Medical Officer",
        "room_no": "OPD Room 01",
        "vitals": {}, 
        "red_flag_active": bool(q_row["priority_flag"]) if q_row else False,
        "triage_reason": q_row["priority_reason"] if q_row else "",
        "ai_summary": ai_summary,
        "ocr_data": ocr_data,
        "doctor_prescription": doc_prescription_str,
        "uploaded_images": uploaded_images,
        "logo_b64": get_logo_b64(),
        "hospital_name": "SwasthyaSync Healthcare",
        "hospital_subtext": "Center for Clinical Excellence & OPD Intake",
        "previous_history": previous_history
    }
    
    from pdf_generator import generate_summary_pdf
    pdf_bytes = await generate_summary_pdf(session_id, context)
    
    # Overwrite the original PDF
    if not pdf_path:
        summary_id = f"sum_{uuid.uuid4().hex[:8]}"
        pdf_dir = os.path.join(os.path.dirname(__file__), "generated_pdfs")
        os.makedirs(pdf_dir, exist_ok=True)
        pdf_path = os.path.join(pdf_dir, f"{summary_id}.pdf")
        
    with open(pdf_path, "wb") as f:
        f.write(pdf_bytes)
        
    if is_new_summary:
        import database
        try:
            database.save_clinical_summary(
                session_id=session_id,
                small_summary=ai_summary.get("Narrative", ""),
                full_detailed_summary=json.dumps(ai_summary),
                critical_highlights=ai_summary.get("Assessment", []),
                contradictions_found=[],
                pdf_file_path=pdf_path
            )
        except Exception as db_err:
            logger.error(f"Failed to save clinical summary to DB (likely session not in patient_sessions): {db_err}")
    
    conn.close()
    return {"status": "success"}
