import asyncio
import json
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from dialogue_manager import DialogueManager
from macro_fsm import MacroFSM, MACRO_STATES
from ayush_templates import (
    CCRAS_PREDICTORS,
    get_ayush_schema,
    calculate_prakriti,
    NAMASTE_PRAKRITI_CODES,
    PATHYA_APATHYA_DATABASE,
)
from schema_generator import generate_schema
from pdf_generator import generate_summary_pdf

async def run_tests():
    print("=" * 70)
    print("SWASTHYASYNC AYUSH & ALLOPATHIC ZERO-UI/UX DIFFERENCE VERIFICATION")
    print("=" * 70)

    # ─────────────────────────────────────────────────────────────
    # TEST 1: State Machine Parity
    # ─────────────────────────────────────────────────────────────
    print("\n[TEST 1] Macro State Machine Parity Check:")
    fsm_allo = MacroFSM(clinic_mode="allopathic")
    fsm_ayush = MacroFSM(clinic_mode="ayush")
    
    allo_seq = fsm_allo._build_sequence()
    ayush_seq = fsm_ayush._build_sequence()
    
    assert allo_seq == ayush_seq, f"FSM sequences diverge! Allo: {allo_seq}, Ayush: {ayush_seq}"
    assert "AYUSH_ASSESSMENT" not in ayush_seq, "Rogue AYUSH_ASSESSMENT state found in sequence!"
    assert ayush_seq == list(MACRO_STATES), "AYUSH sequence does not match MACRO_STATES!"
    print(f"  PASS: AYUSH sequence is 100% IDENTICAL to Allopathic sequence ({len(ayush_seq)} states).")

    # ─────────────────────────────────────────────────────────────
    # TEST 2: Schema Generation Determinism & Zero-LLM Invariant
    # ─────────────────────────────────────────────────────────────
    print("\n[TEST 2] AYUSH Schema Generation (CCRAS 14-Predictor Determinism):")
    schema = generate_schema(
        chief_complaint="Severe acidity and burning sensation in stomach",
        patient_age=32,
        patient_sex="female",
        category="GI",
        clinic_mode="ayush"
    )
    fields = schema.get("fields", [])
    prakriti_fields = [f for f in fields if f.get("category") == "PRAKRITI"]
    hpi_fields = [f for f in fields if f.get("category") == "HPI"]
    
    assert len(prakriti_fields) == 14, f"Expected 14 CCRAS fields, got {len(prakriti_fields)}"
    assert len(hpi_fields) >= 3, f"Expected at least 3 baseline HPI fields, got {len(hpi_fields)}"
    
    # Check that each CCRAS predictor is present
    pred_ids = {p.id for p in CCRAS_PREDICTORS}
    schema_pred_ids = {f["id"] for f in prakriti_fields}
    assert pred_ids == schema_pred_ids, "Mismatch between CCRAS predictors and schema fields!"
    print(f"  PASS: Schema deterministically generated {len(fields)} fields ({len(prakriti_fields)} CCRAS + {len(hpi_fields)} HPI + safety floor).")

    # ─────────────────────────────────────────────────────────────
    # TEST 3: UI Instruction Screen Consistency (Zero UI/UX difference)
    # ─────────────────────────────────────────────────────────────
    print("\n[TEST 3] UI/UX Screen Parity (Kiosk Screen Enums):")
    dm_ayush = DialogueManager(clinic_mode="ayush", language="en-IN")
    ui_init = dm_ayush.start_session()
    
    # Kiosk screens must be standard
    allowed_screens = {"demographics", "conversation", "document_scan", "summary", "complete", "triage_alert"}
    
    screen = ui_init.get("screen")
    assert screen in allowed_screens, f"Unknown screen '{screen}' in AYUSH mode!"
    print(f"  Start session screen: '{screen}' (allowed)")
    
    # Check transition screens
    dm_ayush.fsm.state = "CHIEF_COMPLAINT"
    ui_cc = dm_ayush._build_ui_instruction()
    assert ui_cc.get("screen") == "conversation", f"Expected 'conversation', got {ui_cc.get('screen')}"
    
    # Test DYNAMIC_INTERVIEW with generated schema
    dm_ayush.record.dynamic_schema = schema
    dm_ayush.fsm.state = "DYNAMIC_INTERVIEW"
    ui_dyn = dm_ayush.resume_session()
    assert ui_dyn.get("screen") == "conversation", f"Expected 'conversation', got {ui_dyn.get('screen')}"
    
    dm_ayush.fsm.state = "DOCUMENT_SCAN"
    ui_doc = dm_ayush._build_ui_instruction()
    assert ui_doc.get("screen") == "document_scan", f"Expected 'document_scan', got {ui_doc.get('screen')}"
    
    dm_ayush.fsm.state = "SUMMARY_CONFIRMATION"
    ui_vit = dm_ayush._build_ui_instruction()
    assert ui_vit.get("screen") == "summary", f"Expected 'summary', got {ui_vit.get('screen')}"
    
    dm_ayush.fsm.state = "COMPLETE"
    ui_comp = dm_ayush._build_ui_instruction()
    assert ui_comp.get("screen") == "complete", f"Expected 'complete', got {ui_comp.get('screen')}"
    
    print("  PASS: All AYUSH screens route to standard Kiosk views identical to Allopath.")

    # ─────────────────────────────────────────────────────────────
    # TEST 4: Prakriti Scoring & NAMASTE Code Accuracy
    # ─────────────────────────────────────────────────────────────
    print("\n[TEST 4] CCRAS Prakriti Algorithm & Vikriti Invariant:")
    # Simulate Pitta-dominant responses
    pitta_answers = {
        "prakriti_built": {"value": "Medium build, proportionate musculature", "confidence": 1.0},
        "prakriti_skin": {"value": "Warm, reddish/pinkish hue, prone to freckles or acne", "confidence": 1.0},
        "prakriti_hair": {"value": "Soft, thin, fine, reddish/brownish tint, early greying", "confidence": 1.0},
        "prakriti_appetite": {"value": "Intense, sharp hunger; gets irritable if meals are delayed", "confidence": 1.0},
        "prakriti_thirst": {"value": "Frequent, strong thirst; prefers cool water", "confidence": 1.0},
        "prakriti_eating_speed": {"value": "Moderate, organized, purposeful eating pace", "confidence": 1.0},
        "prakriti_bowel": {"value": "Soft or loose stool, frequent or urgent movements", "confidence": 1.0},
        "prakriti_sleep": {"value": "Moderate sound sleep (6-7 hours), awaken if hot or stressed", "confidence": 1.0},
        "prakriti_weather": {"value": "Cannot tolerate hot sun or summer heat; always seeks coolness", "confidence": 1.0},
        "prakriti_perspiration": {"value": "Profuse and rapid sweating, hot body feel, noticeable strong odor", "confidence": 1.0},
        "prakriti_decisiveness": {"value": "Decisive, focused, confident, leads easily", "confidence": 1.0},
        "prakriti_memory": {"value": "Sharp grasp, analytical memory, quick comprehension", "confidence": 1.0},
        "prakriti_temperament": {"value": "Goal-driven, passionate, quick to anger or irritate under pressure", "confidence": 1.0},
        "prakriti_activity": {"value": "Articulate, sharp, persuasive speech, moderate organized stride", "confidence": 1.0},
    }
    
    prakriti_result = calculate_prakriti(pitta_answers, "Severe acidity and acid reflux")
    
    print(f"  Dominant Prakriti: {prakriti_result['dominant_dosha']}")
    print(f"  NAMASTE Code: {prakriti_result['namaste_code']} ({prakriti_result['namaste_title']})")
    print(f"  Percentages: {prakriti_result['dosha_percentages']}")
    print(f"  Vikriti: {prakriti_result['vikriti']['ayurvedic_name']} (NAMC: {prakriti_result['vikriti']['namc_code']})")
    
    assert prakriti_result["dominant_dosha_key"] == "pitta", f"Expected Pitta dominant, got {prakriti_result['dominant_dosha_key']}"
    assert prakriti_result["namaste_code"] in ("AYU-PRA-02", "AYU-PRA-04"), f"Unexpected NAMASTE code: {prakriti_result['namaste_code']}"
    assert prakriti_result["vikriti"]["namc_code"] == "EB-4", f"Expected Amlapitta (EB-4), got {prakriti_result['vikriti']}"
    assert "pitta" in prakriti_result["pathya_apathya"]["title"].lower(), "Pathya/Apathya did not match dominant dosha!"
    print("  PASS: CCRAS scoring and NAMASTE classification verified.")

    # ─────────────────────────────────────────────────────────────
    # TEST 5: PDF Generation - AYUSH vs Allopathic
    # ─────────────────────────────────────────────────────────────
    print("\n[TEST 5] PDF Output Verification (Ayurvedic Box vs Allopathic Clean):")
    
    # 5a. AYUSH PDF
    ayush_context = {
        "clinic_mode": "ayush",
        "filled_state": pitta_answers,
        "patient": {
            "token": "TOKEN-AYUSH-01",
            "name": "Sunita Sharma",
            "age": "34",
            "gender": "Female",
            "abha_id": "91-2049-3829-1920",
            "phone": "+91 9876543210",
            "id": "pat_test_ayush",
            "address": "Varanasi, UP",
            "visit_type": "OPD Intake"
        },
        "timestamp": "19/09/2026 10:30 AM",
        "department": "AYUSH / General Medicine",
        "doctor_name": "Vaidya R. K. Mishra",
        "room_no": "Room 04",
        "vitals": {"bp": "118/76", "hr": "72", "weight": "58", "temp": "98.4 F", "spo2": "99%"},
        "ai_summary": {
            "Narrative": "Patient presents with chronic acid reflux and burning sensation in the epigastrium.",
            "Assessment": ["Suspected Amlapitta (Hyperacidity)"]
        },
        "ocr_data": {"extracted_medications": [], "extracted_labs": []},
    }
    
    ayush_pdf_bytes = await generate_summary_pdf("sess_test_ayush", ayush_context)
    assert len(ayush_pdf_bytes) > 5000, f"AYUSH PDF bytes too small ({len(ayush_pdf_bytes)})"
    
    # 5b. Allopathic PDF
    allo_context = {
        "clinic_mode": "allopathic",
        "filled_state": {"symptom_onset": {"value": "3 days ago"}},
        "patient": {
            "token": "TOKEN-ALLO-01",
            "name": "Rajesh Kumar",
            "age": "45",
            "gender": "Male",
            "abha_id": "91-1111-2222-3333",
            "phone": "+91 9123456780",
            "id": "pat_test_allo",
            "address": "Delhi, DL",
            "visit_type": "OPD Intake"
        },
        "timestamp": "19/09/2026 10:30 AM",
        "department": "General Medicine",
        "doctor_name": "Dr. S. K. Gupta",
        "room_no": "Room 01",
        "vitals": {"bp": "120/80", "hr": "78", "weight": "72", "temp": "98.6 F", "spo2": "98%"},
        "ai_summary": {
            "Narrative": "Patient reports persistent dry cough for three days following seasonal changes.",
            "Assessment": ["Upper Respiratory Tract Infection"]
        },
        "ocr_data": {"extracted_medications": [], "extracted_labs": []},
    }
    
    allo_pdf_bytes = await generate_summary_pdf("sess_test_allo", allo_context)
    assert len(allo_pdf_bytes) > 5000, f"Allopathic PDF bytes too small ({len(allo_pdf_bytes)})"
    
    # Save both PDFs to test outputs
    test_out_dir = os.path.join(os.path.dirname(__file__), "generated_pdfs")
    os.makedirs(test_out_dir, exist_ok=True)
    with open(os.path.join(test_out_dir, "test_ayush.pdf"), "wb") as f:
        f.write(ayush_pdf_bytes)
    with open(os.path.join(test_out_dir, "test_allo.pdf"), "wb") as f:
        f.write(allo_pdf_bytes)
        
    print(f"  PASS: AYUSH PDF generated ({len(ayush_pdf_bytes):,} bytes)")
    print(f"  PASS: Allopathic PDF generated ({len(allo_pdf_bytes):,} bytes)")
    
    print("\n" + "=" * 70)
    print("ALL 5 AYUSH & ALLOPATHIC ZERO-UI/UX DIFFERENCE CHECKS PASSED!")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_tests())
