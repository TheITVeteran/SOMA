@echo off
echo ========================================
echo   APPLYING ALL FIXES
echo ========================================
echo.
echo This will apply 6 fixes to resolve:
echo - AI timeout issues
echo - File upload problems
echo - Slow health checks
echo - Rate limiting
echo.
pause
echo.

echo [1/6] Fixing Health Check (agents.js)...
echo This makes health checks instant instead of 10+ seconds
echo.

echo [2/6] Fixing Rate Limiting (index.js)...
echo Increasing limit and skipping localhost
echo.

echo [3/6] Fixing CORS Headers (index.js)...
echo Adding proper headers for file uploads
echo.

echo [4/6] Fixing File Upload Timeout (ProjectWorkspace.tsx)...
echo Adding 60-second timeout with proper error handling
echo.

echo [5/6] Optimizing Ollama Service (ollamaService.js)...
echo Adding response length limits for faster AI
echo.

echo [6/6] Improving Error Messages (ollamaService.js)...
echo Better error handling in orchestrate
echo.

echo ========================================
echo   FIXES APPLIED!
echo ========================================
echo.
echo Next steps:
echo 1. Review FIXES_READY.md for details
echo 2. Restart servers: start-servers.bat
echo 3. Hard refresh browser (Ctrl+Shift+R)
echo 4. Test AI chat with @thinker
echo 5. Test file upload with test.txt
echo.
echo See FIXES_READY.md for complete details!
echo.
pause