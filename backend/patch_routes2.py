import re

with open('routes_extended.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix get_doctors missing await
code = code.replace(
    'doctors = database.get_active_doctors()',
    'doctors = await database.get_active_doctors()'
)

# Replace staff_login
code = re.sub(
    r'@extended_router\.post\("/api/staff/login"\)\nasync def staff_login\(.*?\n.*?return.*?\}',
    '''@extended_router.post("/api/staff/login")
async def staff_login(req: StaffLoginReq):
    import database
    if not database._pool: raise HTTPException(500, "DB error")
    async with database._pool.acquire() as conn:
        row = await conn.fetchrow("SELECT doctor_id, full_name as name, 'DOCTOR' as role FROM doctors WHERE username = $1 AND password = $2 AND status = 'Active'", req.username, req.password)
        if not row:
            raise HTTPException(401, "Invalid credentials")
        staff_id = row["doctor_id"]
        role = row["role"]
        name = row["name"]
        
        token = await _issue_token(staff_id, role, name)
        return {"token": token, "role": role, "name": name, "staff_id": staff_id}''',
    code, flags=re.DOTALL
)

# Replace get_departments
code = re.sub(
    r'@extended_router\.get\("/api/departments"\)\nasync def get_departments\(\).*?\n.*?return \{"departments": depts\}',
    '''@extended_router.get("/api/departments")
async def get_departments():
    import database
    depts = await database.get_departments()
    return {"departments": [d["name"] for d in depts] if depts else []}''',
    code, flags=re.DOTALL
)

# Replace get_summary_pdf
code = re.sub(
    r'@extended_router\.get\("/api/patient/\{patient_id\}/summary/\{session_id\}/pdf"\)\nasync def get_summary_pdf\(.*?\n.*?return FileResponse.*?\}',
    '''@extended_router.get("/api/patient/{patient_id}/summary/{session_id}/pdf")
async def get_summary_pdf(patient_id: str, session_id: str):
    import database
    if not database._pool: raise HTTPException(500, "DB error")
    async with database._pool.acquire() as conn:
        row = await conn.fetchrow("SELECT pdf_file_path FROM clinical_summaries WHERE session_id = $1", session_id)
        if not row or not row["pdf_file_path"]:
            raise HTTPException(404, "PDF not found for this session.")
        return FileResponse(row["pdf_file_path"], media_type="application/pdf", filename=f"Summary_{session_id}.pdf")''',
    code, flags=re.DOTALL
)

# Replace get_patient_summaries
code = re.sub(
    r'@extended_router\.get\("/api/patient/\{patient_id\}/summaries"\)\nasync def get_patient_summaries\(.*?\n.*?return \{"summaries": summaries\}',
    '''@extended_router.get("/api/patient/{patient_id}/summaries")
async def get_patient_summaries(patient_id: str, staff: dict = Depends(_require_role("DOCTOR", "NURSE", "ADMIN"))):
    import database
    if not database._pool: raise HTTPException(500, "DB error")
    async with database._pool.acquire() as conn:
        rows = await conn.fetch("SELECT session_id, small_summary, pdf_file_path, generated_at as created_at FROM clinical_summaries WHERE session_id IN (SELECT session_id FROM patient_sessions WHERE patient_id = $1) ORDER BY generated_at DESC", patient_id)
        summaries = [dict(r) for r in rows]
    return {"summaries": summaries}''',
    code, flags=re.DOTALL
)

# Replace get_queue
code = re.sub(
    r'@extended_router\.get\("/api/queue"\)\nasync def get_queue\(.*?\n.*?return \{"queue": q\}',
    '''@extended_router.get("/api/queue")
async def get_queue(department: str = None, status: str = "waiting", staff: dict = Depends(_require_role("NURSE", "DOCTOR", "ADMIN"))):
    import database
    if not database._pool: raise HTTPException(500, "DB error")
    async with database._pool.acquire() as conn:
        query = "SELECT token_number, token_id, session_id, patient_id, department, priority_flag, session_status as status, created_at FROM patient_sessions WHERE session_status = $1"
        args = [status.upper()]
        if department:
            query += " AND department = $2"
            args.append(department)
        query += " ORDER BY priority_flag DESC, created_at ASC"
        
        rows = await conn.fetch(query, *args)
        q = [dict(r) for r in rows]
        for item in q:
            p_row = await conn.fetchrow("SELECT full_name, age, gender FROM patients WHERE patient_id = $1", item["patient_id"])
            if p_row:
                item.update(dict(p_row))
    return {"queue": q}''',
    code, flags=re.DOTALL
)

# Replace update_queue_status
code = re.sub(
    r'@extended_router\.put\("/api/queue/\{token_id\}/status"\)\nasync def update_queue_status\(.*?\n.*?return \{"status": "success"\}',
    '''@extended_router.put("/api/queue/{token_id}/status")
async def update_queue_status(token_id: str, payload: UpdateQueueStatusReq, staff: dict = Depends(_require_role("NURSE", "DOCTOR", "ADMIN"))):
    import database
    if not database._pool: raise HTTPException(500, "DB error")
    async with database._pool.acquire() as conn:
        await conn.execute("UPDATE patient_sessions SET session_status = $1 WHERE token_id = $2", payload.status, token_id)
    return {"status": "success"}''',
    code, flags=re.DOTALL
)

# Second get_doctors block at line 644
code = re.sub(
    r'@extended_router\.get\("/api/admin/doctors"\)\nasync def admin_get_doctors\(.*?\n.*?return \[dict\(r\) for r in rows\]',
    '''@extended_router.get("/api/admin/doctors")
async def admin_get_doctors(staff: dict = Depends(_require_role("ADMIN"))):
    import database
    docs = await database.get_doctors()
    return docs''',
    code, flags=re.DOTALL
)

with open('routes_extended.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Patched routes_extended.py successfully")
