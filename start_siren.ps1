# start_siren.ps1
# Launches the full Project Siren stack: Fish-Speech (8080) and Paula Proxy (8081)

$SirenDir = Join-Path $PSScriptRoot "siren-bridge"
$VenvPython = Join-Path $SirenDir ".venv\Scripts\python.exe"
$FFmpegBin = Join-Path $PSScriptRoot "ffmpeg_shared\ffmpeg-master-latest-win64-gpl-shared\bin"

# Add FFmpeg to PATH for this session
$env:PATH = "$FFmpegBin;$env:PATH"

Write-Host "[Siren] Starting Project Siren Stack (with FFmpeg at $FFmpegBin)..." -ForegroundColor Cyan

function Test-FishReady {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:8080/v1/health" -Method Post -TimeoutSec 2 -UseBasicParsing -EA Stop
        return $r.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Test-PaulaReady {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:8081/health" -Method Get -TimeoutSec 2 -UseBasicParsing -EA Stop
        return $r.StatusCode -eq 200
    } catch {
        return $false
    }
}

# 1. Start Fish-Speech (Port 8080), unless it is already online.
if (Test-FishReady) {
    Write-Host "   [1/2] Fish-Speech Core already online on :8080." -ForegroundColor Green
} else {
    Write-Host "   [1/2] Launching Fish-Speech Core on :8080..." -ForegroundColor Gray
    Start-Process -FilePath $VenvPython -ArgumentList "siren_bridge.py" -WorkingDirectory $SirenDir -WindowStyle Hidden
}

# 2. Wait for Fish-Speech to actually be ready (poll instead of blind sleep)
Write-Host "   Waiting for Fish-Speech core to be ready..." -ForegroundColor Gray
$maxWait = 240  # Fish loads model + VQ-GAN + warmup before the health route exists.
$elapsed = 0
$ready = $false
while ($elapsed -lt $maxWait) {
    if (Test-FishReady) { $ready = $true; break }
    Start-Sleep -Seconds 2
    $elapsed += 2
    Write-Host "   ...still loading ($elapsed`s)" -ForegroundColor DarkGray
}
if (-not $ready) { Write-Host "   WARNING: Fish-Speech didn't respond in ${maxWait}s - Paula proxy may fail" -ForegroundColor Yellow }

# 3. Start Paula Proxy (Port 8081), unless it is already online.
if (Test-PaulaReady) {
    Write-Host "   [2/2] Paula Female Proxy already online on :8081." -ForegroundColor Green
} else {
    Write-Host "   [2/2] Launching Paula Female Proxy on :8081..." -ForegroundColor Gray
    Start-Process -FilePath $VenvPython -ArgumentList "paula_proxy.py" -WorkingDirectory $SirenDir -WindowStyle Hidden
}

Write-Host "[Siren] Project Siren is online." -ForegroundColor Green
Write-Host "   Primary Voice: Paula (Female Proxy) on http://127.0.0.1:8081" -ForegroundColor Green
