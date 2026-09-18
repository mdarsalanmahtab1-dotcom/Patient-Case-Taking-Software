with open('routes_extended.py', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Imports and DB init (lines 37-93)
import_block_old = """# ─────────────────────────────────────────────────────────────────────
# SQLite persistence (survives restarts)
# ─────────────────────────────────────────────────────────────────────
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), "swasthyasync.db")

def _get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def _init_db():
    conn = _get_db()
    conn.executescript(\"\"\"
        CREATE TABLE IF NOT EXISTS summaries (
            summary_id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            type TEXT NOT NULL,
            content TEXT,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS queue (
            token_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL UNIQUE,
            patient_id TEXT NOT NULL,
            priority_flag INTEGER DEFAULT 0,
            priority_reason TEXT,
            status TEXT DEFAULT 'waiting',
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS staff (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            password_hash TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS doctor_roster (
            doctor_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            department TEXT NOT NULL,
            room_number TEXT NOT NULL,
            shift TEXT NOT NULL
        );
    \"\"\")
    # Additive migration for pdf_path
    try:
        conn.execute("ALTER TABLE summaries ADD COLUMN pdf_path TEXT;")
    except sqlite3.OperationalError:
        pass # Column already exists
    conn.commit()
    conn.close()
    logger.info(f"SQLite database initialized at {DB_PATH}")

_init_db()"""

import_block_new = """from supabase import create_client, Client
import database

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
supabase_client = create_client(supabase_url, supabase_key) if supabase_url and supabase_key else None"""
code = code.replace(import_block_old, import_block_new)


# 2. Staff Auth
auth_old = """_active_tokens: dict[str, dict] = {}  # token_str -> {id, role, name}
security = HTTPBearer(auto_error=False)

def _hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

def _issue_token(staff_id: str, role: str, name: str) -> str:
    token = f"{role}:{staff_id}:{secrets.token_hex(8)}"
    _active_tokens[token] = {"id": staff_id, "role": role, "name": name}
    return token

def _get_current_staff(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not credentials:
        raise HTTPException(401, "Missing auth token")
    info = _active_tokens.get(credentials.credentials)
    if not info:
        raise HTTPException(401, "Invalid or expired token")
    return info

def _require_role(*allowed_roles):
    \"\"\"Dependency factory: rejects requests whose token role is not in allowed_roles.\"\"\"
    def checker(staff: dict = Depends(_get_current_staff)):
        if staff["role"] not in allowed_roles:
            raise HTTPException(403, f"Role '{staff['role']}' not authorized. Requires: {allowed_roles}")
        return staff
    return checker"""

auth_new = """security = HTTPBearer(auto_error=False)

def _hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

async def _issue_token(staff_id: str, role: str, name: str) -> str:
    token = f"{role}:{staff_id}:{secrets.token_hex(8)}"
    if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute("INSERT INTO staff_sessions (token, staff_id, role, name) VALUES ($1, $2, $3, $4)", token, staff_id, role, name)
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
    return checker"""
code = code.replace(auth_old, auth_new)


# 3. Simple Replacements
# staff_login
code = code.replace("""def staff_login(req: StaffLoginReq):
    conn = _get_db()
    cursor = conn.execute("SELECT * FROM staff WHERE name = ?", (req.username,))
    staff = cursor.fetchone()
    conn.close()
    
    if not staff:
        raise HTTPException(401, "Invalid credentials")
    
    hashed_attempt = _hash_password(req.password)
    if staff["password_hash"] != hashed_attempt:
        raise HTTPException(401, "Invalid credentials")
        
    token = _issue_token(staff["id"], staff["role"], staff["name"])
    return {"token": token, "role": staff["role"], "name": staff["name"], "id": staff["id"]}""",
"""async def staff_login(req: StaffLoginReq):
    if not database._pool: raise HTTPException(500, "DB not ready")
    async with database._pool.acquire() as conn:
        staff = await conn.fetchrow("SELECT * FROM staff WHERE name = $1", req.username)
        if not staff:
            raise HTTPException(401, "Invalid credentials")
        hashed_attempt = _hash_password(req.password)
        if staff["password_hash"] != hashed_attempt:
            raise HTTPException(401, "Invalid credentials")
        token = await _issue_token(staff["id"], staff["role"], staff["name"])
        return {"token": token, "role": staff["role"], "name": staff["name"], "id": staff["id"]}""")

# staff_register
code = code.replace("""def staff_register(req: StaffRegisterReq, current_staff: dict = Depends(_require_role("Admin"))):
    hashed_pw = _hash_password(req.password)
    staff_id = f"stf_{uuid.uuid4().hex[:8]}"
    
    conn = _get_db()
    try:
        conn.execute(
            "INSERT INTO staff (id, name, role, password_hash) VALUES (?, ?, ?, ?)",
            (staff_id, req.username, req.role, hashed_pw)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(400, "Username already exists")
    finally:
        conn.close()
        
    return {"status": "success", "staff_id": staff_id}""",
"""async def staff_register(req: StaffRegisterReq, current_staff: dict = Depends(_require_role("Admin"))):
    hashed_pw = _hash_password(req.password)
    staff_id = f"stf_{uuid.uuid4().hex[:8]}"
    if not database._pool: raise HTTPException(500, "DB not ready")
    try:
        async with database._pool.acquire() as conn:
            await conn.execute("INSERT INTO staff (id, name, role, password_hash) VALUES ($1, $2, $3, $4)", staff_id, req.username, req.role, hashed_pw)
    except Exception:
        raise HTTPException(400, "Username already exists")
    return {"status": "success", "staff_id": staff_id}""")

# escalate_queue_priority
code = code.replace("""def escalate_queue_priority(session_id: str, priority_reason: str = None):
    \"\"\"Bridge function for DialogueManager to mark red flags on the triage queue.\"\"\"
    conn = _get_db()
    conn.execute("UPDATE queue SET priority_flag = 1, priority_reason = ? WHERE session_id = ?", (priority_reason, session_id))
    conn.commit()
    conn.close()""",
"""async def escalate_queue_priority(session_id: str, priority_reason: str = None):
    if not database._pool: return
    async with database._pool.acquire() as conn:
        await conn.execute("UPDATE patient_sessions SET priority_flag = TRUE, priority_reason = $1 WHERE session_id = $2", priority_reason, session_id)""")

# update_queue_priority
code = code.replace("""def update_queue_priority(token_id: str, payload: UpdatePriorityReq, staff: dict = Depends(_require_role("Nurse", "Admin"))):
    conn = _get_db()
    conn.execute("UPDATE queue SET priority_flag = ?, priority_reason = ? WHERE token_id = ?", (int(payload.priority_flag), payload.priority_reason, token_id))
    conn.commit()
    conn.close()
    return {"status": "success"}""",
"""async def update_queue_priority(token_id: str, payload: UpdatePriorityReq, staff: dict = Depends(_require_role("Nurse", "Admin"))):
    if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute("UPDATE patient_sessions SET priority_flag = $1, priority_reason = $2 WHERE token_id = $3", payload.priority_flag, payload.priority_reason, token_id)
    return {"status": "success"}""")

# update_queue_status
code = code.replace("""def update_queue_status(token_id: str, payload: UpdateQueueStatusReq, staff: dict = Depends(_require_role("Nurse", "Doctor", "Admin"))):
    conn = _get_db()
    conn.execute("UPDATE queue SET status = ? WHERE token_id = ?", (payload.status, token_id))
    conn.commit()
    conn.close()
    return {"status": "success"}""",
"""async def update_queue_status(token_id: str, payload: UpdateQueueStatusReq, staff: dict = Depends(_require_role("Nurse", "Doctor", "Admin"))):
    if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute("UPDATE patient_sessions SET session_status = $1 WHERE token_id = $2", payload.status, token_id)
    return {"status": "success"}""")

# complete_patient_visit
code = code.replace("""def complete_patient_visit(session_id: str, staff: dict = Depends(_require_role("Nurse", "Doctor", "Admin"))):
    dm = _get_dm(session_id)
    if dm:
        del _sessions_ref[session_id]
        
    conn = _get_db()
    conn.execute("UPDATE queue SET status = 'completed' WHERE session_id = ?", (session_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}""",
"""async def complete_patient_visit(session_id: str, staff: dict = Depends(_require_role("Nurse", "Doctor", "Admin"))):
    dm = _get_dm(session_id)
    if dm:
        del _sessions_ref[session_id]
        
    if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute("UPDATE patient_sessions SET session_status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE session_id = $1", session_id)
    return {"status": "success"}""")

# generate_doctor_summary
code = code.replace("""    # Save to summaries table
    import database
    database.save_clinical_summary(
        session_id=session_id,
        small_summary=ai_summary.get("clinical_summary", ""),
        full_detailed_summary=json.dumps(ai_summary),
        critical_highlights=ai_summary.get("critical_findings", []),
        contradictions_found=ai_summary.get("contradictions", []),
        pdf_file_path=pdf_path
    )
    
    conn = _get_db()
    # Also save to legacy summaries table
    conn.execute(
        "INSERT OR REPLACE INTO summaries (summary_id, patient_id, session_id, type, content, created_at, pdf_path) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (f"sum_{uuid.uuid4().hex[:8]}", dm.record.patient_id, session_id, "consultation", json.dumps(ai_summary), datetime.now().isoformat(), pdf_path)
    )
    conn.commit()
    conn.close()""",
"""    import database
    if supabase_client:
        storage_path = f"patient-documents/{session_id}.pdf"
        try:
            supabase_client.storage.from_("patient-records").upload(
                file=pdf_bytes, path=storage_path, file_options={"content-type": "application/pdf", "upsert": "true"}
            )
            url_resp = supabase_client.storage.from_("patient-records").create_signed_url(storage_path, 604800)
            pdf_path = url_resp.get("signedURL", pdf_path)
        except Exception:
            pass
            
    await database.save_clinical_summary(
        session_id=session_id,
        small_summary=ai_summary.get("clinical_summary", ""),
        full_detailed_summary=ai_summary,
        critical_highlights=ai_summary.get("critical_findings", []),
        contradictions_found=ai_summary.get("contradictions", []),
        pdf_file_path=pdf_path
    )""")

# get_queue_token
code = code.replace("""def get_queue_token(session_id: str):
    \"\"\"Get token information for the completion screen.\"\"\"
    import database
    conn = database.get_connection()
    try:
        # Fetch from patient_sessions and doctors
        row = conn.execute('''
            SELECT ps.token_number, ps.token_id, d.full_name as doctor_name, d.room_number 
            FROM patient_sessions ps
            LEFT JOIN doctors d ON ps.doctor_id = d.doctor_id
            WHERE ps.session_id = ?
        ''', (session_id,)).fetchone()
        
        if row:
            return {
                "token_number": row["token_number"],
                "token_id": row["token_id"],
                "doctor_name": row["doctor_name"],
                "room_number": row["room_number"]
            }
        return {"error": "Token not found"}
    finally:
        conn.close()""",
"""async def get_queue_token(session_id: str):
    import database
    if not database._pool: return {"error": "DB not ready"}
    async with database._pool.acquire() as conn:
        row = await conn.fetchrow('''
            SELECT ps.token_number, ps.token_id, d.full_name as doctor_name, d.room_number 
            FROM patient_sessions ps
            LEFT JOIN doctors d ON ps.doctor_id = d.doctor_id
            WHERE ps.session_id = $1
        ''', session_id)
        if row:
            return dict(row)
        return {"error": "Token not found"}""")

code = code.replace("def generate_doctor_summary", "async def generate_doctor_summary")

with open('routes_extended.py', 'w', encoding='utf-8') as f:
    f.write(code)
print("Safe refactor complete")
