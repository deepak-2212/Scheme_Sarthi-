@echo off
echo ============================================
echo   SchemeSaathi — Starting FastAPI Backend
echo   API: http://localhost:8000
echo   Docs: http://localhost:8000/docs
echo ============================================
cd /d "%~dp0Backend"
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
