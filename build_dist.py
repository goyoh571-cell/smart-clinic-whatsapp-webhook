import os
import sys
import shutil
import subprocess

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = r"C:\Users\user\.gemini\antigravity\scratch\smart-clinic-frontend"
DIST_DIR = os.path.join(BASE_DIR, "dist")
SOURCE_PATH = os.path.join(BASE_DIR, "index.source.html")
BUNDLE_PATH = os.path.join(BASE_DIR, "app.bundle.js")
BABEL_PATH = os.path.join(BASE_DIR, "vendor", "babel.min.js").replace('\\', '/')

print("1. Extracting JSX from index.source.html...")
with open(SOURCE_PATH, 'r', encoding='utf-8') as f:
    html = f.read()

start_marker = '<script type="text/babel">'
end_marker = '</script>'
start_idx = html.find(start_marker)
end_idx = html.rfind(end_marker)

code = html[start_idx + len(start_marker):end_idx]
print(f"   Extracted JSX: {len(code)} characters.")

# Write temp JSX code to compile
temp_jsx_path = os.path.join(BASE_DIR, "_temp_source.jsx").replace('\\', '/')
temp_jsx_native = os.path.join(BASE_DIR, "_temp_source.jsx")
with open(temp_jsx_native, 'w', encoding='utf-8') as f:
    f.write(code)

bundle_path_posix = BUNDLE_PATH.replace('\\', '/')
compile_node_script = f"""
const fs = require('fs');
const Babel = require('{BABEL_PATH}');
const code = fs.readFileSync('{temp_jsx_path}', 'utf-8');
const result = Babel.transform(code, {{
  presets: [
    ['react', {{ runtime: 'classic' }}]
  ]
}});
fs.writeFileSync('{bundle_path_posix}', result.code, 'utf-8');
console.log('Precompiled JS bundle written (' + result.code.length + ' bytes)');
"""

temp_node_script = os.path.join(BASE_DIR, "_temp_compile.js")
with open(temp_node_script, 'w', encoding='utf-8') as f:
    f.write(compile_node_script)

print("2. Precompiling JSX to JavaScript with Node.js and Babel...")
res = subprocess.run(["node", temp_node_script], capture_output=True, text=True, encoding="utf-8", errors="replace")
print(res.stdout)
if res.returncode != 0:
    print("Compilation error:", res.stderr)
    try:
        os.remove(temp_jsx_native)
        os.remove(temp_node_script)
    except:
        pass
    exit(1)

# Clean up temp files
try:
    os.remove(temp_jsx_native)
    os.remove(temp_node_script)
except:
    pass

print("3. Updating cache buster version in index.html...")
VERSION = "20261110_v1_whatsapp_automation"
with open(os.path.join(BASE_DIR, "index.html"), 'r', encoding='utf-8') as f:
    idx_content = f.read()

import re
idx_content = re.sub(r'app\.bundle\.js\?v=[a-zA-Z0-9_-]+', f'app.bundle.js?v={VERSION}', idx_content)
with open(os.path.join(BASE_DIR, "index.html"), 'w', encoding='utf-8') as f:
    f.write(idx_content)

print("4. Preparing dist/ directory...")
if os.path.exists(DIST_DIR):
    shutil.rmtree(DIST_DIR)
os.makedirs(DIST_DIR, exist_ok=True)

print("5. Copying production assets to dist/...")
shutil.copy2(os.path.join(BASE_DIR, "index.html"), os.path.join(DIST_DIR, "index.html"))
shutil.copy2(BUNDLE_PATH, os.path.join(DIST_DIR, "app.bundle.js"))
shutil.copytree(os.path.join(BASE_DIR, "vendor"), os.path.join(DIST_DIR, "vendor"))
shutil.copytree(os.path.join(BASE_DIR, "src"), os.path.join(DIST_DIR, "src"))

print(f"SUCCESS: dist/ built successfully with {len(os.listdir(DIST_DIR))} items!")
