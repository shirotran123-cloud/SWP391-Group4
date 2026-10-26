@echo off
chcp 65001 >nul
title AITA Intelligent Autograding Platform - Stop All Services

echo ======================================================================
echo    AITA-INTELLIGENT: DỪNG TOÀN BỘ CÁC DỊCH VỤ HỆ THỐNG
echo ======================================================================
echo.

echo [1/3] Đang dừng các tiến trình Node.js (Gateway, GenAI Hub, Frontend)...
taskkill /F /FI "WINDOWTITLE eq AITA API Gateway (Port 3000)*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq AITA GenAI Hub (Port 3001)*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq AITA Frontend (Port 5173)*" >nul 2>&1

echo [2/3] Đang dừng hạ tầng Docker Compose (PostgreSQL 15 & Redis 7)...
where docker >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    docker compose down
    echo  [OK] Đã tắt các container aita-postgres và aita-redis.
) else (
    echo  [BỎ QUA] Docker không khả dụng.
)

echo [3/3] Hoàn tất tắt hệ thống.
echo.
echo ======================================================================
echo    TOÀN BỘ DỊCH VỤ AITA ĐÃ ĐƯỢC DỪNG AN TOÀN!
echo ======================================================================
timeout /t 2 /nobreak >nul
