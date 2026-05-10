# start_siren.ps1
# Launches the full Project Siren stack: Fish-Speech (8080) and Paula Proxy (8081)

$SirenDir = Join-Path $PSScriptRoot "siren-bridge"
$VenvPython = Join-Path $SirenDir ".venv\Scripts\python.exe"
$FFmpegBin = Join-Path $PSScriptRoot "ffmpeg_shared\ffmpeg-master-latest-win64-gpl-shared\bin"

# Add FFmpeg to PATH for this session
$env:PATH = "$FFmpegBin;$env:PATH"

Write-Host "[Siren] Starting Project Siren Stack (with FFmpeg at $FFmpegBin)..." -ForegroundColor Cyan

# 1. Start Fish-Speech (Port 8080)
Write-Host "   [1/2] Launching Fish-Speech Core on :8080..." -ForegroundColor Gray
Start-Process -FilePath $VenvPython -ArgumentList "siren_bridge.py" -WorkingDirectory $SirenDir -WindowStyle Hidden

# 2. Wait for Fish-Speech to actually be ready (poll instead of blind sleep)
Write-Host "   Waiting for Fish-Speech core to be ready..." -ForegroundColor Gray
$maxWait = 120  # 2 minute timeout
$elapsed = 0
$ready = $false
while ($elapsed -lt $maxWait) {
    Start-Sleep -Seconds 2
    $elapsed += 2
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:8080/v1/health" -Method Post -TimeoutSec 2 -EA Stop
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Write-Host "   ...still loading ($elapsed`s)" -ForegroundColor DarkGray
}
if (-not $ready) { Write-Host "   WARNING: Fish-Speech didn't respond in ${maxWait}s - Paula proxy may fail" -ForegroundColor Yellow }

# 3. Start Paula Proxy (Port 8081)
Write-Host "   [2/2] Launching Paula Female Proxy on :8081..." -ForegroundColor Gray
Start-Process -FilePath $VenvPython -ArgumentList "paula_proxy.py" -WorkingDirectory $SirenDir -WindowStyle Hidden

Write-Host "[Siren] Project Siren is online." -ForegroundColor Green
Write-Host "   Primary Voice: Paula (Female Proxy) on http://localhost:8081" -ForegroundColor Green
