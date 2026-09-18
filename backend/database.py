import json
import uuid
import random
import asyncio
from datetime import datetime, timezone
import logging
import os
from typing import Optional, List, Dict, Any
from urllib.parse import quote_plus

import asyncpg

logger = logging.getLogger(__name__)

_pool = None

async def init_db_pool():
    global _pool
    db_url = os.getenv("SUPABASE_DB_URL")
    if not db_url:
        logger.error("SUPABASE_DB_URL is missing. DB won't work.")
        return
    _pool = await asyncpg.create_pool(
        db_url,
        min_size=2,
        max_size=20,
        max_inactive_connection_lifetime=60.0,
        command_timeout=30.0,
        statement_cache_size=0,
    )
    async with _pool.acquire() as conn:
        try:
            await conn.execute("ALTER TABLE patients ADD COLUMN IF NOT EXISTS vitals TEXT")
        except Exception as e:
            logger.warning(f"Could not add vitals column: {e}")
    logger.info("Database pool initialized.")

async def close_db_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("Database pool closed.")

async def setup_database():
    """Initializes the connection pool. Schema creation is handled by migration script."""
    await init_db_pool()

async def get_active_doctors() -> list[dict]:
    """Fetch active doctors from the database."""
    if not _pool: return []
    async with _pool.acquire() as conn:
        try:
            records = await conn.fetch('''
                SELECT d.doctor_id, d.full_name, d.room_number, d.current_status, dp.name as department
                FROM doctors d
                LEFT JOIN departments dp ON d.dept_id = dp.dept_id
                WHERE d.status = 'Active' OR d.status IS NULL
            ''')
            doctors = [dict(r) for r in records]
            for doc in doctors:
                if not doc["department"]:
                    doc["department"] = "General Medicine"
            return doctors
        except Exception as e:
            logger.error(f"Error fetching active doctors: {e}")
            return []

async def get_patients_by_phone(phone_number: str) -> list[dict]:
    """Fetches all family members linked to a single phone number."""
    if not _pool: return []
    async with _pool.acquire() as conn:
        records = await conn.fetch("SELECT * FROM patients WHERE phone_number = $1", phone_number)
        return [dict(r) for r in records]

async def fetch_previous_history(patient_id: str) -> dict | None:
    """Fetches the most recent COMPLETED session's AI summary and doctor prescription
    for a given patient_id. Returns None if no history exists (new patient)."""
    if not _pool: return None
    async with _pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT ps.session_id, ps.chief_complaint, ps.doctor_prescription,
                   ps.completed_at, ps.department,
                   cs.full_detailed_summary, cs.small_summary, cs.pdf_file_path
            FROM patient_sessions ps
            LEFT JOIN clinical_summaries cs ON ps.session_id = cs.session_id
            WHERE ps.patient_id = $1
              AND ps.session_status = 'COMPLETED'
            ORDER BY ps.completed_at DESC
            LIMIT 1
        """, patient_id)
        if not row:
            return None
        
        result = dict(row)
        # Parse JSON summary safely (full_detailed_summary is JSONB now)
        val = result.get("full_detailed_summary")
        if isinstance(val, str):
            try:
                result["ai_summary_parsed"] = json.loads(val)
            except json.JSONDecodeError:
                result["ai_summary_parsed"] = {}
        else:
            result["ai_summary_parsed"] = val or {}
        
        return result

async def start_kiosk_session(patient_data: dict, department: str = "General Medicine", previous_history_json: dict = None, doctor_id: str = None) -> dict:
    """Starts a session. Reuses patient_id if provided, else creates a new patient.
    If previous_history_json is provided, stores it for follow-up context."""
    if not _pool: return {}
    async with _pool.acquire() as conn:
        patient_id = patient_data.get("patient_id")
        
        if not patient_id:
            abha_id = patient_data.get("abha_id")
            if abha_id:
                existing = await conn.fetchrow("SELECT patient_id FROM patients WHERE abha_id = $1", abha_id)
                if existing:
                    patient_id = existing["patient_id"]
                else:
                    patient_id = abha_id
            else:
                patient_id = f"pat_{uuid.uuid4().hex[:8]}"
            await conn.execute("""
                INSERT INTO patients (patient_id, full_name, phone_number, age, gender, date_of_birth, weight, height, address, abha_id, vitals)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (patient_id) DO UPDATE SET
                    weight = COALESCE(EXCLUDED.weight, patients.weight),
                    height = COALESCE(EXCLUDED.height, patients.height),
                    vitals = COALESCE(EXCLUDED.vitals, patients.vitals),
                    address = COALESCE(EXCLUDED.address, patients.address)
            """, 
                patient_id, patient_data.get("full_name"), patient_data.get("phone_number"),
                patient_data.get("age"), patient_data.get("gender"), patient_data.get("date_of_birth"),
                patient_data.get("weight"), patient_data.get("height"), patient_data.get("address"), 
                patient_data.get("abha_id"), patient_data.get("vitals")
            )
            
        token_number = None
        room_number = "TBD"
        if doctor_id:
            doc_row = await conn.fetchrow("SELECT room_number FROM doctors WHERE doctor_id = $1", doctor_id)
            if doc_row:
                room_number = doc_row["room_number"]
            
        # GUARANTEE NO TOKEN DUPLICATION (Active Session Lock) applies universally
        existing_session = await conn.fetchrow("""
            SELECT ps.token_number, ps.token_id, ps.department, d.full_name as doctor_name
            FROM patient_sessions ps
            JOIN patients p ON ps.patient_id = p.patient_id
            LEFT JOIN doctors d ON ps.doctor_id = d.doctor_id
            WHERE (
                ps.patient_id = $1 
                OR ($2::text IS NOT NULL AND p.phone_number = $2::text AND LOWER(p.full_name) = LOWER($3::text))
            )
              AND (ps.created_at AT TIME ZONE 'Asia/Kolkata')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
              AND ps.session_status IN ('IN_PROGRESS', 'WAITING')
        """, patient_id, patient_data.get("phone_number"), patient_data.get("full_name"))
        if existing_session:
            return {
                "conflict": True,
                "existing_token": existing_session["token_number"] or existing_session["token_id"],
                "doctor_name": existing_session["doctor_name"],
                "department": existing_session["department"]
            }
            
        # Global daily footfall count
        row = await conn.fetchrow("""
            SELECT COUNT(*) as count 
            FROM patient_sessions 
            WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
        """)
        token_number = (row["count"] or 0) + 1
        
        date_prefix = datetime.now().strftime('%y%m%d')
        
        while True:
            token_id = f"TOKEN-{date_prefix}-{token_number}"
            try:
                session_id = f"sess_{uuid.uuid4().hex[:8]}"
                await conn.execute("""
                    INSERT INTO patient_sessions (session_id, patient_id, token_id, department, session_status, previous_history_json, doctor_id, token_number)
                    VALUES ($1, $2, $3, $4, 'IN_PROGRESS', $5, $6, $7)
                """, session_id, patient_id, token_id, department, json.dumps(previous_history_json) if previous_history_json else None, doctor_id, token_number)
                break # success
            except asyncpg.exceptions.UniqueViolationError:
                token_number += 1
                
        return {"session_id": session_id, "token_id": token_id, "token_number": token_number, "room_number": room_number, "patient_id": patient_id, "doctor_id": doctor_id}

async def commit_fsm_checkpoint(session_id: str, filled_state: dict, chief_complaint: str, interview_qa: list, 
                          priority_flag: bool = False, priority_reason: str = None, status: str = "IN_PROGRESS"):
    """Serializes the RAM dictionary to Postgres JSONB during state transitions."""
    if not _pool: return
    async with _pool.acquire() as conn:
        await conn.execute("""
            UPDATE patient_sessions
            SET filled_state_json = $1::jsonb,
                interview_qa_json = $2::jsonb,
                chief_complaint = $3,
                priority_flag = $4,
                priority_reason = $5,
                session_status = $6
            WHERE session_id = $7
        """, json.dumps(filled_state), json.dumps(interview_qa), chief_complaint, bool(priority_flag), priority_reason, status, session_id)
        logger.info(f"Session {session_id} checkpoint saved with status '{status}'.")

async def save_uploaded_document(session_id: str, file_path: str, document_type: str = 'OTHER', 
                           ocr_raw: dict = None, medications: list = None, labs: list = None) -> str:
    """Inserts Gemini vision extractions into uploaded_documents."""
    doc_id = f"doc_{uuid.uuid4().hex[:8]}"
    if not _pool: return doc_id
    async with _pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO uploaded_documents (document_id, session_id, file_path, document_type, ocr_raw_json, extracted_medications, extracted_labs)
            VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)
        """, doc_id, session_id, file_path, document_type,
            json.dumps(ocr_raw or {}),
            json.dumps(medications or []), 
            json.dumps(labs or [])
        )
    return doc_id

async def save_clinical_summary(session_id: str, small_summary: str, full_detailed_summary: dict, 
                          critical_highlights: list, contradictions_found: list, pdf_file_path: str) -> str:
    """Uses INSERT ON CONFLICT on clinical_summaries to store generated AI narratives, PDF paths, and contradiction audits."""
    summary_id = f"sum_{uuid.uuid4().hex[:8]}"
    if not _pool: return summary_id
    async with _pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO clinical_summaries 
            (summary_id, session_id, small_summary, full_detailed_summary, critical_highlights, contradictions_found, pdf_file_path)
            VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7)
            ON CONFLICT (session_id) DO UPDATE SET
                small_summary = EXCLUDED.small_summary,
                full_detailed_summary = EXCLUDED.full_detailed_summary,
                critical_highlights = EXCLUDED.critical_highlights,
                contradictions_found = EXCLUDED.contradictions_found,
                pdf_file_path = EXCLUDED.pdf_file_path
        """, summary_id, session_id, small_summary, json.dumps(full_detailed_summary),
            json.dumps(critical_highlights or []), 
            json.dumps(contradictions_found or []),
            pdf_file_path
        )
    return summary_id

async def submit_doctor_notes(session_id: str, doctor_id: str, notes: str):
    """Updates doctor_consultation_notes, doctor_id, and sets doctor_signed_at, marking the session status as COMPLETED."""
    if not _pool: return
    async with _pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("""
                UPDATE clinical_summaries
                SET doctor_consultation_notes = $1, doctor_id = $2, doctor_signed_at = CURRENT_TIMESTAMP
                WHERE session_id = $3
            """, notes, doctor_id, session_id)
            
            await conn.execute("""
                UPDATE patient_sessions
                SET session_status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
                WHERE session_id = $1
            """, session_id)

async def fetch_triage_queue(doctor_id: str = None) -> list[dict]:
    """Returns today's active sessions ordered by priority_flag DESC, created_at ASC (IST local time)."""
    if not _pool: return []
    async with _pool.acquire() as conn:
        query = """
            SELECT ps.session_id, ps.token_id, ps.token_number, ps.doctor_id, ps.priority_flag, ps.priority_reason, ps.session_status, 
                   ps.created_at, p.full_name, p.age, p.gender, p.phone_number, ps.chief_complaint,
                   ps.department, ps.nurse_triage_notes
            FROM patient_sessions ps
            JOIN patients p ON ps.patient_id = p.patient_id
            WHERE (
                (ps.created_at AT TIME ZONE 'Asia/Kolkata')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
                OR (ps.session_status IN ('WAITING', 'IN_PROGRESS') AND ps.created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours')
            )
        """
        params = []
        if doctor_id:
            query += " AND ps.doctor_id = $1"
            params.append(doctor_id)
            
        query += " ORDER BY ps.priority_flag DESC, ps.created_at ASC"
        
        records = await conn.fetch(query, *params)
        return [dict(r) for r in records]

async def fetch_doctor_encounter(session_id: str) -> dict:
    """Executes LEFT JOIN on patient_sessions, patients, clinical_summaries, and parses JSONB columns back to Python dicts/lists."""
    if not _pool: return None
    async with _pool.acquire() as conn:
        encounter_row = await conn.fetchrow("""
            SELECT 
                p.patient_id, p.abha_id, p.abha_address, p.aadhaar_hash, p.date_of_birth,
                p.full_name, p.phone_number, p.age, p.gender,
                ps.session_id, ps.token_id, ps.chief_complaint, ps.interview_qa_json, ps.filled_state_json, 
                ps.priority_flag, ps.priority_reason, ps.session_status, ps.created_at as session_created_at, ps.completed_at,
                cs.small_summary, cs.full_detailed_summary, cs.critical_highlights, cs.contradictions_found, 
                cs.doctor_consultation_notes, cs.doctor_id, cs.pdf_file_path, cs.doctor_signed_at
            FROM patient_sessions ps
            JOIN patients p ON ps.patient_id = p.patient_id
            LEFT JOIN clinical_summaries cs ON ps.session_id = cs.session_id
            WHERE ps.session_id = $1
        """, session_id)
        
        if not encounter_row:
            return None
            
        encounter_data = dict(encounter_row)
        
        # Safely parse JSONB columns (they are usually returned as strings by asyncpg or parsed dicts if typemap is setup, let's handle string to be safe)
        for json_col in ['filled_state_json', 'interview_qa_json', 'critical_highlights', 'contradictions_found']:
            val = encounter_data.get(json_col)
            if isinstance(val, str):
                try:
                    default = "{}" if "state" in json_col else "[]"
                    encounter_data[json_col.replace("_json", "")] = json.loads(val or default)
                except json.JSONDecodeError:
                    encounter_data[json_col.replace("_json", "")] = {} if "state" in json_col else []
            else:
                encounter_data[json_col.replace("_json", "")] = val or ({} if "state" in json_col else [])
            if json_col in encounter_data:
                del encounter_data[json_col]
        
        documents = []
        doc_records = await conn.fetch("""
            SELECT document_id, file_path, document_type, ocr_raw_json, extracted_medications, extracted_labs, created_at
            FROM uploaded_documents
            WHERE session_id = $1
        """, session_id)
        
        for doc in doc_records:
            doc_dict = dict(doc)
            for doc_json_col in ['ocr_raw_json', 'extracted_medications', 'extracted_labs']:
                val = doc_dict.get(doc_json_col)
                if isinstance(val, str):
                    try:
                        default = "{}" if "raw" in doc_json_col else "[]"
                        doc_dict[doc_json_col.replace("_json", "")] = json.loads(val or default)
                    except json.JSONDecodeError:
                        doc_dict[doc_json_col.replace("_json", "")] = {} if "raw" in doc_json_col else []
                else:
                    doc_dict[doc_json_col.replace("_json", "")] = val or ({} if "raw" in doc_json_col else [])
                if doc_json_col in doc_dict:
                    del doc_dict[doc_json_col]
            documents.append(doc_dict)
            
        encounter_data["uploaded_documents"] = documents
        return encounter_data

# -----------------------------------------------------------------------------
# PORTAL / MOBILE APP HELPER FUNCTIONS (Phase 3 & 4)
# -----------------------------------------------------------------------------

async def fetch_patient_history_by_identifier(identifier: str) -> list[dict]:
    """Returns past consultations for the patient."""
    if not _pool: return []
    async with _pool.acquire() as conn:
        records = await conn.fetch("""
            SELECT ps.session_id, ps.completed_at, ps.department,
                   d.full_name as doctor_name, cs.pdf_file_path
            FROM patient_sessions ps
            JOIN patients p ON ps.patient_id = p.patient_id
            LEFT JOIN clinical_summaries cs ON ps.session_id = cs.session_id
            LEFT JOIN doctors d ON ps.doctor_id = d.doctor_id
            WHERE (p.abha_id = $1 OR p.phone_number = $1)
              AND ps.session_status = 'COMPLETED'
            ORDER BY ps.completed_at DESC
        """, identifier)
        return [dict(r) for r in records]

async def fetch_patient_documents_by_identifier(identifier: str) -> list[dict]:
    """Returns previously uploaded documents for the patient."""
    if not _pool: return []
    async with _pool.acquire() as conn:
        records = await conn.fetch("""
            SELECT ud.document_id, ud.file_path, ud.document_type, ud.created_at
            FROM uploaded_documents ud
            JOIN patient_sessions ps ON ud.session_id = ps.session_id
            JOIN patients p ON ps.patient_id = p.patient_id
            WHERE (p.abha_id = $1 OR p.phone_number = $1)
            ORDER BY ud.created_at DESC
        """, identifier)
        return [dict(r) for r in records]

async def fetch_latest_clinical_record(identifier: str) -> dict | None:
    """Returns the most recent JSON clinical record and notes for RAG AI."""
    if not _pool: return None
    async with _pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT cs.full_detailed_summary, cs.doctor_consultation_notes
            FROM clinical_summaries cs
            JOIN patient_sessions ps ON cs.session_id = ps.session_id
            JOIN patients p ON ps.patient_id = p.patient_id
            WHERE (p.abha_id = $1 OR p.phone_number = $1)
              AND ps.session_status = 'COMPLETED'
            ORDER BY ps.completed_at DESC
            LIMIT 1
        """, identifier)
        if not row:
            return None
            
        result = dict(row)
        # Handle stringified JSONB fallback
        val = result.get("full_detailed_summary")
        if isinstance(val, str):
            try:
                result["full_detailed_summary"] = json.loads(val)
            except json.JSONDecodeError:
                result["full_detailed_summary"] = {}
        
        return result

# -----------------------------------------------------------------------------
# ADMIN PANEL HELPER FUNCTIONS
# -----------------------------------------------------------------------------

async def log_system_action(admin_email: str, action_type: str, target_id: str = None):
    if not _pool: return
    async with _pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO system_logs (admin_email, action_type, target_id) VALUES ($1, $2, $3)",
            admin_email, action_type, target_id
        )

async def get_system_logs() -> list[dict]:
    if not _pool: return []
    async with _pool.acquire() as conn:
        records = await conn.fetch("SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT 100")
        return [dict(r) for r in records]

async def get_departments() -> list[dict]:
    if not _pool: return []
    async with _pool.acquire() as conn:
        records = await conn.fetch("SELECT * FROM departments")
        return [dict(r) for r in records]

async def add_department(name: str):
    if not _pool: return
    async with _pool.acquire() as conn:
        await conn.execute("INSERT INTO departments (name) VALUES ($1)", name)

async def get_doctors() -> list[dict]:
    if not _pool: return []
    for attempt in range(2):
        try:
            async with _pool.acquire() as conn:
                records = await conn.fetch("""
                    SELECT 
                        d.doctor_id, d.full_name, d.license_number, d.profile_image_url, 
                        d.max_daily_patients, d.status, d.room_number, d.dept_id, d.username, d.password, d.current_status, dept.name as dept_name,
                        (SELECT COUNT(*) FROM patient_sessions ps 
                         WHERE ps.department = dept.name 
                         AND (ps.created_at AT TIME ZONE 'Asia/Kolkata')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date) as total_seen_today
                    FROM doctors d
                    LEFT JOIN departments dept ON d.dept_id = dept.dept_id
                """)
                return [dict(r) for r in records]
        except (asyncpg.ConnectionDoesNotExistError, asyncpg.InterfaceError, ConnectionResetError) as e:
            logger.warning(f"Connection dropped in get_doctors (attempt {attempt+1}): {e}")
            if attempt == 1:
                return []
            await asyncio.sleep(0.2)
        except Exception as e:
            logger.error(f"Error fetching doctors: {e}")
            return []
    return []

async def add_doctor(full_name: str, dept_id: int, license_number: str, max_daily_patients: int = 40, profile_image_url: str = None, room_number: str = "TBD", username: str = None, password: str = None):
    import uuid
    doctor_id = str(uuid.uuid4())
    if not _pool: return
    async with _pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO doctors (doctor_id, full_name, dept_id, license_number, max_daily_patients, profile_image_url, room_number, username, password) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            doctor_id, full_name, dept_id, license_number, max_daily_patients, profile_image_url, room_number, username, password
        )

async def update_doctor(doctor_id: str, full_name: str, dept_id: int, license_number: str, max_daily_patients: int, status: str, room_number: str, profile_image_url: str = None, username: str = None, password: str = None, current_status: str = 'Available'):
    if not _pool: return
    async with _pool.acquire() as conn:
        if profile_image_url:
            await conn.execute("""
                UPDATE doctors 
                SET full_name = $1, dept_id = $2, license_number = $3, max_daily_patients = $4, status = $5, room_number = $6, profile_image_url = $7, username = $8, password = $9, current_status = $10
                WHERE doctor_id = $11
            """, full_name, dept_id, license_number, max_daily_patients, status, room_number, profile_image_url, username, password, current_status, doctor_id)
        else:
            await conn.execute("""
                UPDATE doctors 
                SET full_name = $1, dept_id = $2, license_number = $3, max_daily_patients = $4, status = $5, room_number = $6, username = $7, password = $8, current_status = $9
                WHERE doctor_id = $10
            """, full_name, dept_id, license_number, max_daily_patients, status, room_number, username, password, current_status, doctor_id)

async def get_rules() -> list[dict]:
    if not _pool: return []
    async with _pool.acquire() as conn:
        records = await conn.fetch("SELECT * FROM clinical_rules")
        return [dict(r) for r in records]

async def add_rule(trigger_keyword: str, action_type: str, action_value: str):
    if not _pool: return
    async with _pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO clinical_rules (trigger_keyword, action_type, action_value)
            VALUES ($1, $2, $3)
        """, trigger_keyword, action_type, action_value)

async def get_analytics_metrics() -> dict:
    if not _pool: return {"total_footfall": 0, "avg_wait_time": 0, "emergency_active": 0}
    async with _pool.acquire() as conn:
        total_footfall = await conn.fetchval("SELECT COUNT(*) FROM patient_sessions WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date")
        
        emergency_active = await conn.fetchval("SELECT COUNT(*) FROM patient_sessions WHERE session_status = 'IN_PROGRESS' AND priority_flag = TRUE AND (created_at AT TIME ZONE 'Asia/Kolkata')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date")
        
        row = await conn.fetchval("""
            SELECT AVG(
                EXTRACT(EPOCH FROM (completed_at - created_at)) / 60
            ) 
            FROM patient_sessions 
            WHERE session_status = 'COMPLETED' 
            AND (created_at AT TIME ZONE 'Asia/Kolkata')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
        """)
        avg_wait_time = int(row) if row else 0
        
        return {
            "total_footfall": total_footfall,
            "avg_wait_time": avg_wait_time,
            "emergency_active": emergency_active
        }

async def downgrade_priority(session_id: str, admin_email: str):
    if not _pool: return
    async with _pool.acquire() as conn:
        await conn.execute("UPDATE patient_sessions SET priority_flag = FALSE WHERE session_id = $1", session_id)
    await log_system_action(admin_email, "PRIORITY_DOWNGRADE", session_id)

async def archive_active_queues(admin_email: str):
    if not _pool: return
    async with _pool.acquire() as conn:
        await conn.execute("UPDATE patient_sessions SET session_status = 'ARCHIVED' WHERE session_status = 'IN_PROGRESS'")
    await log_system_action(admin_email, "EOD_RESET", "ALL_QUEUES")

async def get_all_patients() -> list[dict]:
    if not _pool: return []
    async with _pool.acquire() as conn:
        records = await conn.fetch("""
            SELECT p.*, 
                   (SELECT ps.session_id 
                    FROM patient_sessions ps 
                    JOIN clinical_summaries cs ON ps.session_id = cs.session_id 
                    WHERE ps.patient_id = p.patient_id AND cs.pdf_file_path IS NOT NULL 
                    ORDER BY cs.generated_at DESC LIMIT 1) as latest_session_id
            FROM patients p
            ORDER BY p.created_at DESC
        """)
        return [dict(r) for r in records]

async def update_patient_details(patient_id: str, updates: dict, admin_email: str):
    if not _pool: return
    allowed_keys = ['weight', 'height', 'age', 'phone_number']
    set_clauses = []
    values = []
    
    idx = 1
    for key, value in updates.items():
        if key in allowed_keys:
            set_clauses.append(f"{key} = ${idx}")
            values.append(value)
            idx += 1
            
    if not set_clauses:
        return
        
    values.append(patient_id)
    query = f"UPDATE patients SET {', '.join(set_clauses)} WHERE patient_id = ${idx}"
    
    async with _pool.acquire() as conn:
        await conn.execute(query, *values)
    await log_system_action(admin_email, "PATIENT_EDIT", patient_id)

async def get_health_officer_export_data() -> dict:
    if not _pool: return {"patients": [], "patient_sessions": [], "clinical_summaries": []}
    async with _pool.acquire() as conn:
        patients_records = await conn.fetch("SELECT * FROM patients")
        sessions_records = await conn.fetch("SELECT * FROM patient_sessions")
        summaries_records = await conn.fetch("SELECT * FROM clinical_summaries")
        
        def serialize_record(record):
            r = dict(record)
            for k, v in r.items():
                if isinstance(v, datetime):
                    r[k] = v.isoformat()
            return r
            
        return {
            "patients": [serialize_record(p) for p in patients_records],
            "patient_sessions": [serialize_record(s) for s in sessions_records],
            "clinical_summaries": [serialize_record(s) for s in summaries_records]
        }

# -----------------------------------------------------------------------------
# ANALYTICS DASHBOARD
# -----------------------------------------------------------------------------

async def get_dashboard_data(start_date: str = None, end_date: str = None,
                             departments: list = None, complaints: list = None) -> dict:
    """Single comprehensive query for the analytics dashboard.
    All filters are optional — omitted filters mean 'all'."""
    if not _pool:
        return {"kpi": {}, "sparklines": {}, "footfall_by_date": [], "department_breakdown": [],
                "complaint_breakdown": [], "red_flags_over_time": []}

    async with _pool.acquire() as conn:
        # Build WHERE clause fragments
        conditions = []
        params = []
        idx = 1

        if start_date:
            conditions.append(f"(ps.created_at AT TIME ZONE 'Asia/Kolkata')::date >= ${idx}::date")
            params.append(datetime.strptime(start_date, '%Y-%m-%d').date())
            idx += 1
        if end_date:
            conditions.append(f"(ps.created_at AT TIME ZONE 'Asia/Kolkata')::date <= ${idx}::date")
            params.append(datetime.strptime(end_date, '%Y-%m-%d').date())
            idx += 1
        if departments:
            conditions.append(f"ps.department = ANY(${idx}::text[])")
            params.append(departments)
            idx += 1
        if complaints:
            conditions.append(f"ps.chief_complaint = ANY(${idx}::text[])")
            params.append(complaints)
            idx += 1

        where = (" WHERE " + " AND ".join(conditions)) if conditions else ""

        # ── KPI: Total footfall in range ──
        total_footfall = await conn.fetchval(
            f"SELECT COUNT(*) FROM patient_sessions ps{where}", *params) or 0

        # ── KPI: Today's footfall (ignores filters) ──
        today_footfall = await conn.fetchval(
            "SELECT COUNT(*) FROM patient_sessions WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date"
        ) or 0

        # ── KPI: Avg intake time (minutes) in range ──
        avg_intake = await conn.fetchval(
            f"""SELECT AVG(EXTRACT(EPOCH FROM (ps.completed_at - ps.created_at)) / 60)
                FROM patient_sessions ps{where} AND ps.session_status = 'COMPLETED' AND ps.completed_at IS NOT NULL"""
            if where else
            """SELECT AVG(EXTRACT(EPOCH FROM (ps.completed_at - ps.created_at)) / 60)
               FROM patient_sessions ps WHERE ps.session_status = 'COMPLETED' AND ps.completed_at IS NOT NULL""",
            *params
        )
        avg_intake = round(float(avg_intake), 1) if avg_intake else 0

        # ── KPI: Priority count in range ──
        priority_q = f"SELECT COUNT(*) FROM patient_sessions ps{where}"
        if where:
            priority_q += " AND ps.priority_flag = TRUE"
        else:
            priority_q += " WHERE ps.priority_flag = TRUE"
        priority_count = await conn.fetchval(priority_q, *params) or 0

        # ── KPI: Documents OCR'd + avg confidence ──
        docs_count = await conn.fetchval("SELECT COUNT(*) FROM uploaded_documents") or 0

        # ── Sparklines: last 7 days (ignores filters for simplicity) ──
        sparkline_rows = await conn.fetch("""
            SELECT (created_at AT TIME ZONE 'Asia/Kolkata')::date as d, COUNT(*) as c
            FROM patient_sessions
            WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date >= (CURRENT_DATE - INTERVAL '6 days')
            GROUP BY d ORDER BY d
        """)
        footfall_7d = [int(r["c"]) for r in sparkline_rows]

        priority_sparkline = await conn.fetch("""
            SELECT (created_at AT TIME ZONE 'Asia/Kolkata')::date as d, COUNT(*) as c
            FROM patient_sessions
            WHERE priority_flag = TRUE
              AND (created_at AT TIME ZONE 'Asia/Kolkata')::date >= (CURRENT_DATE - INTERVAL '6 days')
            GROUP BY d ORDER BY d
        """)
        priority_7d = [int(r["c"]) for r in priority_sparkline]

        # ── Footfall by date (for main chart) ──
        footfall_rows = await conn.fetch(
            f"""SELECT (ps.created_at AT TIME ZONE 'Asia/Kolkata')::date as date,
                       ps.department, COUNT(*) as count
                FROM patient_sessions ps{where}
                GROUP BY date, ps.department
                ORDER BY date""",
            *params
        )
        footfall_by_date = [{"date": str(r["date"]), "department": r["department"] or "Unknown", "count": int(r["count"])} for r in footfall_rows]

        # ── Department breakdown ──
        dept_rows = await conn.fetch(
            f"""SELECT ps.department, COUNT(*) as count
                FROM patient_sessions ps{where}
                GROUP BY ps.department ORDER BY count DESC""",
            *params
        )
        department_breakdown = [{"department": r["department"] or "Unknown", "count": int(r["count"])} for r in dept_rows]

        # ── Complaint breakdown (top 10 + Other) ──
        complaint_rows = await conn.fetch(
            f"""SELECT ps.chief_complaint, COUNT(*) as count
                FROM patient_sessions ps{where}
                {"AND" if where else "WHERE"} ps.chief_complaint IS NOT NULL AND ps.chief_complaint != ''
                GROUP BY ps.chief_complaint ORDER BY count DESC LIMIT 10""",
            *params
        )
        complaint_breakdown = [{"complaint": r["chief_complaint"], "count": int(r["count"])} for r in complaint_rows]

        # ── Red flags over time ──
        rf_rows = await conn.fetch(
            f"""SELECT (ps.created_at AT TIME ZONE 'Asia/Kolkata')::date as date,
                       ps.priority_reason, COUNT(*) as count
                FROM patient_sessions ps{where}
                {"AND" if where else "WHERE"} ps.priority_flag = TRUE
                GROUP BY date, ps.priority_reason
                ORDER BY date""",
            *params
        )
        # Classify source: if priority_reason contains 'document' or 'lab' or 'ocr' → document, else conversational
        red_flags_over_time = []
        for r in rf_rows:
            reason = (r["priority_reason"] or "").lower()
            source = "document" if any(kw in reason for kw in ["document", "lab", "ocr", "troponin", "creatinine"]) else "conversational"
            red_flags_over_time.append({"date": str(r["date"]), "source": source, "count": int(r["count"])})

        return {
            "kpi": {
                "total_footfall_range": total_footfall,
                "today_footfall": today_footfall,
                "avg_intake_minutes": avg_intake,
                "priority_count_range": priority_count,
                "docs_ocrd": docs_count,
            },
            "sparklines": {
                "footfall_7d": footfall_7d,
                "priority_7d": priority_7d,
            },
            "footfall_by_date": footfall_by_date,
            "department_breakdown": department_breakdown,
            "complaint_breakdown": complaint_breakdown,
            "red_flags_over_time": red_flags_over_time,
        }


async def get_active_red_flags() -> list:
    """Returns all currently-flagged patients in today's OPD."""
    if not _pool: return []
    async with _pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT ps.session_id, ps.token_id, ps.priority_reason, ps.department,
                   ps.chief_complaint, ps.created_at, ps.session_status,
                   p.full_name, p.age, p.gender
            FROM patient_sessions ps
            JOIN patients p ON ps.patient_id = p.patient_id
            WHERE ps.priority_flag = TRUE
              AND (ps.created_at AT TIME ZONE 'Asia/Kolkata')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
            ORDER BY ps.created_at DESC
        """)
        result = []
        for r in rows:
            d = dict(r)
            if isinstance(d.get("created_at"), datetime):
                d["created_at"] = d["created_at"].isoformat()
            result.append(d)
        return result


async def get_impact_metrics() -> dict:
    """Computes real impact numbers from actual session data."""
    if not _pool: return {}
    async with _pool.acquire() as conn:
        total_completed = await conn.fetchval(
            "SELECT COUNT(*) FROM patient_sessions WHERE session_status = 'COMPLETED'"
        ) or 0

        avg_intake = await conn.fetchval("""
            SELECT AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 60)
            FROM patient_sessions
            WHERE session_status = 'COMPLETED' AND completed_at IS NOT NULL
        """)
        avg_intake_min = round(float(avg_intake), 1) if avg_intake else 0

        total_patients = await conn.fetchval("SELECT COUNT(*) FROM patients") or 0
        total_sessions = await conn.fetchval("SELECT COUNT(*) FROM patient_sessions") or 0
        total_docs = await conn.fetchval("SELECT COUNT(*) FROM uploaded_documents") or 0
        total_red_flags = await conn.fetchval(
            "SELECT COUNT(*) FROM patient_sessions WHERE priority_flag = TRUE"
        ) or 0

        # Estimated savings: assume 15min manual intake → our avg intake = savings per patient
        manual_estimate_min = 15
        savings_per_patient = max(0, manual_estimate_min - avg_intake_min)
        total_hours_saved = round((savings_per_patient * total_completed) / 60, 1)

        return {
            "total_patients": total_patients,
            "total_sessions": total_sessions,
            "total_completed": total_completed,
            "avg_intake_minutes": avg_intake_min,
            "total_docs_ocrd": total_docs,
            "total_red_flags_caught": total_red_flags,
            "estimated_hours_saved": total_hours_saved,
            "savings_per_patient_min": round(savings_per_patient, 1),
        }
