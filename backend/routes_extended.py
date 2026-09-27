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
    import hashlib
    if not database._pool: raise HTTPException(500, "DB error")
    async with database._pool.acquire() as conn:
        # Check doctors table
        row = await conn.fetchrow(
            "SELECT doctor_id as id, full_name as name, 'DOCTOR' as role FROM doctors WHERE username = $1 AND password = $2 AND status = 'Active'",
            req.username, req.password
        )
        if not row:
            # Check staff table (ADMIN, NURSE, RECEPTIONIST)
            pw_hash = hashlib.sha256(req.password.encode()).hexdigest()
            row = await conn.fetchrow(
                "SELECT id, name, role FROM staff WHERE id = $1 AND (password_hash = $2 OR password_hash = $3)",
                req.username, pw_hash, req.password
            )
        if not row:
            raise HTTPException(401, "Invalid credentials")
        token = await _issue_token(row["id"], row["role"], row["name"])
        return {"token": token, "role": row["role"], "name": row["name"], "staff_id": row["id"]}

@extended_router.post("/api/auth/staff/logout")
async def staff_logout(credentials: HTTPAuthorizationCredentials = Depends(security), staff: dict = Depends(_get_current_staff)):
    import database
    if database._pool and credentials:
        async with database._pool.acquire() as conn:
            await conn.execute("DELETE FROM staff_sessions WHERE token = $1", credentials.credentials)
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

async def generate_and_save_session_pdf(session_id: str, doctor_prescription_override: str = None) -> tuple[str, str]:
    """
    Generates the complete, authoritative OPD casesheet PDF for session_id.
    Guarantees that attending physician notes/prescriptions are rendered.
    Uploads to Supabase storage (or saves locally).
    Persists updated pdf_file_path, doctor_consultation_notes, and detailed summary in clinical_summaries.
    Returns (pdf_path, summary_id).
    """
    import database
    import os
    import json
    import uuid
    import re
    from datetime import datetime
    from fastapi import HTTPException
    
    if not database._pool:
        raise HTTPException(500, "Database pool not initialized")
        
    async with database._pool.acquire() as conn:
        try:
            from main import sessions
            dm = sessions.get(session_id)
        except ImportError:
            dm = None
        
        def _parse_vitals_to_dict(raw_vitals_str: str = "", weight_val = None, height_val = None, filled_state: dict = None) -> dict:
            res = {
                "bp": "",
                "hr": "",
                "temp": "",
                "spo2": "",
                "resp_rate": "",
                "weight": "",
                "height": "",
                "bmi": "",
                "bmi_status": "",
            }
            
            text = str(raw_vitals_str or "").strip()
            
            # 1. Parse Blood Pressure
            bp_match = re.search(r'(\b\d{2,3}\s*/\s*\d{2,3}\b)', text)
            if bp_match:
                res["bp"] = bp_match.group(1).replace(" ", "")
            
            # 2. Parse Heart Rate / Pulse
            hr_match = re.search(r'(?:HR|Heart\s*Rate|Pulse|PR)[\s:]*(\d{2,3})', text, re.IGNORECASE)
            if hr_match:
                res["hr"] = hr_match.group(1)
            
            # 3. Parse SpO2
            spo2_match = re.search(r'(?:SpO2|Oxygen|O2)[\s:]*(\d{2,3})\s*%?', text, re.IGNORECASE)
            if not spo2_match:
                spo2_match = re.search(r'(\d{2,3})\s*%\s*(?:SpO2)?', text, re.IGNORECASE)
            if spo2_match:
                val = int(spo2_match.group(1))
                if 50 <= val <= 100:
                    res["spo2"] = str(val)
                    
            # 4. Parse Temperature
            temp_match = re.search(r'(?:Temp|Temperature)[\s:]*([\d\.]+)\s*(?:F|C|\xb0F|\xb0C)?', text, re.IGNORECASE)
            if temp_match:
                res["temp"] = temp_match.group(1)

            # 5. Respiratory Rate
            rr_match = re.search(r'(?:RR|Resp|Respiratory\s*Rate)[\s:]*(\d{1,2})', text, re.IGNORECASE)
            if rr_match:
                res["resp_rate"] = rr_match.group(1)

            # Check filled_state overrides if any field is still missing
            if filled_state and isinstance(filled_state, dict):
                for k, v in filled_state.items():
                    k_low = k.lower()
                    val_str = str(v.get("value", "") if isinstance(v, dict) else v).strip()
                    if not val_str: continue
                    if not res["bp"] and ("bp" in k_low or "blood_pressure" in k_low):
                        m = re.search(r'(\b\d{2,3}\s*/\s*\d{2,3}\b)', val_str)
                        if m: res["bp"] = m.group(1).replace(" ", "")
                    if not res["hr"] and ("heart_rate" in k_low or "pulse" in k_low):
                        m = re.search(r'(\d{2,3})', val_str)
                        if m: res["hr"] = m.group(1)
                    if not res["spo2"] and "spo2" in k_low:
                        m = re.search(r'(\d{2,3})', val_str)
                        if m and 50 <= int(m.group(1)) <= 100: res["spo2"] = m.group(1)
                    if ("temp" in k_low or "fever" in k_low) and not res["temp"]:
                        m = re.search(r'([\d\.]+)', val_str)
                        if m and 94 <= float(m.group(1)) <= 108: res["temp"] = m.group(1)
                    if ("rr" in k_low or "respiratory" in k_low) and not res["resp_rate"]:
                        m = re.search(r'(\d{1,2})', val_str)
                        if m: res["resp_rate"] = m.group(1)

            # Weight, Height & BMI (only calculate if actual measurements are recorded)
            wt = None
            if weight_val:
                try: wt = float(str(weight_val).replace("kg", "").strip())
                except: pass
            if wt is None and filled_state:
                for k, v in filled_state.items():
                    if "weight" in k.lower():
                        try: wt = float(str(v.get("value") if isinstance(v, dict) else v).replace("kg", "").strip())
                        except: pass
            if wt:
                res["weight"] = f"{wt:.1f}"

            ht = None
            if height_val:
                ht_str = str(height_val).replace("cm", "").strip()
                try: ht = float(ht_str)
                except: pass
            if ht is None and filled_state:
                for k, v in filled_state.items():
                    if "height" in k.lower():
                        try: ht = float(str(v.get("value") if isinstance(v, dict) else v).replace("cm", "").strip())
                        except: pass
            if ht:
                res["height"] = f"{int(ht)} cm" if ht.is_integer() else f"{ht:.1f} cm"

            if wt and ht and ht > 50:
                ht_m = ht / 100.0
                bmi_val = round(wt / (ht_m * ht_m), 1)
                res["bmi"] = str(bmi_val)
                if bmi_val < 18.5: res["bmi_status"] = "Underweight"
                elif bmi_val < 25.0: res["bmi_status"] = "Normal"
                elif bmi_val < 30.0: res["bmi_status"] = "Overweight"
                else: res["bmi_status"] = "Obese"

            return res

        def _generate_abdm_qr_b64(qr_data_str: str) -> str:
            try:
                import qrcode
                import io
                import base64
                qr = qrcode.QRCode(box_size=3, border=1)
                qr.add_data(qr_data_str)
                qr.make(fit=True)
                img = qr.make_image(fill_color="black", back_color="white")
                buf = io.BytesIO()
                img.save(buf, format="PNG")
                return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"
            except Exception as e:
                return ""
        
        p_sess = await conn.fetchrow("""
            SELECT ps.chief_complaint, ps.patient_id, ps.doctor_prescription, ps.priority_flag,
                   ps.priority_reason, ps.token_id, ps.filled_state_json, ps.department, ps.created_at,
                   ps.doctor_id, ps.session_status, ps.completed_at,
                   d.full_name as doctor_name, d.license_number as doctor_license, d.room_number,
                   dept.name as dept_name
            FROM patient_sessions ps
            LEFT JOIN doctors d ON ps.doctor_id = d.doctor_id
            LEFT JOIN departments dept ON d.dept_id = dept.dept_id
            WHERE ps.session_id = $1
        """, session_id)
        q_row = p_sess
        
        if not p_sess:
            raise HTTPException(404, f"Session {session_id} not found")
            
        p_info = await conn.fetchrow("SELECT full_name, age, gender, abha_id, phone_number, address, weight, height, vitals FROM patients WHERE patient_id = $1", p_sess["patient_id"])

        # Dynamic Doctor, License & Department Resolution
        department_name = p_sess.get("department") or p_sess.get("dept_name") or "General Medicine"
        doctor_name = p_sess.get("doctor_name")
        doctor_license = p_sess.get("doctor_license")
        room_no = p_sess.get("room_number")

        doc_row = None
        if not doctor_name:
            doc_row = await conn.fetchrow("""
                SELECT d.doctor_id, d.full_name, d.license_number, d.room_number
                FROM doctors d
                LEFT JOIN departments dept ON d.dept_id = dept.dept_id
                WHERE LOWER(dept.name) = LOWER($1) AND (d.status = 'Active' OR d.status IS NULL)
                ORDER BY d.doctor_id LIMIT 1
            """, department_name)
            if doc_row:
                doctor_name = doc_row["full_name"]
                doctor_license = doc_row["license_number"]
                room_no = doc_row["room_number"]
            else:
                doctor_name = "Attending Medical Officer"
                doctor_license = "N/A"
                room_no = "OPD Consultation Room"
        
        if not room_no:
            room_no = "OPD Consultation Room"
        if not doctor_license:
            doctor_license = "N/A"

        # Safely resolve valid doctor_id to avoid FK constraint violation
        valid_doc_id = None
        target_doc_id = p_sess.get("doctor_id")
        if target_doc_id:
            exists = await conn.fetchval("SELECT 1 FROM doctors WHERE doctor_id = $1", str(target_doc_id))
            if exists:
                valid_doc_id = str(target_doc_id)
        if not valid_doc_id and doc_row and doc_row.get("doctor_id"):
            valid_doc_id = str(doc_row["doctor_id"])
        if not valid_doc_id:
            # Dynamically resolve first available active doctor instead of hardcoding an ID
            fallback_doc = await conn.fetchval(
                "SELECT doctor_id FROM doctors WHERE status = 'Active' OR status IS NULL ORDER BY doctor_id LIMIT 1"
            )
            valid_doc_id = str(fallback_doc) if fallback_doc else None

        # Resolve effective doctor prescription
        effective_doc_rx = doctor_prescription_override
        if effective_doc_rx is None:
            effective_doc_rx = p_sess["doctor_prescription"] if p_sess and "doctor_prescription" in p_sess.keys() and p_sess["doctor_prescription"] else ""

        # IST Timezone Resolution
        try:
            from zoneinfo import ZoneInfo
            ist = ZoneInfo("Asia/Kolkata")
        except ImportError:
            from datetime import timezone, timedelta
            ist = timezone(timedelta(hours=5, minutes=30))

        created_dt = p_sess.get("created_at")
        if created_dt:
            if created_dt.tzinfo is None:
                from datetime import timezone
                created_dt = created_dt.replace(tzinfo=timezone.utc)
            ist_time = created_dt.astimezone(ist).strftime("%d/%m/%Y %I:%M %p")
        else:
            from datetime import datetime, timezone
            ist_time = datetime.now(timezone.utc).astimezone(ist).strftime("%d/%m/%Y %I:%M %p")
        
        from pdf_generator import generate_summary_pdf
        from llm_client import generate_clinical_summary
        
        extracted_medications = []
        extracted_labs = []
        uploaded_images = []
        doc_extractions_list = []
        filled_state_json = {}
        
        # ── Helper: parse any raw date to sortable ISO YYYY-MM-DD ──
        def _parse_to_iso_date(raw_date_str: str) -> str:
            NO_DATE = "9999-12-31"
            if not raw_date_str or not isinstance(raw_date_str, str):
                return NO_DATE
            raw = raw_date_str.strip()
            # Try DD/MM/YYYY
            try:
                parts = raw.split("/")
                if len(parts) == 3 and len(parts[2]) == 4:
                    d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
                    return f"{y:04d}-{m:02d}-{d:02d}"
            except Exception:
                pass
            # Try DD-MM-YYYY
            try:
                parts = raw.split("-")
                if len(parts) == 3 and len(parts[2]) == 4:
                    d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
                    return f"{y:04d}-{m:02d}-{d:02d}"
            except Exception:
                pass
            # Try YYYY-MM-DD
            try:
                parts = raw.split("-")
                if len(parts) == 3 and len(parts[0]) == 4:
                    y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
                    return f"{y:04d}-{m:02d}-{d:02d}"
            except Exception:
                pass
            return raw

        def _extract_earliest_date(ocr_data: dict) -> str:
            NO_DATE = "9999-12-31"
            try:
                cs = ocr_data.get("consolidated_summary_json") or ocr_data.get("consolidated_summary") or {}
                if isinstance(cs, str):
                    cs = json.loads(cs)
                dates = cs.get("document_dates", [])
                valid = []
                for d in dates:
                    raw_d = d.get("date", "") if isinstance(d, dict) else str(d)
                    iso_d = _parse_to_iso_date(raw_d)
                    if iso_d and iso_d != NO_DATE:
                        valid.append(iso_d)
                if valid:
                    valid.sort()
                    return valid[0]
            except Exception:
                pass
            return NO_DATE

        _image_date_pairs = []
        seen_paths = set()
        
        if dm and getattr(dm.record, "document_extractions", None):
            filled_state_json = dm.record.filled_state
            doc_extractions_list = [ext.model_dump() for ext in dm.record.document_extractions]
            for doc in dm.record.document_extractions:
                if not getattr(doc, 'ocr_path', None):
                    continue
                paths = [p.strip() for p in doc.ocr_path.split(",") if p.strip()]
                ocr_data = doc.entities[0] if doc.entities else {}
                earliest = _extract_earliest_date(ocr_data)
                for p in paths:
                    if p not in seen_paths:
                        seen_paths.add(p)
                        _image_date_pairs.append((earliest, p))
        
        # Also check DB for uploaded_documents to guarantee complete coverage
        db_docs = await conn.fetch("SELECT file_path, ocr_raw_json FROM uploaded_documents WHERE session_id = $1", session_id)
        if not filled_state_json and p_sess.get("filled_state_json"):
            filled_state_json = json.loads(p_sess["filled_state_json"])
            
        for doc in db_docs:
            raw_paths = doc["file_path"] or ""
            paths = [p.strip() for p in raw_paths.split(",") if p.strip()]
            ocr_data = json.loads(doc["ocr_raw_json"]) if doc["ocr_raw_json"] else {}
            earliest = _extract_earliest_date(ocr_data)
            if ocr_data and ocr_data not in doc_extractions_list:
                doc_extractions_list.append(ocr_data)
            for p in paths:
                if p not in seen_paths:
                    seen_paths.add(p)
                    _image_date_pairs.append((earliest, p))

        # Sort strictly chronologically by date
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
            for cand_path in [
                os.path.join(os.path.dirname(__file__), "assets", "logo.png"),
                os.path.join(os.path.dirname(__file__), "logo.png"),
                os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "src", "assets", "logoPNG.png"),
            ]:
                if os.path.exists(cand_path):
                    with open(cand_path, "rb") as lf:
                        raw_b64 = base64.b64encode(lf.read()).decode("utf-8")
                        logo_b64 = f"data:image/png;base64,{raw_b64}"
                    break
        except Exception as e:
            logger.error(f"Error loading logo for PDF: {e}")
        
        # Determine clinic_mode for AYUSH / Allopathic rendering
        clinic_mode = "allopathic"
        if dm and hasattr(dm.record, "clinic_mode"):
            clinic_mode = dm.record.clinic_mode
        elif filled_state_json and any(k.startswith("prakriti_") for k in filled_state_json.keys()):
            clinic_mode = "ayush"
        elif "ayush" in department_name.lower() or "ayur" in department_name.lower():
            clinic_mode = "ayush"

        # Parse vitals using dedicated parser
        parsed_vitals = _parse_vitals_to_dict(
            raw_vitals_str=p_info.get("vitals") if p_info else "",
            weight_val=p_info.get("weight") if p_info else None,
            height_val=p_info.get("height") if p_info else None,
            filled_state=filled_state_json
        )

        token_val = q_row["token_id"] if q_row and q_row.get("token_id") else "TOKEN-2026"
        abha_val = p_info["abha_id"] if p_info and p_info.get("abha_id") else "Not Linked / N/A"
        patient_name_val = p_info["full_name"] if p_info and p_info.get("full_name") else "Walk-in Patient"

        # Generate offline ABDM QR code
        qr_b64 = _generate_abdm_qr_b64(
            f"ABDM:SWASTHYASYNC | TOKEN:{token_val} | ABHA:{abha_val} | PATIENT:{patient_name_val} | DATE:{ist_time}"
        )

        context = {
            "clinic_mode": clinic_mode,
            "filled_state": filled_state_json,
            "patient": {
                "token": token_val,
                "abha_id": abha_val,
                "name": patient_name_val,
                "gender": p_info["gender"] if p_info else "Unknown",
                "age": str(p_info["age"]) if p_info else "Unknown",
                "id": p_sess["patient_id"],
                "phone": p_info["phone_number"] if p_info and p_info.get("phone_number") else "Not Provided",
                "address": p_info["address"] if p_info and p_info.get("address") else "Not Provided",
                "visit_type": "New OPD Visit" if not previous_history else "Follow-Up Visit"
            },
            "timestamp": ist_time,
            "department": department_name,
            "doctor_name": doctor_name,
            "doctor_license": doctor_license,
            "room_no": room_no,
            "vitals": parsed_vitals,
            "red_flag_active": bool(q_row["priority_flag"]) if q_row else False,
            "triage_reason": q_row["priority_reason"] if q_row else "",
            "ai_summary": ai_summary,
            "ocr_data": ocr_data,
            "uploaded_images": uploaded_images,
            "image_dates": [d for d, _ in _image_date_pairs],
            "doctor_prescription": effective_doc_rx,
            "logo_b64": logo_b64,
            "qr_b64": qr_b64,
            "hospital_name": "SwasthyaSync Healthcare",
            "hospital_subtext": "Central Outpatient Department & Clinical Excellence Center",
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
            pdf_dir = os.path.join(os.path.dirname(__file__), "generated_pdfs")
            os.makedirs(pdf_dir, exist_ok=True)
            local_path = os.path.join(pdf_dir, f"{summary_id}.pdf")
            with open(local_path, "wb") as f:
                f.write(pdf_bytes)
            pdf_path = local_path
            
        try:
            if clinic_mode in ("ayush", "integrative") and "ayush_summary" in context:
                ai_summary["ayush_assessment"] = context["ayush_summary"]
            await database.save_clinical_summary(
                session_id=session_id,
                small_summary=ai_summary.get("Narrative", "") or ai_summary.get("clinical_narrative", ""),
                full_detailed_summary=ai_summary,
                critical_highlights=ai_summary.get("Assessment", []) or ai_summary.get("critical_highlights", []),
                contradictions_found=[c.model_dump() for c in getattr(dm.record, 'contradictions', [])] if dm and hasattr(dm.record, 'contradictions') else [],
                pdf_file_path=pdf_path,
                doctor_consultation_notes=effective_doc_rx or None,
                doctor_id=valid_doc_id
            )
        except Exception as e:
            logger.error(f"Error persisting clinical summary for {session_id}: {e}")

        return pdf_path, summary_id


@extended_router.get("/api/summary/{session_id}/pdf")
@extended_router.get("/api/pdf/{session_id}")
async def get_summary_pdf(session_id: str, regenerate: bool = False, force: bool = False, download: bool = False):
    import database
    import os
    from fastapi.responses import FileResponse, RedirectResponse, Response
    from fastapi import HTTPException
    
    if not database._pool: raise HTTPException(500, "DB error")
    async with database._pool.acquire() as conn:
        if not regenerate and not force:
            row = await conn.fetchrow("""
                SELECT cs.summary_id, cs.pdf_file_path, cs.doctor_consultation_notes, cs.generated_at,
                       ps.doctor_prescription, ps.completed_at, ps.session_status, ps.token_id
                FROM clinical_summaries cs
                LEFT JOIN patient_sessions ps ON cs.session_id = ps.session_id
                WHERE cs.session_id = $1 AND cs.pdf_file_path IS NOT NULL
                ORDER BY cs.generated_at DESC LIMIT 1
            """, session_id)
            if not row:
                row = await conn.fetchrow("""
                    SELECT cs.summary_id, cs.pdf_file_path, cs.doctor_consultation_notes, cs.generated_at,
                           ps.doctor_prescription, ps.completed_at, ps.session_status, ps.token_id
                    FROM clinical_summaries cs
                    LEFT JOIN patient_sessions ps ON cs.session_id = ps.session_id
                    WHERE cs.summary_id = $1
                """, session_id)
                
            is_stale = False
            if row and row.get("doctor_prescription"):
                # If doctor notes exist on session, but missing from clinical summary or summary was generated before session completion
                if not row.get("doctor_consultation_notes"):
                    is_stale = True
                elif row.get("completed_at") and row.get("generated_at") and row["generated_at"] < row["completed_at"]:
                    is_stale = True

            if row and row["pdf_file_path"] and not is_stale:
                path = row["pdf_file_path"]
                token_clean = (row.get("token_id") or session_id).replace(" ", "_")
                filename = f"OPD_Casesheet_{token_clean}.pdf"

                if download:
                    if path.startswith("http"):
                        import httpx
                        async with httpx.AsyncClient(timeout=30.0) as client:
                            r = await client.get(path)
                            return Response(
                                content=r.content,
                                media_type="application/pdf",
                                headers={"Content-Disposition": f'attachment; filename="{filename}"'}
                            )
                    elif os.path.exists(path):
                        return FileResponse(
                            path,
                            media_type="application/pdf",
                            filename=filename,
                            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
                        )
                else:
                    if path.startswith("http"):
                        return RedirectResponse(path)
                    elif os.path.exists(path):
                        return FileResponse(path, media_type="application/pdf", filename=f"{row['summary_id']}.pdf")
            
    # Generate fresh or regenerate
    try:
        pdf_path, summary_id = await generate_and_save_session_pdf(session_id)
        token_clean = session_id
        async with database._pool.acquire() as conn:
            tok = await conn.fetchval("SELECT token_id FROM patient_sessions WHERE session_id = $1", session_id)
            if tok:
                token_clean = str(tok).replace(" ", "_")
        filename = f"OPD_Casesheet_{token_clean}.pdf"

        if download:
            if pdf_path.startswith("http"):
                import httpx
                async with httpx.AsyncClient(timeout=30.0) as client:
                    r = await client.get(pdf_path)
                    return Response(
                        content=r.content,
                        media_type="application/pdf",
                        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
                    )
            elif os.path.exists(pdf_path):
                return FileResponse(
                    pdf_path,
                    media_type="application/pdf",
                    filename=filename,
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'}
                )
        else:
            if pdf_path.startswith("http"):
                return RedirectResponse(pdf_path)
            elif os.path.exists(pdf_path):
                return FileResponse(pdf_path, media_type="application/pdf", filename=f"{summary_id}.pdf")
        raise HTTPException(500, "Generated PDF could not be located.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving summary PDF: {e}", exc_info=True)
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
            SELECT ps.token_number, ps.token_id, ps.department,
                   d.full_name as doctor_name, d.room_number 
            FROM patient_sessions ps
            LEFT JOIN doctors d ON ps.doctor_id = d.doctor_id
            WHERE ps.session_id = $1
        ''', session_id)
        
        if not row:
            raise HTTPException(404, "Session not found")

        doctor_name = row["doctor_name"]
        room_number = row["room_number"]

        # If doctor_id was NULL, resolve the department's default doctor and room
        if not doctor_name and row.get("department"):
            dept_doc = await conn.fetchrow('''
                SELECT d.full_name, d.room_number
                FROM doctors d
                LEFT JOIN departments dept ON d.dept_id = dept.dept_id
                WHERE LOWER(dept.name) = LOWER($1) AND (d.status = 'Active' OR d.status IS NULL)
                ORDER BY d.doctor_id LIMIT 1
            ''', row["department"])
            if dept_doc:
                doctor_name = dept_doc["full_name"]
                room_number = dept_doc["room_number"]

        return {
            "token": row["token_number"] or row["token_id"],
            "doctor_name": doctor_name or "Attending Medical Officer",
            "room_number": room_number or "OPD Consultation Room",
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

@extended_router.post("/api/session/{session_id}/start")
async def start_consultation(session_id: str):
    """Doctor-facing: marks session as IN_PROGRESS when doctor opens the clinical encounter."""
    import database
    if not database._pool: raise HTTPException(500, "DB error")
    async with database._pool.acquire() as conn:
        row = await conn.fetchrow("SELECT session_status FROM patient_sessions WHERE session_id = $1", session_id)
        if not row:
            raise HTTPException(404, "Session not found")
        if row["session_status"] == "WAITING":
            await conn.execute(
                "UPDATE patient_sessions SET session_status = 'IN_PROGRESS' WHERE session_id = $1",
                session_id
            )
    return {"status": "success", "session_status": "IN_PROGRESS"}



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
            "queue_waiting": (await conn.fetchrow("SELECT COUNT(*) as c FROM patient_sessions WHERE session_status = 'WAITING'"))["c"],
            "queue_priority": (await conn.fetchrow("SELECT COUNT(*) as c FROM patient_sessions WHERE priority_flag = TRUE AND session_status NOT IN ('COMPLETED', 'ARCHIVED')"))["c"],
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
    doc_prescription_str = f"[{req.action}] {req.doctor_prescription}".strip()
    if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute(
                "UPDATE patient_sessions SET doctor_prescription = $1, session_status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE session_id = $2", 
                doc_prescription_str, session_id
            )
            await conn.execute(
                "UPDATE clinical_summaries SET doctor_consultation_notes = $1, doctor_signed_at = CURRENT_TIMESTAMP WHERE session_id = $2",
                doc_prescription_str, session_id
            )

    pdf_path = None
    try:
        pdf_path, summary_id = await generate_and_save_session_pdf(session_id, doctor_prescription_override=doc_prescription_str)
        logger.info(f"Successfully generated and stored final signed PDF for session {session_id}: {pdf_path}")
    except Exception as e:
        logger.error(f"Error generating final signed PDF for session {session_id}: {e}", exc_info=True)
            
    try:
        # Direct database notification instead of fragile httpx localhost loopback
        if database._pool:
            async with database._pool.acquire() as conn:
                # Resolve the doctor_id from the session for the notification
                sess_doc = await conn.fetchval(
                    "SELECT doctor_id FROM patient_sessions WHERE session_id = $1", session_id
                )
                notif_id = f"notif_{__import__('uuid').uuid4().hex[:8]}"
                await conn.execute("""
                    INSERT INTO admin_notifications (notif_id, doctor_id, message, is_read, timestamp)
                    VALUES ($1, $2, $3, FALSE, CURRENT_TIMESTAMP)
                """, notif_id, sess_doc or "system", f"OPD Consultation completed for session {session_id}.")
    except Exception:
        pass
        
    return {
        "status": "success",
        "pdf_url": pdf_path or f"/api/summary/{session_id}/pdf?regenerate=true"
    }