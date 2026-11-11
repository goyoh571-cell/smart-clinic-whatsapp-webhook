import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function DoctorDashboardView')
lines = text[idx:idx+2500].splitlines()
for i, line in enumerate(lines[:50]):
    print(f"{i+1}: {line}")
