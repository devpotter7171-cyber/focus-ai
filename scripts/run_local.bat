@echo off
REM =============================================
REM Focus-AI Local Development Script (Windows)
REM =============================================-

echo ================================================
echo    Focus-AI Local Development Environment
echo ================================================
echo.

REM ============== Step 1: Check Prerequisites ==============
echo Step 1: Checking prerequisites...

where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python is not installed
    exit /b 1
)

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed
    exit /b 1
)

echo All prerequisites found!
echo.

REM ============== Step 2: Start Database ==============
echo Step 2: Starting database (if Docker available)...

docker-compose up -d postgres 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Warning: Docker not available. Using SQLite.
)
timeout /t 2 >nul
echo.

REM ============== Step 3: Start Backend ==============
echo Step 3: Starting Backend...

cd backend

if not exist ".venv" (
    python -m venv .venv
)

call .venv\Scripts\activate.bat
pip install -r requirements.txt -q 2>nul

start "Focus-AI Backend" cmd /c "uvicorn main:app --host 0.0.0.0 --port 8000"

cd ..
echo Backend starting on http://localhost:8000
echo.

REM ============== Wait for Backend ==============
echo Waiting for backend...
timeout /t 5 >nul
echo.

REM ============== Step 4: Start Frontend ==============
echo Step 4: Starting Frontend...

cd frontend
call npm install --silent 2>nul
start "Focus-AI Frontend" cmd /c "npm run dev"

cd ..
echo Frontend starting on http://localhost:3000
echo.

REM ============== Wait for Frontend ==============
echo Waiting for frontend...
timeout /t 10 >nul
echo.

REM ============== Step 5: Validate ==============
echo Step 5: Validating endpoints...

curl -s http://localhost:8000/health >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo   Backend health check: PASS
) else (
    echo   Backend health check: FAIL
)

curl -s http://localhost:3000 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo   Frontend check: PASS
) else (
    echo   Frontend check: PENDING (may still be compiling)
)

echo.
echo ================================================
echo    Focus-AI is running!
echo ================================================
echo.
echo   Frontend:  http://localhost:3000
echo   Backend:   http://localhost:8000
echo   API Docs:  http://localhost:8000/docs
echo.
echo   Close the terminal windows to stop services.
echo ================================================
echo.

pause
