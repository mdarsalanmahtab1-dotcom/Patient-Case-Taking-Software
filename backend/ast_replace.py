import ast

with open('routes_extended.py', 'r', encoding='utf-8') as f:
    source = f.read()

tree = ast.parse(source)

funcs_to_replace = {
    'staff_login': '''@extended_router.post("/api/auth/staff/login")
async def staff_login(req: StaffLoginReq):
    import database
    if not database._pool: raise HTTPException(500, "DB error")
    async with database._pool.acquire() as conn:
        row = await conn.fetchrow("SELECT doctor_id, full_name as name, 'DOCTOR' as role FROM doctors WHERE username = $1 AND password = $2 AND status = 'Active'", req.username, req.password)
        if not row:
            raise HTTPException(401, "Invalid credentials")
        token = await _issue_token(row["doctor_id"], row["role"], row["name"])
        return {"token": token, "role": row["role"], "name": row["name"], "staff_id": row["doctor_id"]}''',

    'staff_logout': '''@extended_router.post("/api/staff/logout")
async def staff_logout(staff: dict = Depends(_get_current_staff)):
    import database
    if not database._pool: raise HTTPException(500, "DB error")
    async with database._pool.acquire() as conn:
        await conn.execute("DELETE FROM staff_sessions WHERE staff_id = $1", staff["id"])
    return {"status": "ok"}''',

    'staff_register': '''@extended_router.post("/api/staff/register")
async def staff_register(req: StaffCreateReq):
    import database
    if not database._pool: raise HTTPException(500, "DB error")
    hashed_pw = _hash_password(req.password)
    # Create doctor logic... wait, this was legacy staff table.
    raise HTTPException(400, "Registration disabled. Ask admin to create doctor profile.")''',
    
    'create_session': '''@extended_router.post("/api/session/start")
async def create_session(payload: StartSessionPayload):
    import database
    previous_history = None
    if payload.patient_id:
        previous_history = await database.fetch_previous_history(payload.patient_id)
    db_data = await database.start_kiosk_session(
        patient_data=payload.dict(),
        department=payload.department,
        previous_history_json=previous_history,
        doctor_id=payload.doctor_id
    )
    if db_data.get("conflict"):
        raise HTTPException(409, {"message": "Active session exists", "existing_token": db_data.get("existing_token")})
    return {"status": "success", "session_id": db_data["session_id"], "token_id": db_data["token_id"], "token_number": db_data["token_number"], "room_number": db_data.get("room_number")}''',

    'generate_doctor_summary': '''@extended_router.post("/api/patient/{patient_id}/summary/{session_id}/generate")
async def generate_doctor_summary(session_id: str, staff: dict = Depends(_require_role("DOCTOR", "ADMIN"))):
    raise HTTPException(501, "Not Implemented")''',

    'get_summary_pdf': '''@extended_router.get("/api/patient/{patient_id}/summary/{session_id}/pdf")
async def get_summary_pdf(patient_id: str, session_id: str):
    import database
    if not database._pool: raise HTTPException(500, "DB error")
    async with database._pool.acquire() as conn:
        row = await conn.fetchrow("SELECT pdf_file_path FROM clinical_summaries WHERE session_id = $1", session_id)
        if not row or not row["pdf_file_path"]:
            raise HTTPException(404, "PDF not found")
        return FileResponse(row["pdf_file_path"], media_type="application/pdf", filename=f"Summary_{session_id}.pdf")''',

    'get_patient_summaries': '''@extended_router.get("/api/patient/{patient_id}/summaries")
async def get_patient_summaries(patient_id: str):
    import database
    if not database._pool: raise HTTPException(500, "DB error")
    async with database._pool.acquire() as conn:
        rows = await conn.fetch("SELECT session_id, small_summary, pdf_file_path as pdf_path, generated_at as created_at FROM clinical_summaries WHERE session_id IN (SELECT session_id FROM patient_sessions WHERE patient_id = $1) ORDER BY generated_at DESC", patient_id)
        return {"summaries": [dict(r) for r in rows]}''',

    'get_queue': '''@extended_router.get("/api/queue")
async def get_queue():
    import database
    queue = await database.fetch_triage_queue()
    return {"queue": queue}''',

    'update_queue_priority': '''@extended_router.put("/api/queue/{token_id}/priority")
async def update_queue_priority(token_id: str, payload: PriorityUpdate, staff: dict = Depends(_require_role("NURSE", "DOCTOR", "ADMIN"))):
    import database
    if not database._pool: raise HTTPException(500, "DB error")
    async with database._pool.acquire() as conn:
        await conn.execute("UPDATE patient_sessions SET priority_flag = $1, priority_reason = $2 WHERE token_id = $3", payload.priority_flag, payload.priority_reason, token_id)
    return {"status": "success"}''',

    'update_queue_status': '''@extended_router.put("/api/queue/{token_id}/status")
async def update_queue_status(token_id: str, payload: StatusUpdate):
    import database
    if not database._pool: raise HTTPException(500, "DB error")
    async with database._pool.acquire() as conn:
        await conn.execute("UPDATE patient_sessions SET session_status = $1 WHERE token_id = $2", payload.status, token_id)
    return {"status": "success"}''',

    'get_doctor_queue': '''@extended_router.get("/api/doctor/{doctor_id}/queue")
async def get_doctor_queue(doctor_id: str, staff: dict = Depends(_require_role("DOCTOR", "ADMIN"))):
    import database
    queue = await database.fetch_triage_queue(doctor_id)
    return {"queue": queue}''',

    'get_doctors': '''@extended_router.get("/api/admin/doctors")
async def get_doctors(staff: dict = Depends(_require_role("ADMIN"))):
    import database
    docs = await database.get_doctors()
    return docs''',

    'complete_patient_visit': '''@extended_router.post("/api/session/{session_id}/complete")
async def complete_patient_visit(session_id: str, staff: dict = Depends(_require_role("DOCTOR", "ADMIN"))):
    import database
    if not database._pool: raise HTTPException(500, "DB error")
    async with database._pool.acquire() as conn:
        await conn.execute("UPDATE patient_sessions SET session_status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE session_id = $1", session_id)
    return {"status": "success"}'''
}

lines = source.splitlines()

# Process from bottom to top so line numbers don't shift
replacements = []

for node in ast.walk(tree):
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        if node.name in funcs_to_replace:
            # Check if this function actually contains _get_db to avoid replacing fixed ones
            func_source = "\\n".join(lines[node.lineno - 1:node.end_lineno])
            if '_get_db()' in func_source or node.name == 'get_doctors':
                start_line = node.lineno - 1
                # Include decorators
                if node.decorator_list:
                    start_line = node.decorator_list[0].lineno - 1
                end_line = node.end_lineno
                
                replacements.append((start_line, end_line, funcs_to_replace[node.name]))

replacements.sort(reverse=True, key=lambda x: x[0])

for start_line, end_line, new_code in replacements:
    lines = lines[:start_line] + new_code.splitlines() + lines[end_line:]

with open('routes_extended.py', 'w', encoding='utf-8') as f:
    f.write("\n".join(lines))

print("AST based replacement complete!")
