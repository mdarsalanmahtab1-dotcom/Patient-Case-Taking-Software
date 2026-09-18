import os
import re

with open('routes_extended.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

def get_func_bounds(func_name):
    start = -1
    for i, line in enumerate(lines):
        if line.startswith(f"async def {func_name}(") or line.startswith(f"def {func_name}("):
            start = i
            # Look backwards for decorators
            while start > 0 and lines[start-1].startswith("@"):
                start -= 1
            break
    if start == -1:
        return -1, -1
        
    # Find end of function (first line that is not indented and not empty)
    end = -1
    for i in range(start + 1, len(lines)):
        # Skip empty lines
        if not lines[i].strip():
            continue
        # If line starts with a letter or @, it's a new function
        if lines[i][0] not in [' ', '\t', '\n', '#']:
            end = i
            break
    if end == -1:
        end = len(lines)
    return start, end

# Let's see what bounds we get for staff_login
start, end = get_func_bounds('staff_login')
print("staff_login:", start, end)
print("".join(lines[start:start+5]))
