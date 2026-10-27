@echo off
setlocal enabledelayedexpansion
title AITA Intelligent Autograding Platform - All Services Launcher

color 0B
cls
echo ======================================================================
echo    AITA-INTELLIGENT (SWP391 Group 4) - ALL SERVICES LAUNCHER
echo    He thong Cham Ma Nguon va Giam Sat Liem Chinh Hoc Thuat Tu Dong
echo ======================================================================
echo.

:: ----------------------------------------------------------------------
:: BUOC 1: KIEM TRA MOI TRUONG THUC THI VA DIEU KIEN TIEN QUYET
:: ----------------------------------------------------------------------
echo [1/5] Kiem tra moi truong thuc thi...

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [LOI] Khong tim thay Node.js trong PATH!
    echo Vui long cai dat Node.js tu https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo  [OK] Node.js da cai dat: !NODE_VERSION!

where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [LOI] Khong tim thay npm!
    pause
    exit /b 1
)

set DOCKER_AVAILABLE=0
set "DOCKER_DESKTOP_EXE="
if exist "%LocalAppData%\Programs\DockerDesktop\Docker Desktop.exe" (
    set "DOCKER_DESKTOP_EXE=%LocalAppData%\Programs\DockerDesktop\Docker Desktop.exe"
) else if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
    set "DOCKER_DESKTOP_EXE=C:\Program Files\Docker\Docker\Docker Desktop.exe"
)

where docker >nul 2>&1
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
            echo  [CANH BAO] Vui long bat Docker Desktop thu cong neu can PostgreSQL container.
        )
    )
) else (
    echo  [CANH BAO] Khong tim thay Docker trong PATH.
)

if !DOCKER_AVAILABLE! EQU 0 (
    echo  - He thong se tu dong chay che do Dual-Mode: In-memory va JSON store fallback.
)
echo.

:: ----------------------------------------------------------------------
:: BUOC 2: KHOI DONG HA TANG CSDL POSTGRESQL 15, REDIS 7 VA CHAY MIGRATIONS
:: ----------------------------------------------------------------------
echo [2/5] Khoi dong Ha tang CSDL PostgreSQL 15 va Redis 7...
if !DOCKER_AVAILABLE! EQU 1 (
    call :INIT_DOCKER_DATABASE
) else (
    echo  - Bo qua Docker Compose: He thong dung JSON store fallback san sang.
)
ping -n 3 127.0.0.1 >nul
echo.

:: ----------------------------------------------------------------------
:: BUOC 3: KIEM TRA MOI TRUONG .ENV VA CAI DAT THU VIEN (DEPENDENCIES)
:: ----------------------------------------------------------------------
echo [3/5] Kiem tra file cau hinh .env va thu vien dependencies...

if not exist "%~dp0api-gateway\.env" if exist "%~dp0api-gateway\.env.example" (
    echo  - Tu dong khoi tao api-gateway\.env tu template mau...
    copy "%~dp0api-gateway\.env.example" "%~dp0api-gateway\.env" >nul
)

if not exist "%~dp0genai-hub\.env" if exist "%~dp0genai-hub\.env.example" (
    echo  - Tu dong khoi tao genai-hub\.env tu template mau...
    copy "%~dp0genai-hub\.env.example" "%~dp0genai-hub\.env" >nul
)

if not exist "%~dp0frontend\.env" if exist "%~dp0frontend\.env.example" (
    echo  - Tu dong khoi tao frontend\.env tu template mau...
    copy "%~dp0frontend\.env.example" "%~dp0frontend\.env" >nul
)

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
:: BUOC 4: KHOI CHAY 3 TIEU HE THONG (MICROSERVICES)
:: ----------------------------------------------------------------------
echo [4/5] Khoi dong cac dich vu: moi dich vu trong 1 cua so rieng...

:: Subsystem 1: AITA API Gateway & BullMQ Worker (Port 3000)
echo  [4.1] Khoi dong AITA API Gateway va BullMQ Worker: Port 3000...
start "AITA API Gateway (Port 3000)" /D "%~dp0api-gateway" cmd /k "title AITA API Gateway (Port 3000) && npm.cmd run start"
ping -n 4 127.0.0.1 >nul

:: Subsystem 2: AITA GenAI Hub & AST Service (Port 3001)
echo  [4.2] Khoi dong AITA GenAI Hub va AST Service: Port 3001...
start "AITA GenAI Hub (Port 3001)" /D "%~dp0genai-hub" cmd /k "title AITA GenAI Hub (Port 3001) && npm.cmd run server"
ping -n 3 127.0.0.1 >nul

:: Subsystem 3: AITA React Frontend (Port 5173)
echo  [4.3] Khoi dong AITA React Web Frontend: Port 5173...
start "AITA Frontend (Port 5173)" /D "%~dp0frontend" cmd /k "title AITA Frontend (Port 5173) && npm.cmd run dev"
ping -n 3 127.0.0.1 >nul

:: ----------------------------------------------------------------------
:: BUOC 5: TU DONG MO TRINH DUYET VA HIEN THI BANG DIEU KHIEN
:: ----------------------------------------------------------------------
echo [5/5] Hoan tat! Dang mo trinh duyet Web...
ping -n 3 127.0.0.1 >nul
start http://localhost:5173

color 0A
cls
echo ======================================================================
echo    HE THONG AITA-INTELLIGENT DA KHOI CHAY THANH CONG!
echo ======================================================================
echo.
echo  [DANH SACH DIEM CUOI DICH VU]:
echo    * Web Frontend:             http://localhost:5173
echo    * API Gateway va Telemetry: http://localhost:3000
echo    * GenAI Hub (Gemini):       http://localhost:3001
echo    * PostgreSQL Database:      localhost:5432 (DB: aita_autograding)
echo    * Redis Queue (BullMQ):     localhost:6379 (Queue: grading_queue)
echo.
echo  [TAI KHOAN DEMO CO SAN]:
echo    * Giang vien: giangvien.edu@gmail.com
echo    * Sinh vien:  phaithayj@gmail.com  /  SE170000
echo    * Admin:      admin.aita@gmail.com
echo.
echo ======================================================================
echo    MENU DIEU KHIEN NHANH: Nhap so va an Enter
echo ======================================================================
echo    [1] Mo lai giao dien Web tren trinh duyet (http://localhost:5173)
echo    [2] Chay Knex Migrations: Cap nhat chuan 13 bang 3NF CSDL
echo    [3] Nap du lieu Master Demo Seed: khoang 1000 ban ghi kiem thu
echo    [4] Chay kiem thu an toan Sandbox: 8 kich ban phong thu
echo    [5] Chay Stress Test Hang doi BullMQ: 100 bai nop dong thoi
echo    [6] Dung toan bo he thong va Docker containers
echo    [0] Thoat cua so Launcher: cac dich vu van tiep tuc chay
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
    echo --- DANG KIEM THU AN TOAN DOCKER SANDBOX ---
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
        echo Da dung Docker containers.
    )
    exit /b 0
)
if "%CHOICE%"=="0" (
    echo Cam on ban da su dung AITA-Intelligent!
    ping -n 2 127.0.0.1 >nul
    exit /b 0
)

echo Lua chon khong hop le, vui long nhap lai!
goto MENU_LOOP

:: ----------------------------------------------------------------------
:: SUBROUTINES
:: ----------------------------------------------------------------------
:START_DOCKER_DESKTOP
echo  - Phat hien Docker Desktop tai: !DOCKER_DESKTOP_EXE!
echo  - Dang tu dong bat Docker Desktop, vui long doi...
start "" "!DOCKER_DESKTOP_EXE!"
echo  - Cho Docker Engine san sang toi da 25 giay...
for /L %%i in (1,1,12) do (
    docker info >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        set DOCKER_AVAILABLE=1
        echo  [OK] Docker Engine da khoi dong thanh cong!
        goto :EOF
    )
    ping -n 3 127.0.0.1 >nul
)
echo  [CANH BAO] Docker Desktop can them thoi gian de khoi dong.
goto :EOF

:INIT_DOCKER_DATABASE
echo  - Dang khoi dong container aita-postgres cong 5432 va aita-redis cong 6379...
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
    ping -n 2 127.0.0.1 >nul
)
:DB_IS_READY
echo  [OK] PostgreSQL 15 da san sang tren cong 5432!
echo  - Dang tu dong kiem tra va ap dung Knex Migrations: 13 bang 3NF...
cd /d "%~dp0api-gateway"
call npm.cmd run db:migrate
echo  - Dang nap du lieu mau (Seed Data: giang vien, sinh vien demo, de thi, rubrics)...
call npm.cmd run db:seed
cd /d "%~dp0"
echo  [OK] Co so du lieu 13 bang 3NF da duoc dong bo hoan tat!
goto :EOF
