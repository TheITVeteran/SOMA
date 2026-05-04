@echo off
echo ===============================================================================
echo   SOMA ORB - Voice Interface
echo ===============================================================================
echo.
echo   Starting the orb...
echo.

cd /d "%~dp0"

:: Check if SOMA backend is running
echo   [1/4] Checking SOMA backend...
powershell -Command "$response = try { Invoke-WebRequest -Uri 'http://localhost:3001/health' -UseBasicParsing -TimeoutSec 2 } catch { $null }; if ($response) { exit 0 } else { exit 1 }"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo   WARNING: SOMA backend not detected at http://localhost:3001
    echo   Please start the SOMA backend first:
    echo.
    echo   cd ..\a cognitive terminal\server
    echo   node index.cjs
    echo.
    pause
    exit /b 1
)
echo   ✓ SOMA backend is running

:: Start Whisper server (voice transcription) if not already running
echo   [2/4] Starting Whisper voice server...
powershell -Command "$response = try { Invoke-WebRequest -Uri 'http://localhost:5002/health' -UseBasicParsing -TimeoutSec 2 } catch { $null }; if ($response) { exit 0 } else { exit 1 }"
if %ERRORLEVEL% NEQ 0 (
    echo   Starting Whisper on port 5002...
    start /B "" "..\.soma_venv\Scripts\python.exe" "..\a cognitive terminal\services\whisper_flask_server.py" >nul 2>&1
    :: Wait for Whisper to load model and start
    echo   Waiting for Whisper model to load...
    timeout /t 10 /nobreak >nul
) else (
    echo   ✓ Whisper server already running
)

:: Start Vite dev server in background
echo   [3/4] Starting dev server...
start /B npm run dev >nul 2>&1

:: Wait for dev server
echo   [4/4] Waiting for dev server...
timeout /t 3 /nobreak >nul

:: Launch Electron
echo   ✓ Launching SOMA Orb...
echo.
npm run electron:start
