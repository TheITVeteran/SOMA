"""
Computer Control Arbiter System
Extends the existing BaseArbiter framework to enable GUI automation and computer control
"""

import asyncio
import base64
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from enum import Enum
import numpy as np
from PIL import Image
import io

# Platform-specific imports
try:
    import pyautogui
    pyautogui.FAILSAFE = True  # Move mouse to corner to abort
    PYAUTOGUI_AVAILABLE = True
except ImportError:
    PYAUTOGUI_AVAILABLE = False

try:
    import cv2
    import pytesseract
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

try:
    from screeninfo import get_monitors
    SCREENINFO_AVAILABLE = True
except ImportError:
    SCREENINFO_AVAILABLE = False

# Platform-specific accessibility APIs
import sys
if sys.platform == "win32":
    try:
        import pywinauto
        from pywinauto import Desktop
        WINDOWS_AUTOMATION = True
    except ImportError:
        WINDOWS_AUTOMATION = False
elif sys.platform == "darwin":
    try:
        import PyObjC
        from ApplicationServices import AXUIElementCopyElementAtPosition
        MAC_AUTOMATION = True
    except ImportError:
        MAC_AUTOMATION = False
else:  # Linux
    try:
        import pyatspi
        LINUX_AUTOMATION = True
    except ImportError:
        LINUX_AUTOMATION = False

# ============================================================================
# Base Classes (simplified for standalone use)
# ============================================================================

class ArbiterRole(Enum):
    CONDUCTOR = "conductor"
    ANALYZER = "analyzer"
    EXECUTOR = "executor"

class ArbiterCapability(Enum):
    READ_FILES = "read_files"
    SPAWN_AGENT = "spawn_agent"

@dataclass
class Task:
    query: str
    context: Dict[str, Any]

@dataclass
class ArbiterResult:
    success: bool
    data: Any
    confidence: float
    arbiter: str
    duration: float
    error: Optional[str] = None

class BaseArbiter:
    def __init__(self, name: str, role: ArbiterRole, capabilities: List):
        self.name = name
        self.role = role
        self.capabilities = capabilities
    
    def _get_system_prompt(self) -> str:
        return ""
    
    async def execute(self, task: Task) -> ArbiterResult:
        raise NotImplementedError

# ============================================================================
# Extended Capabilities for Computer Control
# ============================================================================

class ExtendedCapability(Enum):
    """Additional capabilities for computer control"""
    SCREEN_CAPTURE = "screen_capture"
    MOUSE_CONTROL = "mouse_control"
    KEYBOARD_CONTROL = "keyboard_control"
    WINDOW_MANAGEMENT = "window_management"
    OCR_VISION = "ocr_vision"
    GUI_ELEMENT_DETECTION = "gui_element_detection"
    ACCESSIBILITY_API = "accessibility_api"

@dataclass
class GUIElement:
    """Represents a GUI element on screen"""
    name: str
    type: str  # button, input, link, etc.
    position: Tuple[int, int]
    size: Tuple[int, int]
    text: Optional[str] = None
    confidence: float = 1.0
    accessibility_id: Optional[str] = None

@dataclass
class ComputerControlTask(Task):
    """Extended task for computer control operations"""
    visual_context: Optional[str] = None  # base64 screenshot
    target_element: Optional[str] = None  # description of element to find
    action_sequence: Optional[List[Dict]] = None  # list of actions to perform
    safety_level: str = "high"  # high, medium, low

# ============================================================================
# Computer Vision Arbiter
# ============================================================================

class ComputerVisionArbiter(BaseArbiter):
    """Handles screen understanding and element detection"""
    
    def __init__(self):
        super().__init__(
            name="ComputerVision",
            role=ArbiterRole.ANALYZER,
            capabilities=[
                ArbiterCapability.READ_FILES,
                ExtendedCapability.SCREEN_CAPTURE,
                ExtendedCapability.OCR_VISION,
                ExtendedCapability.GUI_ELEMENT_DETECTION
            ]
        )
        
    def _get_system_prompt(self) -> str:
        return """
        You are the Computer Vision arbiter responsible for:
        1. Capturing and analyzing screenshots
        2. Detecting GUI elements (buttons, inputs, menus)
        3. Performing OCR to extract text
        4. Understanding screen layout and structure
        5. Matching natural language descriptions to visual elements
        """
        
    async def execute(self, task: ComputerControlTask) -> ArbiterResult:
        """Analyze screen and find elements"""
        start_time = datetime.now()
        
        try:
            # Capture screen if not provided
            if not task.visual_context:
                screenshot = await self.capture_screen()
                task.visual_context = self.image_to_base64(screenshot)
            else:
                screenshot = self.base64_to_image(task.visual_context)
                
            # Detect elements
            elements = await self.detect_elements(screenshot)
            
            # If looking for specific element
            if task.target_element:
                matching_element = await self.find_element_by_description(
                    elements, 
                    task.target_element
                )
                
                return ArbiterResult(
                    success=True,
                    data={"element": matching_element, "all_elements": elements},
                    confidence=matching_element.confidence if matching_element else 0.0,
                    arbiter=self.name,
                    duration=(datetime.now() - start_time).total_seconds()
                )
            
            # Return all detected elements
            return ArbiterResult(
                success=True,
                data={"elements": elements},
                confidence=0.9,
                arbiter=self.name,
                duration=(datetime.now() - start_time).total_seconds()
            )
            
        except Exception as e:
            return ArbiterResult(
                success=False,
                data=None,
                confidence=0.0,
                arbiter=self.name,
                duration=(datetime.now() - start_time).total_seconds(),
                error=str(e)
            )
    
    async def capture_screen(self, region=None) -> Image.Image:
        """Capture screenshot"""
        if not PYAUTOGUI_AVAILABLE:
            raise ImportError("pyautogui not available for screen capture")
            
        screenshot = pyautogui.screenshot(region=region)
        return screenshot
    
    async def detect_elements(self, image: Image.Image) -> List[GUIElement]:
        """Detect GUI elements in screenshot"""
        elements = []
        
        # Convert PIL Image to OpenCV format
        if CV2_AVAILABLE:
            img_array = np.array(image)
            img_cv = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
            
            # Perform OCR to find text elements
            try:
                ocr_data = pytesseract.image_to_data(
                    image, 
                    output_type=pytesseract.Output.DICT
                )
                
                for i in range(len(ocr_data['text'])):
                    if ocr_data['conf'][i] > 60 and ocr_data['text'][i].strip():
                        element = GUIElement(
                            name=f"text_{i}",
                            type="text",
                            position=(ocr_data['left'][i], ocr_data['top'][i]),
                            size=(ocr_data['width'][i], ocr_data['height'][i]),
                            text=ocr_data['text'][i],
                            confidence=ocr_data['conf'][i] / 100.0
                        )
                        elements.append(element)
            except:
                pass  # OCR not available
            
            # Detect buttons using edge detection
            gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(gray, 50, 150)
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            for contour in contours:
                x, y, w, h = cv2.boundingRect(contour)
                # Filter for button-like shapes
                if 20 < w < 500 and 15 < h < 100:
                    element = GUIElement(
                        name=f"button_{len(elements)}",
                        type="button",
                        position=(x, y),
                        size=(w, h),
                        confidence=0.7
                    )
                    elements.append(element)
        
        return elements
    
    async def find_element_by_description(
        self, 
        elements: List[GUIElement], 
        description: str
    ) -> Optional[GUIElement]:
        """Match natural language description to GUI element"""
        description_lower = description.lower()
        best_match = None
        best_score = 0
        
        for element in elements:
            score = 0
            
            # Check text match
            if element.text:
                text_lower = element.text.lower()
                if text_lower in description_lower or description_lower in text_lower:
                    score += 0.8
                elif any(word in text_lower for word in description_lower.split()):
                    score += 0.4
            
            # Check type match
            if element.type in description_lower:
                score += 0.2
                
            # Update best match
            if score > best_score:
                best_score = score
                best_match = element
                if best_match:
                    best_match.confidence = score
        
        return best_match
    
    def image_to_base64(self, image: Image.Image) -> str:
        """Convert PIL Image to base64 string"""
        buffer = io.BytesIO()
        image.save(buffer, format='PNG')
        return base64.b64encode(buffer.getvalue()).decode()
    
    def base64_to_image(self, base64_str: str) -> Image.Image:
        """Convert base64 string to PIL Image"""
        image_data = base64.b64decode(base64_str)
        return Image.open(io.BytesIO(image_data))

# ============================================================================
# Action Execution Arbiter
# ============================================================================

class ActionExecutionArbiter(BaseArbiter):
    """Executes mouse and keyboard actions"""
    
    def __init__(self):
        super().__init__(
            name="ActionExecution",
            role=ArbiterRole.EXECUTOR,
            capabilities=[
                ExtendedCapability.MOUSE_CONTROL,
                ExtendedCapability.KEYBOARD_CONTROL,
                ExtendedCapability.WINDOW_MANAGEMENT
            ]
        )
        self.safety_mode = True
        self.action_delay = 0.5  # Delay between actions
        
    def _get_system_prompt(self) -> str:
        return """
        You are the Action Execution arbiter responsible for:
        1. Controlling mouse movements and clicks
        2. Typing keyboard input
        3. Managing windows and applications
        4. Executing action sequences safely
        5. Verifying action completion
        """
        
    async def execute(self, task: ComputerControlTask) -> ArbiterResult:
        """Execute computer control actions"""
        start_time = datetime.now()
        
        try:
            # Validate safety level
            if not await self.validate_safety(task):
                return ArbiterResult(
                    success=False,
                    data=None,
                    confidence=0.0,
                    arbiter=self.name,
                    duration=(datetime.now() - start_time).total_seconds(),
                    error="Safety validation failed"
                )
            
            # Execute action sequence
            results = []
            for action in task.action_sequence or []:
                result = await self.execute_action(action)
                results.append(result)
                await asyncio.sleep(self.action_delay)
            
            return ArbiterResult(
                success=True,
                data={"executed_actions": results},
                confidence=0.95,
                arbiter=self.name,
                duration=(datetime.now() - start_time).total_seconds()
            )
            
        except Exception as e:
            return ArbiterResult(
                success=False,
                data=None,
                confidence=0.0,
                arbiter=self.name,
                duration=(datetime.now() - start_time).total_seconds(),
                error=str(e)
            )
    
    async def validate_safety(self, task: ComputerControlTask) -> bool:
        """Validate action safety"""
        if task.safety_level == "low":
            return True
        
        # Check for dangerous patterns
        dangerous_patterns = [
            "delete", "remove", "format", "uninstall",
            "shutdown", "restart", "rm -rf"
        ]
        
        for action in task.action_sequence or []:
            action_text = str(action).lower()
            if any(pattern in action_text for pattern in dangerous_patterns):
                if task.safety_level == "high":
                    return False
        
        return True
    
    async def execute_action(self, action: Dict) -> Dict:
        """Execute a single action"""
        action_type = action.get('type')
        
        if not PYAUTOGUI_AVAILABLE:
            return {"error": "pyautogui not available"}
        
        if action_type == 'click':
            x, y = action.get('position', (0, 0))
            button = action.get('button', 'left')
            pyautogui.click(x, y, button=button)
            return {"action": "click", "position": (x, y), "status": "completed"}
            
        elif action_type == 'double_click':
            x, y = action.get('position', (0, 0))
            pyautogui.doubleClick(x, y)
            return {"action": "double_click", "position": (x, y), "status": "completed"}
            
        elif action_type == 'right_click':
            x, y = action.get('position', (0, 0))
            pyautogui.rightClick(x, y)
            return {"action": "right_click", "position": (x, y), "status": "completed"}
            
        elif action_type == 'type':
            text = action.get('text', '')
            pyautogui.write(text, interval=0.05)
            return {"action": "type", "text": text, "status": "completed"}
            
        elif action_type == 'hotkey':
            keys = action.get('keys', [])
            pyautogui.hotkey(*keys)
            return {"action": "hotkey", "keys": keys, "status": "completed"}
            
        elif action_type == 'move':
            x, y = action.get('position', (0, 0))
            duration = action.get('duration', 0.5)
            pyautogui.moveTo(x, y, duration=duration)
            return {"action": "move", "position": (x, y), "status": "completed"}
            
        elif action_type == 'scroll':
            clicks = action.get('clicks', 3)
            pyautogui.scroll(clicks)
            return {"action": "scroll", "clicks": clicks, "status": "completed"}
            
        elif action_type == 'drag':
            start = action.get('start', (0, 0))
            end = action.get('end', (100, 100))
            duration = action.get('duration', 1.0)
            pyautogui.moveTo(start[0], start[1])
            pyautogui.dragTo(end[0], end[1], duration=duration)
            return {"action": "drag", "start": start, "end": end, "status": "completed"}
            
        else:
            return {"error": f"Unknown action type: {action_type}"}

# ============================================================================
# Computer Control Conductor Arbiter
# ============================================================================

class ComputerControlConductor(BaseArbiter):
    """Main orchestrator for computer control tasks"""
    
    def __init__(self):
        super().__init__(
            name="ComputerControlConductor",
            role=ArbiterRole.CONDUCTOR,
            capabilities=[
                ArbiterCapability.SPAWN_AGENT,
                ExtendedCapability.SCREEN_CAPTURE,
                ExtendedCapability.MOUSE_CONTROL,
                ExtendedCapability.KEYBOARD_CONTROL
            ]
        )
        
        self.vision_arbiter = ComputerVisionArbiter()
        self.action_arbiter = ActionExecutionArbiter()
        self.max_autonomous_steps = 20  # Safety limit
        
    async def execute(self, task: Task) -> ArbiterResult:
        """Main execution flow for computer control tasks"""
        start_time = datetime.now()
        
        if not isinstance(task, ComputerControlTask):
            task = ComputerControlTask(
                query=task.query,
                context=task.context,
                safety_level="high"
            )
        
        try:
            # Check if this is an autonomous multi-step task
            if self.is_autonomous_task(task.query):
                return await self.execute_autonomous(task)
            
            # Single action execution
            action_plan = await self.parse_query_to_actions(task.query)
            return await self.execute_with_vision(task, action_plan)
            
        except Exception as e:
            return ArbiterResult(
                success=False,
                data=None,
                confidence=0.0,
                arbiter=self.name,
                duration=(datetime.now() - start_time).total_seconds(),
                error=str(e)
            )
    
    def is_autonomous_task(self, query: str) -> bool:
        """Detect if task requires autonomous multi-step execution"""
        autonomous_keywords = [
            'find', 'search for', 'download', 'get', 'look for',
            'navigate to', 'go to', 'open and', 'browse'
        ]
        query_lower = query.lower()
        
        # Check for goal-oriented tasks (not just single actions)
        has_goal = any(kw in query_lower for kw in autonomous_keywords)
        not_simple = not any(kw in query_lower for kw in ['click', 'type', 'press', 'scroll'])
        
        return has_goal and not_simple
    
    async def execute_autonomous(self, task: ComputerControlTask) -> ArbiterResult:
        """Execute autonomous multi-step task with vision feedback loop"""
        start_time = datetime.now()
        
        print(f"🤖 [AUTONOMOUS MODE] Starting: {task.query}")
        
        # Create task plan
        plan = await self.create_task_plan(task.query)
        print(f"📋 Plan: {len(plan)} steps")
        
        execution_log = []
        current_step = 0
        
        while current_step < len(plan) and current_step < self.max_autonomous_steps:
            step = plan[current_step]
            print(f"\n🔹 Step {current_step + 1}: {step['description']}")
            
            # Capture current screen state
            screenshot = await self.vision_arbiter.capture_screen()
            
            # Execute step
            step_result = await self.execute_step(step, screenshot, task)
            execution_log.append({
                'step': current_step + 1,
                'description': step['description'],
                'success': step_result.success,
                'data': step_result.data
            })
            
            if not step_result.success:
                print(f"⚠️  Step failed: {step_result.error}")
                # Try to recover or adapt
                recovery_plan = await self.attempt_recovery(step, screenshot)
                if recovery_plan:
                    plan.insert(current_step + 1, recovery_plan)
                else:
                    break
            
            # Wait between actions
            await asyncio.sleep(1)
            
            # Check if goal achieved
            if await self.is_goal_achieved(task.query, screenshot):
                print("✅ Goal achieved!")
                break
            
            current_step += 1
        
        success = current_step > 0 and execution_log[-1]['success']
        
        return ArbiterResult(
            success=success,
            data={
                'autonomous': True,
                'steps_executed': current_step + 1,
                'total_planned': len(plan),
                'execution_log': execution_log
            },
            confidence=0.7 if success else 0.3,
            arbiter=self.name,
            duration=(datetime.now() - start_time).total_seconds()
        )
    
    async def create_task_plan(self, goal: str) -> List[Dict]:
        """Break down goal into executable steps"""
        goal_lower = goal.lower()
        plan = []
        
        # Example: "find wallpaper of sunset"
        if 'wallpaper' in goal_lower or 'background' in goal_lower:
            search_term = goal_lower.replace('find', '').replace('wallpaper', '').replace('background', '').strip()
            
            plan = [
                {'description': 'Open browser', 'action': 'hotkey', 'keys': ['win', 'r']},
                {'description': 'Type chrome command', 'action': 'type', 'text': 'chrome'},
                {'description': 'Press enter', 'action': 'hotkey', 'keys': ['enter']},
                {'description': 'Wait for browser', 'action': 'wait', 'duration': 2},
                {'description': f'Search for {search_term} wallpaper', 'action': 'type', 'text': f'{search_term} wallpaper hd'},
                {'description': 'Submit search', 'action': 'hotkey', 'keys': ['enter']},
                {'description': 'Wait for results', 'action': 'wait', 'duration': 2},
                {'description': 'Click Images tab', 'action': 'find_and_click', 'target': 'Images'},
                {'description': 'Click first image', 'action': 'click_position', 'position': (400, 300)},
            ]
        
        # Example: "download xyz file"
        elif 'download' in goal_lower:
            item = goal_lower.replace('download', '').strip()
            plan = [
                {'description': 'Open browser', 'action': 'hotkey', 'keys': ['win', 'r']},
                {'description': 'Launch', 'action': 'type', 'text': 'chrome'},
                {'description': 'Enter', 'action': 'hotkey', 'keys': ['enter']},
                {'description': 'Wait', 'action': 'wait', 'duration': 2},
                {'description': f'Search for {item}', 'action': 'type', 'text': item},
                {'description': 'Submit', 'action': 'hotkey', 'keys': ['enter']},
            ]
        
        # Example: "open file explorer and find documents"
        elif 'file explorer' in goal_lower or 'find file' in goal_lower:
            plan = [
                {'description': 'Open File Explorer', 'action': 'hotkey', 'keys': ['win', 'e']},
                {'description': 'Wait', 'action': 'wait', 'duration': 1},
                {'description': 'Go to search', 'action': 'hotkey', 'keys': ['ctrl', 'f']},
            ]
            
            # Add search if specified
            if 'find' in goal_lower:
                search_term = goal_lower.split('find')[-1].strip()
                plan.append({'description': f'Search for {search_term}', 'action': 'type', 'text': search_term})
                plan.append({'description': 'Submit search', 'action': 'hotkey', 'keys': ['enter']})
        
        # Generic fallback
        if not plan:
            plan = [
                {'description': 'Analyze request', 'action': 'wait', 'duration': 1},
                {'description': 'Execute goal', 'action': 'search_and_interact', 'query': goal}
            ]
        
        return plan
    
    async def execute_step(self, step: Dict, screenshot: Image.Image, task: ComputerControlTask) -> ArbiterResult:
        """Execute a single step in the plan"""
        action_type = step.get('action')
        
        if action_type == 'wait':
            await asyncio.sleep(step.get('duration', 1))
            return ArbiterResult(
                success=True,
                data={'waited': step.get('duration')},
                confidence=1.0,
                arbiter='StepExecutor',
                duration=step.get('duration', 1)
            )
        
        # Convert step to action format
        action_sequence = []
        
        if action_type == 'hotkey':
            action_sequence.append({'type': 'hotkey', 'keys': step['keys']})
        elif action_type == 'type':
            action_sequence.append({'type': 'type', 'text': step['text']})
        elif action_type == 'find_and_click':
            # Use vision to find element
            vision_task = ComputerControlTask(
                query=f"Find {step['target']}",
                target_element=step['target'],
                context=task.context
            )
            vision_result = await self.vision_arbiter.execute(vision_task)
            
            if vision_result.success and vision_result.data.get('element'):
                element = vision_result.data['element']
                action_sequence.append({
                    'type': 'click',
                    'position': (
                        element.position[0] + element.size[0] // 2,
                        element.position[1] + element.size[1] // 2
                    )
                })
            else:
                return vision_result
        elif action_type == 'click_position':
            action_sequence.append({'type': 'click', 'position': step['position']})
        
        # Execute actions
        if action_sequence:
            action_task = ComputerControlTask(
                query=step['description'],
                action_sequence=action_sequence,
                safety_level=task.safety_level
            )
            return await self.action_arbiter.execute(action_task)
        
        return ArbiterResult(
            success=True,
            data={'step': step},
            confidence=0.8,
            arbiter='StepExecutor',
            duration=0.1
        )
    
    async def attempt_recovery(self, failed_step: Dict, screenshot: Image.Image) -> Optional[Dict]:
        """Attempt to recover from failed step"""
        # Simple recovery: retry with wait
        if failed_step.get('action') == 'find_and_click':
            return {
                'description': f"Retry: {failed_step['description']}",
                'action': 'wait',
                'duration': 2
            }
        return None
    
    async def is_goal_achieved(self, goal: str, screenshot: Image.Image) -> bool:
        """Check if the goal has been achieved"""
        # Simplified check - could use AI vision here
        # For now, assume we need to complete all steps
        return False
    
    async def parse_query_to_actions(self, query: str) -> List[Dict]:
        """Parse natural language query into action sequence"""
        query_lower = query.lower()
        actions = []
        
        # Hotkey/keyboard shortcuts
        if "press" in query_lower:
            import re
            # Extract key combination (e.g., "windows+e", "ctrl+shift+esc")
            keys_match = re.search(r'press\s+([\w+]+(?:\+[\w+]+)*)', query_lower)
            if keys_match:
                keys_str = keys_match.group(1)
                # Convert to list: "windows+e" -> ["win", "e"]
                keys = []
                for key in keys_str.split('+'):
                    # Map common names
                    key_map = {
                        'windows': 'win',
                        'control': 'ctrl',
                        'escape': 'esc',
                        'return': 'enter'
                    }
                    keys.append(key_map.get(key, key))
                
                actions.append({"type": "hotkey", "keys": keys})
        
        elif "click" in query_lower:
            target = query.split("click")[-1].strip()
            actions.append({"type": "find_and_click", "target": target})
            
        elif "type" in query_lower or "enter" in query_lower:
            import re
            text_match = re.search(r'["\'](.*?)["\']', query)
            if text_match:
                actions.append({"type": "type", "text": text_match.group(1)})
            else:
                # Try to extract text after "type"
                text = query.split("type")[-1].strip()
                if text:
                    actions.append({"type": "type", "text": text})
                
        elif "open" in query_lower:
            app = query.split("open")[-1].strip()
            actions.append({"type": "open_application", "application": app})
            
        elif "find" in query_lower:
            target = query.split("find")[-1].strip()
            actions.append({"type": "find_element", "target": target})
            
        elif "scroll" in query_lower:
            direction = "down" if "down" in query_lower else "up"
            clicks = -3 if direction == "down" else 3
            actions.append({"type": "scroll", "clicks": clicks})
        
        if not actions:
            actions.append({"type": "search_and_interact", "query": query})
        
        return actions
    
    async def execute_with_vision(self, task: ComputerControlTask, action_plan: List[Dict]) -> ArbiterResult:
        """Execute using vision-based approach"""
        results = []
        start_time = datetime.now()
        
        for action in action_plan:
            if action['type'] == 'hotkey':
                # Direct hotkey execution
                action_task = ComputerControlTask(
                    query="Execute hotkey",
                    action_sequence=[action],
                    safety_level=task.safety_level
                )
                action_result = await self.action_arbiter.execute(action_task)
                results.append(action_result)
                
            elif action['type'] == 'find_and_click':
                vision_task = ComputerControlTask(
                    query="Find element: " + action['target'],
                    target_element=action['target'],
                    context=task.context
                )
                
                vision_result = await self.vision_arbiter.execute(vision_task)
                
                if vision_result.success and vision_result.data.get('element'):
                    element = vision_result.data['element']
                    
                    click_task = ComputerControlTask(
                        query="Click element",
                        action_sequence=[{
                            'type': 'click',
                            'position': (
                                element.position[0] + element.size[0] // 2,
                                element.position[1] + element.size[1] // 2
                            )
                        }],
                        safety_level=task.safety_level
                    )
                    
                    action_result = await self.action_arbiter.execute(click_task)
                    results.append(action_result)
                else:
                    results.append(vision_result)
                    
            elif action['type'] in ['type', 'scroll', 'hotkey']:
                action_task = ComputerControlTask(
                    query=f"Execute {action['type']}",
                    action_sequence=[action],
                    safety_level=task.safety_level
                )
                
                action_result = await self.action_arbiter.execute(action_task)
                results.append(action_result)
        
        success = all(r.success for r in results)
        
        return ArbiterResult(
            success=success,
            data={"action_results": results, "plan": action_plan},
            confidence=0.8 if success else 0.3,
            arbiter=self.name,
            duration=(datetime.now() - start_time).total_seconds()
        )

# ============================================================================
# Unified Orchestrator
# ============================================================================

class UnifiedArbiterOrchestrator:
    """Integrates computer control with existing arbiters"""
    
    def __init__(self, existing_arbiters: Dict[str, BaseArbiter]):
        self.arbiters = existing_arbiters
        self.arbiters['computer_control'] = ComputerControlConductor()
        self.arbiters['vision'] = ComputerVisionArbiter()
        self.arbiters['action'] = ActionExecutionArbiter()
    
    async def route_query(self, query: str, context: Dict = None) -> ArbiterResult:
        """Route queries to appropriate arbiters"""
        query_lower = query.lower()
        
        gui_patterns = ['click', 'type', 'open', 'find on screen', 'navigate', 'scroll']
        needs_gui = any(pattern in query_lower for pattern in gui_patterns)
        
        if needs_gui:
            task = ComputerControlTask(
                query=query,
                context=context or {},
                safety_level="high"
            )
            return await self.arbiters['computer_control'].execute(task)
        
        return ArbiterResult(
            success=False,
            data=None,
            confidence=0.0,
            arbiter="UnifiedOrchestrator",
            duration=0.0,
            error="No suitable arbiter found for query"
        )
