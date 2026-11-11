import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r"C:\Users\user\.gemini\antigravity\scratch\smart-clinic-frontend\index.source.html", "r", encoding="utf-8") as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'smart_clinic_', text)]
keys = set()
for idx in matches:
    end = text.find("'", idx)
    end2 = text.find('`', idx)
    end3 = text.find('"', idx)
    valid_ends = [x for x in [end, end2, end3] if x != -1 and x > idx]
    if valid_ends:
        e = min(valid_ends)
        keys.add(text[idx:e])

print("LocalStorage keys found:")
for k in sorted(keys):
    print(" -", k)
