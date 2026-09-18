import re

asyncpg_fallback = """@extended_router.get("/api/summary/{session_id}/pdf")
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
            
        if row and row["pdf_file_path"] and os.path.exists(row["pdf_file_path"]):
            return FileResponse(row["pdf_file_path"], media_type="application/pdf", filename=f"{row['summary_id']}.pdf")
            
        # ── On-demand PDF generation fallback ──
        import dialogue_manager
        dm = dialogue_manager._active_sessions.get(session_id)
        
        q_row = await conn.fetchrow("SELECT priority_flag, priority_reason, token_id FROM queue WHERE session_id = $1", session_id)
        p_sess = await conn.fetchrow("SELECT chief_complaint, patient_id, doctor_prescription FROM patient_sessions WHERE session_id = $1", session_id)
        
        if not p_sess:
            raise HTTPException(404, "Session not found")
            
        p_info = await conn.fetchrow("SELECT full_name, age, gender FROM patients WHERE patient_id = $1", p_sess["patient_id"])
        
        try:
            from pdf_generator import generate_summary_pdf
            from llm_client import generate_clinical_summary
            
            extracted_medications = []
            extracted_labs = []
            uploaded_images = []
            
            if dm:
                raw_extractions = [ext.model_dump() for ext in dm.record.document_extractions]
                for ext in raw_extractions:
                    if "medications" in ext:
                        for med in ext["medications"]:
                            extracted_medications.append({
                                "name": med.get("name", ""),
                                "dosage": med.get("dose", ""),
                                "frequency": med.get("frequency", "")
                            })
                    if "lab_results" in ext:
                        for lab in ext["lab_results"]:
                            extracted_labs.append({
                                "test_name": lab.get("test_name", ""),
                                "value": str(lab.get("value", "")),
                                "unit": lab.get("unit", ""),
                                "is_abnormal": lab.get("is_abnormal", False)
                            })
                uploaded_images = [doc.ocr_path for doc in dm.record.document_extractions if getattr(doc, 'ocr_path', None)]
                
            ai_summary = generate_clinical_summary(dm.record.filled_state, extracted_medications, extracted_labs) if dm else {"Narrative": "", "Assessment": []}
            ocr_data = ""
            
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
                    "name": p_info["full_name"] if p_info else "Unknown",
                    "age": str(p_info["age"]) if p_info else "",
                    "gender": p_info["gender"] if p_info else "",
                    "id": p_sess["patient_id"],
                    "phone": "Not Provided",
                    "visit_type": "OPD Intake"
                },
                "timestamp": datetime.utcnow().strftime("%d/%m/%Y %I:%M %p"),
                "department": "General Medicine",
                "doctor_name": "Duty Medical Officer",
                "room_no": "OPD Room 01",
                "vitals": {}, 
                "red_flag_active": bool(q_row["priority_flag"]) if q_row else False,
                "triage_reason": q_row["priority_reason"] if q_row else "",
                "ai_summary": ai_summary,
                "ocr_data": ocr_data,
                "uploaded_images": uploaded_images,
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
            pdf_dir = os.path.join(os.path.dirname(__file__), "generated_pdfs")
            os.makedirs(pdf_dir, exist_ok=True)
            pdf_path = os.path.join(pdf_dir, f"{summary_id}.pdf")
            with open(pdf_path, "wb") as f:
                f.write(pdf_bytes)
                
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
                
            return FileResponse(pdf_path, media_type="application/pdf", filename=f"{summary_id}.pdf")
        except Exception as e:
            import traceback
            traceback.print_exc()
            raise HTTPException(500, f"Failed to generate PDF: {e}")
"""

with open('routes_extended.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace the existing simple get_summary_pdf with the asyncpg fallback version
old_pattern = re.compile(r'@extended_router\.get\("/api/summary/\{session_id\}/pdf"\)\nasync def get_summary_pdf.*?return FileResponse[^\n]+', re.DOTALL)
new_code = old_pattern.sub(asyncpg_fallback.replace('\\', '\\\\'), code)

with open('routes_extended.py', 'w', encoding='utf-8') as f:
    f.write(new_code)

print("Patched successfully!")
