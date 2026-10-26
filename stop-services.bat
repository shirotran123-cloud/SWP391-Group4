@echo off
title AITA Intelligent Autograding Platform - Stop All Services

echo ======================================================================
echo    AITA-INTELLIGENT: DUNG TOAN BO CAC DICH VU HE THONG
echo ======================================================================
echo.

echo [1/3] Dang dung cac tien trinh Node.js (Gateway, GenAI Hub, Frontend)...
taskkill /F /FI "WINDOWTITLE eq AITA API Gateway (Port 3000)*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq AITA GenAI Hub (Port 3001)*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq AITA Frontend (Port 5173)*" >nul 2>&1

echo [2/3] Dang dung ha tang Docker Compose (PostgreSQL 15 va Redis 7)...
where docker >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    docker compose down
    echo  [OK] Da tat cac container aita-postgres va aita-redis.
) else (
    echo  [BO QUA] Docker khong kha dung.
)

echo [3/3] Hoan tat tat he thong.
echo.
echo ======================================================================
echo    TOAN BO DICH VU AITA DA DUOC DUNG AN TOAN!
echo ======================================================================
timeout /t 2 /nobreak >nul
