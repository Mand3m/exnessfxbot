@echo off
setlocal
cd /d "%~dp0\.."
set "URL=http://127.0.0.1:3001/desk"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not on PATH. Install it, then try again.
  pause
  exit /b 1
)

netstat -ano | findstr ":3001" | findstr "LISTENING" >nul
if errorlevel 1 (
  echo Starting the signal desk on port 3001...
  start "Signal desk" /min cmd /k "cd /d ""%~dp0\.."" && npx next dev --webpack --port 3001"
) else (
  echo Signal desk is already running.
)

if not exist "data\mt5-executor.pid" goto start_exec
for /f %%p in (data\mt5-executor.pid) do tasklist /FI "PID eq %%p" | findstr /I "python" >nul
if errorlevel 1 goto start_exec
goto skip_exec
:start_exec
echo Opening Account 1 MT5 (gold EA on XAUUSDz M5) in the background...
start "MT5 executor" /min cmd /c "cd /d ""%~dp0\.."" && set PYTHONUNBUFFERED=1&& set PYTHONIOENCODING=utf-8&& python -u scripts\mt5_executor.py >> data\mt5-executor.log 2>&1"
:skip_exec

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
