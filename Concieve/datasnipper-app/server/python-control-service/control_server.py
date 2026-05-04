from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
import uvicorn
import asyncio
import os

# Import the arbiter logic
from computer_control_arbiter import ComputerControlConductor, Task, ArbiterResult

app = FastAPI(title="Computer Control Service")
conductor = ComputerControlConductor()

class ControlRequest(BaseModel):
    query: str
    context: Optional[Dict[str, Any]] = {}

@app.get("/health")
async def health():
    return {"status": "active", "system": os.name}

@app.post("/execute")
async def execute_task(request: ControlRequest):
    task = Task(query=request.query, context=request.context)
    result = await conductor.execute(task)
    
    if result.success:
        return {
            "success": True,
            "data": result.data,
            "confidence": result.confidence,
            "duration": result.duration
        }
    else:
        raise HTTPException(status_code=500, detail=result.error or "Task execution failed")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8001)
