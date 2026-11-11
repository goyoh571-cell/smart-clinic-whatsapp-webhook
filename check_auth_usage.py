import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r"C:\Users\user\.gemini\antigravity\scratch\smart-clinic-frontend\index.source.html", "r", encoding="utf-8") as f:
    src = f.read()

with open(r"C:\Users\user\.gemini\antigravity\scratch\smart-clinic-frontend\index.html", "r", encoding="utf-8") as f:
    html = f.read()

import re
print("firebase.auth in index.html:", len(re.findall(r'auth', html, re.I)))
print("firebase-auth script in index.html:", 'firebase-auth' in html)

matches = [m.start() for m in re.finditer(r'firebase\.auth|getAuth|signInWith|createUser', src, re.I)]
print("Auth matches in index.source.html:", len(matches))
for idx in matches:
    print(src[max(0, idx-40):min(len(src), idx+80)])
