@echo off
title Beatweaver - DJ Tool
cd /d "%~dp0"

echo ========================================
echo           BEATWEAVER LAUNCHER
echo ========================================
echo.

:: Kill any existing processes on port 5173 (Vite dev server)
echo Cleaning up old processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING 2^>nul') do (
    if not "%%a"=="0" (
        echo Killing process %%a on port 5173...
        taskkill //F //PID %%a >nul 2>&1
    )
)
:: Also kill any orphaned electron processes for this app
taskkill //F //IM electron.exe //T >nul 2>&1
echo.

:check_node
:: Find npm in common locations
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

:: Try PATH
where npm.cmd >nul 2>&1
if %errorlevel%==0 (
    for /f "delims=" %%i in ('where npm.cmd') do set "NPM_CMD=%%i"
    goto :found
)

:: Node.js not found - prompt user to install
echo ========================================
echo   NODE.JS NOT FOUND
echo ========================================
echo.
echo Beatweaver requires Node.js to run.
echo.
echo Please download and install Node.js:
echo.
echo   https://nodejs.org
echo.
echo Click the green LTS button, run the installer,
echo then press any key to continue...
echo.
pause
goto :check_node

:found
echo Node.js found: %NPM_CMD%
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    echo This may take a minute...
    echo.
    call "%NPM_CMD%" install
    if errorlevel 1 (
        echo.
        echo ERROR: npm install failed
        pause
        exit /b 1
    )
    echo.
)

echo Starting Beatweaver...
echo.
call "%NPM_CMD%" run dev

pause
