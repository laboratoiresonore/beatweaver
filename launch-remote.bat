@echo off
title Beatweaver - Remote Access
cd /d "%~dp0"

echo ========================================
echo     BEATWEAVER REMOTE ACCESS LAUNCHER
echo ========================================
echo.

set "CLOUDFLARED=C:\Program Files (x86)\cloudflared\cloudflared.exe"
if not exist "%CLOUDFLARED%" (
    echo ERROR: cloudflared not found at %CLOUDFLARED%
    echo Install it with: winget install Cloudflare.cloudflared
    pause
    exit /b 1
)

:: Kill any existing processes on port 5173
echo Cleaning up old processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING 2^>nul') do (
    if not "%%a"=="0" (
        echo Killing process %%a on port 5173...
        taskkill //F //PID %%a >nul 2>&1
    )
)
taskkill //F //IM electron.exe //T >nul 2>&1
echo.

:check_node
set "NPM_CMD="
if exist "C:\Program Files\nodejs\npm.cmd" (
    set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"
    goto :found
)
if exist "%PROGRAMFILES%\nodejs\npm.cmd" (
    set "NPM_CMD=%PROGRAMFILES%\nodejs\npm.cmd"
    goto :found
)
if exist "%LOCALAPPDATA%\Programs\nodejs\npm.cmd" (
    set "NPM_CMD=%LOCALAPPDATA%\Programs\nodejs\npm.cmd"
    goto :found
)
where npm.cmd >nul 2>&1
if %errorlevel%==0 (
    for /f "delims=" %%i in ('where npm.cmd') do set "NPM_CMD=%%i"
    goto :found
)
echo NODE.JS NOT FOUND - install from https://nodejs.org
pause
goto :check_node

:found
echo Node.js found: %NPM_CMD%
echo.

:: Install deps if needed
if not exist "node_modules" (
    echo Installing dependencies...
    call "%NPM_CMD%" install
    if errorlevel 1 (
        echo ERROR: npm install failed
        pause
        exit /b 1
    )
    echo.
)

:: Start Vite dev server in a separate minimized window (web only, no Electron)
echo Starting Vite dev server on port 5173...
start "Beatweaver Vite" /MIN cmd /c "call "%NPM_CMD%" run dev:web"

:: Wait for Vite to be ready
echo Waiting for dev server to start...
:wait_loop
timeout /t 1 /nobreak >nul
powershell -NoProfile -Command "(New-Object Net.Sockets.TcpClient).Connect('127.0.0.1', 5173)" >nul 2>&1
if errorlevel 1 goto :wait_loop
echo Dev server is ready!
echo.

:: Start cloudflare tunnel
echo ========================================
echo   STARTING CLOUDFLARE TUNNEL
echo ========================================
echo.
echo Share the URL below with your remote tester:
echo.
"%CLOUDFLARED%" tunnel --url http://localhost:5173

:: If tunnel stops, clean up
echo.
echo Tunnel closed. Stopping Vite server...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING 2^>nul') do (
    if not "%%a"=="0" taskkill //F //PID %%a >nul 2>&1
)
pause
