@echo off
echo Starting FastAPI server...

cd /d %~dp0

C:\Users\MSI\AppData\Local\Programs\Python\Python311\python.exe -m uvicorn server:app --reload --host 0.0.0.0 --port 8000

pause