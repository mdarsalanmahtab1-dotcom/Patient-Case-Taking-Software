import os
import glob

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if '<button' in content or '<button\n' in content:
        # Check if already imported
        if 'LiquidButton' not in content:
            # Find the last import statement
            lines = content.split('\n')
            last_import_idx = 0
            for i, line in enumerate(lines):
                if line.startswith('import '):
                    last_import_idx = i
            
            # Use absolute import alias
            lines.insert(last_import_idx + 1, "import { LiquidButton } from '@/components/ui/button';")
            content = '\n'.join(lines)
            
        content = content.replace('<button', '<LiquidButton')
        content = content.replace('</button>', '</LiquidButton>')
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Updated {filepath}')

for root, _, files in os.walk('c:/SmartIndiaHackathon/Prototype/frontend/src'):
    for file in files:
        if file.endswith('.tsx') and 'button.tsx' not in file:
            process_file(os.path.join(root, file))
