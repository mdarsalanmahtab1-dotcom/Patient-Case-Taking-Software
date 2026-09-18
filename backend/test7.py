from dialogue_manager import DialogueManager
from pdf_generator import generate_summary_pdf

dm = DialogueManager()
dm.record.patient_name = "Test User"
dm.record.patient_age = 30
dm.record.patient_sex = "Male"
dm.record.chief_complaint = "Fever and cough"
dm.record.filled_state = {
    "duration": {"value": "3 days"},
    "severity": {"value": "High"}
}
dm.record.document_extractions = []

pdf_data = dm.record.model_dump()
pdf_data["priority_flag"] = True
pdf_data["priority_reason"] = "High Fever"
pdf_data["token_id"] = "tok_12345"
pdf_data["clinic_mode"] = dm.record.clinic_mode

pdf_bytes = generate_summary_pdf(pdf_data)

if pdf_bytes:
    print(f"Success, generated {len(pdf_bytes)} bytes")
else:
    print("Failed")
