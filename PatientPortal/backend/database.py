import json
import logging
import os
import uuid
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
        max_size=15,
        max_inactive_connection_lifetime=60.0,
        command_timeout=30.0,
        statement_cache_size=0,
    )
    logger.info("Database pool initialized.")

async def close_db_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("Database pool closed.")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PATIENT HISTORY & DOCUMENTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def fetch_patient_history_by_identifier(identifier: str) -> list[dict]:
    """Returns past consultations for the patient (COMPLETED + ARCHIVED)."""
    if not _pool: return []
    async with _pool.acquire() as conn:
        records = await conn.fetch("""
            SELECT ps.session_id, ps.completed_at, ps.department,
                   ps.chief_complaint,
                   d.full_name as doctor_name, cs.pdf_file_path,
                   cs.small_summary, cs.critical_highlights,
                   cs.doctor_consultation_notes
            FROM patient_sessions ps
            JOIN patients p ON ps.patient_id = p.patient_id
            LEFT JOIN clinical_summaries cs ON ps.session_id = cs.session_id
            LEFT JOIN doctors d ON ps.doctor_id = d.doctor_id
            WHERE (p.abha_id = $1 OR p.phone_number = $1)
              AND ps.session_status IN ('COMPLETED', 'ARCHIVED')
            ORDER BY ps.completed_at DESC
        """, identifier)
        result = []
        for r in records:
            row = dict(r)
            # Serialize datetime for JSON
            if row.get("completed_at"):
                row["completed_at"] = row["completed_at"].isoformat()
            # Parse critical_highlights if it's a string
            if isinstance(row.get("critical_highlights"), str):
                try:
                    row["critical_highlights"] = json.loads(row["critical_highlights"])
                except json.JSONDecodeError:
                    row["critical_highlights"] = []
            result.append(row)
        return result


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
        result = []
        for r in records:
            row = dict(r)
            if row.get("created_at"):
                row["created_at"] = row["created_at"].isoformat()
            result.append(row)
        return result


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
              AND ps.session_status IN ('COMPLETED', 'ARCHIVED')
            ORDER BY ps.completed_at DESC
            LIMIT 1
        """, identifier)
        if not row:
            return None

        result = dict(row)
        val = result.get("full_detailed_summary")
        if isinstance(val, str):
            try:
                result["full_detailed_summary"] = json.loads(val)
            except json.JSONDecodeError:
                result["full_detailed_summary"] = {}

        return result


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  QUEUE STATUS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def fetch_active_queue_for_phone(phone: str) -> list[dict]:
    """Returns active WAITING/IN_PROGRESS sessions with queue position."""
    if not _pool: return []
    async with _pool.acquire() as conn:
        records = await conn.fetch("""
            SELECT ps.session_id, ps.token_id, ps.token_number,
                   ps.department, ps.session_status, ps.priority_flag,
                   ps.created_at,
                   d.full_name as doctor_name, d.room_number
            FROM patient_sessions ps
            JOIN patients p ON ps.patient_id = p.patient_id
            LEFT JOIN doctors d ON ps.doctor_id = d.doctor_id
            WHERE p.phone_number = $1
              AND ps.session_status IN ('WAITING', 'IN_PROGRESS')
            ORDER BY ps.created_at ASC
        """, phone)

        result = []
        for r in records:
            row = dict(r)
            if row.get("created_at"):
                # Calculate queue position: how many WAITING sessions are ahead
                position = await conn.fetchval("""
                    SELECT COUNT(*) FROM patient_sessions
                    WHERE department = $1
                      AND session_status = 'WAITING'
                      AND created_at < $2
                """, row["department"], row["created_at"])
                row["queue_position"] = position + 1  # 1-indexed
                row["estimated_wait_minutes"] = position * 5  # ~5 min per patient
                row["created_at"] = row["created_at"].isoformat()
            result.append(row)
        return result


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  HOSPITAL INFO
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def fetch_hospital_info() -> dict:
    """Returns public hospital info: departments, doctor counts, active patients."""
    if not _pool: return {"departments": [], "active_patients_today": 0}
    async with _pool.acquire() as conn:
        # Departments with available doctor counts
        depts = await conn.fetch("""
            SELECT dep.dept_id, dep.name,
                   COUNT(doc.doctor_id) FILTER (WHERE doc.current_status = 'Available') as available_doctors
            FROM departments dep
            LEFT JOIN doctors doc ON dep.dept_id = doc.dept_id
            GROUP BY dep.dept_id, dep.name
            ORDER BY dep.name
        """)

        # Active patients today
        active_count = await conn.fetchval("""
            SELECT COUNT(*) FROM patient_sessions
            WHERE created_at::date = CURRENT_DATE
              AND session_status IN ('WAITING', 'IN_PROGRESS')
        """)

        return {
            "hospital_name": "SwasthyaSync Smart Hospital",
            "departments": [
                {
                    "dept_id": d["dept_id"],
                    "name": d["name"],
                    "available_doctors": d["available_doctors"],
                }
                for d in depts
            ],
            "active_patients_today": active_count or 0,
        }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PATIENT INFO & FEEDBACK
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def fetch_patient_info_by_phone(phone: str) -> dict | None:
    """Returns basic patient info for export/profile."""
    if not _pool: return None
    async with _pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT patient_id, full_name, phone_number, abha_id, age, gender
            FROM patients
            WHERE phone_number = $1
            LIMIT 1
        """, phone)
        if not row:
            return {"phone": phone}
        result = dict(row)
        return result


async def save_patient_feedback(session_id: str, phone: str, rating: int, comment: str):
    """Save post-visit feedback. Verify session belongs to patient first."""
    if not _pool: return
    async with _pool.acquire() as conn:
        # Verify session belongs to this patient
        owner = await conn.fetchval("""
            SELECT p.phone_number FROM patient_sessions ps
            JOIN patients p ON ps.patient_id = p.patient_id
            WHERE ps.session_id = $1
        """, session_id)
        if owner != phone:
            raise ValueError("Session does not belong to this patient.")

        # Ensure feedback table exists
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS patient_feedback (
                feedback_id TEXT PRIMARY KEY,
                session_id TEXT,
                rating INTEGER CHECK (rating BETWEEN 1 AND 5),
                comment TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        feedback_id = f"fb_{uuid.uuid4().hex[:8]}"
        await conn.execute("""
            INSERT INTO patient_feedback (feedback_id, session_id, rating, comment)
            VALUES ($1, $2, $3, $4)
        """, feedback_id, session_id, rating, comment)
