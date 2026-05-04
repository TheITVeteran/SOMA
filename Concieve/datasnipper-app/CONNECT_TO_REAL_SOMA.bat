@echo off
echo ===================================================
echo   CONCEIVE + REAL SOMA INTEGRATION LAUNCHER
echo ===================================================
echo.

echo Checking if Real SOMA is running on Port 3001...
netstat -an | find "3001" >nul
if %errorlevel%==0 (
    echo [OK] SOMA is ALREADY RUNNING on Port 3001.
    echo      Conceive is configured to talk to it automatically.
    echo.
    echo      You can now chat with @thinker in the app!
    pause
    exit
)

echo [WARN] SOMA is NOT running.
echo.
echo Attempting to start Real SOMA from:
echo ..\..\scripts\start-soma-complete.cjs
echo.

if exist "..\..\scripts\start-soma-complete.cjs" (
    echo [1/1] Launching SOMA Engine...
    cd /d "..\.."
    start "REAL SOMA ENGINE" cmd /k "node scripts\start-soma-complete.cjs"
    
    echo.
    echo SOMA is starting up... please wait ~30 seconds for it to be ready.
    echo Then refresh Conceive and chat with @thinker.
) else (
    echo [ERROR] Could not find SOMA directory!
    echo Please make sure the scripts\start-soma-complete.cjs exists.
)

echo.
pause
