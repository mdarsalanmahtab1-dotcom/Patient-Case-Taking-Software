import re

with open('routes_extended.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace get_departments
old_get_departments = """@extended_router.get("/api/departments")
async def get_departments():
    conn = _get_db()
    cursor = conn.cursor()
    # If is_default column does not exist on older DBs, we'll try to query it or just return without it
    # We added it via ALTER TABLE earlier so it should exist
    try:
        cursor.execute("SELECT dept_id, name, is_default FROM departments")
        departments = [dict(row) for row in cursor.fetchall()]
    except Exception:
        cursor.execute("SELECT dept_id, name FROM departments")
        departments = [dict(row) for row in cursor.fetchall()]
        for d in departments: d["is_default"] = False
    conn.close()
    return {"departments": departments}"""

new_get_departments = """@extended_router.get("/api/departments")
async def get_departments():
    import database
    depts = await database.get_departments()
    return {"departments": depts}"""

code = code.replace(old_get_departments, new_get_departments)

with open('routes_extended.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("get_departments fixed")
