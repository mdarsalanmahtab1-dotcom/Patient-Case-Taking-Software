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
        CREATE TABLE IF NOT EXISTS patients (
            patient_id TEXT PRIMARY KEY,
            name TEXT,
            phone TEXT UNIQUE NOT NULL,
            age INTEGER,
            gender TEXT,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS patient_sessions (
            session_id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
        );
        CREATE TABLE IF NOT EXISTS summaries (
            summary_id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            type TEXT NOT NULL,
            content TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
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

class LookupCreateReq(BaseModel):
    phone: str
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None

@extended_router.post("/api/patient/lookup-or-create")
async def lookup_or_create_patient(req: LookupCreateReq):
    conn = _get_db()
    row = conn.execute("SELECT * FROM patients WHERE phone = ?", (req.phone,)).fetchone()
    if row:
        # Update fields if provided
        updates = []
        params = []
        if req.name:
            updates.append("name = ?"); params.append(req.name)
        if req.age is not None:
            updates.append("age = ?"); params.append(req.age)
        if req.gender:
            updates.append("gender = ?"); params.append(req.gender)
        if updates:
            params.append(row["patient_id"])
            conn.execute(f"UPDATE patients SET {', '.join(updates)} WHERE patient_id = ?", params)
            conn.commit()
        # Re-fetch
        row = conn.execute("SELECT * FROM patients WHERE patient_id = ?", (row["patient_id"],)).fetchone()
        conn.close()
        return dict(row)
    
    # Create new
    patient_id = f"pat_{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow().isoformat()
    conn.execute(
        "INSERT INTO patients (patient_id, name, phone, age, gender, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (patient_id, req.name, req.phone, req.age, req.gender, now)
    )
    conn.commit()
    result = dict(conn.execute("SELECT * FROM patients WHERE patient_id = ?", (patient_id,)).fetchone())
    conn.close()
    return result

class StartSessionReq(BaseModel):
    patient_id: str

@extended_router.post("/api/session/start")
async def start_new_session(req: StartSessionReq):
    conn = _get_db()
    patient = conn.execute("SELECT * FROM patients WHERE patient_id = ?", (req.patient_id,)).fetchone()
    if not patient:
        conn.close()
        raise HTTPException(404, "Patient not found")
    
    session_id = f"sess_{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow().isoformat()
    conn.execute(
        "INSERT INTO patient_sessions (session_id, patient_id, created_at, status) VALUES (?, ?, ?, 'active')",
        (session_id, req.patient_id, now)
    )
    
    # Auto-enqueue
    token_id = f"tok_{uuid.uuid4().hex[:6]}"
    conn.execute(
        "INSERT INTO queue (token_id, session_id, patient_id, priority_flag, status, created_at) VALUES (?, ?, ?, 0, 'waiting', ?)",
        (token_id, session_id, req.patient_id, now)
    )
    conn.commit()
    conn.close()
    
    return {"session_id": session_id, "token_id": token_id, "patient_id": req.patient_id}


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
        "SELECT summary_id, pdf_path FROM summaries WHERE session_id = ? AND pdf_path IS NOT NULL ORDER BY created_at DESC LIMIT 1",
        (session_id,)
    ).fetchone()
    if not row:
        # Fallback: maybe they passed a summary_id directly
        row = conn.execute("SELECT summary_id, pdf_path FROM summaries WHERE summary_id = ?", (session_id,)).fetchone()
    
    if row and row["pdf_path"] and os.path.exists(row["pdf_path"]):
        conn.close()
        return FileResponse(row["pdf_path"], media_type="application/pdf", filename=f"{row['summary_id']}.pdf")
    
    # ── On-demand PDF generation fallback ──
    # If no pre-generated PDF exists, generate it now from the live session
    dm = _get_dm(session_id)
    if not dm:
        conn.close()
        raise HTTPException(404, "PDF not found and session not in memory")
    
    try:
        from pdf_generator import generate_summary_pdf
        
        q_row = conn.execute("SELECT priority_flag, priority_reason, token_id FROM queue WHERE session_id = ?", (session_id,)).fetchone()
        
        pdf_data = dm.record.model_dump()
        pdf_data["priority_flag"] = bool(q_row["priority_flag"]) if q_row else False
        pdf_data["priority_reason"] = q_row["priority_reason"] if q_row else ""
        pdf_data["token_id"] = q_row["token_id"] if q_row else ""
        pdf_data["clinic_mode"] = dm.record.clinic_mode
        
        pdf_bytes = generate_summary_pdf(pdf_data)
        
        summary_id = f"sum_{uuid.uuid4().hex[:8]}"
        pdf_dir = os.path.join(os.path.dirname(__file__), "generated_pdfs")
        os.makedirs(pdf_dir, exist_ok=True)
        pdf_path = os.path.join(pdf_dir, f"{summary_id}.pdf")
        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)
        
        # Save to DB for future requests
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
    """Every past summary (kiosk + doctor), across all sessions — the follow-up view."""
    conn = _get_db()
    rows = conn.execute(
        "SELECT * FROM summaries WHERE patient_id = ? ORDER BY created_at DESC", (patient_id,)
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
        "SELECT q.*, p.name as patient_name, p.phone, p.age, p.gender "
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
    """Get queue position for the kiosk status screen."""
    conn = _get_db()
    row = conn.execute("SELECT * FROM queue WHERE session_id = ?", (session_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Not in queue")
    # Count people ahead
    ahead = conn.execute(
        "SELECT COUNT(*) as cnt FROM queue WHERE status = 'waiting' AND "
        "(priority_flag > ? OR (priority_flag = ? AND created_at < ?))",
        (row["priority_flag"], row["priority_flag"], row["created_at"])
    ).fetchone()["cnt"]
    conn.close()
    return {**dict(row), "position": ahead + 1}


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
        "SELECT q.*, p.name as patient_name, p.phone, p.age, p.gender "
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

@extended_router.post("/api/reception/checkin")
async def manual_checkin(req: LookupCreateReq):
    """Receptionist walk-in check-in: lookup-or-create + auto-session + auto-queue."""
    # Reuse lookup-or-create logic
    patient = await lookup_or_create_patient(req)
    patient_id = patient["patient_id"] if isinstance(patient, dict) else patient.patient_id
    session_resp = await start_new_session(StartSessionReq(patient_id=patient_id))
    return {**session_resp, "patient": patient}

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

class RosterCreateReq(BaseModel):
    name: str
    department: str
    room_number: str
    shift: str

@extended_router.post("/api/admin/doctors")
async def admin_create_roster(req: RosterCreateReq, staff: dict = Depends(_require_role("ADMIN"))):
    doctor_id = f"doc_{uuid.uuid4().hex[:8]}"
    conn = _get_db()
    conn.execute(
        "INSERT INTO doctor_roster (doctor_id, name, department, room_number, shift) VALUES (?, ?, ?, ?, ?)",
        (doctor_id, req.name, req.department, req.room_number, req.shift)
    )
    conn.commit()
    conn.close()
    return {"doctor_id": doctor_id, "name": req.name, "department": req.department}

@extended_router.get("/api/admin/doctors")
async def admin_get_roster():
    conn = _get_db()
    rows = conn.execute("SELECT * FROM doctor_roster").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@extended_router.delete("/api/admin/doctors/{doctor_id}")
async def admin_delete_roster(doctor_id: str, staff: dict = Depends(_require_role("ADMIN"))):
    conn = _get_db()
    conn.execute("DELETE FROM doctor_roster WHERE doctor_id = ?", (doctor_id,))
    conn.commit()
    conn.close()
    return {"deleted": doctor_id}

@extended_router.get("/api/admin/dashboard")
async def admin_dashboard(staff: dict = Depends(_require_role("ADMIN"))):
    conn = _get_db()
    stats = {
        "total_patients": conn.execute("SELECT COUNT(*) as c FROM patients").fetchone()["c"],
        "total_sessions": conn.execute("SELECT COUNT(*) as c FROM patient_sessions").fetchone()["c"],
        "queue_waiting": conn.execute("SELECT COUNT(*) as c FROM queue WHERE status = 'waiting'").fetchone()["c"],
        "queue_priority": conn.execute("SELECT COUNT(*) as c FROM queue WHERE priority_flag = 1 AND status != 'completed'").fetchone()["c"],
        "total_summaries": conn.execute("SELECT COUNT(*) as c FROM summaries").fetchone()["c"],
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
