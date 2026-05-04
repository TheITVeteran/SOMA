@echo off
echo Killing any existing SOMA backend processes...

REM Kill processes on port 3001
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001"') do (
    echo Killing process %%a on port 3001
    taskkill /F /PID %%a 2>nul
)

REM Kill processes on port 3002
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3002"') do (
    echo Killing process %%a on port 3002
    taskkill /F /PID %%a 2>nul
)

timeout /t 2 /nobreak >nul

echo Starting SOMA backend on port 3001...
cd /d "%~dp0"
start "SOMA Backend" node launcher_ULTRA.mjs

echo Done! Backend should be running on http://127.0.0.1:3001
pause
