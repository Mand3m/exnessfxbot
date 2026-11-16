@echo off
cd /d "%~dp0\.."
echo Installing MetaTrader5 Python package if needed...
python -m pip install -q MetaTrader5
echo.
echo Opening Account 1 MT5 with the XAUUSD H1-range M5 EA, then watching the desk...
echo.
set PYTHONUNBUFFERED=1
set PYTHONIOENCODING=utf-8
python -u scripts\mt5_executor.py
pause
