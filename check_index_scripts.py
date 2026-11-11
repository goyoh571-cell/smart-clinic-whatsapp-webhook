with open(r"C:\Users\user\.gemini\antigravity\scratch\smart-clinic-frontend\index.html", "r", encoding="utf-8") as f:
    text = f.read()

pos = text.find('firebase-app-compat')
print(text[pos-50:pos+1200])
