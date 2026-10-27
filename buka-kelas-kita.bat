@echo off
title KelasKita Server
cd /d "%~dp0"
set "PORT=5500"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js tidak ditemukan.
  echo Install Node.js dari https://nodejs.org/
  pause
  exit /b 1
)

netstat -ano | findstr ":%PORT%" >nul
if not errorlevel 1 goto open

start "KelasKita Server" /D "%~dp0" cmd /k node server.js
timeout /t 2 /nobreak >nul

:open
start "KelasKita Browser" http://localhost:%PORT%/index.html
exit /b 0
