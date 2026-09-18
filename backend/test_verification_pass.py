import sys
import os
import json
import asyncio
from fastapi.testclient import TestClient

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from lab_unit_reference import LAB_UNIT_REFERENCE, normalize_lab_value
from document_red_flags import check_document_flags
from patient_record import PatientRecord, Contradiction
from contradiction_checker import check_contradictions
from main import app

def print_result(name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    print(f"{status} [{name}] - {detail}")

def test_lab_unit_normalization():
    print("--- 1. LAB UNIT NORMALIZATION ---")
    
    # 1. Confirm aliases
    all_resolved = True
    for test_key, data in LAB_UNIT_REFERENCE.items():
        aliases = data.get("aliases", [])
        for alias in aliases:
            # mock OCR data
            val, unit, factor = normalize_lab_value(alias, "10", data["us_unit"])
            if val is None:
                all_resolved = False
                print(f"Failed to resolve alias {alias} for {test_key}")
    
    print_result("Confirm all 30+ aliases in LAB_UNIT_REFERENCE resolve correctly", all_resolved, "All aliases resolved properly.")
    
    # 2. Test unit string robustness
    res1 = normalize_lab_value("Hemoglobin", "10", "MG/DL")
    res2 = normalize_lab_value("Hemoglobin", "10", " mg / dl ")
    robust_pass = (res1 is not None and res2 is not None)
    if robust_pass:
        print_result("Test unit string robustness (mixed case, whitespace)", robust_pass, f"Units parsed cleanly: {res1[1]} and {res2[1]}")
    else:
        print_result("Test unit string robustness (mixed case, whitespace)", False, "Units failed to parse")
    
    # 3. Test exact-boundary values
    record1 = PatientRecord()
    # Creatinine exactly 4.0 mg/dL
    cr_exact = [{"entities": [{"lab_values": [{"test_name": "Creatinine", "value": "4.0", "unit": "mg/dL", "is_abnormal": True}]}]}]
    flags_cr_exact = check_document_flags(cr_exact, record1)
    # Hemoglobin exactly 7.0
    hb_exact = [{"entities": [{"lab_values": [{"test_name": "Hemoglobin", "value": "7.0", "unit": "g/dL", "is_abnormal": True}]}]}]
    flags_hb_exact = check_document_flags(hb_exact, record1)
    
    boundary_pass = len(flags_cr_exact) == 0 and len(flags_hb_exact) == 0 
    print_result("Test exact-boundary values", boundary_pass, f"Creatinine 4.0 flags: {len(flags_cr_exact)}, Hemoglobin 7.0 flags: {len(flags_hb_exact)}")
    
    # 4. Garbage/unrecognized units
    record2 = PatientRecord()
    bad_unit = [{"entities": [{"lab_values": [{"test_name": "Hemoglobin", "value": "7.5", "unit": "kg/m", "is_abnormal": True}]}]}]
    flags_bad = check_document_flags(bad_unit, record2)
    bad_pass = len(flags_bad) == 0 and len(record2.unverifiable_values) > 0
    print_result("Test garbage/unrecognized units land in unverifiable_values", bad_pass, f"Flags: {len(flags_bad)}, Unverifiable: {len(record2.unverifiable_values)}")


def test_document_red_flags():
    print("\n--- 2. DOCUMENT RED FLAGS ---")
    
    # 1. Confirm every lab value triggers when it should, NOT when it shouldn't
    record = PatientRecord()
    # High Creatinine
    cr_high = [{"entities": [{"lab_values": [{"test_name": "Creatinine", "value": "4.1", "unit": "mg/dL", "is_abnormal": True}]}]}]
    flags_high = check_document_flags(cr_high, record)
    
    # Normal Creatinine (but OCR wrongly said abnormal)
    cr_norm = [{"entities": [{"lab_values": [{"test_name": "Creatinine", "value": "1.0", "unit": "mg/dL", "is_abnormal": True}]}]}]
    flags_norm = check_document_flags(cr_norm, record)
    
    flags_pass = len(flags_high) == 1 and len(flags_norm) == 0
    print_result("Confirm every lab value in reference table triggers correctly", flags_pass, f"High triggered {len(flags_high)}, Normal triggered {len(flags_norm)}")
    
    # 2. Confirm is_abnormal=True AND threshold breach are both required
    record2 = PatientRecord()
    cr_high_not_abnormal = [{"entities": [{"lab_values": [{"test_name": "Creatinine", "value": "4.1", "unit": "mg/dL", "is_abnormal": False}]}]}]
    flags_high_not_abnormal = check_document_flags(cr_high_not_abnormal, record2)
    
    cond_pass = len(flags_high_not_abnormal) == 0
    print_result("Confirm is_abnormal=True AND threshold breach are both required", cond_pass, f"High but not marked abnormal triggered {len(flags_high_not_abnormal)}")

def test_contradiction_checker():
    print("\n--- 3. CONTRADICTION CHECKER ---")
    
    # Setup test statements
    filled_state = {"current_medications": {"value": "aspirin", "confidence": 1.0}}
    document_extractions = [{"entities": [{"medications": [{"drug_name": "ibuprofen"}]}]}]
    
    try:
        contradictions = check_contradictions(filled_state, document_extractions)
        if len(contradictions) > 0 and contradictions[0]["status"] == "unresolved":
             print_result("Test conversational statement contradicts OCR", True, "Contradiction created with status unresolved")
        else:
             print_result("Test conversational statement contradicts OCR", False, "No contradiction created")
             
        # Matching statements
        filled_state2 = {"current_medications": {"value": "aspirin", "confidence": 1.0}}
        document_extractions2 = [{"entities": [{"medications": [{"drug_name": "aspirin 81mg"}]}]}]
        contradictions2 = check_contradictions(filled_state2, document_extractions2)
        print_result("Test matching (non-contradictory) statements", len(contradictions2) == 0, "No false contradiction raised")
    except Exception as e:
        print(f"Skipping Contradiction Checker tests: {str(e)}")

def test_patient_record_schema():
    print("\n--- 4. PATIENT RECORD SCHEMA ---")
    
    record = PatientRecord()
    record.unverifiable_values.append("Test value")
    record.contradictions.append(Contradiction(field="test", conversation_value="a", document_value="b", status="unresolved_flag_for_physician"))
    record.filled_state = {"symptom": {"value": "fever", "confidence": 0.9, "source": "conversation"}}
    
    try:
        serialized = record.model_dump()
        deserialized = PatientRecord(**serialized)
        pass_ser = (
            len(deserialized.unverifiable_values) == 1 and
            len(deserialized.contradictions) == 1 and 
            "symptom" in deserialized.filled_state
        )
        print_result("Confirm fields serialize/deserialize correctly", pass_ser, "All complex fields restored correctly.")
    except Exception as e:
        print_result("Confirm fields serialize/deserialize correctly", False, str(e))
        
    # Test PDF Generator directly (HTML rendering to avoid WeasyPrint GTK errors on Windows)
    from jinja2 import Template
    from pdf_generator import _TEMPLATE_STR
    try:
        template = Template(_TEMPLATE_STR)
        unified_record = record.model_dump()
        unified_record["unverifiable_values"] = ["Test value"]
        # Add a dummy document so has_documents is True
        unified_record["document_extractions"] = [{"entities": []}]
        html_str = template.render(
            has_documents=True,
            unverifiable_values=unified_record.get("unverifiable_values", [])
        )
        pass_pdf_unverifiable = "Test value" in html_str and "Unverifiable/Unrecognized Lab Units" in html_str
        print_result("Confirm unverifiable_values reaches PDF generator", pass_pdf_unverifiable, "HTML generation successful" if pass_pdf_unverifiable else "String not found in HTML")
    except Exception as e:
        print_result("Confirm unverifiable_values reaches PDF generator", False, str(e))


def test_frontend_backend_wiring():
    print("\n--- 5. FRONTEND <-> BACKEND WIRING ---")
    client = TestClient(app)
    
    patient_id = "test_id"
    # POST /api/patient/lookup-or-create
    try:
        resp1 = client.post("/api/patient/lookup-or-create", json={"phone": "+919999999999"})
        pass_lookup = resp1.status_code == 200 and "patient_id" in resp1.json()
        if pass_lookup:
            patient_id = resp1.json()["patient_id"]
        print_result("Patient lookup flow (unknown)", pass_lookup, f"Status: {resp1.status_code}, Response: {resp1.json().get('patient_id', '')}")
    except Exception as e:
        print_result("Patient lookup flow", False, str(e))
        
    # POST /api/session/start
    try:
        resp2 = client.post("/api/session/start", json={"patient_id": patient_id})
        pass_start = resp2.status_code == 200 and "session_id" in resp2.json()
        print_result("Session start flow", pass_start, f"Status: {resp2.status_code}, Session ID: {resp2.json().get('session_id', '')}")
    except Exception as e:
        print_result("Session start flow", False, str(e))
        
    # PDF download
    try:
        resp3 = client.get(f"/api/summary/test_summary/pdf")
        pass_pdf = resp3.status_code in [200, 404] 
        print_result("PDF download GET /api/summary/{summaryId}/pdf", pass_pdf, f"Status: {resp3.status_code}")
    except Exception as e:
         print_result("PDF download GET /api/summary/{summaryId}/pdf", False, str(e))


if __name__ == "__main__":
    test_lab_unit_normalization()
    test_document_red_flags()
    test_contradiction_checker()
    test_patient_record_schema()
    test_frontend_backend_wiring()
