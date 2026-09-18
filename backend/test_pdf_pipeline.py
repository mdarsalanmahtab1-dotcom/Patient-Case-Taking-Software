import asyncio
import os
from pdf_generator import pdf_engine, generate_summary_pdf
from llm_client import generate_clinical_summary

# 1. Mock Data Setup
mock_filled_state = {
    "chief_complaint": "Severe crushing chest pain radiating to left arm",
    "onset": "2 hours ago while climbing stairs",
    "severity": "8/10",
    "associated_symptoms": ["Shortness of breath", "Profuse sweating"],
    "past_medical_history": "Hypertension for 5 years",
    "known_allergies": "Penicillin"
}

mock_ocr_data = {
    "extracted_medications": [
        {"name": "Tab. ARKAMIN", "dosage": "100mg", "frequency": "TDS"},
        {"name": "Tab. NICARDIA-R", "dosage": "10mg", "frequency": "BD"}
    ],
    "extracted_labs": [
        {"parameter": "S. Cr", "value": "2.50 mg/dL", "is_abnormal": True},
        {"parameter": "Na+ / K+", "value": "122 / 5.08 mmol/L", "is_abnormal": True},
        {"parameter": "Hb", "value": "9.3 g/dL", "is_abnormal": True}
    ]
}

mock_patient_info = {
    "token": "OP-064",
    "abha_id": "91-8273-1928-10",
    "name": "Mr Md Afroz",
    "gender": "Male",
    "age": "26",
    "phone": "+91 8420744956",
    "visit_type": "OP, Revisit"
}

# Base64 1x1 pixel PNG placeholder for hospital logo testing
from routes_extended import get_logo_b64
DUMMY_LOGO_B64 = get_logo_b64()

async def run_pipeline_test():
    print("[1/4] Starting PDFEngine Playwright Browser Singleton...")
    await pdf_engine.start()

    print("[2/4] Executing Gemini Flash Clinical Synthesis...")
    try:
        # Note: generate_clinical_summary is a synchronous function
        ai_summary = generate_clinical_summary(mock_filled_state, mock_ocr_data)
        print("   [+] LLM Synthesis response received successfully.")
    except Exception as e:
        print(f"   [!] Gemini API call skipped/failed ({e}). Using mock LLM payload.")
        ai_summary = {
            "clinical_narrative": "26-year-old male presenting for follow-up evaluation. Reports recurring episodes of generalized weakness and occasional blackouts over the past 3 days. Known case of Renal Acute Tubular Necrosis (ATN) post-biopsy (18/04/2026). Currently on antihypertensive management.",
            "critical_highlights": [
                "Serum Creatinine elevated at 2.50 mg/dL",
                "Urine analysis indicates trace protein and trace glucose"
            ],
            "contradictions": [
                "Patient reports no active medication, but uploaded records show ongoing Arkamin and Nicardia-R treatment."
            ]
        }

    # 3. Assemble Context Dict for Jinja2
    context = {
        "patient": mock_patient_info,
        "ai_summary": ai_summary,
        "red_flag_active": True,
        "triage_reason": "CRITICAL CARDIAC ALERT: Severe chest pain (8/10) + left arm radiation + elevated Troponin-T.",
        "uploaded_images": [],  # Pass list of base64 strings to test document image rendering
        "logo_b64": DUMMY_LOGO_B64,
        "timestamp": "03/08/2026 10:55 AM",
        "department": "NEPHROLOGY",
        "doctor_name": "Dr. Deepak Shankar Ray",
        "room_no": "OPD Room 12",
        "vitals": {
            "bp": "111/72",
            "hr": "85",
            "temp": "96.9",
            "spo2": "99",
            "weight": "55",
            "pain_score": "4"
        },
        "ocr_data": mock_ocr_data,
        "hospital_name": "Rabindranath Tagore International Institute of Cardiac Sciences",
        "hospital_subtext": "Narayana Health Network • OPD Clinical Casesheet"
    }

    print("[3/4] Rendering HTML via Jinja2 & Exporting PDF via Playwright Chromium...")
    test_session_id = "test_run_999"
    pdf_bytes = await generate_summary_pdf(test_session_id, context)

    pdf_dir = os.path.join(os.path.dirname(__file__), "generated_pdfs")
    os.makedirs(pdf_dir, exist_ok=True)
    pdf_path = os.path.join(pdf_dir, f"sum_{test_session_id}.pdf")
    
    with open(pdf_path, "wb") as f:
        f.write(pdf_bytes)

    print(f"[4/4] PDF Successfully Created at: {pdf_path}")
    
    # 4. Cleanup Singleton
    await pdf_engine.stop()

if __name__ == "__main__":
    asyncio.run(run_pipeline_test())
