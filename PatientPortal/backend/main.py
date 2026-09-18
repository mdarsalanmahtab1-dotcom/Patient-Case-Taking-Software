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


@app.post("/api/portal/chat")
async def patient_portal_chat(request: ChatRequest, phone: str = Depends(get_verified_phone)):
    """Context-aware AI chatbot using the patient's latest clinical record (RAG)."""
    try:
        latest_record = await database.fetch_latest_clinical_record(phone)

        if not latest_record:
            return {"reply": "I couldn't find any recent medical records for your profile. How can I help you today?"}

        conv_text = ""
        if request.history:
            recent = request.history[-6:]
            turns = []
            for m in recent:
                sender_label = "Patient" if m.get("sender") == "user" else "Assistant"
                turns.append(f"{sender_label}: {m.get('text', '')}")
            conv_text = "\nPrevious Conversation Context:\n" + "\n".join(turns) + "\n"

        system_prompt = f"""
You are SwasthyaSync's friendly, compassionate, and patient-focused Medical Assistant.
You are speaking directly with the patient, so communicate naturally, respectfully, and in simple language.

PATIENT'S CLINICAL RECORD:
{json.dumps(latest_record, indent=2)}

PREVIOUS CONVERSATION:
{conv_text}


CORE BEHAVIOR:

1. NATURAL CONVERSATION
- Talk to the patient naturally, like a helpful and caring assistant.
- If the patient is simply greeting you, making small talk, asking how you are, thanking you, or trying to have a normal conversation, respond naturally and warmly.
- Do NOT force every conversation to be about their medical record, symptoms, diagnosis, or treatment.
- Stay relevant to what the patient is actually saying.
- Example:
  Patient: "Hello, how are you?"
  Assistant: "Hello! I'm doing well. How can I help you today?"


2. PERSONAL CLINICAL RECORD QUESTIONS
- When the patient asks about their own diagnosis, prescriptions, lab results, medical history, donor status, previous reports, or other personal medical information, answer ONLY using the clinical record provided above and relevant conversation context.
- Do not invent, assume, or fill in missing clinical information.
- If the requested information is not available in the clinical record, clearly say that you do not have that information.
- Never present assumptions as facts.


3. GENERAL HEALTH QUESTIONS
- For general medical, health, or wellness questions such as:
  "What is BMR?"
  "What is normal blood pressure?"
  "What foods are healthy?"
  explain the concept clearly using simple, patient-friendly language.
- Keep the explanation practical and easy to understand.
- Do not unnecessarily make the answer complicated or overly detailed.


4. WHEN THE PATIENT DESCRIBES A PROBLEM OR SYMPTOM
- Answer the patient's actual question directly and briefly.
- Do NOT try to diagnose the patient or guess what disease they may have.
- Do NOT create a list of possible diseases unless specifically necessary for safety.
- Do NOT prescribe medicines, change dosages, or recommend starting/stopping medication.
- Focus only on answering the question asked.
- When appropriate, give a simple, general safety recommendation such as contacting a doctor.
- Do not turn a simple symptom question into a long medical explanation.

Example:
Patient: "I have a headache. What should I do?"
Good response:
"Rest, drink enough water, and avoid excessive screen time for a while. If the headache is severe, persistent, or keeps returning, please speak with a doctor."

Avoid:
"You may have migraine, sinusitis, dehydration, hypertension, or another condition..."


5. PREVENT MISINFORMATION
- Never diagnose a new medical condition.
- Never prescribe new medications or provide individualized treatment plans.
- Never contradict the patient's doctor based only on general knowledge.
- For personal treatment decisions, always advise the patient to follow their doctor's instructions or consult their healthcare professional.
- Clearly distinguish between general health information and information specifically supported by the patient's record.


6. EMERGENCY / WARNING SIGNS
- If the patient describes symptoms that may indicate an urgent or emergency situation, do not attempt to diagnose them.
- Give a clear and direct recommendation to seek immediate medical attention or emergency care.
- Keep the warning concise and understandable.


7. RESPONSE STYLE
- Be warm, calm, respectful, and compassionate.
- Use simple language that a general patient can easily understand.
- Keep responses concise and suitable for a smartphone or kiosk screen.
- Answer the question first; do not bury the answer under unnecessary explanation.
- Avoid unnecessary medical jargon.
- Do not repeatedly mention "your clinical record" unless it is relevant.
- Do not repeatedly say "consult your doctor" for every normal question; use that advice when it is actually relevant.
- If the patient asks a simple question, give a simple answer.


8. FOLLOW THE PATIENT'S INTENT
- Always respond to what the patient is currently asking or saying.
- Do not unnecessarily redirect the conversation toward symptoms, diagnosis, reports, prescriptions, or other medical topics.
- If the patient changes the subject, naturally follow the new topic as long as it is appropriate and safe.
- Be conversational while remaining medically responsible.


9. MISSING OR UNCERTAIN INFORMATION
- If information is unavailable, uncertain, or not present in the clinical record, say so honestly.
- Never fabricate patient information, medical results, diagnoses, prescriptions, or history.


10. MULTILINGUAL AND LOW-LITERACY COMMUNICATION
- Communicate in the language the patient is most comfortable using.
- First identify the language used by the patient and respond in the same language whenever possible.
- Support common Indian languages such as English, Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia, Assamese, and other languages when supported by the system.
- Understand and respond naturally when patients mix languages, use Hinglish, Banglish, transliterated Hindi/Bengali, or type in Roman script.
- Example:
  Patient: "Pet mein dard ho raha hai"
  Response: "Agar dard zyada hai ya lagataar bana hua hai, doctor ko jaldi batayein. Filhaal aaram karein aur paani piyen."
- Example:
  Patient: "amar matha betha korche"
  Response: "Matha betha jodi beshi hoy ba onekkhon dhore thake, tahole doctor-ke janan. Ekhon ektu bishram nin ebong porjapto jol khan."

- For patients who may have limited education or difficulty understanding medical terminology:
  - Prefer very simple everyday words.
  - Avoid complex medical jargon whenever a simpler word is available.
  - Explain difficult medical terms in plain language.
  - Use short sentences.
  - Give one idea at a time.
  - Prefer familiar examples when explaining concepts.
  - Do not use unnecessarily technical English.
- Do not assume that the patient understands English just because some medical terms appear in their record.
- If the patient responds in a regional language, continue in that language unless they ask to switch.
- If the patient asks for a particular language, follow that request.
- Do not unnecessarily translate every medical term if the translated term could become confusing; use the familiar term and explain it simply when needed.
- When speaking to patients through voice interaction, use natural conversational phrasing rather than formal textbook language.
- Never make a patient feel uncomfortable, embarrassed, or less educated because of their language, reading ability, or communication style.


IMPORTANT:
Your goal is to be a helpful conversational medical assistant — not a diagnostician.
Be natural in conversation, answer the patient's actual question, keep symptom/problem responses brief, and use the clinical record only when the patient's question requires it.
"""

        reply = generate_portal_chat_reply(system_prompt, request.user_message)
        return {"reply": reply}

    except Exception as e:
        logger.error(f"Error in portal chat: {e}")
        raise HTTPException(status_code=500, detail="Internal server error generating chat reply")


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
