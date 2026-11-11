import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r"C:\Users\user\.gemini\antigravity\scratch\smart-clinic-frontend\index.source.html", "r", encoding="utf-8") as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'handleDeleteClinic|handleConfirmDeleteClinic|clinicToDelete', text)]
print(f"Total deletion references: {len(matches)}")
for idx in matches:
    print(f"at {idx}: {repr(text[max(0, idx-40):min(len(text), idx+120)])}")
