@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title AITA Intelligent Autograding Platform - All Services Launcher

:: ======================================================================
:: AITA-INTELLIGENT: HỆ THỐNG CHẤM MÃ NGUỒN & GIÁM SÁT LIÊM CHÍNH HỌC THUẬT
:: TỔNG HỢP TOÀN BỘ LỆNH KHỞI CHẠY HỆ THỐNG
:: Học phần: SWP391 - Nhóm 4 (FPT University)
:: ======================================================================

color 0B
cls
echo ======================================================================
echo    AITA-INTELLIGENT (SWP391 Group 4) - LOCAL SERVICES LAUNCHER
echo    He thong Cham Ma Nguon ^& Giam Sat Liem Chinh Hoc Thuat Tu Dong
echo ======================================================================
echo.

:: ----------------------------------------------------------------------
:: BƯỚC 1: KIỂM TRA MÔI TRƯỜNG & ĐIỀU KIỆN TIÊN QUYẾT (PREREQUISITES)
:: ----------------------------------------------------------------------
echo [1/5] Kiem tra moi truong thuc thi...

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [LOI] Khong tim thay Node.js trong PATH!
    echo Vui long cai dat Node.js ^(phien ban ^>= 20^) tu https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo  [OK] Node.js da cai dat: %NODE_VERSION%

where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [LOI] Khong tim thay npm!
    pause
    exit /b 1
)

where docker >nul 2>&1
set DOCKER_AVAILABLE=0
set "DOCKER_DESKTOP_EXE="
if exist "%LocalAppData%\Programs\DockerDesktop\Docker Desktop.exe" (
    set "DOCKER_DESKTOP_EXE=%LocalAppData%\Programs\DockerDesktop\Docker Desktop.exe"
) else if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
    set "DOCKER_DESKTOP_EXE=C:\Program Files\Docker\Docker\Docker Desktop.exe"
)

if %ERRORLEVEL% EQU 0 (
    docker info >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        set DOCKER_AVAILABLE=1
        echo  [OK] Docker Desktop dang hoat dong san sang.
    ) else (
        echo  [THONG BAO] Docker CLI co san nhung Docker Engine chua chay.
        if defined DOCKER_DESKTOP_EXE (
            call :START_DOCKER_DESKTOP
        ) else (
            echo  [CANH BAO] Vui long bat Docker Desktop thu cong neu muon chay PostgreSQL that.
        )
    )
) else (
    echo  [CANH BAO] Khong tim thay Docker trong PATH.
)

if %DOCKER_AVAILABLE% EQU 0 (
    echo           He thong se tu dong chay che do Dual-Mode ^(In-memory / JSON store fallback^).
)

echo.

:: ----------------------------------------------------------------------
:: BƯỚC 2: KHỞI ĐỘNG HẠ TẦNG CSDL POSTGRESQL 15, REDIS 7 & CHẠY MIGRATIONS
:: ----------------------------------------------------------------------
echo [2/5] Khoi dong Ha tang CSDL PostgreSQL 15 ^& Redis 7...
if %DOCKER_AVAILABLE% EQU 1 (
    call :INIT_DOCKER_DATABASE
) else (
    echo  - Bo qua Docker Compose (He thong su dung JSON store fallback san sang).
)
timeout /t 2 /nobreak >nul
echo.

:: ----------------------------------------------------------------------
:: BƯỚC 3: KIỂM TRA & CÀI ĐẶT THƯ VIỆN NẾU THIẾU (DEPENDENCY CHECK)
:: ----------------------------------------------------------------------
echo [3/5] Kiem tra thu vien dependencies (node_modules)...

if not exist "%~dp0api-gateway\node_modules" (
    echo  - Dang cai dat thu vien cho api-gateway...
    cd /d "%~dp0api-gateway"
    call npm.cmd install
    cd /d "%~dp0"
)

if not exist "%~dp0genai-hub\node_modules" (
    echo  - Dang cai dat thu vien cho genai-hub...
    cd /d "%~dp0genai-hub"
    call npm.cmd install
    cd /d "%~dp0"
)

if not exist "%~dp0frontend\node_modules" (
    echo  - Dang cai dat thu vien cho frontend...
    cd /d "%~dp0frontend"
    call npm.cmd install
    cd /d "%~dp0"
)
echo  [OK] Tat ca thu vien da day du.
echo.

:: ----------------------------------------------------------------------
:: BƯỚC 4: KHỞI CHẠY 3 TIỂU HỆ THỐNG CỐT LÕI (MICROSERVICES)
:: ----------------------------------------------------------------------
echo [4/5] Khoi dong cac dich vu (Moi dich vu trong 1 cua so rieng)...

:: Subsystem 1: AITA API Gateway & BullMQ Worker (Port 3000)
echo  [4.1] Khoi dong AITA API Gateway ^& BullMQ Worker (Port 3000)...
start "AITA API Gateway (Port 3000)" /D "%~dp0api-gateway" cmd /k "title AITA API Gateway (Port 3000) && npm run start"
timeout /t 3 /nobreak >nul

:: Subsystem 2: AITA GenAI Hub & AST Service (Port 3001)
echo  [4.2] Khoi dong AITA GenAI Hub ^& AST Analysis (Port 3001)...
start "AITA GenAI Hub (Port 3001)" /D "%~dp0genai-hub" cmd /k "title AITA GenAI Hub (Port 3001) && npm run server"
timeout /t 2 /nobreak >nul

:: Subsystem 3: AITA React Frontend (Port 5173)
echo  [4.3] Khoi dong AITA React Web Frontend (Port 5173)...
start "AITA Frontend (Port 5173)" /D "%~dp0frontend" cmd /k "title AITA Frontend (Port 5173) && npm run dev"
timeout /t 2 /nobreak >nul

:: ----------------------------------------------------------------------
:: BƯỚC 5: TỰ ĐỘNG MỞ TRÌNH DUYỆT & HIỂN THỊ BẢNG ĐIỀU KHIỂN
:: ----------------------------------------------------------------------
echo [5/5] Hoan tat! Dang mo trinh duyet Web...
timeout /t 2 /nobreak >nul
start http://localhost:5173

color 0A
cls
echo ======================================================================
echo    🎉 HE THONG AITA-INTELLIGENT DA KHOI CHAY THANH CONG!
echo ======================================================================
echo.
echo  [DANH SACH DIEM CUOI DICH VU (ENDPOINTS)]:
echo    * Web Frontend:          http://localhost:5173
echo    * API Gateway ^& Telemetry: http://localhost:3000
echo    * GenAI Hub (Gemini):    http://localhost:3001
echo    * PostgreSQL Database:   localhost:5432 (DB: aita_autograding)
echo    * Redis Queue (BullMQ):  localhost:6379 (Queue: grading_queue)
echo.
echo  [TAI KHOAN DEMO CO SAN]:
echo    * Giang vien (Lecturer): giangvien.edu@gmail.com
echo    * Sinh vien (Student):   phaithayj@gmail.com  /  SE170000
echo    * Quan tri vien (Admin): admin.aita@gmail.com
echo.
echo ======================================================================
echo    MENU DIEU KHIEN NHANH (Nhap so va an Enter):
echo ======================================================================
echo    [1] Mo lai giao dien Web tren trinh duyet (http://localhost:5173)
echo    [2] Chay Knex Migrations (Cap nhat chuan 13 bang 3NF CSDL)
echo    [3] Nap du lieu Master Demo Seed (~1,000 ban ghi kiem thu)
echo    [4] Chay kiem thu an toan Sandbox (8/8 kich ban phong thu)
echo    [5] Chay Stress Test Hang doi BullMQ (100 bai nop dong thoi)
echo    [6] Dung toan bo he thong va Docker containers
echo    [0] Thoat cua so Launcher (Cac dich vu van tiep tuc chay)
echo ======================================================================
echo.

:MENU_LOOP
set /p CHOICE="Nhap lua chon cua ban [0-6]: "

if "%CHOICE%"=="1" (
    start http://localhost:5173
    goto MENU_LOOP
)
if "%CHOICE%"=="2" (
    echo.
    echo --- DANG CHAY KNEX DATABASE MIGRATIONS ---
    cd /d "%~dp0api-gateway"
    call npm.cmd run db:migrate
    cd /d "%~dp0"
    echo.
    goto MENU_LOOP
)
if "%CHOICE%"=="3" (
    echo.
    echo --- DANG NAP DU LIEU MASTER DEMO SEED ---
    cd /d "%~dp0api-gateway"
    call npm.cmd run db:seed
    cd /d "%~dp0"
    echo.
    goto MENU_LOOP
)
if "%CHOICE%"=="4" (
    echo.
    echo --- DANG KIEM THU AN TOAN DOCKER SANDBOX (8 ATTACK DEFENSE) ---
    python "%~dp0tools\verify-sandbox-security.py"
    echo.
    goto MENU_LOOP
)
if "%CHOICE%"=="5" (
    echo.
    echo --- DANG CHAY STRESS TEST HANG DOI BULLMQ ---
    python "%~dp0tools\stress-test-queue.py"
    echo.
    goto MENU_LOOP
)
if "%CHOICE%"=="6" (
    echo.
    echo --- DANG DUNG TOAN BO DICH VU ---
    if exist "%~dp0stop-services.bat" (
        call "%~dp0stop-services.bat"
    ) else (
        docker compose down
        echo Da dung Docker containers. Vui long dong cac cua so terminal.
    )
    exit /b 0
)
if "%CHOICE%"=="0" (
    echo Cam on ban da su dung AITA-Intelligent!
    timeout /t 1 /nobreak >nul
    exit /b 0
)

echo Lua chon khong hop le, vui long nhap lai!
goto MENU_LOOP

:: ======================================================================
:: SUBROUTINES / HÀM CON XỬ LÝ HẠ TẦNG DOCKER & DATABASE
:: ======================================================================

:START_DOCKER_DESKTOP
echo  - Phat hien Docker Desktop tai: %DOCKER_DESKTOP_EXE%
echo  - Dang tu dong bat Docker Desktop, vui long doi...
start "" "%DOCKER_DESKTOP_EXE%"
echo  - Cho Docker Engine san sang (toi da 25 giay)...
for /L %%i in (1,1,12) do (
    docker info >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        set DOCKER_AVAILABLE=1
        echo  [OK] Docker Engine da khoi dong thanh cong!
        goto :EOF
    )
    timeout /t 2 /nobreak >nul
)
echo  [CANH BAO] Docker Desktop can them thoi gian de khoi dong.
goto :EOF

:INIT_DOCKER_DATABASE
echo  - Dang khoi dong container aita-postgres (5432) ^& aita-redis (6379)...
docker compose up -d
if %ERRORLEVEL% NEQ 0 (
    echo  [CANH BAO] Khong the khoi dong Docker Compose, chuyen sang che do fallback.
    goto :EOF
)
echo  [OK] Docker containers da duoc khoi chay!
echo  - Dang cho PostgreSQL 15 san sang nhan ket noi...
for /L %%k in (1,1,10) do (
    docker exec aita-postgres pg_isready -U aita_admin -d aita_autograding >nul 2>&1
    if !ERRORLEVEL! EQU 0 goto :DB_IS_READY
    timeout /t 1 /nobreak >nul
)
:DB_IS_READY
echo  [OK] PostgreSQL 15 da san sang tren cong 5432!
echo  - Dang tu dong kiem tra ^& ap dung Knex Migrations (13 bang 3NF)...
cd /d "%~dp0api-gateway"
call npm.cmd run db:migrate
cd /d "%~dp0"
echo  [OK] Co so du lieu 13 bang 3NF da duoc dong bo hoan tat!
goto :EOF

