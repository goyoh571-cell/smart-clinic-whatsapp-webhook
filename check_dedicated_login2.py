import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r"C:\Users\user\.gemini\antigravity\scratch\smart-clinic-frontend\index.source.html", "r", encoding="utf-8") as f:
    text = f.read()

pos = text.find('function DedicatedClinicLoginView')
print(text[pos+2000:pos+4500])
