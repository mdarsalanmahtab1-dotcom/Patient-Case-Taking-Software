import re

with open('routes_extended_backup.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
in_async_func = False
in_db_block = False

# First pass: replace the `_init_db` function and SQLite imports only at the top of the file without deleting everything else.
# Wait, actually we don't even need to replace `_init_db`, we just need to import `database` and we're good.
# I'll just do global string replacements for the SQLite connection.

code = "".join(lines)

# Fix top of file imports
code = code.replace(
    'import sqlite3\nimport json',
    'import json\nimport database\nfrom fastapi import HTTPException'
)

# Fix def _get_db() to not be used, but keep the function just in case
code = code.replace(
    '''def _get_db():
    conn = sqlite3.connect("swasthyasync.db")
    conn.row_factory = sqlite3.Row
    return conn''',
    '''def _get_db():
    pass'''
)

# Convert all synchronous defs to async defs if they contain conn = _get_db()
import ast
class DBFuncFinder(ast.NodeVisitor):
    def __init__(self):
        self.funcs_to_change = set()
    def visit_FunctionDef(self, node):
        code_str = ast.get_source_segment(code, node)
        if 'conn = _get_db()' in code_str:
            self.funcs_to_change.add(node.name)
        self.generic_visit(node)

finder = DBFuncFinder()
finder.visit(ast.parse(code))

for func in finder.funcs_to_change:
    code = re.sub(rf'def {func}\(', f'async def {func}(', code)

# Regex to replace db blocks
# Basically: 
# conn = _get_db()
# <do stuff>
# conn.close()
#
# Becomes:
# if not database._pool: raise HTTPException(500, "DB not ready")
# async with database._pool.acquire() as conn:
#     <do stuff> (indented, with awaits)

def process_function_body(match):
    body = match.group(0)
    # indent by 4 spaces
    indented_body = "\n".join("    " + line if line.strip() else line for line in body.split("\n"))
    
    # replace conn.execute( -> await conn.execute(
    indented_body = indented_body.replace('conn.execute(', 'await conn.execute(')
    
    # replace conn.commit() and conn.close() with nothing
    indented_body = indented_body.replace('await conn.execute("COMMIT")', '')
    indented_body = re.sub(r' +conn\.commit\(\)\n', '', indented_body)
    indented_body = re.sub(r' +conn\.close\(\)\n', '', indented_body)
    
    # replace .fetchone() with await conn.fetchrow(...)
    # actually, since we already did await conn.execute(), we can't easily chain .fetchone() because it's a coroutine.
    # We should just use fetchrow and fetch instead.
    
    # So instead of regexing the block, let's just use my original fix_routes3.py and fix_routes_phase6.py, and fix_routes_phase7.py, but make sure they match precisely.
    return body

# I will write a precise regex for the specific lines that failed earlier.
