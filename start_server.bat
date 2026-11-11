@echo off
title GOYOH Health Connect - Multi-Tenant Healthcare OS
cd /d "C:\Users\user\.gemini\antigravity\scratch\smart-clinic-frontend"

netstat -ano | findstr :3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo ========================================================
    echo GOYOH Server is ALREADY RUNNING on port 3000!
    echo Opening Unified Login in browser...
    echo ========================================================
    start http://localhost:3000/login
    timeout /t 3 >nul
    exit /b 0
)

echo ========================================================
echo Starting GOYOH Health Connect Server on port 3000...
echo ========================================================
echo Unified Login (1 Link): http://localhost:3000/login
echo Super Admin Dashboard:  http://localhost:3000/super-admin
echo ========================================================
echo Opening Unified Login in 2 seconds...
start http://localhost:3000/login
python serve.py
pause
