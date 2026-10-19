@echo off
title AITA Intelligent Autograding Platform - All Services Launcher
echo ======================================================================
echo    AITA-INTELLIGENT (SWP391 Group 4) - LOCAL SERVICES LAUNCHER
echo ======================================================================
echo.

echo [1/3] Khoi dong AITA API Gateway (Port 3000)...
start "AITA API Gateway (Port 3000)" cmd /k "cd /d \"%~dp0api-gateway\" && npm run start"

timeout /t 3 /nobreak >nul

echo [2/3] Khoi dong AITA GenAI ^& AST Hub (Port 3001)...
start "AITA GenAI Hub (Port 3001)" cmd /k "cd /d \"%~dp0genai-hub\" && npm run server"

timeout /t 2 /nobreak >nul

echo [3/3] Khoi dong AITA React Frontend (Port 5173)...
start "AITA Frontend (Port 5173)" cmd /k "cd /d \"%~dp0frontend\" && npm run dev"

echo.
echo ======================================================================
echo    DA KHOI DONG CAC DICH VU THANH CONG!
echo    - API Gateway:    http://localhost:3000
echo    - GenAI Hub:      http://localhost:3001
echo    - Web Frontend:   http://localhost:5173
echo ======================================================================
echo.
pause
