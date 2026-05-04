
import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal as TerminalIcon, 
  ChevronRight,
  Zap,
  Settings,
  PanelRight,
  ShieldCheck,
  Search,
  Activity,
  Network,
  Layout,
  ExternalLink,
  RefreshCw,
  Code,
  Plus
} from 'lucide-react';
import JSZip from 'jszip';
import { 
  TerminalBlock, ProjectState, WorkspaceTab, ViewPlane, BackendService, 
  SomaTask, CompletionSuggestion, TaskEnvelope, ObserverMessage, SearchStep, BlueprintFile 
} from './types';
import { 
  getTerminalAssistance, 
  getSteveResponse,
  generateAgenticBlueprint
} from './services/geminiService';
import Sidebar from './components/Sidebar';
import TerminalBlockView from './components/TerminalBlock';
import StatsOverlay from './components/StatsOverlay';
import MissionControl from './components/MissionControl';
import SteveAgentButton from './components/SteveAgentButton';
import SteveChat from './components/SteveChat';
import CommandPalette from './components/CommandPalette';
import SettingsModal from './components/SettingsModal';
import TopologyView from './components/TopologyView';
import Autocomplete from './components/Autocomplete';
import PreviewPlane from './components/PreviewPlane';
import broker from './core/MessageBroker';

const INITIAL_STATE: ProjectState = {
  name: "Pulse-App",
  activeTab: 'web',
  currentPlane: 'code',
  currentPath: "~/projects/pulse-app",
  services: [
    { 
      id: 'PrimeCore', 
      name: 'Prime Core', 
      port: 8000, 
      status: 'online', 
      role: 'prime',
      version: '3.6.1',
      logs: ['[AUTHORITY] Pulse SOMA Orchestrator online'],
      metrics: { 
        cpu: [8, 10, 9], 
        memory: [120, 122, 121],
        network: { rx: [10, 15, 12], tx: [5, 8, 6] },
        requests: [20, 25, 22]
      },
      alerts: [
        { id: '1', type: 'info', message: 'Service initialized', timestamp: Date.now() - 100000 }
      ]
    }
  ],
  blocks: [
    {
      id: 'init-1',
      type: 'output',
      content: 'Pulse Synthesis Engine initialized. System ready for intent capture.',
      timestamp: Date.now()
    }
  ],
  roadmap: [
    { id: '1', title: 'Synthesize Core Architecture', status: 'completed', description: 'Define the cluster authority model and arbiter roles.' },
    { id: '2', title: 'Live Rendering Link', status: 'in-progress', description: 'Enable direct-to-preview blueprint synchronization.' }
  ],
  activeBlueprint: [],
  securityScore: 85,
  vulnerabilities: [
    { id: '1', severity: 'high', name: 'Injection Risk', description: 'Potential SQL injection in query params', status: 'open' },
    { id: '2', severity: 'medium', name: 'Outdated Dep', description: 'Lodash version < 4.17.21', status: 'resolved' }
  ],
  compliance: [
    { id: '1', name: 'GDPR Data Privacy', status: 'passed', lastChecked: Date.now() },
    { id: '2', name: 'SOC2 Encryption', status: 'pending', lastChecked: Date.now() }
  ],
  preview: {
    url: 'pulse://local-preview',
    title: 'Pulse Surface',
    type: 'website',
    lastUpdated: Date.now()
  }
};

const COMMAND_DICTIONARY: CompletionSuggestion[] = [
  { text: 'soma', type: 'cmd', description: 'Run a development task' },
  { text: 'deploy', type: 'cmd', description: 'Push current blueprint to live plane' },
  { text: 'reset', type: 'cmd', description: 'Clear system state' },
  { text: 'status', type: 'cmd', description: 'Check cluster health' },
  { text: 'ls', type: 'cmd', description: 'List blueprint files' },
  { text: 'help', type: 'cmd', description: 'Show architectural guidance' }
];

const App: React.FC = () => {
  const [state, setState] = useState<ProjectState>(INITIAL_STATE);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSteveChatOpen, setIsSteveChatOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSteveThinking, setIsSteveThinking] = useState(false);
  const [isInputActionsOpen, setIsInputActionsOpen] = useState(false);
  
  // Terminal History Logic
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const [steveMessages, setSteveMessages] = useState<{role: 'user'|'steve', content: string, actions?: string[], updatedFiles?: BlueprintFile[]}[]>([
    { role: 'steve', content: "S.T.E.V.E. System (Supervised Terminal Execution & Validation Engine) online. Preview Plane optimized. How can I assist with your synthesis?" }
  ]);

  // Draggable Steve Logic
  const [stevePos, setStevePos] = useState({ x: 30, y: window.innerHeight - 60 });
  const [isDraggingSteve, setIsDraggingSteve] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; mouseStartX: number; mouseStartY: number } | null>(null);

  const handleSteveMouseDown = (e: React.MouseEvent) => {
    dragRef.current = {
      startX: stevePos.x,
      startY: stevePos.y,
      mouseStartX: e.clientX,
      mouseStartY: e.clientY
    };
    setIsDraggingSteve(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSteve || !dragRef.current) return;
      
      const deltaX = e.clientX - dragRef.current.mouseStartX;
      const deltaY = e.clientY - dragRef.current.mouseStartY;
      
      const newX = Math.max(30, Math.min(window.innerWidth - 30, dragRef.current.startX + deltaX));
      const newY = Math.max(30, Math.min(window.innerHeight - 30, dragRef.current.startY + deltaY));
      
      setStevePos({ x: newX, y: newY });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isDraggingSteve) return;
      
      if (dragRef.current) {
        const dist = Math.sqrt(
          Math.pow(e.clientX - dragRef.current.mouseStartX, 2) + 
          Math.pow(e.clientY - dragRef.current.mouseStartY, 2)
        );
        if (dist < 5) {
          setIsSteveChatOpen(prev => !prev);
        }
      }
      
      setIsDraggingSteve(false);
      dragRef.current = null;
    };

    if (isDraggingSteve) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSteve, stevePos]);

  const [suggestions, setSuggestions] = useState<CompletionSuggestion[]>([]);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(0);

  const [showOpsSidebar, setShowOpsSidebar] = useState(window.innerWidth > 1024);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [state.blocks]);

  useEffect(() => {
    const lastWord = inputValue.split(' ').pop() || '';
    if (lastWord.length > 0) {
      const filtered = COMMAND_DICTIONARY.filter(s => s.text.startsWith(lastWord));
      setSuggestions(filtered);
      setActiveSuggestionIdx(0);
    } else {
      setSuggestions([]);
    }
  }, [inputValue]);

  useEffect(() => {
    broker.registerArbiter('PrimeCore', { role: 'prime', version: '3.6.1', instance: null });
    
    const unsubTask = broker.subscribe('task', async (envelope: TaskEnvelope) => {
      const { taskId, steps } = envelope;
      for (let i = 0; i < steps.length; i++) {
        await new Promise(r => setTimeout(r, 600));
        broker.publish('observer', { taskId, type: 'progress', from: 'ExecNode1', payload: steps[i] });
      }
      broker.publish('observer', { taskId, type: 'complete', from: 'PrimeCore' });
    });

    const unsubObserver = broker.subscribe('observer', (msg: ObserverMessage) => {
      const { taskId, type, payload, from } = msg;
      setState(prev => {
        const block = prev.blocks.find(b => b.metadata?.soma?.id === taskId);
        if (!block) return prev;
        const task = { ...block.metadata!.soma! };
        let newPlane = prev.currentPlane;
        if (type === 'progress') { task.currentStep += 1; task.stepLabel = `[${from}] ${payload}`; }
        else if (type === 'complete') { 
          task.state = 'completed'; task.currentStep = task.totalSteps; task.stepLabel = '✔ Deployment Success'; 
          if (task.name === 'Live Deployment') newPlane = 'preview';
        }
        return { ...prev, currentPlane: newPlane, blocks: prev.blocks.map(b => b.id === block.id ? { ...b, metadata: { ...b.metadata, soma: task } } : b) };
      });
    });

    return () => { unsubTask(); unsubObserver(); };
  }, []);

  const handleCommand = async (e?: React.FormEvent, directCmd?: string) => {
    if (e) e.preventDefault();
    const cmdText = (directCmd || inputValue).trim();
    if (!cmdText || isProcessing) return;

    // Add to history
    setHistory(prev => [cmdText, ...prev.slice(0, 49)]);
    setHistoryIdx(-1);

    setState(prev => ({ ...prev, blocks: [...prev.blocks, { id: Date.now().toString(), type: 'command', content: cmdText, timestamp: Date.now() }] }));
    setInputValue('');
    setSuggestions([]);
    
    setIsProcessing(true);
    
    try {
      const lowerCmd = cmdText.toLowerCase();
      
      if (lowerCmd === 'topology') {
        setState(prev => ({ ...prev, activeTab: 'fleet' }));
        setIsProcessing(false);
        return;
      }
      
      if (lowerCmd === 'audit' || lowerCmd === 'compliance') {
        setState(prev => ({ ...prev, activeTab: 'security' }));
        setIsProcessing(false);
        return;
      }
      
      if (lowerCmd.startsWith('plan')) {
        setState(prev => ({ ...prev, activeTab: 'web' }));
        // Continue to processing if it's more than just 'plan'
        if (lowerCmd === 'plan') {
           setIsProcessing(false);
           return;
        }
      }

      if (lowerCmd === 'optimize') {
        setState(prev => ({ ...prev, blocks: [...prev.blocks, { id: Date.now().toString(), type: 'diagnostic', content: "Optimizing network mesh topology...", timestamp: Date.now() }] }));
        setTimeout(() => {
          setState(prev => ({ ...prev, blocks: [...prev.blocks, { id: Date.now().toString(), type: 'output', content: "✔ Network optimization complete. Latency reduced by 12ms.", timestamp: Date.now() }] }));
        }, 1500);
        setIsProcessing(false);
        return;
      }

      if (lowerCmd === 'fail_test') {
        const errorId = Date.now().toString();
        // 1. Show Error
        setState(prev => ({ 
          ...prev, 
          blocks: [...prev.blocks, { 
            id: errorId, 
            type: 'error', 
            content: "Error: Build process failed. Dependency cycle detected in module 'core'. Exit Code 1.", 
            timestamp: Date.now() 
          }] 
        }));

        // 2. Watchdog Intervenes
        setTimeout(() => {
          setState(prev => ({
            ...prev,
            blocks: [...prev.blocks, {
              id: Date.now().toString(),
              type: 'ai-suggestion',
              content: "I caught that before the kernel panicked.",
              timestamp: Date.now(),
              metadata: {
                intervention: {
                  originalCmd: 'npm run build',
                  fixCmd: 'npm run build -- --ignore-cycles',
                  reason: 'Dependency cycle detected. I am forcing a cycle-ignore build to bypass the deadlock.'
                }
              }
            }]
          }));
          setIsProcessing(false);
        }, 1200);
        return;
      }

      const assistance = await getTerminalAssistance(cmdText, state.currentPath);
      
      if (assistance.intent === 'blueprint_intent' || cmdText.toLowerCase().includes('make') || cmdText.toLowerCase().includes('create')) {
        const synthesis = await generateAgenticBlueprint(cmdText);
        const newBlock: TerminalBlock = { 
          id: Date.now().toString(), 
          type: 'code-gen', 
          content: synthesis.explanation, 
          timestamp: Date.now(), 
          metadata: { 
            blueprint: synthesis.files 
          } 
        };
        setState(prev => ({ ...prev, blocks: [...prev.blocks, newBlock], activeBlueprint: synthesis.files }));
      } else if (cmdText.toLowerCase() === 'deploy') {
        startSomaTask('Live Deployment');
      } else if (cmdText.toLowerCase() === 'reset') {
        setState(INITIAL_STATE);
      } else {
        const newBlock: TerminalBlock = { 
          id: Date.now().toString(), 
          type: assistance.code ? 'code-gen' : 'ai-suggestion', 
          content: assistance.explanation || assistance.suggestion || 'Done.', 
          timestamp: Date.now(), 
          metadata: { 
            language: assistance.language,
            blueprint: assistance.code ? [{ path: 'src/main.tsx', content: assistance.code, language: assistance.language || 'typescript' }] : undefined 
          } 
        };
        setState(prev => ({ ...prev, blocks: [...prev.blocks, newBlock] }));
      }
    } catch (err) {
      console.error(err);
      setState(prev => ({ ...prev, blocks: [...prev.blocks, { id: Date.now().toString(), type: 'error', content: "Synthesizer offline. Please check your connection.", timestamp: Date.now() }] }));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const nextIdx = historyIdx + 1;
      if (nextIdx < history.length) {
        setHistoryIdx(nextIdx);
        setInputValue(history[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = historyIdx - 1;
      if (nextIdx >= 0) {
        setHistoryIdx(nextIdx);
        setInputValue(history[nextIdx]);
      } else {
        setHistoryIdx(-1);
        setInputValue('');
      }
    } else if (e.key === 'Tab' && suggestions.length > 0) {
      e.preventDefault();
      const parts = inputValue.split(' ');
      parts[parts.length - 1] = suggestions[0].text;
      setInputValue(parts.join(' '));
    }
  };

  const startSomaTask = async (name: string) => {
    const taskId = `task_${Date.now()}`;
    const steps = ['Synthesizing Blueprint...', 'Transpiling Artifacts...', 'Optimizing Assets...', 'Linking Live Domains...'];
    setState(prev => ({
      ...prev,
      blocks: [...prev.blocks, {
        id: `block_${Date.now()}`, type: 'soma-task', content: name, timestamp: Date.now(),
        metadata: { soma: { id: taskId, name, state: 'running', currentStep: 0, totalSteps: steps.length, stepLabel: 'Readying...', timestamp: Date.now(), assignedNodeId: 'ExecNode1' } }
      }]
    }));
    await broker.publish('task', { taskId, intent: 'exec', steps, ttl: 3600 });
  };

  const handleSyncBlueprint = (files: BlueprintFile[]) => {
    setState(prev => ({ 
      ...prev, 
      activeBlueprint: files,
      currentPlane: 'preview'
    }));
  };

  const handleSteveMessage = async (msg: string) => {
    setSteveMessages(prev => [...prev, {role: 'user', content: msg}]);
    setIsSteveThinking(true);
    
    try {
      const response = await getSteveResponse(msg, steveMessages, { 
        projectName: state.name, 
        currentPlane: state.currentPlane,
        activeBlueprint: state.activeBlueprint
      });

      setSteveMessages(prev => [...prev, {
        role: 'steve', 
        content: response.response, 
        actions: response.actions,
        updatedFiles: response.updatedFiles
      }]);
      
      if (response.actions?.includes('generate')) {
        handleCommand(undefined, msg);
      }
    } catch (err) {
      console.error(err);
      setSteveMessages(prev => [...prev, { role: 'steve', content: "My cognitive link failed. Let's try that request again." }]);
    } finally {
      setIsSteveThinking(false);
    }
  };

  const applySteveEdits = (files: BlueprintFile[]) => {
    setState(prev => {
      const newBlueprint = [...(prev.activeBlueprint || [])];
      files.forEach(updatedFile => {
        const existingIdx = newBlueprint.findIndex(f => f.path === updatedFile.path);
        if (existingIdx !== -1) {
          newBlueprint[existingIdx] = updatedFile;
        } else {
          newBlueprint.push(updatedFile);
        }
      });
      
      return {
        ...prev,
        activeBlueprint: newBlueprint,
        currentPlane: 'preview'
      };
    });
  };

  const handleAddFile = () => {
    const filename = prompt("Enter filename (e.g. index.css):");
    if (!filename) return;
    
    const newFile: BlueprintFile = {
      path: filename,
      content: '// Source generated by Pulse Architect',
      language: filename.split('.').pop() || 'text'
    };

    setState(prev => ({
      ...prev,
      activeBlueprint: [...(prev.activeBlueprint || []), newFile]
    }));
  };

  const downloadBlueprintAsZip = async () => {
    if (!state.activeBlueprint || state.activeBlueprint.length === 0) return;
    
    const zip = new JSZip();
    state.activeBlueprint.forEach(file => {
      zip.file(file.path, file.content);
    });
    
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${state.name.toLowerCase() || 'pulse-app'}-blueprint.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-[#0d0d0e] text-zinc-300 font-sans overflow-hidden">
      <Sidebar 
        state={state} 
        onTabChange={(tab) => setState(prev => ({ ...prev, activeTab: tab }))} 
        onDownloadZip={downloadBlueprintAsZip}
      />

      <main className="flex-1 flex flex-col min-w-0 border-l border-zinc-800/50 relative">
        <header className="h-14 border-b border-zinc-800/50 flex items-center px-4 justify-between bg-zinc-900/20 backdrop-blur-md z-20 shrink-0">
          <div className="flex items-center space-x-2 px-3 py-1 bg-zinc-800/50 rounded border border-zinc-700">
             <TerminalIcon className="w-3 h-3 text-zinc-400" />
             <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">{state.activeTab} Controller</span>
          </div>

          <div className="flex bg-zinc-900/80 border border-zinc-800 rounded-2xl p-0.5 shadow-lg shadow-black/40">
            <button 
              onClick={() => setState(prev => ({ ...prev, currentPlane: 'code' }))}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-xl transition-all text-[10px] font-bold uppercase tracking-widest ${state.currentPlane === 'code' ? 'bg-zinc-800 text-blue-400 shadow-inner shadow-black/20' : 'text-zinc-600'}`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Spec Plane</span>
            </button>
            <button 
              onClick={() => setState(prev => ({ ...prev, currentPlane: 'preview' }))}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-xl transition-all text-[10px] font-bold uppercase tracking-widest ${state.currentPlane === 'preview' ? 'bg-zinc-800 text-emerald-400 shadow-inner shadow-black/20' : 'text-zinc-600'}`}
            >
              <Layout className="w-3.5 h-3.5" />
              <span>Preview Plane</span>
            </button>
          </div>

          <button onClick={() => setShowOpsSidebar(!showOpsSidebar)} className={`p-1.5 rounded-lg border transition-all ${showOpsSidebar ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' : 'text-zinc-500 border-zinc-800 hover:border-zinc-700'}`}>
            <PanelRight className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
          {state.activeTab === 'fleet' ? (
            <TopologyView services={state.services} />
          ) : state.currentPlane === 'preview' ? (
             <PreviewPlane 
               preview={state.preview} 
               blueprint={state.activeBlueprint} 
               onRefresh={() => setState(prev => ({ ...prev, preview: { ...prev.preview!, lastUpdated: Date.now() } }))} 
               onAddFile={handleAddFile}
               onLaunch={() => startSomaTask('Live Deployment')}
             />
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
               <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth custom-scrollbar">
                  {state.blocks.map(block => (
                    <TerminalBlockView 
                      key={block.id} 
                      block={block} 
                      onExecute={(cmd) => handleCommand(undefined, cmd)} 
                      onSyncBlueprint={handleSyncBlueprint}
                      onStopSoma={() => broker.publish(`stop.${block.metadata?.soma?.id}`, { taskId: block.metadata?.soma?.id })}
                    />
                  ))}
                  {isProcessing && (
                    <div className="flex items-center space-x-3 text-blue-400 animate-pulse font-mono text-[10px] pl-3 border-l border-blue-500/30 ml-2">
                      <Zap className="w-3 h-3" />
                      <span className="uppercase tracking-[0.2em]">Synthesizing Reality...</span>
                    </div>
                  )}
                </div>

              <div className="p-4 bg-[#0d0d0e]/80 backdrop-blur-md border-t border-zinc-800/50 relative mt-auto">
                <form onSubmit={handleCommand} className="flex items-center bg-zinc-900/50 rounded-xl border border-zinc-800 focus-within:border-blue-500/50 transition-all p-3 group shadow-2xl">
                  <div className="flex items-center">
                    <button 
                      type="button"
                      onClick={() => setIsInputActionsOpen(!isInputActionsOpen)}
                      className={`p-1.5 rounded-lg transition-all transform hover:scale-110 active:scale-95 ${isInputActionsOpen ? 'bg-blue-500/20 text-blue-400 rotate-90 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'text-zinc-600 hover:text-blue-400'}`}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    
                    <div className={`flex items-center transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden ${isInputActionsOpen ? 'w-10 opacity-100 mx-2 translate-x-0' : 'w-0 opacity-0 -translate-x-2'}`}>
                      <button 
                        type="button"
                        onClick={handleAddFile}
                        className="p-1.5 bg-blue-500 hover:bg-blue-400 text-white border border-blue-500/30 rounded-lg shadow-xl shadow-blue-500/20 transition-all"
                        title="Add File"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center text-[10px] font-bold text-zinc-600 uppercase tracking-tighter mr-3 select-none">
                    <span className="text-blue-500/50 mr-1">~/</span>
                    <span>{state.name.toLowerCase()}</span>
                    <span className="mx-1">❯</span>
                  </div>

                  <input 
                    ref={inputRef} autoFocus
                    className="flex-1 bg-transparent border-none outline-none text-zinc-200 font-mono text-sm placeholder-zinc-700"
                    placeholder={`Synthesize intent...`}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isProcessing}
                  />
                  
                  <div className="flex items-center space-x-2">
                    {inputValue.length > 0 && suggestions.length > 0 && (
                      <span className="text-[9px] font-mono text-zinc-700 italic border border-zinc-800 px-2 py-1 rounded">
                        TAB to complete: {suggestions[0].text}
                      </span>
                    )}
                    <kbd className="hidden md:flex items-center space-x-1 px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[8px] font-black text-zinc-500">
                      <span>ENTER</span>
                    </kbd>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>

      <div className={`transition-all duration-500 flex flex-col border-l border-zinc-800/50 overflow-hidden bg-zinc-950/20 ${showOpsSidebar ? 'w-80' : 'w-0'}`}>
        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
          <MissionControl 
            activeTab={state.activeTab} 
            activeSomaTasks={state.blocks.filter(b => b.type === 'soma-task').map(b => b.metadata!.soma!)} 
            blueprint={state.activeBlueprint}
            roadmap={state.roadmap}
            securityScore={state.securityScore}
            vulnerabilities={state.vulnerabilities}
            compliance={state.compliance}
            onLaunch={() => startSomaTask('Live Deployment')} 
            onDownloadZip={downloadBlueprintAsZip}
            onRoadmapChange={(newRoadmap) => setState(prev => ({ ...prev, roadmap: newRoadmap }))}
          />
          <StatsOverlay services={state.services} />
        </div>
      </div>

      <SteveChat 
        isOpen={isSteveChatOpen} 
        onClose={() => setIsSteveChatOpen(false)}
        messages={steveMessages} 
        onSendMessage={handleSteveMessage}
        isProcessing={isSteveThinking}
        onActionExecute={(cmd) => handleCommand(undefined, cmd)}
        onApplyEdits={applySteveEdits}
        buttonPosition={stevePos}
      />
      
      <SteveAgentButton 
        isActive={isSteveChatOpen} 
        position={stevePos}
        onMouseDown={handleSteveMouseDown}
        isDragging={isDraggingSteve}
      />

      <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} onAction={(cmd) => { setIsPaletteOpen(false); handleCommand(undefined, cmd); }} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} projectName={state.name} />
    </div>
  );
};

export default App;
