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
# ABDM M1 — In-Memory OTP Store
# Not persisted. TTL-based. Single-use tokens.
# Format: { txn_id: { otp, profile_or_phone, expires_at, path, attempts } }
# ─────────────────────────────────────────────────────────────────────
import time as _time
import random as _random

from services.otp_provider import get_otp_provider, mask_phone as _mask_phone

# Transaction context store (stores profile / path context only, NEVER raw OTP)
abdm_context_store: dict[str, dict] = {}


# ── ABDM Pydantic Models ──────────────────────────────────────────────

class AbdmInitReq(BaseModel):
    abha_number: str

class AbdmConfirmReq(BaseModel):
    transaction_id: str
    otp: str

class MobileOtpInitReq(BaseModel):
    phone: str

class MobileOtpConfirmReq(BaseModel):
    transaction_id: str
    otp: str


# ── ABDM M1 Endpoints ─────────────────────────────────────────────────

@extended_router.post("/api/abdm/auth/init")
async def abdm_init(req: AbdmInitReq):
    """
    Path A Step 1: Patient enters their ABHA address.
    Looks up the MOCK_ABHA_REGISTRY, dispatches real/mock OTP via otp_provider.
    Returns transaction_id + masked phone hint.
    """
    from abdm_utils import lookup_by_abha_number
    profile = lookup_by_abha_number(req.abha_number)
    if not profile:
        raise HTTPException(404, detail={
            "code": "ABHA_NOT_FOUND",
            "message": "ABHA Number not registered. Please use mobile number login.",
        })

    provider = get_otp_provider()
    result = await provider.send_otp(profile["mobile"], purpose="abha_login")
    if not result.success:
        status_code = 429 if result.error_code == "RATE_LIMITED" else (400 if result.error_code == "INVALID_PHONE" else 500)
        raise HTTPException(status_code, detail={"code": result.error_code or "SEND_FAILED", "message": result.message})

    abdm_context_store[result.transaction_id] = {
        "profile": profile,
        "path": "A",
    }
    logger.info(f"[ABDM/A] OTP requested for {req.abha_number} → txn={result.transaction_id}")

    return {
        "transaction_id": result.transaction_id,
        "phone_hint": result.phone_hint,
        "message": result.message,
        "resend_after_seconds": result.resend_after_seconds,
        **({"debug_otp": result.debug_otp} if result.debug_otp else {}),
    }


@extended_router.post("/api/abdm/auth/confirm")
async def abdm_confirm(req: AbdmConfirmReq):
    """
    Path A Step 2: Patient enters OTP.
    Validates via otp_provider, returns the full normalized ABHA profile on success.
    """
    entry = abdm_context_store.get(req.transaction_id)
    if not entry or entry.get("path") != "A":
        raise HTTPException(404, detail={"code": "TXN_NOT_FOUND", "message": "OTP expired or invalid transaction."})

    provider = get_otp_provider()
    verify_result = await provider.verify_otp(req.transaction_id, req.otp, purpose="abha_login")
    if not verify_result.success:
        raise HTTPException(
            verify_result.status_code,
            detail={
                "code": verify_result.error_code or "INVALID_OTP",
                "message": verify_result.error_message or "Incorrect OTP.",
                "attempts_remaining": verify_result.attempts_remaining,
            }
        )

    profile = entry["profile"]
    abdm_context_store.pop(req.transaction_id, None)   # Single-use: delete context immediately
    logger.info(f"[ABDM/A] OTP confirmed for {profile['name']}")

    return {
        "status": "success",
        "profile": profile,
    }


@extended_router.post("/api/abdm/auth/mobile/init")
async def mobile_otp_init(req: MobileOtpInitReq):
    """
    Path B Step 1: Walk-in patient enters their mobile number.
    Dispatches OTP via otp_provider.
    Returns transaction_id + masked phone hint.
    """
    provider = get_otp_provider()
    result = await provider.send_otp(req.phone, purpose="mobile_login")
    if not result.success:
        status_code = 429 if result.error_code == "RATE_LIMITED" else (400 if result.error_code == "INVALID_PHONE" else 500)
        raise HTTPException(status_code, detail={"code": result.error_code or "SEND_FAILED", "message": result.message})

    abdm_context_store[result.transaction_id] = {
        "path": "B",
    }
    logger.info(f"[ABDM/B] OTP requested for {_mask_phone(req.phone)} → txn={result.transaction_id}")

    return {
        "transaction_id": result.transaction_id,
        "phone_hint": result.phone_hint,
        "message": result.message,
        "resend_after_seconds": result.resend_after_seconds,
        **({"debug_otp": result.debug_otp} if result.debug_otp else {}),
    }


@extended_router.post("/api/abdm/auth/mobile/confirm")
async def mobile_otp_confirm(req: MobileOtpConfirmReq):
    """
    Path B Step 2: Patient enters OTP for their mobile.
    On success: returns verified phone + existing patients list.
    """
    entry = abdm_context_store.get(req.transaction_id)
    if not entry or entry.get("path") != "B":
        raise HTTPException(404, detail={"code": "TXN_NOT_FOUND", "message": "OTP expired or invalid transaction."})

    provider = get_otp_provider()
    verify_result = await provider.verify_otp(req.transaction_id, req.otp, purpose="mobile_login")
    if not verify_result.success:
        raise HTTPException(
            verify_result.status_code,
            detail={
                "code": verify_result.error_code or "INVALID_OTP",
                "message": verify_result.error_message or "Incorrect OTP.",
                "attempts_remaining": verify_result.attempts_remaining,
            }
        )

    phone = verify_result.phone
    abdm_context_store.pop(req.transaction_id, None)   # Single-use
    logger.info(f"[ABDM/B] Phone {_mask_phone(phone)} verified.")

    # Fetch existing patients linked to this phone
    import database
    patients = await database.get_patients_by_phone(phone)
    for p in patients:
        last_visit = await database.fetch_previous_history(p["patient_id"])
        p["last_visit"] = {
            "chief_complaint": last_visit.get("chief_complaint"),
            "completed_at": last_visit.get("completed_at"),
            "department": last_visit.get("department"),
        } if last_visit else None

    return {
        "status": "success",
        "phone": phone,
        "patients": patients,   # [] = new patient, [...] = family selection
    }



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
import database

DB_PATH = os.path.join(os.path.dirname(__file__), "swasthyasync.db")





# ─────────────────────────────────────────────────────────────────────
# RBAC — real JWT-like token validation
# ─────────────────────────────────────────────────────────────────────
# For hackathon: simple token = "role:staff_id:random". Not crypto-grade
# but actually enforced — routes check the role before proceeding.

security = HTTPBearer(auto_error=False)

def _hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

async def _issue_token(staff_id: str, role: str, name: str) -> str:
    token = f"{role}:{staff_id}:{secrets.token_hex(8)}"
    if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute("INSERT INTO staff_sessions (token, staff_id, role, name) VALUES ($1, $2, $3, $4)", token, staff_id, role, name)
    return token

async def _get_current_staff(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not credentials:
        raise HTTPException(401, "Missing auth token")
    token_str = credentials.credentials
    if not database._pool:
        raise HTTPException(500, "DB not initialized")
    async with database._pool.acquire() as conn:
        row = await conn.fetchrow("SELECT staff_id as id, role, name FROM staff_sessions WHERE token = $1", token_str)
        if not row:
            raise HTTPException(401, "Invalid or expired token")
        return dict(row)

def _require_role(*allowed_roles):
    async def checker(staff: dict = Depends(_get_current_staff)):
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

async def escalate_queue_priority(session_id: str, reason: str):
    if not database._pool: return
    async with database._pool.acquire() as conn:
        row = await conn.fetchrow("SELECT token_number FROM patient_sessions WHERE session_id = $1", session_id)
        if row:
            await conn.execute(
                "UPDATE patient_sessions SET priority_flag = TRUE, priority_reason = $1 WHERE session_id = $2",
                reason, session_id
            )
            logger.warning(f"🚨 QUEUE ESCALATED: session={session_id} reason={reason}")
        else:
            logger.warning(f"Queue escalation requested but no queue entry for session {session_id}")


# ═════════════════════════════════════════════════════════════════════
# API ROUTES
# ═════════════════════════════════════════════════════════════════════

# ── Phase 1: Staff Auth ──────────────────────────────────────────────

class StaffLoginReq(BaseModel):
    username: str
    password: str

@extended_router.post("/api/auth/staff/login")
async def staff_login(req: StaffLoginReq):
    import database
    if not database._pool: raise HTTPException(500, "DB error")
    async with database._pool.acquire() as conn:
        row = await conn.fetchrow("SELECT doctor_id, full_name as name, 'DOCTOR' as role FROM doctors WHERE username = $1 AND password = $2 AND status = 'Active'", req.username, req.password)
        if not row:
            raise HTTPException(401, "Invalid credentials")
        token = await _issue_token(row["doctor_id"], row["role"], row["name"])
        return {"token": token, "role": row["role"], "name": row["name"], "staff_id": row["doctor_id"]}

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

@extended_router.post("/api/staff/register")
async def staff_register(req: StaffCreateReq):
    import database
    if not database._pool: raise HTTPException(500, "DB error")
    hashed_pw = _hash_password(req.password)
    # Create doctor logic... wait, this was legacy staff table.
    raise HTTPException(400, "Registration disabled. Ask admin to create doctor profile.")


# ── Phase 2: Patient Identity & Session ──────────────────────────────

import database

class StartSessionPayload(BaseModel):
    patient_id: Optional[str] = None
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
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
    patients = await database.get_patients_by_phone(phone_number)
    for p in patients:
        last_visit = await database.fetch_previous_history(p["patient_id"])
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
    doctors = await database.get_active_doctors()
    return {"doctors": doctors}

@extended_router.get("/api/departments")
async def get_departments():
    import database
    depts = await database.get_departments()
    return {"departments": depts}

@extended_router.post("/api/session/start")
async def create_session(payload: StartSessionPayload):
    import database
    previous_history = None
    if payload.patient_id:
        previous_history = await database.fetch_previous_history(payload.patient_id)
    db_data = await database.start_kiosk_session(
        patient_data=payload.dict(),
        department=payload.department,
        previous_history_json=previous_history,
        doctor_id=payload.doctor_id
    )
    if db_data.get("conflict"):
        return {
            "status": "conflict",
            "message": "Active session exists", 
            "existing_token": db_data.get("existing_token"),
            "doctor_name": db_data.get("doctor_name"),
            "department": db_data.get("department")
        }
    return {"status": "success", "session_id": db_data["session_id"], "token_id": db_data["token_id"], "token_number": db_data["token_number"], "room_number": db_data.get("room_number")}


# ── Phase 2–3: Summaries (real content from PatientRecord) ───────────

@extended_router.post("/api/patient/{patient_id}/summary/{session_id}/generate")
async def generate_doctor_summary(session_id: str, staff: dict = Depends(_require_role("DOCTOR", "ADMIN"))):
    raise HTTPException(501, "Not Implemented")

from fastapi.responses import FileResponse

@extended_router.get("/api/summary/{session_id}/pdf")
async def get_summary_pdf(session_id: str):
    import database
    import os
    import json
    import uuid
    from datetime import datetime
    from fastapi.responses import FileResponse
    from fastapi import HTTPException
    
    if not database._pool: raise HTTPException(500, "DB error")
    async with database._pool.acquire() as conn:
        row = await conn.fetchrow("SELECT summary_id, pdf_file_path FROM clinical_summaries WHERE session_id = $1 AND pdf_file_path IS NOT NULL ORDER BY generated_at DESC LIMIT 1", session_id)
        if not row:
            row = await conn.fetchrow("SELECT summary_id, pdf_file_path FROM clinical_summaries WHERE summary_id = $1", session_id)
            
        if row and row["pdf_file_path"]:
            path = row["pdf_file_path"]
            if path.startswith("http"):
                from fastapi.responses import RedirectResponse
                return RedirectResponse(path)
            elif os.path.exists(path):
                return FileResponse(path, media_type="application/pdf", filename=f"{row['summary_id']}.pdf")
            
        # ── On-demand PDF generation fallback ──
        try:
            from main import sessions
            dm = sessions.get(session_id)
        except ImportError:
            dm = None
        
        p_sess = await conn.fetchrow("SELECT chief_complaint, patient_id, doctor_prescription, priority_flag, priority_reason, token_id, filled_state_json FROM patient_sessions WHERE session_id = $1", session_id)
        q_row = p_sess
        
        if not p_sess:
            raise HTTPException(404, "Session not found")
            
        p_info = await conn.fetchrow("SELECT full_name, age, gender, abha_id, phone_number, address, weight, height, vitals FROM patients WHERE patient_id = $1", p_sess["patient_id"])
        
        try:
            from pdf_generator import generate_summary_pdf
            from llm_client import generate_clinical_summary
            
            extracted_medications = []
            extracted_labs = []
            uploaded_images = []
            doc_extractions_list = []
            
            # ── Helper: extract earliest clinical date from OCR result ──
            def _extract_earliest_date(ocr_data: dict) -> str:
                """
                Drill into consolidated_summary.document_dates to find the earliest
                clinical date. Returns ISO date string or "9999-12-31" (sorts last).
                """
                NO_DATE = "9999-12-31"
                try:
                    cs = ocr_data.get("consolidated_summary", {})
                    if isinstance(cs, str):
                        cs = json.loads(cs)
                    dates = cs.get("document_dates", [])
                    valid = [d.get("date", "") for d in dates if d.get("date")]
                    if valid:
                        valid.sort()
                        return valid[0]  # earliest date
                except Exception:
                    pass
                return NO_DATE

            _image_date_pairs = []
            if dm:
                filled_state_json = dm.record.filled_state
                doc_extractions_list = [ext.model_dump() for ext in dm.record.document_extractions]
                
                # Build (date, image_paths) tuples for sorting
                _image_date_pairs = []
                for doc in dm.record.document_extractions:
                    if not getattr(doc, 'ocr_path', None):
                        continue
                    paths = [p.strip() for p in doc.ocr_path.split(",") if p.strip()]
                    # Get date from OCR entities
                    ocr_data = doc.entities[0] if doc.entities else {}
                    earliest = _extract_earliest_date(ocr_data)
                    for p in paths:
                        _image_date_pairs.append((earliest, p))
                
                # Sort: dated docs first (chronological), undated at the end
                _image_date_pairs.sort(key=lambda x: x[0])
                uploaded_images = [p for _, p in _image_date_pairs]
            else:
                filled_state_json = json.loads(p_sess["filled_state_json"]) if p_sess.get("filled_state_json") else {}
                db_docs = await conn.fetch("SELECT file_path, ocr_raw_json FROM uploaded_documents WHERE session_id = $1", session_id)
                
                # Build (date, image_paths) tuples for sorting
                _image_date_pairs = []
                for doc in db_docs:
                    if doc["file_path"]:
                        paths = [p.strip() for p in doc["file_path"].split(",") if p.strip()]
                    else:
                        paths = []
                    ocr_data = json.loads(doc["ocr_raw_json"]) if doc["ocr_raw_json"] else {}
                    earliest = _extract_earliest_date(ocr_data)
                    if ocr_data:
                        doc_extractions_list.append(ocr_data)
                    for p in paths:
                        _image_date_pairs.append((earliest, p))
                
                # Sort: dated docs first (chronological), undated at the end
                _image_date_pairs.sort(key=lambda x: x[0])
                uploaded_images = [p for _, p in _image_date_pairs]
                        
            for ext in doc_extractions_list:
                if "medications" in ext:
                    for med in ext["medications"]:
                        extracted_medications.append({
                            "name": med.get("drug_name", ""),
                            "dosage": med.get("dosage", ""),
                            "frequency": med.get("frequency", "")
                        })
                if "lab_values" in ext:
                    for lab in ext["lab_values"]:
                        extracted_labs.append({
                            "parameter": lab.get("test_name", ""),
                            "value": f"{lab.get('value', '')} {lab.get('unit', '')}".strip(),
                            "is_abnormal": lab.get("is_abnormal", False)
                        })

            if not filled_state_json and not doc_extractions_list:
                ai_summary = {
                    "clinical_narrative": p_sess["chief_complaint"] if p_sess else "No complaint recorded",
                    "critical_highlights": []
                }
            else:
                ai_summary = generate_clinical_summary(filled_state_json, doc_extractions_list)

            ocr_data = {
                "extracted_medications": extracted_medications,
                "extracted_labs": extracted_labs
            }
            
            previous_history = None
            prev_sess = await conn.fetchrow("SELECT session_id FROM patient_sessions WHERE patient_id = $1 AND session_id != $2 ORDER BY created_at DESC LIMIT 1", p_sess["patient_id"], session_id)
            if prev_sess:
                old_session_id = prev_sess["session_id"]
                old_sum = await conn.fetchrow("SELECT full_detailed_summary, pdf_file_path FROM clinical_summaries WHERE session_id = $1 ORDER BY generated_at DESC LIMIT 1", old_session_id)
                if old_sum:
                    previous_history = json.loads(old_sum["full_detailed_summary"]) if old_sum["full_detailed_summary"] else None
                    if previous_history and old_sum["pdf_file_path"]:
                        previous_history["pdf_file_path"] = old_sum["pdf_file_path"]
                        
            # Get Logo B64 securely
            logo_b64 = ""
            try:
                import base64
                logo_path = os.path.join(os.path.dirname(__file__), "logo.png")
                if os.path.exists(logo_path):
                    with open(logo_path, "rb") as lf:
                        logo_b64 = base64.b64encode(lf.read()).decode()
            except: pass
            
            context = {
                "patient": {
                    "token": q_row["token_id"] if q_row else "",
                    "abha_id": p_info["abha_id"] if p_info and p_info.get("abha_id") else "Not Provided",
                    "name": p_info["full_name"] if p_info else "Unknown",
                    "gender": p_info["gender"] if p_info else "Unknown",
                    "age": str(p_info["age"]) if p_info else "Unknown",
                    "id": p_sess["patient_id"],
                    "phone": p_info["phone_number"] if p_info and p_info.get("phone_number") else "Not Provided",
                    "address": p_info["address"] if p_info and p_info.get("address") else "Not Provided",
                    "visit_type": "OPD Intake"
                },
                "timestamp": datetime.utcnow().strftime("%d/%m/%Y %I:%M %p"),
                "department": "General Medicine",
                "doctor_name": "Duty Medical Officer",
                "room_no": "OPD Room 01",
                "vitals": {
                    "bp": p_info["vitals"] if p_info and p_info.get("vitals") else "/", 
                    "hr": "", 
                    "weight": str(p_info["weight"]) if p_info and p_info.get("weight") else "", 
                    "temp": "", 
                    "spo2": ""
                }, 
                "red_flag_active": bool(q_row["priority_flag"]) if q_row else False,
                "triage_reason": q_row["priority_reason"] if q_row else "",
                "ai_summary": ai_summary,
                "ocr_data": ocr_data,
                "uploaded_images": uploaded_images,
                "image_dates": [d for d, _ in _image_date_pairs],
                "doctor_prescription": p_sess["doctor_prescription"] if p_sess and "doctor_prescription" in p_sess.keys() else "",
                "logo_b64": logo_b64,
                "hospital_name": "SwasthyaSync Healthcare",
                "hospital_subtext": "Center for Clinical Excellence & OPD Intake",
                "previous_history": previous_history
            }
            
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
                    pass
                    
            summary_id = f"sum_{uuid.uuid4().hex[:8]}"
            
            from supabase import create_client
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_KEY")
            pdf_path = None
            if supabase_url and supabase_key:
                try:
                    supabase = create_client(supabase_url, supabase_key)
                    storage_path = f"patient-documents/{summary_id}.pdf"
                    supabase.storage.from_("patient-records").upload(
                        file=pdf_bytes,
                        path=storage_path,
                        file_options={"content-type": "application/pdf"}
                    )
                    url_resp = supabase.storage.from_("patient-records").get_public_url(storage_path)
                    pdf_path = url_resp
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).error(f"Supabase upload error for PDF: {e}")
            
            if not pdf_path:
                # Local fallback ONLY if config is missing (but we expect it to exist)
                pdf_dir = os.path.join(os.path.dirname(__file__), "generated_pdfs")
                os.makedirs(pdf_dir, exist_ok=True)
                local_path = os.path.join(pdf_dir, f"{summary_id}.pdf")
                with open(local_path, "wb") as f:
                    f.write(pdf_bytes)
                pdf_path = local_path
                
            try:
                import database
                await database.save_clinical_summary(
                    session_id=session_id,
                    small_summary=ai_summary.get("Narrative", ""),
                    full_detailed_summary=ai_summary,
                    critical_highlights=ai_summary.get("Assessment", []),
                    contradictions_found=[c.model_dump() for c in getattr(dm.record, 'contradictions', [])] if dm and hasattr(dm.record, 'contradictions') else [],
                    pdf_file_path=pdf_path
                )
            except Exception as e:
                pass
                
            if pdf_path.startswith("http"):
                from fastapi.responses import RedirectResponse
                return RedirectResponse(pdf_path)
            else:
                return FileResponse(pdf_path, media_type="application/pdf", filename=f"{summary_id}.pdf")
        except Exception as e:
            import traceback
            traceback.print_exc()
            raise HTTPException(500, f"Failed to generate PDF: {e}")


@extended_router.get("/api/patient/{patient_id}/summaries")
async def get_patient_summaries(patient_id: str):
    import database
    if not database._pool: raise HTTPException(500, "DB error")
    async with database._pool.acquire() as conn:
        rows = await conn.fetch("SELECT session_id, small_summary, pdf_file_path as pdf_path, generated_at as created_at FROM clinical_summaries WHERE session_id IN (SELECT session_id FROM patient_sessions WHERE patient_id = $1) ORDER BY generated_at DESC", patient_id)
        return {"summaries": [dict(r) for r in rows]}


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
    import database
    queue = await database.fetch_triage_queue()
    return {"queue": queue}

class PriorityUpdate(BaseModel):
    priority_flag: bool

@extended_router.put("/api/queue/{token_id}/priority")
async def update_queue_priority(token_id: str, payload: PriorityUpdate, staff: dict = Depends(_require_role("NURSE", "DOCTOR", "ADMIN"))):
    import database
    if not database._pool: raise HTTPException(500, "DB error")
    async with database._pool.acquire() as conn:
        await conn.execute("UPDATE patient_sessions SET priority_flag = $1, priority_reason = $2 WHERE token_id = $3", payload.priority_flag, payload.priority_reason, token_id)
    return {"status": "success"}

class StatusUpdate(BaseModel):
    status: str

@extended_router.put("/api/queue/{token_id}/status")
async def update_queue_status(token_id: str, payload: StatusUpdate):
    import database
    if not database._pool: raise HTTPException(500, "DB error")
    async with database._pool.acquire() as conn:
        await conn.execute("UPDATE patient_sessions SET session_status = $1 WHERE token_id = $2", payload.status, token_id)
    return {"status": "success"}

@extended_router.get("/api/queue/token/{session_id}")
async def get_queue_token(session_id: str):
    """Get token information for the completion screen."""
    import database
    if not database._pool:
        raise HTTPException(500, "Database not initialized")
        
    async with database._pool.acquire() as conn:
        # Fetch from patient_sessions and doctors
        row = await conn.fetchrow('''
            SELECT ps.token_number, ps.token_id, d.full_name as doctor_name, d.room_number 
            FROM patient_sessions ps
            LEFT JOIN doctors d ON ps.doctor_id = d.doctor_id
            WHERE ps.session_id = $1
        ''', session_id)
        
        if not row:
            raise HTTPException(404, "Session not found")
            
        return {
            "token": row["token_number"] or row["token_id"],
            "doctor_name": row["doctor_name"],
            "room_number": row["room_number"],
            "position": row["token_number"] or 1
        }


# ── Phase 4: Doctor Dashboard ────────────────────────────────────────



@extended_router.get("/api/doctor/{doctor_id}/queue")
async def get_doctor_queue(doctor_id: str, staff: dict = Depends(_require_role("DOCTOR", "ADMIN"))):
    import database
    queue = await database.fetch_triage_queue(doctor_id)
    return {"queue": queue}

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

@extended_router.post("/api/session/{session_id}/complete")
async def complete_patient_visit(session_id: str, staff: dict = Depends(_require_role("DOCTOR", "ADMIN"))):
    import database
    if not database._pool: raise HTTPException(500, "DB error")
    async with database._pool.acquire() as conn:
        await conn.execute("UPDATE patient_sessions SET session_status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE session_id = $1", session_id)
    return {"status": "success"}

@extended_router.post("/api/session/{session_id}/submit")
async def submit_to_doctor(session_id: str):
    """Kiosk-facing: marks the session as WAITING so the doctor queue picks it up."""
    import database
    if not database._pool: raise HTTPException(500, "DB error")
    async with database._pool.acquire() as conn:
        row = await conn.fetchrow("SELECT session_status FROM patient_sessions WHERE session_id = $1", session_id)
        if not row:
            raise HTTPException(404, "Session not found")
        await conn.execute(
            "UPDATE patient_sessions SET session_status = 'WAITING' WHERE session_id = $1",
            session_id
        )
    return {"status": "success", "message": "Session submitted to doctor queue"}


# ── Phase 5: Reception & Admin ───────────────────────────────────────

# @extended_router.post("/api/reception/checkin")
# async def manual_checkin(req: dict):
#     pass


@extended_router.get("/api/admin/staff")
async def admin_get_staff(staff: dict = Depends(_require_role("ADMIN"))):
    if not database._pool: return []
    async with database._pool.acquire() as conn:
        rows = await conn.fetch("SELECT id, name, role FROM staff")
    return [dict(r) for r in rows]

@extended_router.delete("/api/admin/staff/{staff_id}")
async def admin_delete_staff(staff_id: str, staff: dict = Depends(_require_role("ADMIN"))):
    if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute("DELETE FROM staff WHERE id = $1", staff_id)
    return {"deleted": staff_id}



@extended_router.get("/api/admin/dashboard")
async def admin_dashboard(staff: dict = Depends(_require_role("ADMIN"))):
    if not database._pool: return {}
    async with database._pool.acquire() as conn:
        stats = {
            "total_patients": (await conn.fetchrow("SELECT COUNT(*) as c FROM patients"))["c"],
            "total_sessions": (await conn.fetchrow("SELECT COUNT(*) as c FROM patient_sessions"))["c"],
            "queue_waiting": (await conn.fetchrow("SELECT COUNT(*) as c FROM patient_sessions WHERE status = 'waiting'"))["c"],
            "queue_priority": (await conn.fetchrow("SELECT COUNT(*) as c FROM patient_sessions WHERE priority_flag = TRUE AND status != 'completed'"))["c"],
            "total_summaries": (await conn.fetchrow("SELECT COUNT(*) as c FROM clinical_summaries"))["c"],
            "total_staff": (await conn.fetchrow("SELECT COUNT(*) as c FROM staff"))["c"],
            "total_doctors": (await conn.fetchrow("SELECT COUNT(*) as c FROM doctors"))["c"],
        }
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
    queue = await database.fetch_triage_queue(doctor_id)
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
    doctor_id: str
    message: str

class NurseTriageReq(BaseModel):
    nurse_triage_notes: str
    elevate_to_priority: bool

class CompleteSessionReq(BaseModel):
    doctor_prescription: str
    action: str

@extended_router.post("/api/doctor/login")
async def doctor_login(req: DoctorLoginReq):
    if not database._pool: raise HTTPException(500, "DB not ready")
    async with database._pool.acquire() as conn:
        doctor = await conn.fetchrow("SELECT * FROM doctors WHERE username = $1 AND password = $2", req.username, req.password)
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
async def update_doctor_status(doctor_id: str, req: DoctorStatusReq):
    if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute("UPDATE doctors SET current_status = $1 WHERE doctor_id = $2", req.status, doctor_id)
    return {"status": "success", "current_status": req.status}

class DoctorInstructionsReq(BaseModel):
    custom_instructions: str

@extended_router.get("/api/doctor/{doctor_id}/instructions")
async def get_doctor_instructions(doctor_id: str):
    if database._pool:
        async with database._pool.acquire() as conn:
            doc = await conn.fetchrow("SELECT custom_instructions FROM doctors WHERE doctor_id = $1", doctor_id)
            if doc:
                return {"custom_instructions": doc["custom_instructions"] or ""}
    return {"custom_instructions": ""}

@extended_router.put("/api/doctor/{doctor_id}/instructions")
async def update_doctor_instructions(doctor_id: str, req: DoctorInstructionsReq):
    if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute("UPDATE doctors SET custom_instructions = $1 WHERE doctor_id = $2", req.custom_instructions, doctor_id)
    return {"status": "success"}


@extended_router.post("/api/doctor/notify")
async def notify_admin(req: DoctorNotifyReq):
    import uuid
    notif_id = str(uuid.uuid4())
    if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute("INSERT INTO admin_notifications (notif_id, doctor_id, message) VALUES ($1, $2, $3)", notif_id, req.doctor_id, req.message)
    return {"status": "success", "notif_id": notif_id}

@extended_router.get("/api/admin/notifications")
async def get_admin_notifications():
    if not database._pool: return {"notifications": []}
    async with database._pool.acquire() as conn:
        notifs = await conn.fetch("""
            SELECT n.*, d.full_name as doctor_name, d.room_number
            FROM admin_notifications n
            JOIN doctors d ON n.doctor_id = d.doctor_id
            WHERE n.is_read = FALSE
            ORDER BY n.timestamp DESC
        """)
    return {"notifications": [dict(n) for n in notifs]}

@extended_router.put("/api/admin/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str):
    if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute("UPDATE admin_notifications SET is_read = TRUE WHERE notif_id = $1", notif_id)
    return {"status": "success"}

@extended_router.put("/api/session/{session_id}/nurse-triage")
async def update_nurse_triage(session_id: str, req: NurseTriageReq):
    if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute("UPDATE patient_sessions SET nurse_triage_notes = $1 WHERE session_id = $2", req.nurse_triage_notes, session_id)
            if req.elevate_to_priority:
                await conn.execute("UPDATE patient_sessions SET priority_flag = TRUE, priority_reason = $1 WHERE session_id = $2", "Elevated by Triage Nurse", session_id)
    return {"status": "success"}

@extended_router.get("/api/session/{session_id}")
async def get_single_session(session_id: str):
    if not database._pool: return {"error": "DB not initialized"}
    async with database._pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT ps.*, p.full_name, p.age, p.gender, p.phone_number
            FROM patient_sessions ps
            JOIN patients p ON ps.patient_id = p.patient_id
            WHERE ps.session_id = $1
        """, session_id)
        if not row:
            raise HTTPException(404, "Session not found")
        return dict(row)

@extended_router.put("/api/session/{session_id}/complete")
async def complete_session_doctor(session_id: str, req: CompleteSessionReq):
    doc_prescription_str = f"[{req.action}] {req.doctor_prescription}"
    if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute(
                "UPDATE patient_sessions SET doctor_prescription = $1, session_status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE session_id = $2", 
                doc_prescription_str, session_id
            )
            
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            await client.post("http://localhost:8000/api/admin/notifications", json={
                "message": f"Patient session {session_id} completed.",
                "doctor_id": 0
            })
    except:
        pass
        
    return {"status": "success"}