from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
import json
import os
import uuid
import random as _random
import time as _time
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

import database
from llm_client import generate_portal_chat_reply

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── OTP Provider & Verified Sessions ──────────────────────────────────
from services.otp_provider import get_otp_provider, mask_phone as _mask_phone
verified_sessions: dict[str, str] = {}   # token → phone


# ── Auth Dependency ────────────────────────────────────────────────────
async def get_verified_phone(authorization: str = Header(default="")) -> str:
    """Extract and validate the bearer token from the Authorization header."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header. Please log in.")
    token = authorization.replace("Bearer ", "").strip()
    phone = verified_sessions.get(token)
    if not phone:
        raise HTTPException(status_code=401, detail="Invalid or expired session. Please log in again.")
    return phone


# ── Pydantic Models ────────────────────────────────────────────────────
class PortalOtpInitReq(BaseModel):
    phone: str

class PortalOtpConfirmReq(BaseModel):
    transaction_id: str
    otp: str

class ChatRequest(BaseModel):
    user_message: str
    history: list[dict] = []


# ── App Lifespan ───────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Standalone Patient Portal Backend starting...")
    await database.init_db_pool()
    yield
    await database.close_db_pool()

app = FastAPI(title="SwasthyaSync Mobile Portal API", lifespan=lifespan)

raw_origins = os.getenv("CORS_ORIGINS", "*")
if raw_origins.strip() == "*":
    origins = ["*"]
else:
    origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app" if "*" not in origins else None,
    allow_credentials=True if "*" not in origins else False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Utility ────────────────────────────────────────────────────────────
def _mask_phone(phone: str) -> str:
    clean = phone.replace("+91", "").replace(" ", "").strip()
    if len(clean) <= 4:
        return "X" * len(clean)
    return "X" * (len(clean) - 4) + clean[-4:]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  AUTH ENDPOINTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.post("/api/portal/auth/init")
async def portal_otp_init(req: PortalOtpInitReq):
    """
    Step 1: Patient enters phone number → dispatch OTP via otp_provider.
    Returns transaction_id + masked phone hint.
    """
    provider = get_otp_provider()
    result = await provider.send_otp(req.phone, purpose="portal_login")
    if not result.success:
        status_code = 429 if result.error_code == "RATE_LIMITED" else (400 if result.error_code == "INVALID_PHONE" else 500)
        raise HTTPException(status_code, detail={"code": result.error_code or "SEND_FAILED", "message": result.message})

    logger.info(f"[Portal Auth] OTP requested for {result.phone_hint} → txn={result.transaction_id}")

    return {
        "transaction_id": result.transaction_id,
        "phone_hint": result.phone_hint,
        "message": result.message,
        "resend_after_seconds": result.resend_after_seconds,
        **({"debug_otp": result.debug_otp} if result.debug_otp else {}),
    }


@app.post("/api/portal/auth/confirm")
async def portal_otp_confirm(req: PortalOtpConfirmReq):
    """
    Step 2: Patient enters OTP → validate via otp_provider, return session token.
    """
    provider = get_otp_provider()
    verify_result = await provider.verify_otp(req.transaction_id, req.otp, purpose="portal_login")
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

    # Generate session token
    token = uuid.uuid4().hex
    verified_sessions[token] = phone
    logger.info(f"[Portal Auth] Phone {_mask_phone(phone)} verified. Token issued.")

    return {
        "status": "success",
        "token": token,
        "phone": phone,
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PROTECTED DATA ENDPOINTS (require auth token)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.get("/api/portal/history")
async def get_patient_history(phone: str = Depends(get_verified_phone)):
    """Fetch all past completed consultations for the authenticated patient."""
    try:
        history = await database.fetch_patient_history_by_identifier(phone)
        return history
    except Exception as e:
        logger.error(f"Error fetching patient history: {e}")
        raise HTTPException(status_code=500, detail="Internal server error fetching history")


@app.get("/api/portal/documents")
async def get_patient_documents(phone: str = Depends(get_verified_phone)):
    """Fetch all documents uploaded by the authenticated patient."""
    try:
        documents = await database.fetch_patient_documents_by_identifier(phone)
        return documents
    except Exception as e:
        logger.error(f"Error fetching patient documents: {e}")
        raise HTTPException(status_code=500, detail="Internal server error fetching documents")


from services.swasthya_prompt import build_chat_system_prompt
from services.chat_router import classify_intent_and_safety, get_direct_small_talk_reply
from services.chat_tools import (
    get_my_profile,
    get_my_medical_history,
    get_my_latest_case_summary,
    get_my_latest_reports,
    get_my_prescriptions,
    get_my_vitals,
    get_my_uploaded_documents,
    get_my_queue_status,
    search_hospital
)
from llm_client import generate_portal_chat_structured, generate_portal_chat_reply, clean_and_parse_json


@app.get("/api/portal/chat/status")
async def get_portal_chat_status(phone: str = Depends(get_verified_phone)):
    """Returns record availability status for dynamic UI context badge."""
    try:
        latest = await database.fetch_latest_clinical_record(phone)
        info = await database.fetch_patient_info_by_phone(phone)
        return {
            "record_available": bool(latest),
            "patient_name": info.get("full_name", "") if info else "",
            "phone_masked": _mask_phone(phone)
        }
    except Exception as e:
        logger.error(f"Error fetching chat status: {e}")
        return {"record_available": False, "patient_name": "", "phone_masked": ""}


@app.post("/api/portal/chat")
async def patient_portal_chat(request: ChatRequest, phone: str = Depends(get_verified_phone)):
    """Context-aware, intent-routed AI companion with scoped tools and clinical safety."""
    try:
        user_msg = request.user_message.strip()
        intent, is_emergency = classify_intent_and_safety(user_msg)

        # 1. Immediate Emergency Escalation
        if is_emergency:
            return {
                "reply": "⚠️ **URGENT MEDICAL NOTICE**: Your message describes symptoms that require immediate emergency attention.\n\n"
                         "Please call **108** (National Emergency), **1800-123-4567** (SwasthyaSync Hospital Emergency), or proceed immediately to the nearest Emergency Trauma Center. "
                         "Do not wait for an online reply.",
                "intent": "EMERGENCY",
                "emergency": True,
                "needs_clinician": True,
                "sources": [{"type": "emergency_protocol", "label": "SwasthyaSync Emergency Protocol", "id": "EMERGENCY-108"}],
                "confidence": "high",
                "suggested_followups": [
                    "What is the hospital emergency number?",
                    "Where is the emergency department located?"
                ]
            }

        # 2. Fast Small-Talk Isolation (Zero DB queries, friendly polite reply)
        if intent == "SMALL_TALK":
            talk_res = get_direct_small_talk_reply(user_msg)
            return {
                "reply": talk_res["response"],
                **talk_res
            }

        # 3. Check Patient Record Presence
        latest_record = await database.fetch_latest_clinical_record(phone)
        patient_info = await database.fetch_patient_info_by_phone(phone)

        # If user explicitly asked for their personal record, but no record is present
        if intent == "PATIENT_RECORD" and not latest_record:
            return {
                "reply": "I don't currently have a medical report or prescription available in your SwasthyaSync record for that question. "
                         "You can scan your past paper records at the hospital kiosk or upload them under the **History** tab. "
                         "In the meantime, feel free to ask me about hospital departments, kiosk guidance, or general health.",
                "intent": "PATIENT_RECORD",
                "response": "I don't currently have a medical report or prescription available in your SwasthyaSync record for that question.",
                "sources": [],
                "confidence": "high",
                "needs_clinician": False,
                "emergency": False,
                "suggested_followups": [
                    "What does the SwasthyaSync kiosk do?",
                    "Which department handles general checkups?",
                    "How do I upload past medical records?"
                ]
            }

        # 4. Scoped Context Assembly
        patient_context = {}
        if latest_record or patient_info:
            patient_context["profile"] = {
                "name": patient_info.get("full_name") if patient_info else "Patient",
                "age": patient_info.get("age") if patient_info else None,
                "gender": patient_info.get("gender") if patient_info else None,
            }
            if latest_record:
                full_sum = latest_record.get("full_detailed_summary", {})
                patient_context["latest_visit"] = {
                    "doctor_consultation_notes": latest_record.get("doctor_consultation_notes", ""),
                    "chief_complaint": full_sum.get("chief_complaint") or full_sum.get("clinical_narrative", ""),
                    "assessment": full_sum.get("Assessment") or full_sum.get("critical_highlights", []),
                    "prescriptions": await get_my_prescriptions(phone),
                    "lab_reports": await get_my_latest_reports(phone),
                    "vitals": await get_my_vitals(phone)
                }

        # Retrieve relevant hospital/kiosk knowledge
        hospital_context = search_hospital(user_msg)

        # Retrieve queue status if relevant
        if intent == "QUEUE_STATUS":
            queue_data = await get_my_queue_status(phone)
            hospital_context["patient_queue"] = queue_data

        # 5. Format Conversation Turns
        conv_text = ""
        if request.history:
            recent = request.history[-6:]
            turns = []
            for m in recent:
                sender_label = "Patient" if m.get("sender") == "user" else "Assistant"
                turns.append(f"{sender_label}: {m.get('text', '')}")
            conv_text = "\n".join(turns)

        # 6. Build Master System Prompt
        system_prompt = build_chat_system_prompt(
            patient_context_json=json.dumps(patient_context, indent=2, default=str),
            hospital_context_json=json.dumps(hospital_context, indent=2, default=str),
            conversation_history_text=conv_text
        )

        # 7. Generate Structured Response
        structured = generate_portal_chat_structured(system_prompt, user_msg)
        response_text = structured.get("response") or structured.get("reply", "")

        # Defensive check: unwrap if response_text is itself a stringified JSON or markdown codeblock
        if isinstance(response_text, str) and (response_text.strip().startswith("{") or response_text.strip().startswith("```")):
            inner = clean_and_parse_json(response_text)
            if inner and ("response" in inner or "reply" in inner):
                response_text = inner.get("response") or inner.get("reply", "")
                structured["response"] = response_text
                if "sources" in inner and not structured.get("sources"):
                    structured["sources"] = inner["sources"]
                if "suggested_followups" in inner and not structured.get("suggested_followups"):
                    structured["suggested_followups"] = inner["suggested_followups"]
                if "intent" in inner and structured.get("intent") in ["UNKNOWN", "GENERAL_HEALTH"]:
                    structured["intent"] = inner["intent"]

        structured["response"] = response_text

        return {
            **structured,
            "reply": response_text
        }

    except Exception as e:
        logger.error(f"Error in portal chat: {e}", exc_info=True)
        return {
            "reply": "I apologize, but I encountered an error while processing your request. Please try again or ask your doctor directly.",
            "intent": "ERROR",
            "sources": [],
            "confidence": "low",
            "needs_clinician": True,
            "emergency": False
        }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PUBLIC ENDPOINTS (no auth required)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.get("/api/portal/hospital-info")
async def get_hospital_info():
    """Public hospital information — departments, doctor counts, active patients."""
    try:
        info = await database.fetch_hospital_info()
        return info
    except Exception as e:
        logger.error(f"Error fetching hospital info: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  AUTHENTICATED FEATURE ENDPOINTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.get("/api/portal/queue-status")
async def get_queue_status(phone: str = Depends(get_verified_phone)):
    """Live queue status for the authenticated patient."""
    try:
        active = await database.fetch_active_queue_for_phone(phone)
        return {"active_sessions": active}
    except Exception as e:
        logger.error(f"Error fetching queue status: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/api/portal/feedback")
async def submit_feedback(request: dict, phone: str = Depends(get_verified_phone)):
    """Submit post-visit feedback for a session."""
    session_id = request.get("session_id")
    rating = request.get("rating")
    comment = request.get("comment", "")

    if not session_id or not rating:
        raise HTTPException(400, detail="session_id and rating are required.")
    if not (1 <= int(rating) <= 5):
        raise HTTPException(400, detail="Rating must be between 1 and 5.")

    try:
        await database.save_patient_feedback(session_id, phone, int(rating), comment)
        return {"status": "saved"}
    except Exception as e:
        logger.error(f"Error saving feedback: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/portal/export")
async def export_all_records(phone: str = Depends(get_verified_phone)):
    """Export all patient records as a single JSON bundle (Health Vault)."""
    try:
        history = await database.fetch_patient_history_by_identifier(phone)
        documents = await database.fetch_patient_documents_by_identifier(phone)
        patient_info = await database.fetch_patient_info_by_phone(phone)

        return {
            "patient": patient_info,
            "consultations": history,
            "documents": documents,
            "exported_at": _time.strftime("%Y-%m-%dT%H:%M:%SZ", _time.gmtime()),
        }
    except Exception as e:
        logger.error(f"Error exporting records: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
