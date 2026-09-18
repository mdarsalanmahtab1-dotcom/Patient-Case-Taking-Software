import re

with open('routes_extended.py', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Imports and DB init
code = re.sub(r'# ──+.*?SQLite persistence.*?_init_db\(\)', '''
from supabase import create_client, Client
import database

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
supabase_client: Client = create_client(supabase_url, supabase_key) if supabase_url and supabase_key else None
''', code, flags=re.DOTALL)

# 2. Staff auth
code = re.sub(r'# ──+.*?RBAC.*?def _require_role.*?return checker\n    return checker', '''
# RBAC using staff_sessions Postgres table
security = HTTPBearer(auto_error=False)

def _hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

async def _issue_token(staff_id: str, role: str, name: str) -> str:
    token = f"{role}:{staff_id}:{secrets.token_hex(8)}"
    if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO staff_sessions (token, staff_id, role, name)
                VALUES ($1, $2, $3, $4)
            """, token, staff_id, role, name)
    return token

async def _get_current_staff(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not credentials:
        raise HTTPException(401, "Missing auth token")
    token_str = credentials.credentials
    if not database._pool:
        raise HTTPException(500, "DB not initialized")
    async with database._pool.acquire() as conn:
        row = await conn.fetchrow("SELECT staff_id as id, role, name FROM staff_sessions WHERE token = $1", token_str)
        if not row:
            raise HTTPException(401, "Invalid or expired token")
        return dict(row)

def _require_role(*allowed_roles):
    async def checker(staff: dict = Depends(_get_current_staff)):
        if staff["role"] not in allowed_roles:
            raise HTTPException(403, f"Role '{staff['role']}' not authorized. Requires: {allowed_roles}")
        return staff
    return checker''', code, flags=re.DOTALL)

# 3. Queue -> Patient_sessions logic and async DB calls
# Since queue table is dropped, priority_flag and status are on patient_sessions.
# escalate_queue_priority
code = re.sub(
    r'def escalate_queue_priority\(session_id: str, priority_reason: str = None\):.*?conn\.close\(\)',
    '''async def escalate_queue_priority(session_id: str, priority_reason: str = None):
    if not database._pool: return
    async with database._pool.acquire() as conn:
        await conn.execute("""
            UPDATE patient_sessions 
            SET priority_flag = TRUE, priority_reason = $1
            WHERE session_id = $2
        """, priority_reason, session_id)''',
    code, flags=re.DOTALL
)

# staff_login
code = re.sub(
    r'conn = _get_db\(\)\n.*?cursor = conn.execute\("SELECT \* FROM staff WHERE name = \?", \(req\.username,\)\)\n.*?staff = cursor.fetchone\(\)\n.*?conn.close\(\)',
    '''if not database._pool: raise HTTPException(500, "DB not ready")
    async with database._pool.acquire() as conn:
        staff = await conn.fetchrow("SELECT * FROM staff WHERE name = $1", req.username)''',
    code, flags=re.DOTALL
)
code = re.sub(r'token = _issue_token\(staff\["id"\], staff\["role"\], staff\["name"\]\)', 'token = await _issue_token(staff["id"], staff["role"], staff["name"])', code)

# staff_register
code = re.sub(
    r'conn = _get_db\(\)\n.*?try:\n.*?conn\.execute\(\n.*?INSERT INTO staff \(id, name, role, password_hash\)\n.*?VALUES \(\?, \?, \?, \?\),\n.*?\(staff_id, req\.username, req\.role, hashed_pw\)\n.*?\)\n.*?conn\.commit\(\)\n.*?except sqlite3\.IntegrityError:\n.*?raise HTTPException\(400, "Username already exists"\)\n.*?finally:\n.*?conn\.close\(\)',
    '''if not database._pool: raise HTTPException(500, "DB not ready")
    try:
        async with database._pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO staff (id, name, role, password_hash)
                VALUES ($1, $2, $3, $4)
            """, staff_id, req.username, req.role, hashed_pw)
    except Exception:
        raise HTTPException(400, "Username already exists")''',
    code, flags=re.DOTALL
)

# create_session
code = re.sub(
    r'conn = _get_db\(\)\n.*?conn\.execute\(\n.*?INSERT INTO queue \(token_id, session_id, patient_id, created_at\)\n.*?VALUES \(\?, \?, \?, \?\),\n.*?\(payload\.token_id, payload\.session_id, payload\.patient_id, datetime\.now\(\)\.isoformat\(\)\)\n.*?\)\n.*?conn\.commit\(\)\n.*?conn\.close\(\)',
    '# queue table is gone, token is in patient_sessions. Nothing to do here.',
    code, flags=re.DOTALL
)

# generate_doctor_summary
# Repoint summaries to clinical_summaries
code = re.sub(
    r'conn = _get_db\(\)\n.*?# Also save to legacy summaries table.*?conn\.execute\(\n.*?"INSERT OR REPLACE INTO summaries.*?conn\.commit\(\)\n.*?conn\.close\(\)',
    '',
    code, flags=re.DOTALL
)
# And replace database.save_clinical_summary(...)
code = re.sub(r'database\.save_clinical_summary\(', 'await database.save_clinical_summary(', code)

# PDF Generation and Upload
code = re.sub(
    r'# Ensure directory exists.*?os\.makedirs\(os\.path\.dirname\(pdf_path\), exist_ok=True\)\n.*?with open\(pdf_path, "wb"\) as f:\n.*?f\.write\(pdf_bytes\)',
    '''if supabase_client:
        try:
            # Upload to supabase storage
            storage_path = f"summaries/{session_id}.pdf"
            supabase_client.storage.from_("patient-records").upload(
                file=pdf_bytes,
                path=storage_path,
                file_options={"content-type": "application/pdf", "upsert": "true"}
            )
            # Create a signed URL valid for 7 days
            url_resp = supabase_client.storage.from_("patient-records").create_signed_url(storage_path, 604800)
            pdf_path = url_resp.get("signedURL", pdf_path)
        except Exception as e:
            logger.error(f"Error uploading PDF to Supabase: {e}")
    ''',
    code, flags=re.DOTALL
)
code = re.sub(
    r'conn = _get_db\(\)\n.*?conn\.execute\("UPDATE summaries SET pdf_path = \? WHERE session_id = \?", \(pdf_path, session_id\)\)\n.*?conn\.commit\(\)\n.*?conn\.close\(\)',
    '''if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute("UPDATE clinical_summaries SET pdf_file_path = $1 WHERE session_id = $2", pdf_path, session_id)''',
    code, flags=re.DOTALL
)

# get_summary_pdf
# Read from clinical_summaries instead of summaries
code = re.sub(
    r'conn = _get_db\(\)\n.*?cursor = conn\.execute\("SELECT pdf_path, content FROM summaries WHERE session_id = \?", \(session_id,\)\)\n.*?row = cursor\.fetchone\(\)\n.*?conn\.close\(\)',
    '''if not database._pool: raise HTTPException(500, "DB not ready")
    async with database._pool.acquire() as conn:
        row = await conn.fetchrow("SELECT pdf_file_path as pdf_path, full_detailed_summary as content FROM clinical_summaries WHERE session_id = $1", session_id)''',
    code, flags=re.DOTALL
)

# get_patient_summaries
code = re.sub(
    r'conn = _get_db\(\)\n.*?cursor = conn\.execute\(.*?"SELECT \* FROM summaries WHERE patient_id = \? ORDER BY created_at DESC",.*?\(patient_id,\)\n.*?\)\n.*?summaries = \[dict\(r\) for r in cursor\.fetchall\(\)\]\n.*?conn\.close\(\)',
    '''if not database._pool: return {"summaries": []}
    async with database._pool.acquire() as conn:
        records = await conn.fetch("""
            SELECT cs.summary_id, ps.patient_id, cs.session_id, 'consultation' as type, cs.full_detailed_summary as content, cs.generated_at as created_at, cs.pdf_file_path as pdf_path
            FROM clinical_summaries cs
            JOIN patient_sessions ps ON cs.session_id = ps.session_id
            WHERE ps.patient_id = $1
            ORDER BY cs.generated_at DESC
        """, patient_id)
        summaries = [dict(r) for r in records]''',
    code, flags=re.DOTALL
)

# Queue routes
code = re.sub(
    r'conn = _get_db\(\)\n.*?cursor = conn\.execute\("""\n.*?SELECT q\.\*,\n.*?p\.full_name,\n.*?p\.age,\n.*?p\.gender\n.*?FROM queue q\n.*?JOIN patients p ON q\.patient_id = p\.patient_id\n.*?ORDER BY q\.priority_flag DESC, q\.created_at ASC\n.*?"""\)\n.*?queue_items = \[dict\(row\) for row in cursor\.fetchall\(\)\]\n.*?conn\.close\(\)',
    '''if not database._pool: return {"queue": []}
    async with database._pool.acquire() as conn:
        records = await conn.fetch("""
            SELECT ps.token_id, ps.session_id, ps.patient_id, ps.priority_flag, ps.priority_reason, ps.session_status as status, ps.created_at,
                   p.full_name, p.age, p.gender
            FROM patient_sessions ps
            JOIN patients p ON ps.patient_id = p.patient_id
            WHERE ps.session_status IN ('IN_PROGRESS', 'WAITING')
              AND (ps.created_at AT TIME ZONE 'Asia/Kolkata')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
            ORDER BY ps.priority_flag DESC, ps.created_at ASC
        """)
        queue_items = [dict(r) for r in records]''',
    code, flags=re.DOTALL
)

code = re.sub(
    r'conn = _get_db\(\)\n.*?conn\.execute\("UPDATE queue SET priority_flag = \?, priority_reason = \? WHERE token_id = \?",.*?\(int\(payload\.priority_flag\), payload\.priority_reason, token_id\)\)\n.*?conn\.commit\(\)\n.*?conn\.close\(\)',
    '''if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute("UPDATE patient_sessions SET priority_flag = $1, priority_reason = $2 WHERE token_id = $3", payload.priority_flag, payload.priority_reason, token_id)''',
    code, flags=re.DOTALL
)

code = re.sub(
    r'conn = _get_db\(\)\n.*?conn\.execute\("UPDATE queue SET status = \? WHERE token_id = \?", \(payload\.status, token_id\)\)\n.*?conn\.commit\(\)\n.*?conn\.close\(\)',
    '''if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute("UPDATE patient_sessions SET session_status = $1 WHERE token_id = $2", payload.status, token_id)''',
    code, flags=re.DOTALL
)

# get_queue_token
code = re.sub(
    r'conn = _get_db\(\)\n.*?cursor = conn\.execute\("SELECT \* FROM patient_sessions WHERE token_id = \?", \(token_id,\)\)\n.*?session_row = cursor\.fetchone\(\)\n.*?conn\.close\(\)',
    '''if not database._pool: raise HTTPException(500, "DB not ready")
    async with database._pool.acquire() as conn:
        session_row = await conn.fetchrow("SELECT * FROM patient_sessions WHERE token_id = $1", token_id)''',
    code, flags=re.DOTALL
)

code = re.sub(r'database\.get_patients_by_phone\(', 'await database.get_patients_by_phone(', code)
code = re.sub(r'database\.start_kiosk_session\(', 'await database.start_kiosk_session(', code)

# get_doctors and get_doctor_queue
code = re.sub(
    r'conn = _get_db\(\)\n.*?cursor = conn\.execute\("SELECT \* FROM doctor_roster"\)\n.*?doctors = \[dict\(row\) for row in cursor\.fetchall\(\)\]\n.*?conn\.close\(\)',
    '''if not database._pool: return {"doctors": []}
    async with database._pool.acquire() as conn:
        records = await conn.fetch("SELECT * FROM doctors")
        doctors = [dict(r) for r in records]''',
    code, flags=re.DOTALL
)

code = re.sub(
    r'conn = _get_db\(\)\n.*?cursor = conn\.execute\("""\n.*?SELECT q\.\*,\n.*?p\.full_name,\n.*?p\.age,\n.*?p\.gender\n.*?FROM queue q\n.*?JOIN patients p ON q\.patient_id = p\.patient_id\n.*?JOIN patient_sessions ps ON q\.session_id = ps\.session_id\n.*?WHERE ps\.doctor_id = \?\n.*?ORDER BY q\.priority_flag DESC, q\.created_at ASC\n.*?""", \(doctor_id,\)\)\n.*?queue_items = \[dict\(row\) for row in cursor\.fetchall\(\)\]\n.*?conn\.close\(\)',
    '''if not database._pool: return {"queue": []}
    async with database._pool.acquire() as conn:
        records = await conn.fetch("""
            SELECT ps.token_id, ps.session_id, ps.patient_id, ps.priority_flag, ps.priority_reason, ps.session_status as status, ps.created_at,
                   p.full_name, p.age, p.gender
            FROM patient_sessions ps
            JOIN patients p ON ps.patient_id = p.patient_id
            WHERE ps.doctor_id = $1 AND ps.session_status IN ('IN_PROGRESS', 'WAITING')
              AND (ps.created_at AT TIME ZONE 'Asia/Kolkata')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
            ORDER BY ps.priority_flag DESC, ps.created_at ASC
        """, doctor_id)
        queue_items = [dict(r) for r in records]''',
    code, flags=re.DOTALL
)

# complete_patient_visit
code = re.sub(
    r'conn = _get_db\(\)\n.*?conn\.execute\("UPDATE queue SET status = \'completed\' WHERE session_id = \?", \(session_id,\)\)\n.*?conn\.commit\(\)\n.*?conn\.close\(\)',
    '''if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute("UPDATE patient_sessions SET session_status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE session_id = $1", session_id)''',
    code, flags=re.DOTALL
)

# admin_dashboard
code = re.sub(
    r'conn = _get_db\(\)\n.*?cursor = conn\.execute\("SELECT count\(\*\) FROM staff"\)\n.*?staff_count = cursor\.fetchone\(\)\[0\]\n.*?cursor = conn\.execute\("SELECT count\(\*\) FROM patients"\)\n.*?patients_count = cursor\.fetchone\(\)\[0\]\n.*?cursor = conn\.execute\("SELECT count\(\*\) FROM queue WHERE status != \'completed\'"\)\n.*?active_queue = cursor\.fetchone\(\)\[0\]\n.*?cursor = conn\.execute\("SELECT count\(\*\) FROM summaries"\)\n.*?summaries_count = cursor\.fetchone\(\)\[0\]\n.*?cursor = conn\.execute\("SELECT count\(\*\) FROM doctor_roster"\)\n.*?doctors_count = cursor\.fetchone\(\)\[0\]\n.*?conn\.close\(\)',
    '''if not database._pool: raise HTTPException(500, "DB not ready")
    async with database._pool.acquire() as conn:
        staff_count = await conn.fetchval("SELECT count(*) FROM staff")
        patients_count = await conn.fetchval("SELECT count(*) FROM patients")
        active_queue = await conn.fetchval("SELECT count(*) FROM patient_sessions WHERE session_status != 'COMPLETED'")
        summaries_count = await conn.fetchval("SELECT count(*) FROM clinical_summaries")
        doctors_count = await conn.fetchval("SELECT count(*) FROM doctors")''',
    code, flags=re.DOTALL
)

# doctor_login
code = re.sub(
    r'database\.get_doctors\(\)',
    'await database.get_doctors()',
    code
)
code = re.sub(
    r'if req\.password == doctor\["password"\]:',
    '''hashed_attempt = hashlib.sha256(req.password.encode()).hexdigest()
        if hashed_attempt == doctor["password"]:''',
    code
)

# doctor notify
code = re.sub(
    r'database\.log_system_action\(',
    'await database.log_system_action(',
    code
)

# doctor notifications
code = re.sub(
    r'cursor\.execute\("SELECT \* FROM admin_notifications WHERE doctor_id = \? ORDER BY timestamp DESC LIMIT 50", \(doctor_id,\)\)',
    '''async with database._pool.acquire() as conn:
            records = await conn.fetch("SELECT * FROM admin_notifications WHERE doctor_id = $1 ORDER BY timestamp DESC LIMIT 50", doctor_id)
            return [dict(r) for r in records]''',
    code
)
code = re.sub(
    r'def get_notifications\(.*?conn = _get_db\(\).*?conn\.close\(\)',
    '''async def get_notifications(doctor_id: str):
    if not database._pool: return []
    async with database._pool.acquire() as conn:
        records = await conn.fetch("SELECT * FROM admin_notifications WHERE doctor_id = $1 ORDER BY timestamp DESC LIMIT 50", doctor_id)
        return [dict(r) for r in records]''',
    code, flags=re.DOTALL
)
code = re.sub(
    r'cursor\.execute\("UPDATE admin_notifications SET is_read = 1 WHERE notif_id = \?", \(notif_id,\)\)',
    'await conn.execute("UPDATE admin_notifications SET is_read = TRUE WHERE notif_id = $1", notif_id)',
    code
)
code = re.sub(
    r'def mark_notification_read\(.*?conn = _get_db\(\).*?conn\.commit\(\).*?conn\.close\(\).*?return \{"status": "ok"\}',
    '''async def mark_notification_read(notif_id: str):
    if not database._pool: return {"status": "ok"}
    async with database._pool.acquire() as conn:
        await conn.execute("UPDATE admin_notifications SET is_read = TRUE WHERE notif_id = $1", notif_id)
    return {"status": "ok"}''',
    code, flags=re.DOTALL
)

# update_nurse_triage
code = re.sub(
    r'cursor\.execute\("""\n.*?UPDATE patient_sessions\n.*?SET nurse_triage_notes = \?\n.*?WHERE session_id = \?\n.*?""", \(payload\.notes, session_id\)\)',
    'await conn.execute("UPDATE patient_sessions SET nurse_triage_notes = $1 WHERE session_id = $2", payload.notes, session_id)',
    code
)
code = re.sub(
    r'def update_nurse_triage\(.*?conn = database\.get_connection\(\).*?conn\.commit\(\).*?conn\.close\(\).*?return \{"status": "success"\}',
    '''async def update_nurse_triage(session_id: str, payload: dict):
    if not database._pool: return {"status": "error"}
    async with database._pool.acquire() as conn:
        await conn.execute("UPDATE patient_sessions SET nurse_triage_notes = $1 WHERE session_id = $2", payload.get("notes", ""), session_id)
    return {"status": "success"}''',
    code, flags=re.DOTALL
)

# complete_session_doctor
code = re.sub(r'database\.submit_doctor_notes\(', 'await database.submit_doctor_notes(', code)
code = re.sub(r'database\.fetch_doctor_encounter\(', 'await database.fetch_doctor_encounter(', code)

# Write modified file
with open('routes_extended.py', 'w', encoding='utf-8') as f:
    f.write(code)
print("Finished refactoring routes_extended.py")
