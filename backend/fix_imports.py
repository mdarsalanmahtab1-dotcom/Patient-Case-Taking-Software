import re

with open('routes_extended_backup.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace JUST the sqlite3 import and the _init_db block safely.
code = code.replace("import sqlite3", "import database")
code = re.sub(r'def _get_db\(\):.*?return conn', 'def _get_db():\n    pass', code, flags=re.DOTALL)
code = re.sub(r'def _init_db\(\):.*?_init_db\(\)', '', code, flags=re.DOTALL)

with open('routes_extended.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Imports fixed safely")
