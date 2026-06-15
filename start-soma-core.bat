@echo off
REM ── Lean, reliable SOMA launch for supervised auto-recovery ─────────────────
REM Same env as start_production.bat but WITHOUT the optional preamble that can
REM hang (WSL/Redis hot-tier, Siren TTS, Bonsai images). Marionette uses THIS so
REM recovery never blocks on WSL. Start those extras via start_production.bat for
REM a full interactive session; core SOMA runs fine without them.

cd /d "%~dp0"
set NODE_ENV=production
set SOMA_MODE=standalone
set SOMA_GPU=true
set SOMA_LOAD_HEAVY=true
set SOMA_LOAD_TRADING=true
set SOMA_HYBRID_SEARCH=true
set SOMA_LOAD_VISION=true
set OLLAMA_MODEL=qwen2.5:7b
set OLLAMA_MODEL_LOGOS=qwen2.5-coder:14b
set OLLAMA_MODEL_AURORA=qwen2.5:7b
set OLLAMA_MODEL_PROMETHEUS=llama3.2:latest

node --max-old-space-size=4096 --expose-gc launcher_ULTRA.mjs
