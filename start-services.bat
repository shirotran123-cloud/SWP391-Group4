@echo off
title AITA Intelligent Autograding Platform - All Services Launcher
echo ======================================================================
echo    AITA-INTELLIGENT (SWP391 Group 4) - LOCAL SERVICES LAUNCHER
echo ======================================================================
echo.

echo [0/3] Khoi dong Docker PostgreSQL 15 ^& Redis 7...
docker compose up -d
echo.
timeout /t 2 /nobreak >nul

echo [1/3] Khoi dong AITA API Gateway (Port 3000)...
start "AITA API Gateway (Port 3000)" /D "%~dp0api-gateway" cmd /k "npm run start"

timeout /t 3 /nobreak >nul

echo [2/3] Khoi dong AITA GenAI ^& AST Hub (Port 3001)...
start "AITA GenAI Hub (Port 3001)" /D "%~dp0genai-hub" cmd /k "npm run server"

timeout /t 2 /nobreak >nul

echo [3/3] Khoi dong AITA React Frontend (Port 5173)...
start "AITA Frontend (Port 5173)" /D "%~dp0frontend" cmd /k "npm run dev"

echo.
echo ======================================================================
echo    DA KHOI DONG CAC DICH VU THANH CONG!
echo    - API Gateway:    http://localhost:3000
echo    - GenAI Hub:      http://localhost:3001
echo    - Web Frontend:   http://localhost:5173
echo ======================================================================
echo.
pause
