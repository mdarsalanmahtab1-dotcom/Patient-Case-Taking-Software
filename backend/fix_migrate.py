import re

with open('migrate_to_supabase.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace assignments where `.get` is called on sqlite3.Row variables `dept` and `doc`
# We'll just cast the rows to dict immediately after fetchall.

# "departments = sqlite_cur.fetchall()" -> "departments = [dict(r) for r in sqlite_cur.fetchall()]"
code = code.replace("departments = sqlite_cur.fetchall()", "departments = [dict(r) for r in sqlite_cur.fetchall()]")

# "roster_rows = {str(r['doctor_id']): r for r in sqlite_cur.fetchall()}" -> "roster_rows = {str(r['doctor_id']): dict(r) for r in sqlite_cur.fetchall()}"
code = code.replace("roster_rows = {str(r['doctor_id']): r for r in sqlite_cur.fetchall()}", "roster_rows = {str(r['doctor_id']): dict(r) for r in sqlite_cur.fetchall()}")

# "doctors = sqlite_cur.fetchall()" -> "doctors = [dict(r) for r in sqlite_cur.fetchall()]"
code = code.replace("doctors = sqlite_cur.fetchall()", "doctors = [dict(r) for r in sqlite_cur.fetchall()]")

# "staff = sqlite_cur.fetchall()" -> "staff = [dict(r) for r in sqlite_cur.fetchall()]"
code = code.replace("staff = sqlite_cur.fetchall()", "staff = [dict(r) for r in sqlite_cur.fetchall()]")

# "patients = sqlite_cur.fetchall()" -> "patients = [dict(r) for r in sqlite_cur.fetchall()]"
code = code.replace("patients = sqlite_cur.fetchall()", "patients = [dict(r) for r in sqlite_cur.fetchall()]")

with open('migrate_to_supabase.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Fixed row mapping in migrate_to_supabase.py")
