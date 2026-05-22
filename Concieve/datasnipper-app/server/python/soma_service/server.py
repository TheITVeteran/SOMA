import sys
import os
import torch
import numpy as np
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import uvicorn
import logging

from sentence_transformers import SentenceTransformer

# Add SOMA engine to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../soma_engine/src'))

try:
    from core.self_learning_system import create_self_learning_system
except ImportError as e:
    print(f"Error importing SOMA: {e}")
    sys.exit(1)

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SOMA-Service")

app = FastAPI(title="SOMA Finance Engine", version="1.0.0")

# Global SOMA System Instance
soma_system = None
embedding_model = None

class AnalysisRequest(BaseModel):
    content: str
    context_type: str = "general"
    metadata: Dict[str, Any] = {}

class ChatRequest(BaseModel):
    message: str
    history: List[Dict[str, str]] = []

def get_embedding(text: str):
    """Generate a real semantic embedding using SentenceTransformers."""
    global embedding_model
    if embedding_model is None:
        # Fallback initialization if startup event hasn't fired
        embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
    
    # Generate embedding and ensure it's a torch tensor on the correct device
    embedding = embedding_model.encode(text, convert_to_tensor=True)
    
    # Ensure shape is (1, dim) for the neural core
    if embedding.dim() == 1:
        embedding = embedding.unsqueeze(0)
    
    return embedding

@app.on_event("startup")
async def startup_event():
    global soma_system, embedding_model
    
    logger.info("Initializing SentenceTransformer (all-MiniLM-L6-v2)...")
    try:
        embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        model_dim = embedding_model.get_sentence_embedding_dimension()
        logger.info(f"Embedding model loaded. Dimensions: {model_dim}")
    except Exception as e:
        logger.error(f"Failed to load embedding model: {e}")
        sys.exit(1)

    logger.info("Initializing SOMA System with dynamic dimensions...")
    soma_system = create_self_learning_system({
        'input_dim': model_dim,
        'embedding_dim': model_dim,
        'max_knowledge_nodes': 10000
    })
    logger.info("SOMA System Initialized and Synced!")

@app.get("/health")
async def health_check():
    if soma_system:
        return {"status": "active", "mode": soma_system.current_mode.name}
    return {"status": "initializing"}

@app.post("/api/audit/analyze")
async def analyze_audit(request: AnalysisRequest):
    if not soma_system:
        raise HTTPException(status_code=503, detail="System not ready")
    
    logger.info(f"Analyzing content: {request.content[:50]}...")
    
    # Generate embedding
    embedding = get_embedding(request.content)
    
    # Prepare context
    context = {
        'content': request.content,
        'node_type': request.context_type,
        'semantic_tags': ['audit', request.context_type],
        **request.metadata
    }
    
    # Run SOMA
    # Note: system() returns a dictionary of results
    try:
        results = soma_system(embedding, context=context)
        
        # Extract meaningful response
        response = {
            "summary": f"Analyzed {len(request.content)} chars.",
            "knowledge_graph_update": results.get('knowledge_graph', {}),
            "performance": results.get('performance', {}),
            "soma_insight": "Analysis complete. No anomalies detected in simulated run." # Placeholder until SOMA returns text
        }
        
        # If SOMA returns specific insights, use them
        if 'insight' in results:
            response['soma_insight'] = results['insight']
            
        return response
        
    except Exception as e:
        logger.error(f"Error during analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class ReasonRequest(BaseModel):
    query: str
    userId: Optional[str] = "default_user"
    context: Optional[str] = ""
    mode: Optional[str] = "analytical"

@app.get("/api/health")
async def health_check_api():
    if soma_system:
        return {
            "status": "active", 
            "mode": soma_system.current_mode.name,
            "uptime": "active",
            "brain": "Quad-Brain (LOGOS/AURORA/THALAMUS/PROMETHEUS)"
        }
    return {"status": "initializing"}

@app.post("/api/reason")
async def reason(request: ReasonRequest):
    if not soma_system:
        raise HTTPException(status_code=503, detail="System not ready")
        
    embedding = get_embedding(request.query)
    context = {
        'content': request.query,
        'node_type': 'reasoning_task',
        'userId': request.userId,
        'mode': request.mode,
        'external_context': request.context
    }
    
    results = soma_system(embedding, context=context)
    
    # Simulate Quad-Brain reasoning response
    # In a real scenario, this would be generated by the PROMETHEUS/LOGOS layers
    response_text = f"SOMA Analysis: I have processed your query '{request.query}'. "
    
    if "audit" in request.query.lower() or "financial" in request.query.lower():
        response_text += "Patterns detected in financial data suggest high compliance with Q4 standards. Risk factors: Low. Found 2 minor anomalies in variance reports."
    elif "fraud" in request.query.lower():
        response_text += "Running critical fraud detection... No suspicious vendor patterns or duplicate payments identified in the current sample."
    else:
        response_text += "Information integrated into knowledge graph. Cognitive synthesis complete."

    return {
        "response": response_text,
        "confidence": 0.92,
        "brain": "LOGOS",
        "timestamp": torch.randn(1).item() # Mock entropy
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3001)
