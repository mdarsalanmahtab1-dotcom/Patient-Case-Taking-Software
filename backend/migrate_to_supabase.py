import asyncio
import asyncpg
import sqlite3
import hashlib
import json
import os
from dotenv import load_dotenv

# Load root .env which has the supabase credentials
root_env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path=root_env_path)
# Also load local if needed
load_dotenv()

SQLITE_DB = "swasthyasync.db"

# The schema definition
SCHEMA_SQL = """
-- Drop tables if they exist to allow clean runs
DROP TABLE IF EXISTS staff_sessions CASCADE;
DROP TABLE IF EXISTS admin_notifications CASCADE;
DROP TABLE IF EXISTS system_logs CASCADE;
DROP TABLE IF EXISTS clinical_rules CASCADE;
DROP TABLE IF EXISTS clinical_summaries CASCADE;
DROP TABLE IF EXISTS uploaded_documents CASCADE;
DROP TABLE IF EXISTS patient_sessions CASCADE;
DROP TABLE IF EXISTS doctors CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS staff CASCADE;

CREATE TABLE patients (
    patient_id TEXT PRIMARY KEY,
    abha_id TEXT UNIQUE,
    abha_address TEXT UNIQUE,
    aadhaar_hash TEXT UNIQUE,
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    age INTEGER,
    gender TEXT,
    date_of_birth TEXT,
    weight REAL,
    height TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE departments (
    dept_id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    is_default BOOLEAN DEFAULT FALSE
);

CREATE TABLE doctors (
    doctor_id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT,
    full_name TEXT NOT NULL,
    dept_id INTEGER REFERENCES departments(dept_id),
    license_number TEXT,
    profile_image_url TEXT,
    max_daily_patients INTEGER DEFAULT 40,
    status TEXT DEFAULT 'Active',
    current_status TEXT DEFAULT 'Available',
    room_number TEXT DEFAULT 'TBD',
    shift TEXT DEFAULT 'Day'
);

CREATE TABLE patient_sessions (
    session_id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    token_id TEXT UNIQUE NOT NULL,
    department TEXT,
    chief_complaint TEXT,
    interview_qa_json JSONB DEFAULT '[]'::jsonb,
    filled_state_json JSONB DEFAULT '{}'::jsonb,
    priority_flag BOOLEAN DEFAULT FALSE,
    priority_reason TEXT,
    session_status TEXT DEFAULT 'IN_PROGRESS',
    nurse_triage_notes TEXT,
    doctor_prescription TEXT,
    doctor_id TEXT REFERENCES doctors(doctor_id),
    token_number INTEGER,
    previous_history_json JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ
);

CREATE TABLE uploaded_documents (
    document_id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES patient_sessions(session_id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    document_type TEXT DEFAULT 'OTHER',
    ocr_raw_json JSONB DEFAULT '{}'::jsonb,
    extracted_medications JSONB DEFAULT '[]'::jsonb,
    extracted_labs JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE clinical_summaries (
    summary_id TEXT PRIMARY KEY,
    session_id TEXT UNIQUE REFERENCES patient_sessions(session_id) ON DELETE CASCADE,
    small_summary TEXT,
    full_detailed_summary JSONB,
    critical_highlights JSONB DEFAULT '[]'::jsonb,
    contradictions_found JSONB DEFAULT '[]'::jsonb,
    doctor_consultation_notes TEXT,
    doctor_id TEXT REFERENCES doctors(doctor_id),
    pdf_file_path TEXT,
    generated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    doctor_signed_at TIMESTAMPTZ
);

CREATE TABLE clinical_rules (
    rule_id SERIAL PRIMARY KEY,
    trigger_keyword TEXT NOT NULL,
    action_type TEXT NOT NULL,
    action_value TEXT
);

CREATE TABLE system_logs (
    log_id SERIAL PRIMARY KEY,
    admin_email TEXT NOT NULL,
    action_type TEXT NOT NULL,
    target_id TEXT,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admin_notifications (
    notif_id TEXT PRIMARY KEY,
    doctor_id TEXT REFERENCES doctors(doctor_id),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE staff (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    password_hash TEXT NOT NULL
);

CREATE TABLE staff_sessions (
    token TEXT PRIMARY KEY,
    staff_id TEXT REFERENCES staff(id) ON DELETE CASCADE,
    role TEXT,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ
);
"""

def hash_password(pwd: str) -> str:
    if not pwd:
        return ""
    if len(pwd) == 64 and all(c in '0123456789abcdefABCDEF' for c in pwd):
        return pwd
    return hashlib.sha256(pwd.encode()).hexdigest()

async def migrate_data():
    supabase_db_url = os.getenv("SUPABASE_DB_URL")
    if not supabase_db_url:
        print("Error: SUPABASE_DB_URL not found in environment.")
        return

    print("Connecting to Supabase Postgres...")
    pg_conn = await asyncpg.connect(supabase_db_url)
    
    print("Creating tables...")
    await pg_conn.execute(SCHEMA_SQL)
    print("Tables created successfully.")
    
    if not os.path.exists(SQLITE_DB):
        print(f"SQLite DB {SQLITE_DB} not found. Skipping data migration.")
        await pg_conn.close()
        return

    print(f"Connecting to SQLite ({SQLITE_DB})...")
    sqlite_conn = sqlite3.connect(SQLITE_DB)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cur = sqlite_conn.cursor()
    
    try:
        sqlite_cur.execute("SELECT * FROM departments")
        departments = [dict(r) for r in sqlite_cur.fetchall()]
        for dept in departments:
            is_default = dept.get('is_default', 0) if 'is_default' in dept.keys() else 0
            await pg_conn.execute(
                "INSERT INTO departments (dept_id, name, is_default) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
                dept['dept_id'], dept['name'], bool(is_default)
            )
        print(f"Migrated {len(departments)} departments.")
    except Exception as e:
        print(f"Error migrating departments: {e}")

    try:
        sqlite_cur.execute("SELECT * FROM doctor_roster")
        roster_rows = {str(r['doctor_id']): dict(r) for r in sqlite_cur.fetchall()}
        
        sqlite_cur.execute("SELECT * FROM doctors")
        doctors = [dict(r) for r in sqlite_cur.fetchall()]
        migrated_doctors = 0
        for doc in doctors:
            doc_id_str = str(doc['doctor_id'])
            room_number = doc.get('room_number', 'TBD')
            shift = 'Day'
            if doc_id_str in roster_rows:
                roster = roster_rows[doc_id_str]
                room_number = roster['room_number']
                shift = roster['shift']
                
            pwd_hashed = hash_password(doc['password'])
            
            await pg_conn.execute("""
                INSERT INTO doctors (
                    doctor_id, username, password, full_name, dept_id, license_number, 
                    profile_image_url, max_daily_patients, status, current_status, room_number, shift
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT DO NOTHING
            """,
            doc_id_str, doc['username'], pwd_hashed, doc['full_name'], doc['dept_id'],
            doc['license_number'], doc['profile_image_url'], doc['max_daily_patients'],
            doc['status'], doc['current_status'], room_number, shift)
            migrated_doctors += 1
        print(f"Migrated {migrated_doctors} doctors.")
    except Exception as e:
        print(f"Error migrating doctors: {e}")

    try:
        sqlite_cur.execute("SELECT * FROM staff")
        staff_rows = sqlite_cur.fetchall()
        for s in staff_rows:
            await pg_conn.execute(
                "INSERT INTO staff (id, name, role, password_hash) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
                s['id'], s['name'], s['role'], s['password_hash']
            )
        print(f"Migrated {len(staff_rows)} staff.")
    except Exception as e:
        print(f"Error migrating staff: {e}")

    await pg_conn.close()
    sqlite_conn.close()
    print("Migration completed.")

if __name__ == "__main__":
    asyncio.run(migrate_data())
