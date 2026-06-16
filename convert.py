import os
import re

files_to_fix = [
    r"C:\Users\barry\Desktop\The Stack\SOMA\server\api\gameTheoryRoutes.js",
    r"C:\Users\barry\Desktop\The Stack\SOMA\arbiters\GameTheoryArbiter.js",
    r"C:\Users\barry\Desktop\The Stack\SOMA\server\api\macroEventRoutes.js",
    r"C:\Users\barry\Desktop\The Stack\SOMA\arbiters\MacroEventArbiter.js",
    r"C:\Users\barry\Desktop\The Stack\SOMA\adapters\BraveSearchAdapter.js"
]

for file_path in files_to_fix:
    if not os.path.exists(file_path): continue
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # If it already has imports/exports, skip or only fix exports
    if 'import express' not in content:
        # Convert requires
        content = re.sub(r'const\s+([A-Za-z0-9_]+)\s*=\s*require\((.*?)\);', r'import \1 from \2;', content)
        content = re.sub(r'let\s+([A-Za-z0-9_]+)\s*=\s*require\((.*?)\);', r'import \1 from \2;', content)
    
    # Convert module.exports
    content = content.replace('module.exports = router;', 'export default router;')
    content = re.sub(r'module\.exports\s*=\s*([A-Za-z0-9_]+);', r'export default \1;', content)
    
    # Fix the try/catch require block that agents used
    content = re.sub(r'try\s*\{\s*UniversalLearningPipeline\s*=\s*require\((.*?)\);\s*\}\s*catch\s*\(e\)\s*\{\s*UniversalLearningPipeline\s*=\s*\{[\s\S]*?\}\s*\}', r'import UniversalLearningPipeline from \1;', content)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
