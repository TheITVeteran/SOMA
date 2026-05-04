# SOMA Integration for Conceive

This setup integrates the SOMA Self-Learning AI Engine into the Conceive audit platform.

## Architecture

1. **SOMA Engine (Python)**:
   - Located in `server/python/soma_engine` (Core Logic) and `server/python/soma_service` (API).
   - Runs on Port 8000.
   - Provides Quad-Brain analysis, Memory, and Learning capabilities.

2. **SomaArbiter (Node.js)**:
   - Located in `server/arbiters/SomaArbiter.js`.
   - Bridges the Node.js backend with the Python SOMA Engine.
   - Subscribes to `analyze_file`, `audit_task`, `fraud_check`.

## How to Run

1. **Prerequisites**:
   - Python 3.8+ installed and in PATH.
   - Node.js 16+ installed.
   - Access to internet (for `pip` and `npm` installs).

2. **Start All Services**:
   Double-click `start-soma-integration.bat` in this folder.
   
   This will open 3 windows:
   - **SOMA Engine**: Shows logs from the Python AI.
   - **Datasnipper Backend**: Shows logs from Arbiters and API.
   - **Conceive Client**: Runs the React frontend.

## Verification

- **Check SOMA**: Go to `http://localhost:8000/health`. It should return `{"status": "active", ...}`.
- **Check Integration**: Look at the Backend logs. You should see:
  `[ConceiveSoma] 🧠 SomaArbiter initializing...`
  `[ConceiveSoma] ✅ SOMA Intelligence active`

## Customization

To modify the SOMA behavior, edit `server/python/soma_service/server.py`.
To add new SOMA capabilities to the backend, edit `server/arbiters/SomaArbiter.js`.
