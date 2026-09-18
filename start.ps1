# SwasthyaSync — Quick Start Script
# Run both backend and frontend in separate windows

Write-Host "Starting SwasthyaSync..." -ForegroundColor Cyan

# Start backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
  cd '$PSScriptRoot\backend'
  Write-Host 'Installing backend dependencies...' -ForegroundColor Yellow
  pip install -r requirements.txt -q
  Write-Host 'Starting FastAPI backend on http://localhost:8000' -ForegroundColor Green
  python -m uvicorn main:app --reload --port 8000
"@

# Wait a moment for backend to start
Start-Sleep -Seconds 3

# Start frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
  cd '$PSScriptRoot\frontend'
  Write-Host 'Installing frontend dependencies...' -ForegroundColor Yellow
  npm install --silent
  Write-Host 'Starting Vite frontend on http://localhost:5173' -ForegroundColor Green
  npm run dev
"@

Write-Host ""
Write-Host "SwasthyaSync starting up!" -ForegroundColor Green
Write-Host "   Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "   Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "   API Docs: http://localhost:8000/docs" -ForegroundColor White
