from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from computer_control_arbiter import UnifiedArbiterOrchestrator, ComputerControlTask
import asyncio
from typing import Dict, Optional

app = FastAPI(title="Computer Control Service", version="1.0.0")

# Enable CORS for Node.js backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize arbiter system
orchestrator = UnifiedArbiterOrchestrator({})

class ControlRequest(BaseModel):
    query: str
    safety_level: str = "high"
    context: Dict = {}

class ControlResponse(BaseModel):
    success: bool
    data: Optional[Dict] = None
    confidence: float
    arbiter: str
    duration: float
    error: Optional[str] = None

@app.post("/api/control", response_model=ControlResponse)
async def execute_control(request: ControlRequest):
    """
    Execute computer control action
    
    Examples:
    - "click on the submit button"
    - "type 'hello world'"
    - "find package.json"
    - "scroll down"
    """
    try:
        result = await orchestrator.route_query(
            request.query, 
            request.context
        )
        
        # Convert result to serializable dict
        data = result.data
        if hasattr(data, '__dict__'):
            data = data.__dict__
        
        return {
            "success": result.success,
            "data": data,
            "confidence": result.confidence,
            "arbiter": result.arbiter,
            "duration": result.duration,
            "error": result.error if not result.success else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
def health():
    """Health check endpoint"""
    return {
        "status": "online",
        "service": "computer-control",
        "capabilities": [
            "screen_capture",
            "mouse_control",
            "keyboard_control",
            "ocr_vision",
            "element_detection"
        ]
    }

@app.get("/api/capabilities")
def capabilities():
    """List available capabilities"""
    import sys
    from computer_control_arbiter import (
        PYAUTOGUI_AVAILABLE,
        CV2_AVAILABLE,
        SCREENINFO_AVAILABLE,
        WINDOWS_AUTOMATION
    )
    
    return {
        "platform": sys.platform,
        "pyautogui": PYAUTOGUI_AVAILABLE,
        "opencv": CV2_AVAILABLE,
        "screen_info": SCREENINFO_AVAILABLE,
        "windows_automation": WINDOWS_AUTOMATION if sys.platform == "win32" else False,
        "ready": PYAUTOGUI_AVAILABLE  # Minimum requirement
    }

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Computer Control Service on http://127.0.0.1:5001")
    print("⚠️  WARNING: This service can control your mouse and keyboard!")
    print("📋 Move mouse to top-left corner to emergency abort")
    uvicorn.run(app, host="127.0.0.1", port=5001, log_level="info")
