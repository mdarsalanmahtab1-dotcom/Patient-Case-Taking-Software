import re

with open('routes_extended.py', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. doctor_login
code = re.sub(
    r'conn = _get_db\(\)\n.*?doctor = conn\.execute\("SELECT \* FROM doctors WHERE username = \? AND password = \?", \(req\.username, req\.password\)\)\.fetchone\(\)\n.*?conn\.close\(\)',
    '''if not database._pool: raise HTTPException(500, "DB not ready")
    async with database._pool.acquire() as conn:
        doctor = await conn.fetchrow("SELECT * FROM doctors WHERE username = $1 AND password = $2", req.username, req.password)''',
    code, flags=re.DOTALL
)

# 2. update_doctor_status
code = re.sub(
    r'conn = _get_db\(\)\n.*?conn\.execute\("UPDATE doctors SET current_status = \? WHERE doctor_id = \?", \(req\.status, doctor_id\)\)\n.*?conn\.commit\(\)\n.*?conn\.close\(\)',
    '''if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute("UPDATE doctors SET current_status = $1 WHERE doctor_id = $2", req.status, doctor_id)''',
    code, flags=re.DOTALL
)

# 3. notify_admin
code = re.sub(
    r'conn = _get_db\(\)\n.*?notif_id = str\(uuid\.uuid4\(\)\)\n.*?conn\.execute\(\n.*?INSERT INTO admin_notifications.*?\(notif_id, req\.doctor_id, req\.message\)\n.*?\)\n.*?conn\.commit\(\)\n.*?conn\.close\(\)',
    '''notif_id = str(uuid.uuid4())
    if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO admin_notifications (notif_id, doctor_id, message) VALUES ($1, $2, $3)",
                notif_id, req.doctor_id, req.message
            )''',
    code, flags=re.DOTALL
)

# 4. get_admin_notifications
code = re.sub(
    r'conn = _get_db\(\)\n.*?notifs = conn\.execute\("""\n.*?SELECT n\.\*, d\.full_name as doctor_name, d\.room_number\n.*?FROM admin_notifications n\n.*?JOIN doctors d ON n\.doctor_id = d\.doctor_id\n.*?WHERE n\.is_read = 0\n.*?ORDER BY n\.timestamp DESC\n.*?"""\)\.fetchall\(\)\n.*?conn\.close\(\)',
    '''if not database._pool: return {"notifications": []}
    async with database._pool.acquire() as conn:
        notifs = await conn.fetch("""
            SELECT n.*, d.full_name as doctor_name, d.room_number
            FROM admin_notifications n
            JOIN doctors d ON n.doctor_id = d.doctor_id
            WHERE n.is_read = FALSE
            ORDER BY n.timestamp DESC
        """)''',
    code, flags=re.DOTALL
)

# 5. mark_notification_read
code = re.sub(
    r'conn = _get_db\(\)\n.*?conn\.execute\("UPDATE admin_notifications SET is_read = 1 WHERE notif_id = \?", \(notif_id,\)\)\n.*?conn\.commit\(\)\n.*?conn\.close\(\)',
    '''if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute("UPDATE admin_notifications SET is_read = TRUE WHERE notif_id = $1", notif_id)''',
    code, flags=re.DOTALL
)

# 6. update_nurse_triage
code = re.sub(
    r'conn = _get_db\(\)\n.*?conn\.execute\("UPDATE patient_sessions SET nurse_triage_notes = \? WHERE session_id = \?", \(req\.nurse_triage_notes, session_id\)\)\n.*?if req\.elevate_to_priority:\n.*?conn\.execute\("UPDATE patient_sessions SET priority_flag = 1, priority_reason = \? WHERE session_id = \?", \("Elevated by Triage Nurse", session_id\)\)\n.*?conn\.commit\(\)\n.*?conn\.close\(\)',
    '''if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute("UPDATE patient_sessions SET nurse_triage_notes = $1 WHERE session_id = $2", req.nurse_triage_notes, session_id)
            if req.elevate_to_priority:
                await conn.execute("UPDATE patient_sessions SET priority_flag = TRUE, priority_reason = $1 WHERE session_id = $2", "Elevated by Triage Nurse", session_id)''',
    code, flags=re.DOTALL
)

# 7. complete_session_doctor
code = re.sub(
    r'conn = _get_db\(\)\n.*?# Update first to save the action\n.*?doc_prescription_str = f"\[\{req\.action\}\] \{req\.doctor_prescription\}"\n.*?conn\.execute\(\n.*?UPDATE patient_sessions SET doctor_prescription = \?, session_status = \'COMPLETED\', completed_at = CURRENT_TIMESTAMP WHERE session_id = \?", \n.*?\(doc_prescription_str, session_id\)\n.*?\)\n.*?conn\.commit\(\)\n.*?conn\.close\(\)',
    '''doc_prescription_str = f"[{req.action}] {req.doctor_prescription}"
    if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute(
                "UPDATE patient_sessions SET doctor_prescription = $1, session_status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE session_id = $2",
                doc_prescription_str, session_id
            )''',
    code, flags=re.DOTALL
)


with open('routes_extended.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Phase 6 Routes Refactored successfully")
