# Start DataSnipper App with Computer Control
# Runs both Node.js backend and Python control service

Write-Host "🚀 Starting DataSnipper App Services..." -ForegroundColor Cyan
Write-Host ""

# Check if Python is installed
$pythonExists = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonExists) {
    Write-Host "❌ Python not found. Please install Python 3.8+ first." -ForegroundColor Red
    exit 1
}

# Start Python Control Service
Write-Host "📦 Starting Python Computer Control Service (Port 5001)..." -ForegroundColor Yellow
$pythonJob = Start-Job -ScriptBlock {
    Set-Location "C:\Users\barry\projects\datasnipper-app\server\python-control-service"
    python app.py
}

# Wait a moment for Python service to initialize
Start-Sleep -Seconds 3

# Check if Python service started successfully
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:5001/api/health" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✅ Python Control Service: ONLINE" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Python Control Service: Starting..." -ForegroundColor Yellow
}

Write-Host ""

# Start Node.js Backend
Write-Host "🟢 Starting Node.js Backend (Port 5000)..." -ForegroundColor Yellow
$nodeBackendJob = Start-Job -ScriptBlock {
    Set-Location "C:\Users\barry\projects\datasnipper-app\server"
    npm run dev
}

# Start React Frontend
Write-Host "⚛️  Starting React Frontend (Port 3000)..." -ForegroundColor Yellow
$reactJob = Start-Job -ScriptBlock {
    Set-Location "C:\Users\barry\projects\datasnipper-app\client"
    npm start
}

Write-Host ""
Write-Host "✨ All services starting..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Services:" -ForegroundColor White
Write-Host "  • Python Control:  http://127.0.0.1:5001" -ForegroundColor Gray
Write-Host "  • Node.js Backend: http://localhost:5000" -ForegroundColor Gray
Write-Host "  • React Frontend:  http://localhost:3000" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  Computer control is enabled - actions will require confirmation" -ForegroundColor Yellow
Write-Host "⚠️  Move mouse to top-left corner to emergency abort any action" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Cyan
Write-Host ""

# Keep script running and forward output
try {
    while ($true) {
        # Check job status
        $jobs = @($pythonJob, $nodeBackendJob, $reactJob)
        foreach ($job in $jobs) {
            if ($job.State -eq "Failed") {
                Write-Host "❌ A service has failed. Check logs above." -ForegroundColor Red
                throw "Service failure detected"
            }
            
            # Forward output
            $output = Receive-Job -Job $job -ErrorAction SilentlyContinue
            if ($output) {
                Write-Host $output
            }
        }
        
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host ""
    Write-Host "🛑 Stopping all services..." -ForegroundColor Red
    Stop-Job -Job $pythonJob, $nodeBackendJob, $reactJob -ErrorAction SilentlyContinue
    Remove-Job -Job $pythonJob, $nodeBackendJob, $reactJob -Force -ErrorAction SilentlyContinue
    Write-Host "✅ All services stopped." -ForegroundColor Green
}
