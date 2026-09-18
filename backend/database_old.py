import sqlite3
import json
import uuid
import random
from datetime import datetime
import logging
from typing import Optional, List

logger = logging.getLogger(__name__)
DB_PATH = "swasthyasync.db"

def get_connection():
    """Helper function to get a SQLite connection with WAL enabled."""
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.row_factory = sqlite3.Row
    return conn

def setup_database():
    """Initializes the core tables for the SDUI Kiosk flow with advanced ABDM-compliant schemas."""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS patients (
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS patient_sessions (
                session_id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                token_id TEXT UNIQUE NOT NULL,
                department TEXT,
                chief_complaint TEXT,
                interview_qa_json TEXT DEFAULT '[]',
                filled_state_json TEXT DEFAULT '{}',
                priority_flag BOOLEAN DEFAULT 0,
                priority_reason TEXT,
                session_status TEXT DEFAULT 'IN_PROGRESS',
                nurse_triage_notes TEXT,
                doctor_prescription TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS uploaded_documents (
                document_id TEXT PRIMARY KEY,
                session_id TEXT,
                file_path TEXT NOT NULL,
                document_type TEXT DEFAULT 'OTHER',
                ocr_raw_json TEXT DEFAULT '{}',
                extracted_medications TEXT DEFAULT '[]',
                extracted_labs TEXT DEFAULT '[]',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES patient_sessions(session_id) ON DELETE CASCADE
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS clinical_summaries (
                summary_id TEXT PRIMARY KEY,
                session_id TEXT UNIQUE,
                small_summary TEXT,
                full_detailed_summary TEXT,
                critical_highlights TEXT DEFAULT '[]',
                contradictions_found TEXT DEFAULT '[]',
                doctor_consultation_notes TEXT,
                doctor_id TEXT,
                pdf_file_path TEXT,
                generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                doctor_signed_at TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES patient_sessions(session_id) ON DELETE CASCADE
            )
        """)

        # Admin Panel Tables
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS departments (
                dept_id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS doctors (
                doctor_id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                password TEXT,
                full_name TEXT NOT NULL,
                dept_id INTEGER,
                license_number TEXT,
                profile_image_url TEXT,
                max_daily_patients INTEGER DEFAULT 40,
                status TEXT DEFAULT 'Active',
                current_status TEXT DEFAULT 'Available',
                room_number TEXT DEFAULT 'TBD',
                FOREIGN KEY(dept_id) REFERENCES departments(dept_id)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS clinical_rules (
                rule_id INTEGER PRIMARY KEY AUTOINCREMENT,
                trigger_keyword TEXT NOT NULL,
                action_type TEXT NOT NULL,
                action_value TEXT
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS system_logs (
                log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_email TEXT NOT NULL,
                action_type TEXT NOT NULL,
                target_id TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS admin_notifications (
                notif_id TEXT PRIMARY KEY,
                doctor_id INTEGER,
                message TEXT,
                is_read BOOLEAN DEFAULT 0,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(doctor_id) REFERENCES doctors(doctor_id)
            )
        """)

        # Auto-migration for existing tables
        try:
            cursor.execute("ALTER TABLE patient_sessions ADD COLUMN nurse_triage_notes TEXT")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE patient_sessions ADD COLUMN doctor_prescription TEXT")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE patient_sessions ADD COLUMN doctor_id TEXT")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE patient_sessions ADD COLUMN token_number INTEGER")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE doctors ADD COLUMN username TEXT UNIQUE")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE doctors ADD COLUMN password TEXT")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE doctors ADD COLUMN current_status TEXT DEFAULT 'Available'")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE patient_sessions ADD COLUMN previous_history_json TEXT")
        except Exception:
            pass

        conn.commit()
        logger.info("Database schema initialized and auto-migrated successfully.")

def get_active_doctors() -> list[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT d.doctor_id, d.full_name, d.room_number, dp.name as department
            FROM doctors d
            LEFT JOIN departments dp ON d.dept_id = dp.dept_id
            WHERE d.status = 'Active'
        """)
        return [dict(row) for row in cursor.fetchall()]

def get_patients_by_phone(phone_number: str) -> list[dict]:
    """Fetches all family members linked to a single phone number."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM patients WHERE phone_number = ?", (phone_number,))
        return [dict(row) for row in cursor.fetchall()]

def fetch_previous_history(patient_id: str) -> dict | None:
    """Fetches the most recent COMPLETED session's AI summary and doctor prescription
    for a given patient_id. Returns None if no history exists (new patient)."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT ps.session_id, ps.chief_complaint, ps.doctor_prescription,
                   ps.completed_at, ps.department,
                   cs.full_detailed_summary, cs.small_summary, cs.pdf_file_path
            FROM patient_sessions ps
            LEFT JOIN clinical_summaries cs ON ps.session_id = cs.session_id
            WHERE ps.patient_id = ?
              AND ps.session_status = 'COMPLETED'
            ORDER BY ps.completed_at DESC
            LIMIT 1
        """, (patient_id,))
        row = cursor.fetchone()
        if not row:
            return None
        
        result = dict(row)
        # Parse JSON summary safely
        try:
            result["ai_summary_parsed"] = json.loads(result.get("full_detailed_summary") or "{}")
        except json.JSONDecodeError:
            result["ai_summary_parsed"] = {}
        
        return result

def get_active_doctors() -> list:
    """Fetch active doctors from the database."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT d.doctor_id, d.full_name, d.room_number, d.current_status, dp.name as department
            FROM doctors d
            LEFT JOIN departments dp ON d.dept_id = dp.dept_id
            WHERE d.status = 'Active' OR d.status IS NULL
        ''')
        doctors = [dict(row) for row in cursor.fetchall()]
        # Convert doctor_id to string for consistency if needed, but dict already has it.
        # Fallback to defaults if no department is found
        for doc in doctors:
            if not doc["department"]:
                doc["department"] = "General Medicine"
        return doctors
    except Exception as e:
        logger.error(f"Error fetching active doctors: {e}")
        return []
    finally:
        conn.close()

def start_kiosk_session(patient_data: dict, department: str = "General Medicine", previous_history_json: str = None, doctor_id: str = None) -> dict:
    """Starts a session. Reuses patient_id if provided, else creates a new patient.
    If previous_history_json is provided, stores it for follow-up context."""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        patient_id = patient_data.get("patient_id")
        
        if not patient_id:
            # Create completely new patient
            patient_id = f"pat_{uuid.uuid4().hex[:8]}"
            cursor.execute("""
                INSERT INTO patients (patient_id, full_name, phone_number, age, gender, date_of_birth, weight, height, address, abha_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                patient_id, patient_data.get("full_name"), patient_data.get("phone_number"),
                patient_data.get("age"), patient_data.get("gender"), patient_data.get("date_of_birth"),
                patient_data.get("weight"), patient_data.get("height"), patient_data.get("address"), patient_data.get("abha_id")
            ))
            
        token_number = None
        room_number = "TBD"
        
        if doctor_id:
            # Get doctor's room number
            cursor.execute("SELECT room_number FROM doctors WHERE doctor_id = ?", (doctor_id,))
            doc_row = cursor.fetchone()
            if doc_row:
                room_number = doc_row["room_number"]
            
            # GUARANTEE NO TOKEN DUPLICATION (Active Session Lock)
            cursor.execute("""
                SELECT token_number, token_id FROM patient_sessions
                WHERE patient_id = ?
                  AND date(created_at, 'localtime') = date('now', 'localtime')
                  AND session_status IN ('IN_PROGRESS', 'WAITING')
            """, (patient_id,))
            existing_session = cursor.fetchone()
            if existing_session:
                return {
                    "conflict": True,
                    "existing_token": existing_session["token_number"] or existing_session["token_id"]
                }
            
            # GUARANTEE NO TOKEN DUPLICATION (While Loop Check)
            day_prefix = datetime.now().strftime('%A')[:3].upper()
            cursor.execute("""
                SELECT COUNT(*) as count 
                FROM patient_sessions 
                WHERE doctor_id = ? 
                  AND date(created_at, 'localtime') = date('now', 'localtime')
            """, (doctor_id,))
            row = cursor.fetchone()
            token_number = (row["count"] or 0) + 1
            
            while True:
                token_id = f"TOKEN-{day_prefix}-{doctor_id}-{token_number}"
                cursor.execute("SELECT 1 FROM patient_sessions WHERE token_id = ?", (token_id,))
                if not cursor.fetchone():
                    break # Token is perfectly unique!
                token_number += 1
        else:
            day_prefix = datetime.now().strftime('%A')[:3].upper()
            while True:
                token_id = f"TOKEN-{day_prefix}-{random.randint(1000, 9999)}"
                cursor.execute("SELECT 1 FROM patient_sessions WHERE token_id = ?", (token_id,))
                if not cursor.fetchone():
                    break # Token is perfectly unique!
                
        session_id = f"sess_{uuid.uuid4().hex[:8]}"
        
        cursor.execute("""
            INSERT INTO patient_sessions (session_id, patient_id, token_id, department, session_status, previous_history_json, doctor_id, token_number)
            VALUES (?, ?, ?, ?, 'IN_PROGRESS', ?, ?, ?)
        """, (session_id, patient_id, token_id, department, previous_history_json, doctor_id, token_number))
        
        conn.commit()
        return {"session_id": session_id, "token_id": token_id, "token_number": token_number, "room_number": room_number, "patient_id": patient_id, "doctor_id": doctor_id}

def commit_fsm_checkpoint(session_id: str, filled_state: dict, chief_complaint: str, interview_qa: list, 
                          priority_flag: bool = False, priority_reason: str = None, status: str = "IN_PROGRESS"):
    """Serializes the RAM dictionary (filled_state_json, interview_qa_json) to SQLite disk during state transitions."""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        filled_state_json = json.dumps(filled_state)
        interview_qa_json = json.dumps(interview_qa)
        
        cursor.execute("""
            UPDATE patient_sessions
            SET filled_state_json = ?,
                interview_qa_json = ?,
                chief_complaint = ?,
                priority_flag = ?,
                priority_reason = ?,
                session_status = ?
            WHERE session_id = ?
        """, (filled_state_json, interview_qa_json, chief_complaint, int(priority_flag), priority_reason, status, session_id))
        
        conn.commit()
        logger.info(f"Session {session_id} checkpoint saved with status '{status}'.")

def save_uploaded_document(session_id: str, file_path: str, document_type: str = 'OTHER', 
                           ocr_raw: dict = None, medications: list = None, labs: list = None) -> str:
    """Inserts Gemini vision extractions into uploaded_documents."""
    doc_id = f"doc_{uuid.uuid4().hex[:8]}"
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO uploaded_documents (document_id, session_id, file_path, document_type, ocr_raw_json, extracted_medications, extracted_labs)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            doc_id, session_id, file_path, document_type,
            json.dumps(ocr_raw or {}),
            json.dumps(medications or []), 
            json.dumps(labs or [])
        ))
        conn.commit()
    return doc_id

def save_clinical_summary(session_id: str, small_summary: str, full_detailed_summary: str, 
                          critical_highlights: list, contradictions_found: list, pdf_file_path: str) -> str:
    """Uses INSERT OR REPLACE on clinical_summaries to store generated AI narratives, PDF paths, and contradiction audits."""
    summary_id = f"sum_{uuid.uuid4().hex[:8]}"
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO clinical_summaries 
            (summary_id, session_id, small_summary, full_detailed_summary, critical_highlights, contradictions_found, pdf_file_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            summary_id, session_id, small_summary, full_detailed_summary,
            json.dumps(critical_highlights or []), 
            json.dumps(contradictions_found or []),
            pdf_file_path
        ))
        conn.commit()
    return summary_id

def submit_doctor_notes(session_id: str, doctor_id: str, notes: str):
    """Updates doctor_consultation_notes, doctor_id, and sets doctor_signed_at, marking the session status as COMPLETED."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE clinical_summaries
            SET doctor_consultation_notes = ?, doctor_id = ?, doctor_signed_at = CURRENT_TIMESTAMP
            WHERE session_id = ?
        """, (notes, doctor_id, session_id))
        
        cursor.execute("""
            UPDATE patient_sessions
            SET session_status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
            WHERE session_id = ?
        """, (session_id,))
        
        conn.commit()

def fetch_triage_queue(doctor_id: str = None) -> list[dict]:
    """Returns today's active sessions ordered by priority_flag DESC, created_at ASC (IST local time)."""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        query = """
            SELECT ps.session_id, ps.token_id, ps.token_number, ps.doctor_id, ps.priority_flag, ps.priority_reason, ps.session_status, 
                   ps.created_at, p.full_name, p.age, p.gender, p.phone_number, ps.chief_complaint,
                   ps.department, ps.nurse_triage_notes
            FROM patient_sessions ps
            JOIN patients p ON ps.patient_id = p.patient_id
            WHERE date(ps.created_at, 'localtime') = date('now', 'localtime')
        """
        params = []
        
        if doctor_id:
            query += " AND ps.doctor_id = ?"
            params.append(doctor_id)
            
        query += " ORDER BY ps.priority_flag DESC, ps.created_at ASC"
        
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]

def fetch_doctor_encounter(session_id: str) -> dict:
    """Executes LEFT JOIN on patient_sessions, patients, clinical_summaries, and parses JSON columns back to Python dicts/lists."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
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
            WHERE ps.session_id = ?
        """, (session_id,))
        
        encounter_row = cursor.fetchone()
        if not encounter_row:
            return None
            
        encounter_data = dict(encounter_row)
        
        # Safely parse JSON text columns
        for json_col in ['filled_state_json', 'interview_qa_json', 'critical_highlights', 'contradictions_found']:
            try:
                # Default to {} for object columns and [] for array columns based on column naming context
                default = "{}" if "state" in json_col else "[]"
                encounter_data[json_col.replace("_json", "")] = json.loads(encounter_data[json_col] or default)
            except json.JSONDecodeError:
                encounter_data[json_col.replace("_json", "")] = {} if "state" in json_col else []
            # Clean up the raw string column from the dictionary
            if json_col in encounter_data:
                del encounter_data[json_col]
        
        # Second query: uploaded_documents
        cursor.execute("""
            SELECT document_id, file_path, document_type, ocr_raw_json, extracted_medications, extracted_labs, created_at
            FROM uploaded_documents
            WHERE session_id = ?
        """, (session_id,))
        
        documents = []
        for doc in cursor.fetchall():
            doc_dict = dict(doc)
            for doc_json_col in ['ocr_raw_json', 'extracted_medications', 'extracted_labs']:
                try:
                    default = "{}" if "raw" in doc_json_col else "[]"
                    doc_dict[doc_json_col.replace("_json", "")] = json.loads(doc_dict[doc_json_col] or default)
                except json.JSONDecodeError:
                    doc_dict[doc_json_col.replace("_json", "")] = {} if "raw" in doc_json_col else []
                if doc_json_col in doc_dict:
                    del doc_dict[doc_json_col]
            documents.append(doc_dict)
            
        encounter_data["uploaded_documents"] = documents
        return encounter_data

# -----------------------------------------------------------------------------
# ADMIN PANEL HELPER FUNCTIONS
# -----------------------------------------------------------------------------

def log_system_action(admin_email: str, action_type: str, target_id: str = None):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO system_logs (admin_email, action_type, target_id) VALUES (?, ?, ?)",
            (admin_email, action_type, target_id)
        )
        conn.commit()

def get_system_logs() -> list[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT 100")
        return [dict(row) for row in cursor.fetchall()]

def get_departments() -> list[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM departments")
        return [dict(row) for row in cursor.fetchall()]

def add_department(name: str):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO departments (name) VALUES (?)", (name,))
        conn.commit()

def get_doctors() -> list[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                d.doctor_id, d.full_name, d.license_number, d.profile_image_url, 
                d.max_daily_patients, d.status, d.room_number, d.dept_id, d.username, d.password, d.current_status, dept.name as dept_name,
                (SELECT COUNT(*) FROM patient_sessions ps 
                 WHERE ps.department = dept.name 
                 AND date(ps.created_at, 'localtime') = date('now', 'localtime')) as total_seen_today
            FROM doctors d
            LEFT JOIN departments dept ON d.dept_id = dept.dept_id
        """)
        return [dict(row) for row in cursor.fetchall()]

def add_doctor(full_name: str, dept_id: int, license_number: str, max_daily_patients: int = 40, profile_image_url: str = None, room_number: str = "TBD", username: str = None, password: str = None):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO doctors (full_name, dept_id, license_number, max_daily_patients, profile_image_url, room_number, username, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (full_name, dept_id, license_number, max_daily_patients, profile_image_url, room_number, username, password)
        )
        conn.commit()

def update_doctor(doctor_id: int, full_name: str, dept_id: int, license_number: str, max_daily_patients: int, status: str, room_number: str, profile_image_url: str = None, username: str = None, password: str = None, current_status: str = 'Available'):
    with get_connection() as conn:
        cursor = conn.cursor()
        
        if profile_image_url:
            cursor.execute("""
                UPDATE doctors 
                SET full_name = ?, dept_id = ?, license_number = ?, max_daily_patients = ?, status = ?, room_number = ?, profile_image_url = ?, username = ?, password = ?, current_status = ?
                WHERE doctor_id = ?
            """, (full_name, dept_id, license_number, max_daily_patients, status, room_number, profile_image_url, username, password, current_status, doctor_id))
        else:
            cursor.execute("""
                UPDATE doctors 
                SET full_name = ?, dept_id = ?, license_number = ?, max_daily_patients = ?, status = ?, room_number = ?, username = ?, password = ?, current_status = ?
                WHERE doctor_id = ?
            """, (full_name, dept_id, license_number, max_daily_patients, status, room_number, username, password, current_status, doctor_id))
            
        conn.commit()

def get_rules() -> list[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM clinical_rules")
        return [dict(row) for row in cursor.fetchall()]

def add_rule(trigger_keyword: str, action_type: str, action_value: str):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO clinical_rules (trigger_keyword, action_type, action_value)
            VALUES (?, ?, ?)
        """, (trigger_keyword, action_type, action_value))
        conn.commit()

def get_analytics_metrics() -> dict:
    with get_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM patient_sessions WHERE date(created_at, 'localtime') = date('now', 'localtime')")
        total_footfall = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM patient_sessions WHERE session_status = 'IN_PROGRESS' AND priority_flag = 1 AND date(created_at, 'localtime') = date('now', 'localtime')")
        emergency_active = cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT AVG(
                (julianday(completed_at) - julianday(created_at)) * 24 * 60
            ) 
            FROM patient_sessions 
            WHERE session_status = 'COMPLETED' 
            AND date(created_at, 'localtime') = date('now', 'localtime')
        """)
        row = cursor.fetchone()[0]
        avg_wait_time = int(row) if row else 0
        
        return {
            "total_footfall": total_footfall,
            "avg_wait_time": avg_wait_time,
            "emergency_active": emergency_active
        }

def downgrade_priority(session_id: str, admin_email: str):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE patient_sessions SET priority_flag = 0 WHERE session_id = ?", (session_id,))
        conn.commit()
    log_system_action(admin_email, "PRIORITY_DOWNGRADE", session_id)

def archive_active_queues(admin_email: str):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE patient_sessions SET session_status = 'ARCHIVED' WHERE session_status = 'IN_PROGRESS'")
        conn.commit()
    log_system_action(admin_email, "EOD_RESET", "ALL_QUEUES")

def get_all_patients() -> list[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.*, 
                   (SELECT ps.session_id 
                    FROM patient_sessions ps 
                    JOIN clinical_summaries cs ON ps.session_id = cs.session_id 
                    WHERE ps.patient_id = p.patient_id AND cs.pdf_file_path IS NOT NULL 
                    ORDER BY cs.generated_at DESC LIMIT 1) as latest_session_id
            FROM patients p
            ORDER BY p.created_at DESC
        """)
        return [dict(row) for row in cursor.fetchall()]

def update_patient_details(patient_id: str, updates: dict, admin_email: str):
    allowed_keys = ['weight', 'height', 'age', 'phone_number']
    set_clauses = []
    values = []
    
    for key, value in updates.items():
        if key in allowed_keys:
            set_clauses.append(f"{key} = ?")
            values.append(value)
            
    if not set_clauses:
        return
        
    values.append(patient_id)
    query = f"UPDATE patients SET {', '.join(set_clauses)} WHERE patient_id = ?"
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, values)
        conn.commit()
    log_system_action(admin_email, "PATIENT_EDIT", patient_id)
