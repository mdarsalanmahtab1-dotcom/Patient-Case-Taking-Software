import re

with open('routes_admin.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace all database.* calls with await database.*
code = re.sub(r'database\.', 'await database.', code)

# Handle set_default_department specially
code = re.sub(
    r'conn = await database\.get_connection\(\)\n.*?conn\.execute\("UPDATE departments SET is_default = 0"\)\n.*?conn\.execute\("UPDATE departments SET is_default = 1 WHERE dept_id = \?", \(dept_id,\)\)\n.*?conn\.commit\(\)\n.*?conn\.close\(\)',
    '''if database._pool:
            async with database._pool.acquire() as conn:
                await conn.execute("UPDATE departments SET is_default = FALSE")
                await conn.execute("UPDATE departments SET is_default = TRUE WHERE dept_id = $1", dept_id)''',
    code, flags=re.DOTALL
)

# Fix await database.get_connection() import inside the function if it matched
code = re.sub(r'import await database', 'import database', code)

with open('routes_admin.py', 'w', encoding='utf-8') as f:
    f.write(code)
print("Finished refactoring routes_admin.py")
