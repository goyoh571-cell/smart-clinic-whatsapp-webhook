with open('serve.py', 'r', encoding='utf-8') as f:
    text = f.read()

lines = text.splitlines()
for i, line in enumerate(lines):
    if '/api/' in line:
        print(f"{i+1}: {line.strip()}")
