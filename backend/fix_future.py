import re

with open('dialogue_manager.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Remove the previously injected `import asyncio` at the top
code = code.replace('import asyncio\n', '', 1)

# Inject `import asyncio` AFTER `from __future__ import annotations`
code = code.replace('from __future__ import annotations\n', 'from __future__ import annotations\nimport asyncio\n')

with open('dialogue_manager.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Fixed future import order")
