@echo off
echo ===================================================
echo   SOMA PRODUCTION LAUNCHER (Simple)
echo ===================================================

echo 1. Killing old SOMA processes...
taskkill /F /IM electron.exe /T 2>nul
taskkill /F /IM node.exe /FI "WINDOWTITLE eq SOMA BACKEND" /T 2>nul
taskkill /F /IM node.exe /FI "WINDOWTITLE eq CT SERVER" /T 2>nul

echo.
echo 2. Starting SOMA Core Backend...
set SOMA_LOAD_HEAVY=true
set SOMA_LOAD_TRADING=true
start "SOMA BACKEND" /min cmd /c "node --max-old-space-size=4096 launcher_ULTRA.mjs"

echo.
echo 3. Starting CT Backend...
cd "a cognitive terminal"
start "CT SERVER" /min cmd /c "npm run server"
cd ..

echo.
echo 4. Waiting for backends to warm up (5s)...
timeout /t 5 /nobreak >nul

echo.
echo 5. Launching Command Bridge (Production Mode)...
:: Unset VITE_DEV_SERVER_URL to force Electron to load from dist/
set VITE_DEV_SERVER_URL=
npx electron .

echo.
echo Launch complete. Closing this window...
exit
