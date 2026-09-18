import re

with open('routes_extended.py', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. admin_get_staff
code = code.replace('''@extended_router.get("/api/admin/staff")
async def admin_get_staff(staff: dict = Depends(_require_role("ADMIN"))):
    conn = _get_db()
    rows = conn.execute("SELECT id, name, role FROM staff").fetchall()
    conn.close()
    return [dict(r) for r in rows]''', '''@extended_router.get("/api/admin/staff")
async def admin_get_staff(staff: dict = Depends(_require_role("ADMIN"))):
    if not database._pool: return []
    async with database._pool.acquire() as conn:
        rows = await conn.fetch("SELECT id, name, role FROM staff")
    return [dict(r) for r in rows]''')

# 2. admin_delete_staff
code = code.replace('''@extended_router.delete("/api/admin/staff/{staff_id}")
async def admin_delete_staff(staff_id: str, staff: dict = Depends(_require_role("ADMIN"))):
    conn = _get_db()
    conn.execute("DELETE FROM staff WHERE id = ?", (staff_id,))
    conn.commit()
    conn.close()
    return {"deleted": staff_id}''', '''@extended_router.delete("/api/admin/staff/{staff_id}")
async def admin_delete_staff(staff_id: str, staff: dict = Depends(_require_role("ADMIN"))):
    if database._pool:
        async with database._pool.acquire() as conn:
            await conn.execute("DELETE FROM staff WHERE id = $1", staff_id)
    return {"deleted": staff_id}''')

# 3. admin_dashboard
code = code.replace('''@extended_router.get("/api/admin/dashboard")
async def admin_dashboard(staff: dict = Depends(_require_role("ADMIN"))):
    conn = _get_db()
    stats = {
        "total_patients": conn.execute("SELECT COUNT(*) as c FROM patients").fetchone()["c"],
        "total_sessions": conn.execute("SELECT COUNT(*) as c FROM patient_sessions").fetchone()["c"],
        "queue_waiting": conn.execute("SELECT COUNT(*) as c FROM queue WHERE status = 'waiting'").fetchone()["c"],
        "queue_priority": conn.execute("SELECT COUNT(*) as c FROM queue WHERE priority_flag = 1 AND status != 'completed'").fetchone()["c"],
        "total_summaries": conn.execute("SELECT COUNT(*) as c FROM clinical_summaries").fetchone()["c"],
        "total_staff": conn.execute("SELECT COUNT(*) as c FROM staff").fetchone()["c"],
    }
    conn.close()
    return stats''', '''@extended_router.get("/api/admin/dashboard")
async def admin_dashboard(staff: dict = Depends(_require_role("ADMIN"))):
    if not database._pool: return {}
    async with database._pool.acquire() as conn:
        stats = {
            "total_patients": (await conn.fetchrow("SELECT COUNT(*) as c FROM patients"))["c"],
            "total_sessions": (await conn.fetchrow("SELECT COUNT(*) as c FROM patient_sessions"))["c"],
            "queue_waiting": (await conn.fetchrow("SELECT COUNT(*) as c FROM patient_sessions WHERE status = 'waiting'"))["c"],
            "queue_priority": (await conn.fetchrow("SELECT COUNT(*) as c FROM patient_sessions WHERE priority_flag = TRUE AND status != 'completed'"))["c"],
            "total_summaries": (await conn.fetchrow("SELECT COUNT(*) as c FROM clinical_summaries"))["c"],
            "total_staff": (await conn.fetchrow("SELECT COUNT(*) as c FROM staff"))["c"],
        }
    return stats''')

# 4. escalate_queue_priority (Line 227)
code = code.replace('''def escalate_queue_priority(session_id: str, reason: str):
    """
    Called directly by the dialogue manager when a safety watchdog rule fires.
    This is the REAL wiring — not an HTTP endpoint the user calls manually.
    """
    conn = _get_db()
    row = conn.execute("SELECT token_id FROM queue WHERE session_id = ?", (session_id,)).fetchone()
    if row:
        conn.execute(
            "UPDATE queue SET priority_flag = 1, priority_reason = ? WHERE session_id = ?",
            (reason, session_id)
        )
        conn.commit()
        logger.warning(f"🚨 QUEUE ESCALATED: session={session_id} reason={reason}")
    else:
        logger.warning(f"Queue escalation requested but no queue entry for session {session_id}")
    conn.close()''', '''async def escalate_queue_priority(session_id: str, reason: str):
    if not database._pool: return
    async with database._pool.acquire() as conn:
        row = await conn.fetchrow("SELECT token_number FROM patient_sessions WHERE session_id = $1", session_id)
        if row:
            await conn.execute(
                "UPDATE patient_sessions SET priority_flag = TRUE, priority_reason = $1 WHERE session_id = $2",
                reason, session_id
            )
            logger.warning(f"🚨 QUEUE ESCALATED: session={session_id} reason={reason}")
        else:
            logger.warning(f"Queue escalation requested but no queue entry for session {session_id}")''')

with open('routes_extended.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Fixed lingering _get_db")
