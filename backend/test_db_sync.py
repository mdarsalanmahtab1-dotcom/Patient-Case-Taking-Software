import asyncio
import os
import json
from dotenv import load_dotenv

load_dotenv()

import database

async def test_db_sync():
    print("Initializing DB...")
    await database.init_db_pool()
    if not database._pool:
        print("Failed to initialize DB pool.")
        return

    # 1. Initial Session Creation
    print("\n--- 1. Testing Session Creation ---")
    mock_patient_data = {
        "full_name": "Sync Test Patient",
        "phone_number": "1234567890",
        "age": 30,
        "gender": "male"
    }

    session_info = await database.start_kiosk_session(mock_patient_data, "Cardiology")
    session_id = session_info.get("session_id")
    if not session_id:
        if session_info.get("conflict"):
            print("Session conflict! Cannot test.")
        return
        
    print(f"Created session: {session_id}")

    async with database._pool.acquire() as conn:
        sess_row = await conn.fetchrow("SELECT * FROM patient_sessions WHERE session_id = $1", session_id)
        assert sess_row is not None, "Session not found in DB"
        assert sess_row["session_status"] == "IN_PROGRESS", f"Expected IN_PROGRESS, got {sess_row['session_status']}"
        print("[OK] Session creation verified.")

    # 2. Dialogue Manager Checkpoint Sync
    print("\n--- 2. Testing Checkpoint Sync ---")
    mock_filled_state = {"symptom": "Chest pain", "duration": "2 days"}
    mock_interview_qa = [{"question": "Where is the pain?", "answer": "Chest"}]
    mock_chief_complaint = "Chest pain for 2 days"

    await database.commit_fsm_checkpoint(
        session_id=session_id,
        filled_state=mock_filled_state,
        chief_complaint=mock_chief_complaint,
        interview_qa=mock_interview_qa,
        priority_flag=True,
        priority_reason="Severe pain",
        status="IN_PROGRESS"
    )

    async with database._pool.acquire() as conn:
        sess_row = await conn.fetchrow("SELECT * FROM patient_sessions WHERE session_id = $1", session_id)
        assert json.loads(sess_row["filled_state_json"]) == mock_filled_state
        assert json.loads(sess_row["interview_qa_json"]) == mock_interview_qa
        assert sess_row["chief_complaint"] == mock_chief_complaint
        assert sess_row["priority_flag"] is True
        assert sess_row["priority_reason"] == "Severe pain"
        print("[OK] Checkpoint sync verified.")

    # 3. OCR Document Upload Sync
    print("\n--- 3. Testing OCR Document Sync ---")
    mock_medications = [{"drug_name": "Aspirin", "dosage": "100mg", "frequency": "1-0-0"}]
    mock_labs = [{"test_name": "ECG", "value": "Normal", "is_abnormal": False}]

    doc_id = await database.save_uploaded_document(
        session_id=session_id,
        file_path="/mock/path.jpg",
        document_type="lab_report",
        ocr_raw={"mock": "data"},
        medications=mock_medications,
        labs=mock_labs
    )
    print(f"Uploaded doc: {doc_id}")

    async with database._pool.acquire() as conn:
        doc_row = await conn.fetchrow("SELECT * FROM uploaded_documents WHERE document_id = $1", doc_id)
        assert doc_row is not None
        assert json.loads(doc_row["extracted_medications"]) == mock_medications
        assert json.loads(doc_row["extracted_labs"]) == mock_labs
        print("[OK] OCR Document sync verified.")

    # 4. Nurse Triage Sync (Simulating update via asyncpg)
    print("\n--- 4. Testing Nurse Triage Sync ---")
    async with database._pool.acquire() as conn:
        await conn.execute("UPDATE patient_sessions SET nurse_triage_notes = $1 WHERE session_id = $2", "Patient looks stable", session_id)
        
        sess_row = await conn.fetchrow("SELECT * FROM patient_sessions WHERE session_id = $1", session_id)
        assert sess_row["nurse_triage_notes"] == "Patient looks stable"
        print("[OK] Nurse Triage sync verified.")

    # 5. Doctor Consultation & Clinical Summary Sync
    print("\n--- 5. Testing Clinical Summary Sync ---")
    mock_ai_summary = {"clinical_narrative": "Patient with chest pain..."}
    mock_highlights = ["Check ECG"]

    sum_id = await database.save_clinical_summary(
        session_id=session_id,
        small_summary="Chest pain",
        full_detailed_summary=mock_ai_summary,
        critical_highlights=mock_highlights,
        contradictions_found=[],
        pdf_file_path="/mock/pdf_path.pdf"
    )

    async with database._pool.acquire() as conn:
        await conn.execute("UPDATE patient_sessions SET session_status = 'COMPLETED', doctor_prescription = '[Rx] Rest' WHERE session_id = $1", session_id)

        sum_row = await conn.fetchrow("SELECT * FROM clinical_summaries WHERE session_id = $1", session_id)
        assert sum_row is not None
        assert json.loads(sum_row["full_detailed_summary"]) == mock_ai_summary
        assert json.loads(sum_row["critical_highlights"]) == mock_highlights
        assert sum_row["pdf_file_path"] == "/mock/pdf_path.pdf"

        sess_row = await conn.fetchrow("SELECT * FROM patient_sessions WHERE session_id = $1", session_id)
        assert sess_row["session_status"] == "COMPLETED"
        assert sess_row["doctor_prescription"] == "[Rx] Rest"
        print("[OK] Doctor & Clinical Summary sync verified.")

    print("\n[SUCCESS] All database synchronization tests passed successfully!")
    
    # Cleanup mock data
    async with database._pool.acquire() as conn:
        await conn.execute("DELETE FROM patient_sessions WHERE session_id = $1", session_id)
        await conn.execute("DELETE FROM patients WHERE phone_number = '1234567890'")

    await database.close_db_pool()

if __name__ == "__main__":
    asyncio.run(test_db_sync())
