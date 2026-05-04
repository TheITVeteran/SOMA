@echo off
echo ===================================================
echo   CONCEIVE + SOMA INTEGRATION LAUNCHER
echo ===================================================
echo.

echo [1/3] Starting SOMA Python Engine (Port 3001)...
echo       This hosts the Quad-Brain logic and Analysis API.
start "SOMA Engine" cmd /k "cd server\python\soma_service && echo Installing Python deps... && pip install -r requirements.txt && echo Starting Server... && python server.py"

echo.
echo Waiting 10 seconds for SOMA to initialize...
timeout /t 10

echo.
echo [2/3] Starting Datasnipper Backend (Port 5000)...
echo       This hosts the Arbiters, Message Broker, and API.
start "Datasnipper Backend" cmd /k "npm install && node server/index.js"

echo.
echo [3/4] Starting Computer Control Service (Port 8001)...
echo       Enables GUI automation and local file searching.
start "Computer Control" cmd /k "cd server\python-control-service && echo Installing deps... && pip install fastapi uvicorn pyautogui opencv-python pillow pytesseract && echo Starting Control Server... && python control_server.py"

echo.
echo [4/4] Starting Conceive Frontend (Port 3000)...
echo       Launching the UI...
cd client
start "Conceive Client" cmd /k "npm install && npm start"

echo.
echo ===================================================
echo   ALL SYSTEMS GO!
echo   - SOMA Engine:      http://localhost:3001
echo   - Computer Control: http://localhost:8001
echo   - Backend:          http://localhost:5000
echo   - Frontend:         http://localhost:3000
echo ===================================================
echo.
pause
