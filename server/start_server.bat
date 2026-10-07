@echo off
echo Starting FastAPI server...

cd /d %~dp0

echo Starting Main FastAPI Server...
start cmd /k "C:\python311\python.exe -m uvicorn server:app --reload --host 0.0.0.0 --port 8000"

echo Starting DB Layer Server...
start cmd /k "C:\python311\python.exe -m uvicorn sql_server:DbLayer --reload --host 0.0.0.0 --port 8010"

pause
root342