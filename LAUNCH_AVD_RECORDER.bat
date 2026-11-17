@echo off
title Launching AVD Screen Recorder Pro
cd /d "%~dp0"

echo ========================================================
echo        AVD STUDIO RECORDER PRO - 1-CLICK RUNNER
echo ========================================================
echo.

rem Check if node_modules exists
if not exist "node_modules" (
    echo [!] Installing dependencies, please wait...
    call npm install
)

rem Check if dist bundle exists, otherwise build it
if not exist "dist\index.html" (
    echo [*] Building application bundle...
    call npm run build
)

echo [*] Launching AVD Screen Recorder...
start "" npx electron .

exit
