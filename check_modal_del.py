import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r"C:\Users\user\.gemini\antigravity\scratch\smart-clinic-frontend\index.source.html", "r", encoding="utf-8") as f:
    text = f.read()

pos = text.find('handleConfirmDeleteClinic')
print(text[pos-100:pos+1500])
