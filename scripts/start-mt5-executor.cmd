@echo off
cd /d "%~dp0\.."
echo Installing MetaTrader5 Python package if needed...
python -m pip install -q MetaTrader5
echo.
echo Start MetaTrader 5 first, log into the account, and turn on Algo Trading.
echo.
python scripts\mt5_executor.py
pause
