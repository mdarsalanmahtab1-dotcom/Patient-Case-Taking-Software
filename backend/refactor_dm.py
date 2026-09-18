import re

with open('dialogue_manager.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace database.commit_fsm_checkpoint with asyncio.run_coroutine_threadsafe
code = re.sub(
    r'database\.commit_fsm_checkpoint\((.*?)\)',
    '''asyncio.run_coroutine_threadsafe(
                database.commit_fsm_checkpoint(\\1),
                asyncio.get_event_loop()
            )''',
    code, flags=re.DOTALL
)

# Fix imports in dialogue_manager
if 'import asyncio' not in code:
    code = 'import asyncio\n' + code

with open('dialogue_manager.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Finished refactoring dialogue_manager.py")
