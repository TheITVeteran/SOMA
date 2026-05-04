@echo off
REM run-training-prometheus.bat
REM Manually triggers PROMETHEUS lobe LoRA training against current knowledge library.
REM Produces soma-prometheus:latest in Ollama.

REM Use venv python if available
if exist ".soma_venv\Scripts\python.exe" (
    set PYTHON=.soma_venv\Scripts\python.exe
) else (
    set PYTHON=python
    echo [SOMA Train] WARNING: .soma_venv not found -- using system python
    echo [SOMA Train] Run setup-training.bat first for best results
)

REM Build JSONL from knowledge library + seeds
echo [SOMA Train] Building PROMETHEUS training data from knowledge library...
%PYTHON% build-training-data.py --lobe prometheus

REM Find the newest lobe-prometheus-*.jsonl
for /f "delims=" %%i in ('dir /b /od /a-d "SOMA\training-data\lobe-prometheus-*.jsonl" 2^>nul') do set LATEST=%%i

if not defined LATEST (
    echo [SOMA Train] ERROR: No training data found. Make sure SOMA has been running to build the knowledge library.
    pause
    exit /b 1
)

set DATA_PATH=SOMA\training-data\%LATEST%
set OUTPUT_DIR=models\soma-prometheus-%DATE:~-4,4%%DATE:~-7,2%%DATE:~-10,2%

echo [SOMA Train] Data: %DATA_PATH%
echo [SOMA Train] Output: %OUTPUT_DIR%
echo [SOMA Train] Model: nvidia/Minitron-4B-Base
echo [SOMA Train] This will take 30-90 minutes depending on GPU.
echo.

%PYTHON% train-soma-llama.py ^
    --data "%DATA_PATH%" ^
    --output "%OUTPUT_DIR%" ^
    --model nvidia/Minitron-4B-Base ^
    --epochs 3 ^
    --batch-size 2 ^
    --max-seq-len 2048 ^
    --lobe prometheus

if errorlevel 1 (
    echo [SOMA Train] Training failed. Check output above for errors.
    pause
    exit /b 1
)

echo.
echo [SOMA Train] Training complete! Test with:
echo   ollama run soma-prometheus:latest
pause
