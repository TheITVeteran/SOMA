@echo off
echo Testing FINPOLYMER system functionality...
echo.

echo 1. Testing backend server health...
curl -s http://localhost:5000/api/health
echo.
echo.

echo 2. Testing AI agents health...
curl -s http://localhost:5000/api/agents/health
echo.
echo.

echo 3. Testing AI orchestration...
curl -s -H "Content-Type: application/json" -d "{\"query\":\"Hello, can you help me?\",\"projectData\":{}}" http://localhost:5000/api/agents/orchestrate
echo.
echo.

echo 4. Testing AI assist endpoint...
curl -s -H "Content-Type: application/json" -d "{\"query\":\"test connection\"}" http://localhost:5000/api/agents/assist
echo.
echo.

echo 5. Testing arbiters status...
curl -s http://localhost:5000/api/arbiters/status
echo.
echo.

echo Tests completed! 
echo.
echo If you see JSON responses above, the backend is working correctly.
echo If you see "ai_connected":true, then AI is properly connected.
echo.
echo Next steps:
echo 1. Open http://localhost:3000 in your browser
echo 2. Try typing @thinker hello in a project chat
echo 3. Try clicking the paperclip icon to upload files
echo.
pause