@echo off
setlocal
cd /d "%~dp0\.."
set "URL=http://127.0.0.1:3001/admin"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not on PATH. Install it, then try again.
  pause
  exit /b 1
)

netstat -ano | findstr ":3001" | findstr "LISTENING" >nul
if errorlevel 1 (
  echo Starting the signal desk on port 3001...
  start "Signal desk" /min cmd /k "cd /d ""%~dp0\.."" && npx next dev --port 3001"
) else (
  echo Signal desk is already running.
)

echo Opening %URL%
set /a n=0
:wait
set /a n+=1
if %n% gtr 60 (
  echo Timed out waiting for http://127.0.0.1:3001
  pause
  exit /b 1
)
timeout /t 1 /nobreak >nul
curl.exe -s -o nul -m 2 http://127.0.0.1:3001/ >nul 2>&1
if errorlevel 1 goto wait

start "" "%URL%"
endlocal
