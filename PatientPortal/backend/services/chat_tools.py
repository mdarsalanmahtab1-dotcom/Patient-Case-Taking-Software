"""
SCOPED PATIENT & HOSPITAL TOOLS FOR SWASTHYASYNC AI
All queries are hard-bound to the authenticated user's identifier (phone or abha_id).
The LLM cannot change or spoof the authorized identifier.
"""

import json
import logging
import database
from services.hospital_knowledge import (
    search_hospital_knowledge,
    HOSPITAL_PROFILE,
    HOSPITAL_DEPARTMENTS,
    KIOSK_KNOWLEDGE,
    HOSPITAL_FAQS
)

logger = logging.getLogger(__name__)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PATIENT-SPECIFIC SCOPED TOOLS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def get_my_profile(identifier: str) -> dict:
    """Returns basic demographic profile for the authorized patient."""
    info = await database.fetch_patient_info_by_phone(identifier)
    return info or {}

async def get_my_medical_history(identifier: str) -> list[dict]:
    """Returns chronological list of past completed consultations."""
    history = await database.fetch_patient_history_by_identifier(identifier)
    summary_list = []
    for h in history:
        summary_list.append({
            "session_id": h.get("session_id"),
            "date": h.get("completed_at"),
            "department": h.get("department"),
            "doctor": h.get("doctor_name"),
            "complaint": h.get("chief_complaint"),
            "summary": h.get("small_summary"),
            "doctor_notes": h.get("doctor_consultation_notes")
        })
    return summary_list

async def get_my_latest_case_summary(identifier: str) -> dict:
    """Returns the most recent detailed clinical consultation summary."""
    rec = await database.fetch_latest_clinical_record(identifier)
    if not rec:
        return {}
    return {
        "summary": rec.get("full_detailed_summary", {}),
        "doctor_notes": rec.get("doctor_consultation_notes", "")
    }

async def get_my_latest_reports(identifier: str) -> list[dict]:
    """Extracts lab test reports from the patient's latest clinical summaries."""
    rec = await database.fetch_latest_clinical_record(identifier)
    if not rec:
        return []
    
    extracted_labs = []
    full_sum = rec.get("full_detailed_summary", {})
    if isinstance(full_sum, dict):
        # Look for labs in ocr_data or document extractions
        ocr_data = full_sum.get("ocr_data", {})
        if isinstance(ocr_data, dict) and "extracted_labs" in ocr_data:
            extracted_labs.extend(ocr_data["extracted_labs"])
            
        doc_exts = full_sum.get("document_extractions", [])
        if isinstance(doc_exts, list):
            for doc in doc_exts:
                if isinstance(doc, dict) and "lab_values" in doc:
                    extracted_labs.extend(doc["lab_values"])
                    
        # Check standard assessment
        if "lab_values" in full_sum:
            extracted_labs.extend(full_sum["lab_values"])

    return extracted_labs

async def get_my_prescriptions(identifier: str) -> list[dict]:
    """Retrieves active medications and doctor prescriptions."""
    rec = await database.fetch_latest_clinical_record(identifier)
    if not rec:
        return []

    medications = []
    full_sum = rec.get("full_detailed_summary", {})
    
    # Check doctor's final prescription
    doc_rx = full_sum.get("doctor_prescription") or rec.get("doctor_consultation_notes")
    if doc_rx:
        medications.append({
            "type": "Doctor Consultation Prescription",
            "details": doc_rx
        })
        
    ocr_data = full_sum.get("ocr_data", {})
    if isinstance(ocr_data, dict) and "extracted_medications" in ocr_data:
        for m in ocr_data["extracted_medications"]:
            medications.append({
                "type": "Scanned Past Medication",
                "name": m.get("name") or m.get("drug_name"),
                "dosage": m.get("dosage"),
                "frequency": m.get("frequency"),
                "duration": m.get("duration", "As Directed")
            })

    return medications

async def get_my_vitals(identifier: str) -> dict:
    """Retrieves baseline physiological vitals recorded for the patient."""
    if not database._pool:
        return {}
    async with database._pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT p.vitals, p.weight, p.height
            FROM patients p
            WHERE (p.phone_number = $1 OR p.abha_id = $1)
            LIMIT 1
        """, identifier)
        if not row:
            return {}
        return dict(row)

async def get_my_uploaded_documents(identifier: str) -> list[dict]:
    """Returns metadata of all previous documents uploaded at the kiosk or portal."""
    docs = await database.fetch_patient_documents_by_identifier(identifier)
    return docs

async def get_my_queue_status(phone: str) -> list[dict]:
    """Returns the patient's active live OPD token and waiting position."""
    queue = await database.fetch_active_queue_for_phone(phone)
    return queue

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  HOSPITAL & KIOSK KNOWLEDGE TOOLS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def get_kiosk_information() -> dict:
    """Returns official kiosk specifications and user guidance."""
    return KIOSK_KNOWLEDGE

def get_hospital_departments() -> list[dict]:
    """Returns hospital department directory."""
    return HOSPITAL_DEPARTMENTS

def get_hospital_faq() -> list[dict]:
    """Returns common hospital FAQs."""
    return HOSPITAL_FAQS

def search_hospital(query: str) -> dict:
    """Keyword search in hospital and kiosk knowledge."""
    return search_hospital_knowledge(query)
