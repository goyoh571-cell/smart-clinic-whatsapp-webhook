@echo off
cd /d "C:\Users\user\.gemini\antigravity\scratch\smart-clinic-frontend"
netstat -ano | findstr :3000 >nul 2>&1
if %errorlevel% neq 0 (
    "C:\Users\user\AppData\Local\Programs\Python\Python313\python.exe" serve.py
)
