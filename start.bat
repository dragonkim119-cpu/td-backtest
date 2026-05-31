@echo off
echo Starting TD Backtest...

start "Backend" cmd /k "cd /d D:\invest_program\td-backtest\backend && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000"

timeout /t 2 /nobreak >nul

start "Frontend" cmd /k "cd /d D:\invest_program\td-backtest\frontend && .\node_modules\.bin\next dev --port 3000"

echo Backend: http://localhost:8000
echo Frontend: http://localhost:3000
