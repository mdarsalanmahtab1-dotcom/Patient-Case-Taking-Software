import re

with open('routes_extended.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix admin_dashboard
code = re.sub(
    r'async def admin_dashboard\(.*?conn = _get_db\(\).*?return stats',
    '''async def admin_dashboard(staff: dict = Depends(_require_role("ADMIN"))):
    if not database._pool: return {}
    async with database._pool.acquire() as conn:
        stats = {
            "total_patients": (await conn.fetchrow("SELECT COUNT(*) as c FROM patients"))["c"],
            "total_sessions": (await conn.fetchrow("SELECT COUNT(*) as c FROM patient_sessions"))["c"],
            "queue_waiting": (await conn.fetchrow("SELECT COUNT(*) as c FROM patient_sessions WHERE status = 'waiting'"))["c"],
            "queue_priority": (await conn.fetchrow("SELECT COUNT(*) as c FROM patient_sessions WHERE priority_flag = TRUE AND status != 'completed'"))["c"],
            "total_summaries": (await conn.fetchrow("SELECT COUNT(*) as c FROM clinical_summaries"))["c"],
            "total_staff": (await conn.fetchrow("SELECT COUNT(*) as c FROM staff"))["c"],
            "total_doctors": (await conn.fetchrow("SELECT COUNT(*) as c FROM doctors"))["c"],
        }
    return stats''',
    code, flags=re.DOTALL
)

# Fix complete_session_doctor
code = re.sub(
    r'async def complete_session_doctor\(.*?conn = _get_db\(\).*?return \{"status": "success"\}',
    '''async def complete_session_doctor(session_id: str, req: CompleteSessionReq):
    doc_prescription_str = f"[{req.action}] {req.doctor_prescription}"
    if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute(
                "UPDATE patient_sessions SET doctor_prescription = $1, session_status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE session_id = $2", 
                doc_prescription_str, session_id
            )
            
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            await client.post("http://localhost:8000/api/admin/notifications", json={
                "message": f"Patient session {session_id} completed.",
                "doctor_id": 0
            })
    except:
        pass
        
    return {"status": "success"}''',
    code, flags=re.DOTALL
)

with open('routes_extended.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Final _get_db fix applied")
