@echo off
title KelasKita
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 goto start
where python >nul 2>nul
if %errorlevel%==0 goto startpython
echo Python tidak ditemukan.
echo Install Python dari https://www.python.org/downloads/
pause
exit /b 1
:start
start "KelasKita Server" cmd /k "cd /d "%~dp0" && py -m http.server 5500"
timeout /t 2 /nobreak >nul
start "KelasKita Browser" http://localhost:5500/index.html
exit /b
:startpython
start "KelasKita Server" cmd /k "cd /d "%~dp0" && python -m http.server 5500"
timeout /t 2 /nobreak >nul
start "KelasKita Browser" http://localhost:5500/index.html
exit /b
