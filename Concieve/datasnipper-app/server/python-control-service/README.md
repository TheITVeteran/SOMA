# Computer Control Service

Python-based GUI automation service that enables mouse, keyboard, and screen control through natural language commands.

## Features

- **Screen Capture** - Takes screenshots and analyzes screen content
- **OCR Vision** - Extracts text from screen using Tesseract
- **Element Detection** - Finds buttons, inputs, and UI elements
- **Mouse Control** - Click, drag, move, scroll
- **Keyboard Control** - Type text, press hotkeys
- **Windows Automation** - Native Windows UI Automation API support

## Installation

### 1. Install Python Dependencies

```powershell
cd server/python-control-service
pip install -r requirements.txt
```

### 2. Install Tesseract OCR (Optional, for better text detection)

Download from: https://github.com/UB-Mannheim/tesseract/wiki

Add to PATH or set `pytesseract.pytesseract.tesseract_cmd` in code.

### 3. Start Service

```powershell
python app.py
```

Service runs on **http://127.0.0.1:5001**

## API Endpoints

### POST /api/control

Execute computer control action.

**Request:**
```json
{
  "query": "click on the submit button",
  "safety_level": "high",
  "context": {}
}
```

**Response:**
```json
{
  "success": true,
  "data": { "action_results": [...] },
  "confidence": 0.85,
  "arbiter": "ComputerControlConductor",
  "duration": 1.23,
  "error": null
}
```

### GET /api/health

Health check - returns service status.

### GET /api/capabilities

Lists available capabilities and dependencies.

## Supported Commands

### Mouse Actions
- "click on [element]"
- "double click the icon"
- "right click on file"
- "drag from X to Y"
- "move mouse to center"
- "scroll down/up"

### Keyboard Actions
- "type 'hello world'"
- "press enter"
- "press ctrl+c"
- "hotkey win+r"

### Vision Actions
- "find [element name]"
- "locate button with text [text]"
- "search for icon"

## Safety Features

1. **PyAutoGUI Failsafe** - Move mouse to top-left corner to abort
2. **Safety Levels** - `high`, `medium`, `low`
3. **Dangerous Pattern Detection** - Blocks destructive commands
4. **Action Delay** - 0.5s delay between actions

## Integration with Node.js ECL

The service is registered as an external agent in `server/routes/ecl.js`:

```javascript
'computer_control': { 
  handler: 'external', 
  url: 'http://127.0.0.1:5001/api/control',
  capability: 'Control mouse, keyboard, and GUI automation' 
}
```

Commands like "click", "type", "scroll" are automatically routed to this service.

## Troubleshooting

### Service won't start
- Check Python version: `python --version` (need 3.8+)
- Install dependencies: `pip install -r requirements.txt`
- Check port 5001 isn't in use: `netstat -ano | findstr :5001`

### Mouse/keyboard control not working
- Verify PyAutoGUI installed: `pip show pyautogui`
- Run as administrator if needed
- Disable antivirus temporarily (some block automation)

### OCR not detecting text
- Install Tesseract OCR
- Set path in code: `pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'`
- Try higher resolution screenshots

### Element not found
- Elements detected via OCR and edge detection
- Works best with clear, high-contrast UI
- Try more specific descriptions: "submit button" vs "button"

## Architecture

```
┌─────────────────┐
│  Node.js ECL    │  Parse natural language
│  (Port 5000)    │  Detect GUI control intent
└────────┬────────┘
         │ HTTP POST
         ▼
┌─────────────────┐
│  Python FastAPI │  Orchestrate control
│  (Port 5001)    │  Route to arbiters
└────────┬────────┘
         │
    ┌────┴────┬──────────┐
    ▼         ▼          ▼
┌──────┐  ┌──────┐  ┌──────┐
│Vision│  │Action│  │Access│
│Arbite│  │Arbiter│  │ -ility│
└──────┘  └──────┘  └──────┘
   │          │         │
   └──────────┴─────────┘
              │
         System APIs
   (PyAutoGUI, pywinauto)
```

## Security Warning

⚠️ **This service can control your computer!**

- Only run on trusted networks
- Review commands before confirming
- Use high safety level in production
- Keep logs for audit trail
- Consider sandboxing or VM for testing

## Development

To modify arbiter behavior, edit `computer_control_arbiter.py`:

- `ComputerVisionArbiter` - Screen analysis and element detection
- `ActionExecutionArbiter` - Mouse/keyboard execution
- `ComputerControlConductor` - Main orchestrator

## License

Same as parent project.
