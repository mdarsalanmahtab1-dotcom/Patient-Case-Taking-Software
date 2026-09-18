import re

with open('routes_extended.py', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. doctor_login
code = code.replace('''def doctor_login(req: DoctorLoginReq):
    conn = _get_db()
    doctor = conn.execute("SELECT * FROM doctors WHERE username = ? AND password = ?", (req.username, req.password)).fetchone()
    conn.close()
    if not doctor:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {
        "doctor_id": doctor["doctor_id"],
        "full_name": doctor["full_name"],
        "dept_id": doctor["dept_id"],
        "room_number": doctor["room_number"],
        "current_status": dict(doctor).get("current_status", "Available")
    }''', '''async def doctor_login(req: DoctorLoginReq):
    if not database._pool: raise HTTPException(500, "DB not ready")
    async with database._pool.acquire() as conn:
        doctor = await conn.fetchrow("SELECT * FROM doctors WHERE username = $1 AND password = $2", req.username, req.password)
    if not doctor:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {
        "doctor_id": doctor["doctor_id"],
        "full_name": doctor["full_name"],
        "dept_id": doctor["dept_id"],
        "room_number": doctor["room_number"],
        "current_status": dict(doctor).get("current_status", "Available")
    }''')

# 2. update_doctor_status
code = code.replace('''def update_doctor_status(doctor_id: int, req: DoctorStatusReq):
    conn = _get_db()
    conn.execute("UPDATE doctors SET current_status = ? WHERE doctor_id = ?", (req.status, doctor_id))
    conn.commit()
    conn.close()
    return {"status": "success", "current_status": req.status}''', '''async def update_doctor_status(doctor_id: int, req: DoctorStatusReq):
    if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute("UPDATE doctors SET current_status = $1 WHERE doctor_id = $2", req.status, doctor_id)
    return {"status": "success", "current_status": req.status}''')

# 3. notify_admin
code = code.replace('''def notify_admin(req: DoctorNotifyReq):
    import uuid
    conn = _get_db()
    notif_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO admin_notifications (notif_id, doctor_id, message) VALUES (?, ?, ?)",
        (notif_id, req.doctor_id, req.message)
    )
    conn.commit()
    conn.close()
    return {"status": "success", "notif_id": notif_id}''', '''async def notify_admin(req: DoctorNotifyReq):
    import uuid
    notif_id = str(uuid.uuid4())
    if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute("INSERT INTO admin_notifications (notif_id, doctor_id, message) VALUES ($1, $2, $3)", notif_id, req.doctor_id, req.message)
    return {"status": "success", "notif_id": notif_id}''')

# 4. get_admin_notifications
code = code.replace('''def get_admin_notifications():
    conn = _get_db()
    notifs = conn.execute("""
        SELECT n.*, d.full_name as doctor_name, d.room_number
        FROM admin_notifications n
        JOIN doctors d ON n.doctor_id = d.doctor_id
        WHERE n.is_read = 0
        ORDER BY n.timestamp DESC
    """).fetchall()
    conn.close()
    return {"notifications": [dict(n) for n in notifs]}''', '''async def get_admin_notifications():
    if not database._pool: return {"notifications": []}
    async with database._pool.acquire() as conn:
        notifs = await conn.fetch("""
            SELECT n.*, d.full_name as doctor_name, d.room_number
            FROM admin_notifications n
            JOIN doctors d ON n.doctor_id = d.doctor_id
            WHERE n.is_read = FALSE
            ORDER BY n.timestamp DESC
        """)
    return {"notifications": [dict(n) for n in notifs]}''')

# 5. mark_notification_read
code = code.replace('''def mark_notification_read(notif_id: str):
    conn = _get_db()
    conn.execute("UPDATE admin_notifications SET is_read = 1 WHERE notif_id = ?", (notif_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}''', '''async def mark_notification_read(notif_id: str):
    if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute("UPDATE admin_notifications SET is_read = TRUE WHERE notif_id = $1", notif_id)
    return {"status": "success"}''')

# 6. update_nurse_triage
code = code.replace('''def update_nurse_triage(session_id: str, req: NurseTriageReq):
    conn = _get_db()
    conn.execute("UPDATE patient_sessions SET nurse_triage_notes = ? WHERE session_id = ?", (req.nurse_triage_notes, session_id))
    if req.elevate_to_priority:
        conn.execute("UPDATE patient_sessions SET priority_flag = 1, priority_reason = ? WHERE session_id = ?", ("Elevated by Triage Nurse", session_id))
    conn.commit()
    conn.close()
    return {"status": "success"}''', '''async def update_nurse_triage(session_id: str, req: NurseTriageReq):
    if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute("UPDATE patient_sessions SET nurse_triage_notes = $1 WHERE session_id = $2", req.nurse_triage_notes, session_id)
            if req.elevate_to_priority:
                await conn.execute("UPDATE patient_sessions SET priority_flag = TRUE, priority_reason = $1 WHERE session_id = $2", "Elevated by Triage Nurse", session_id)
    return {"status": "success"}''')

# 7. complete_session_doctor
code = code.replace('''def complete_session_doctor(session_id: str, req: CompleteSessionReq):
    conn = _get_db()
    
    # Update first to save the action
    doc_prescription_str = f"[{req.action}] {req.doctor_prescription}"
    conn.execute(
        "UPDATE patient_sessions SET doctor_prescription = ?, session_status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE session_id = ?", 
        (doc_prescription_str, session_id)
    )
    conn.commit()
    conn.close()
    
    # Fire off notification
    try:
        import httpx
        httpx.post("http://localhost:8000/api/admin/notifications", json={
            "message": f"Patient session {session_id} completed.",
            "doctor_id": 0
        })
    except:
        pass
        
    return {"status": "success"}''', '''async def complete_session_doctor(session_id: str, req: CompleteSessionReq):
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
        
    return {"status": "success"}''')

with open('routes_extended.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Safe phase 6 refactor applied")
