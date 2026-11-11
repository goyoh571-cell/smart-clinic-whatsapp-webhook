import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r"C:\Users\user\.gemini\antigravity\scratch\smart-clinic-frontend\index.source.html", "r", encoding="utf-8") as f:
    text = f.read()

import re
keywords = [
    'auth',
    'createUser',
    'initialPassword',
    'loginCredentials',
    'smart_clinic_authed',
    'DedicatedClinicLoginView'
]

for kw in keywords:
    matches = [m.start() for m in re.finditer(re.escape(kw), text, re.IGNORECASE)]
    print(f"Keyword '{kw}': {len(matches)} occurrences")
    for idx in matches[:4]:
        print(f"  at {idx}: {repr(text[max(0, idx-40):min(len(text), idx+60)])}")
