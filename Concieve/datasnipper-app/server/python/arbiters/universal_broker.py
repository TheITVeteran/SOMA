#!/usr/bin/env python3
"""
Universal MessageBroker for FINPOLYMER + JavaScript + Ollama Integration

SUPPORTS:
- Python arbiters (FINPOLYMER)
- JavaScript/Node.js agents
- Ollama AI requests
- Cross-language communication

This implementation provides in-memory with WebSocket support.
"""

import json
import time
import uuid
import asyncio
import threading
from collections import defaultdict
from enum import Enum
from typing import Any, Dict, List, Optional, Callable
import os
import urllib.request
import urllib.error

# -------------------------
# MESSAGE TYPES
# -------------------------

class MessagePriority(Enum):
    CRITICAL = 1
    HIGH = 2
    MEDIUM = 3
    LOW = 4

class Message:
    """Universal message format for all agents"""
    def __init__(self, 
                 sender: str,
                 receiver: str,
                 msg_type: str,
                 payload: Dict[str, Any],
                 priority: MessagePriority = MessagePriority.MEDIUM,
                 reply_to: Optional[str] = None,
                 correlation_id: Optional[str] = None):
        
        self.id = uuid.uuid4().hex
        self.sender = sender
        self.receiver = receiver
        self.msg_type = msg_type
        self.payload = payload
        self.priority = priority
        self.reply_to = reply_to
        self.correlation_id = correlation_id or self.id
        self.timestamp = time.time()
        self.metadata = {}
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize for cross-language transmission"""
        return {
            'id': self.id,
            'sender': self.sender,
            'receiver': self.receiver,
            'msg_type': self.msg_type,
            'payload': self.payload,
            'priority': self.priority.value,
            'reply_to': self.reply_to,
            'correlation_id': self.correlation_id,
            'timestamp': self.timestamp,
            'metadata': self.metadata
        }
    
    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'Message':
        """Deserialize from JSON"""
        msg = Message(
            sender=data['sender'],
            receiver=data['receiver'],
            msg_type=data['msg_type'],
            payload=data['payload'],
            priority=MessagePriority(data.get('priority', 3)),
            reply_to=data.get('reply_to'),
            correlation_id=data.get('correlation_id')
        )
        msg.id = data['id']
        msg.timestamp = data['timestamp']
        msg.metadata = data.get('metadata', {})
        return msg

# -------------------------
# IN-MEMORY MESSAGE BROKER
# -------------------------

class UniversalMessageBroker:
    """
    Enhanced in-memory broker with WebSocket support for JavaScript
    """
    def __init__(self):
        self.queues = defaultdict(list)
        self.subscribers = defaultdict(list)
        self.message_log = []
        self.handlers = {}  # Callback handlers
        self.websocket_clients = []  # JavaScript clients
        self._lock = threading.Lock()
        self._running = True
        
        print("[BROKER] Universal Message Broker initialized")
    
    def send(self, message: Message):
        """Send message to receiver's queue"""
        with self._lock:
            self.queues[message.receiver].append(message)
            self.message_log.append(message)
            
            # Broadcast to WebSocket clients (for JavaScript)
            self._broadcast_to_websockets(message)
            
            # Trigger handlers if registered
            if message.msg_type in self.handlers:
                for handler in self.handlers[message.msg_type]:
                    threading.Thread(
                        target=handler, 
                        args=(message,), 
                        daemon=True
                    ).start()
        
        print(f"[BROKER] {message.sender} -> {message.receiver}: {message.msg_type}")
    
    def receive(self, arbiter_id: str, wait_time: float = 0, timeout: float = 30) -> Optional[Message]:
        """Receive next message for arbiter"""
        start = time.time()
        
        while True:
            with self._lock:
                if arbiter_id in self.queues and self.queues[arbiter_id]:
                    # Sort by priority
                    self.queues[arbiter_id].sort(key=lambda m: m.priority.value)
                    return self.queues[arbiter_id].pop(0)
            
            if wait_time == 0:
                return None
            
            if time.time() - start > timeout:
                return None
            
            time.sleep(0.1)
    
    def subscribe(self, arbiter_id: str, msg_type: str):
        """Subscribe to message type"""
        if arbiter_id not in self.subscribers[msg_type]:
            self.subscribers[msg_type].append(arbiter_id)
            print(f"[BROKER] {arbiter_id} subscribed to {msg_type}")
    
    def broadcast(self, sender: str, msg_type: str, payload: Dict, priority: MessagePriority = MessagePriority.MEDIUM):
        """Broadcast to all subscribers"""
        with self._lock:
            for subscriber in self.subscribers.get(msg_type, []):
                msg = Message(sender, subscriber, msg_type, payload, priority)
                self.send(msg)
    
    def register_handler(self, msg_type: str, handler: Callable):
        """Register callback for message type"""
        if msg_type not in self.handlers:
            self.handlers[msg_type] = []
        self.handlers[msg_type].append(handler)
        print(f"[BROKER] Handler registered for {msg_type}")
    
    def _broadcast_to_websockets(self, message: Message):
        """Send message to JavaScript clients via WebSocket"""
        for client in self.websocket_clients:
            try:
                client.send(json.dumps(message.to_dict()))
            except:
                self.websocket_clients.remove(client)
    
    def add_websocket_client(self, client):
        """Register JavaScript WebSocket client"""
        self.websocket_clients.append(client)
        print(f"[BROKER] WebSocket client connected")
    
    def stop(self):
        """Stop the broker"""
        self._running = False

# -------------------------
# OLLAMA INTEGRATION BRIDGE
# -------------------------

class OllamaBridge:
    """
    Bridge between message broker and Ollama local LLM
    Python arbiters can request AI analysis via messages
    """
    def __init__(self, broker: UniversalMessageBroker, ollama_endpoint="http://localhost:11434"):
        self.broker = broker
        self.ollama_endpoint = ollama_endpoint
        self.arbiter_id = "OLLAMA-BRIDGE"
        
        # Subscribe to AI requests
        self.broker.subscribe(self.arbiter_id, "OLLAMA_REQUEST")
        self.broker.subscribe(self.arbiter_id, "AI_ANALYZE")
        
        # Start listening thread
        self._listening = True
        self._thread = threading.Thread(target=self._listen_loop, daemon=True)
        self._thread.start()
        
        print(f"[OLLAMA] Bridge active at {ollama_endpoint}")
    
    def _listen_loop(self):
        """Listen for AI requests"""
        while self._listening:
            msg = self.broker.receive(self.arbiter_id, wait_time=1)
            if msg:
                print(f"[OLLAMA] Received request from {msg.sender}")
                response = self._process_ai_request(msg)
                
                # Send response back
                self.broker.send(Message(
                    sender=self.arbiter_id,
                    receiver=msg.sender,
                    msg_type="OLLAMA_RESPONSE",
                    payload=response,
                    correlation_id=msg.correlation_id,
                    reply_to=msg.id
                ))
    
    def _process_ai_request(self, msg: Message) -> Dict[str, Any]:
        """Send prompt to Ollama, get response"""
        prompt = msg.payload.get('prompt', '')
        model = msg.payload.get('model', 'gemma3:4b')
        
        try:
            data = json.dumps({
                'model': model,
                'prompt': prompt,
                'stream': False
            }).encode('utf-8')
            
            req = urllib.request.Request(
                f"{self.ollama_endpoint}/api/generate",
                data=data,
                headers={'Content-Type': 'application/json'}
            )
            
            with urllib.request.urlopen(req, timeout=60) as response:
                result = json.loads(response.read().decode('utf-8'))
                
                return {
                    'success': True,
                    'response': result.get('response', ''),
                    'model': model
                }
        
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def stop(self):
        """Stop the bridge"""
        self._listening = False

# -------------------------
# GLOBAL BROKER INSTANCE
# -------------------------

# Singleton broker instance
_broker = None
_ollama_bridge = None

def get_broker():
    """Get the global broker instance"""
    global _broker, _ollama_bridge
    
    if _broker is None:
        _broker = UniversalMessageBroker()
        
        # Start Ollama bridge if available
        try:
            _ollama_bridge = OllamaBridge(_broker)
        except Exception as e:
            print(f"[BROKER] Ollama bridge failed: {e}")
    
    return _broker

def stop_broker():
    """Stop the global broker"""
    global _broker, _ollama_bridge
    
    if _ollama_bridge:
        _ollama_bridge.stop()
    
    if _broker:
        _broker.stop()
    
    _broker = None
    _ollama_bridge = None

if __name__ == "__main__":
    # Demo usage
    broker = get_broker()
    
    # Send test message
    msg = Message(
        sender="TEST-SENDER",
        receiver="TEST-RECEIVER", 
        msg_type="TEST_MESSAGE",
        payload={"message": "Hello from Universal Broker!"}
    )
    
    broker.send(msg)
    
    # Test receiving
    received = broker.receive("TEST-RECEIVER")
    if received:
        print(f"Received: {received.payload}")
    
    print("Universal Message Broker test complete!")