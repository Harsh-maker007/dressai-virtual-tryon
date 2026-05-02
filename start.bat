@echo off
echo =====================================================
echo   DressAI Virtual Try-On Studio
echo =====================================================
echo.
echo [1/2] Starting AI Backend Server (port 5501)...
start "DressAI Backend" cmd /k "python server.py"
timeout /t 3 /nobreak >nul

echo [2/2] Starting Frontend Server (port 5500)...
start "DressAI Frontend" cmd /k "python -m http.server 5500"
timeout /t 2 /nobreak >nul

echo.
echo =====================================================
echo   Opening DressAI in your browser...
echo   Frontend: http://localhost:5500
echo   Backend:  http://localhost:5501
echo =====================================================
start chrome http://localhost:5500
echo.
echo Both servers are running. Close their windows to stop.
pause
