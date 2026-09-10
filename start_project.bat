@echo off
setlocal
title Focus-AI Launcher

echo ===================================================
echo      FOCUS-AI: System Startup
echo ===================================================

:: 1. Cleanup Old Processes
echo [1/6] Cleaning up previous processes...
taskkill /F /IM uvicorn.exe /T >nul 2>&1
taskkill /F /IM node.exe /T >nul 2>&1
echo       Cleanup complete.

:: 2. Backend env
echo [2/6] Checking Backend Configuration...
if not exist "backend\.env" (
    echo       WARNING: backend\.env not found. Creating from example...
    copy "backend\.env.example" "backend\.env" >nul
)
if not exist "backend\firebase-adminsdk.json" (
    echo       WARNING: backend\firebase-adminsdk.json missing.
    echo                Firestore calls will fail until you provide the service account JSON.
)

:: 3. Backend venv + deps
echo [3/6] Verifying Backend venv and dependencies...
if not exist "backend\.venv\Scripts\python.exe" (
    echo       Creating Python venv at backend\.venv ...
    python -m venv backend\.venv
)
backend\.venv\Scripts\python.exe -m pip install -q -r backend\requirements.txt >nul 2>&1
if errorlevel 1 (
    echo       ERROR: pip install failed.
    pause
    exit /b 1
)

:: 4. Start Backend
echo [4/6] Starting Backend Server (Port 8000)...
start "Focus-AI Backend" /min cmd /k "cd backend && .venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000"

:: Wait for backend to be healthy
echo       Waiting for backend health check...
set /a attempts=0
:healthcheck
set /a attempts+=1
if %attempts% gtr 20 (
    echo       WARNING: Backend did not respond in time. Continuing anyway...
    goto :startfrontend
)
timeout /t 1 /nobreak >nul
curl -s -o nul -w "%%{http_code}" http://127.0.0.1:8000/health | findstr "200" >nul 2>&1
if errorlevel 1 goto :healthcheck
echo       Backend is healthy.

:: 5. Start Frontend
:startfrontend
echo [5/6] Starting Frontend Client (Port 3000)...
if not exist "frontend\node_modules" (
    echo       node_modules missing. Running npm install...
    start "Focus-AI Frontend" /min cmd /k "cd frontend && npm install && npm run dev"
) else (
    start "Focus-AI Frontend" /min cmd /k "cd frontend && npm run dev"
)

:: Wait a moment for Next.js to compile
echo       Waiting for frontend to compile (8s)...
timeout /t 8 /nobreak >nul

:: 6. Open Chrome
echo [6/6] Opening Chrome...
start "" "chrome" "http://localhost:3000"

echo ===================================================
echo      SYSTEM IS RUNNING
echo ===================================================
echo  - Backend:  http://localhost:8000/health
echo  - API docs: http://localhost:8000/docs
echo  - Frontend: http://localhost:3000
echo.
echo  Chrome should have opened automatically.
echo  Minimise this window, but do not close it.
echo ===================================================
pause
