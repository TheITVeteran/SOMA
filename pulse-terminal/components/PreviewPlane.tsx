
import React, { useState, useEffect, useMemo } from 'react';
import { PreviewState, BlueprintFile } from '../types';
import { 
  Globe, 
  RefreshCw, 
  Smartphone, 
  Monitor, 
  ChevronLeft, 
  ChevronRight, 
  ShieldCheck,
  Layout,
  Code,
  PanelRightClose,
  PanelRightOpen,
  Activity,
  Cpu,
  Sparkles,
  Info,
  Loader2,
  Plus,
  ChevronDown,
  Terminal,
  Zap,
  ChevronUp,
  AlertCircle,
  Rocket,
  Server,
  Cloud,
  Search,
  Eye,
  Settings2,
  Database,
  Package,
  Home
} from 'lucide-react';

interface Props {
  preview?: PreviewState;
  blueprint?: BlueprintFile[];
  onRefresh: () => void;
  onAddFile?: () => void;
  onLaunch?: () => void;
}

type InspectorMode = 'blueprint' | 'styles' | 'context';

const ENV_CONFIG = {
  'Production Edge': { icon: Zap, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  'Staging Cluster': { icon: Cloud, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  'Dev Sandbox': { icon: Package, color: 'text-purple-400', bg: 'bg-purple-400/10' },
  'Local Node': { icon: Home, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
};

const PreviewPlane: React.FC<Props> = ({ preview, blueprint, onRefresh, onAddFile, onLaunch }) => {
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [resolution, setResolution] = useState('1920x1080');
  const [targetEnv, setTargetEnv] = useState<keyof typeof ENV_CONFIG>('Staging Cluster');
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>('blueprint');
  
  const [isResDropdownOpen, setIsResDropdownOpen] = useState(false);
  const [isHealthDropdownOpen, setIsHealthDropdownOpen] = useState(false);
  const [isEnvDropdownOpen, setIsEnvDropdownOpen] = useState(false);
  const [isInspectorDropdownOpen, setIsInspectorDropdownOpen] = useState(false);

  const resolutions = ['1920x1080', '1440x900', '1280x720', '1024x768', '375x812'];

  const runtimeLogs = [
    { type: 'info', msg: 'Hydrating Pulse Live Runtime...', time: '0ms' },
    { type: 'success', msg: 'Blueprint synthesized successfully.', time: '+12ms' },
    { type: 'info', msg: 'Linking shadow assets...', time: '+45ms' },
    { type: 'warning', msg: 'Legacy CSS detected, applying polyfill.', time: '+102ms' },
    { type: 'success', msg: 'Surface ready for interaction.', time: '+140ms' }
  ];

  const renderedContent = useMemo(() => {
    if (!blueprint || blueprint.length === 0) return null;

    const htmlFile = blueprint.find(f => f.path.endsWith('.html'));
    const cssFile = blueprint.find(f => f.path.endsWith('.css'));
    const jsFile = blueprint.find(f => f.path.endsWith('.js') || f.path.endsWith('.ts') || f.path.endsWith('.tsx') || f.path.endsWith('.jsx'));

    const runtimeInjections = `
      <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
      <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
      <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
      <script src="https://cdn.tailwindcss.com"></script>
    `;

    if (htmlFile) {
      let content = htmlFile.content;
      if (!content.includes('babel.min.js')) {
        content = content.replace('</head>', `${runtimeInjections}</head>`);
      }
      if (cssFile && !content.includes('<style>')) {
        content = content.replace('</head>', `<style>${cssFile.content}</style></head>`);
      }
      if (jsFile) {
        content = content.replace('</body>', `<script type="text/babel">${jsFile.content}</script></body>`);
      }
      return content;
    }

    if (jsFile) {
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8" />
            ${runtimeInjections}
            <style>
              body { margin: 0; padding: 0; font-family: sans-serif; background: #f4f4f5; color: #18181b; }
              #root { min-height: 100vh; }
              ${cssFile?.content || ''}
            </style>
          </head>
          <body>
            <div id="root"></div>
            <script type="text/babel">
              ${jsFile.content}
              const rootElement = document.getElementById('root');
              if (rootElement && typeof App !== 'undefined') {
                const root = ReactDOM.createRoot(rootElement);
                root.render(<App />);
              }
            </script>
          </body>
        </html>
      `;
    }
    return null;
  }, [blueprint]);

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      onRefresh();
      setIsLoading(false);
    }, 800);
  };

  const handleDeploy = () => {
    setIsDeploying(true);
    onLaunch?.();
    setTimeout(() => setIsDeploying(false), 3000);
  };

  const CurrentEnvIcon = ENV_CONFIG[targetEnv].icon;

  if (!blueprint || blueprint.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-[#0d0d0e]">
        <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mb-6 animate-pulse">
           <Layout className="w-8 h-8 text-zinc-700" />
        </div>
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-2">No Active Deployment</h2>
        <p className="text-xs text-zinc-600 max-w-xs text-center leading-relaxed">
          The Preview Plane is currently idle. Ask Steve to <code className="text-blue-500">synthesize a website</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0d0d0e] animate-in fade-in zoom-in-95 duration-500 relative">
      {/* Header - Fixed: Removed overflow-hidden to allow dropdowns to show */}
      <div className="h-14 border-b border-zinc-800 flex items-center px-4 space-x-3 bg-zinc-950/50 z-[100] shrink-0">
        <div className="flex items-center space-x-1 shrink-0">
           <button className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-600 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
           <button className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-600 transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>

        {/* Compact Dynamic Environment Selector */}
        <div className="relative shrink-0">
          <button 
            onClick={() => {
              setIsEnvDropdownOpen(!isEnvDropdownOpen);
              setIsResDropdownOpen(false);
              setIsInspectorDropdownOpen(false);
            }}
            className={`flex items-center space-x-2 px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-all shadow-lg group ${isEnvDropdownOpen ? 'bg-zinc-800 ring-1 ring-zinc-700' : ''}`}
            title={`Deployment Target: ${targetEnv}`}
          >
            <CurrentEnvIcon className={`w-4 h-4 ${ENV_CONFIG[targetEnv].color}`} />
            <ChevronDown className={`w-3 h-3 text-zinc-600 transition-transform ${isEnvDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isEnvDropdownOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-52 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-[110] p-1 animate-in fade-in slide-in-from-top-2">
              <div className="px-3 py-2 text-[8px] font-black text-zinc-600 uppercase tracking-widest border-b border-zinc-800/50 mb-1">Target Cluster</div>
              {(Object.keys(ENV_CONFIG) as Array<keyof typeof ENV_CONFIG>).map(env => {
                const Icon = ENV_CONFIG[env].icon;
                const isActive = targetEnv === env;
                return (
                  <button 
                    key={env}
                    onClick={() => { setTargetEnv(env); setIsEnvDropdownOpen(false); }}
                    className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-[10px] font-bold transition-all ${isActive ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'}`}
                  >
                    <div className={`p-1.5 rounded-md ${isActive ? ENV_CONFIG[env].bg : 'bg-zinc-950'}`}>
                      <Icon className={`w-3.5 h-3.5 ${ENV_CONFIG[env].color}`} />
                    </div>
                    <span>{env}</span>
                    {isActive && <div className="ml-auto w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,1)]" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Universal URL Bar */}
        <div className="flex-1 flex items-center bg-zinc-900/80 border border-zinc-800 rounded-xl px-3 py-1.5 space-x-2 group focus-within:border-blue-500/50 transition-all relative min-w-0">
          <Globe className="w-3.5 h-3.5 text-zinc-600 group-hover:text-blue-400 transition-colors shrink-0" />
          <span className="text-xs text-zinc-400 font-mono flex-1 truncate select-all">pulse-live-surface://{targetEnv.toLowerCase().replace(' ', '-')}.local</span>
          
          <button 
            onClick={() => setIsHealthDropdownOpen(!isHealthDropdownOpen)}
            className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 shrink-0"
          >
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
             <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Live</span>
             <ChevronDown className={`w-2.5 h-2.5 text-emerald-400 transition-transform ${isHealthDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Health Dropdown Overlay */}
          {isHealthDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 p-4 animate-in fade-in slide-in-from-top-2">
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                     <span className="text-[8px] font-bold text-zinc-500 uppercase">Latency</span>
                     <div className="text-sm font-mono text-emerald-400">14ms</div>
                  </div>
                  <div className="space-y-1">
                     <span className="text-[8px] font-bold text-zinc-500 uppercase">Uptime</span>
                     <div className="text-sm font-mono text-zinc-200">100%</div>
                  </div>
                  <div className="space-y-1">
                     <span className="text-[8px] font-bold text-zinc-500 uppercase">Synthesis Link</span>
                     <div className="text-sm font-mono text-blue-400">Secure</div>
                  </div>
                  <div className="space-y-1">
                     <span className="text-[8px] font-bold text-zinc-500 uppercase">Environment</span>
                     <div className="text-sm font-mono text-zinc-200">{targetEnv}</div>
                  </div>
               </div>
            </div>
          )}
        </div>

        {/* Global Controls Group */}
        <div className="flex items-center space-x-2 shrink-0">
           {/* Resolution Selector */}
           <div className="relative">
              <button 
                onClick={() => {
                  setIsResDropdownOpen(!isResDropdownOpen);
                  setIsEnvDropdownOpen(false);
                  setIsInspectorDropdownOpen(false);
                }}
                className="flex items-center space-x-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] font-bold text-zinc-400 hover:text-white transition-all shadow-lg"
              >
                <span>{resolution}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isResDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {isResDropdownOpen && (
                <div className="absolute top-full right-0 mt-1 w-32 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-[110] p-1 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  {resolutions.map(res => (
                    <button 
                      key={res}
                      onClick={() => { setResolution(res); setIsResDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold transition-all ${resolution === res ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              )}
           </div>

           <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
              <button onClick={() => setViewMode('desktop')} className={`p-1.5 rounded-md transition-all ${viewMode === 'desktop' ? 'bg-zinc-800 text-blue-400' : 'text-zinc-600'}`}><Monitor className="w-3.5 h-3.5" /></button>
              <button onClick={() => setViewMode('mobile')} className={`p-1.5 rounded-md transition-all ${viewMode === 'mobile' ? 'bg-zinc-800 text-blue-400' : 'text-zinc-600'}`}><Smartphone className="w-3.5 h-3.5" /></button>
           </div>
           
           <button onClick={handleRefresh} className={`p-2 hover:bg-zinc-800 rounded-lg text-zinc-600 hover:text-blue-400 transition-colors ${isLoading ? 'animate-spin' : ''}`}>
             <RefreshCw className="w-4 h-4" />
           </button>

           <div className="w-px h-6 bg-zinc-800 mx-1" />

           {/* SHIP / LAUNCH BUTTON - This launches the SOMA deployment task */}
           <button 
              onClick={handleDeploy}
              disabled={isDeploying}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-lg ${isDeploying ? 'bg-zinc-800 text-zinc-500' : 'bg-orange-500 hover:bg-orange-400 text-white shadow-orange-500/20'}`}
           >
             {isDeploying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
             <span>{isDeploying ? 'Shipping...' : 'Ship'}</span>
           </button>

           <div className="w-px h-6 bg-zinc-800 mx-1" />

           {/* Refined Inspector Dropdown (Icon First) */}
           <div className="relative">
              <button 
                onClick={() => {
                  setIsInspectorDropdownOpen(!isInspectorDropdownOpen);
                  setIsEnvDropdownOpen(false);
                  setIsResDropdownOpen(false);
                }}
                className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${isInspectorOpen ? 'bg-blue-600 text-white border border-blue-500 shadow-lg shadow-blue-500/20' : 'bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white'}`}
                title="Surgical Inspector"
              >
                <Search className="w-4 h-4" />
                <ChevronDown className={`w-3 h-3 transition-transform ${isInspectorDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isInspectorDropdownOpen && (
                <div className="absolute top-full right-0 mt-1.5 w-52 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-[120] p-1 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <div className="px-3 py-2 text-[8px] font-black text-zinc-600 uppercase tracking-widest border-b border-zinc-800/50 mb-1">Inspector Mode</div>
                  <button 
                    onClick={() => { setInspectorMode('blueprint'); setIsInspectorOpen(true); setIsInspectorDropdownOpen(false); }}
                    className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-[10px] font-bold transition-all ${inspectorMode === 'blueprint' && isInspectorOpen ? 'bg-blue-600 text-white shadow-xl' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`}
                  >
                    <Code className="w-3.5 h-3.5" />
                    <span>Blueprint Assets</span>
                  </button>
                  <button 
                    onClick={() => { setInspectorMode('styles'); setIsInspectorOpen(true); setIsInspectorDropdownOpen(false); }}
                    className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-[10px] font-bold transition-all ${inspectorMode === 'styles' && isInspectorOpen ? 'bg-blue-600 text-white shadow-xl' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`}
                  >
                    <Layout className="w-3.5 h-3.5" />
                    <span>Styles & Layout</span>
                  </button>
                  <button 
                    onClick={() => { setInspectorMode('context'); setIsInspectorOpen(true); setIsInspectorDropdownOpen(false); }}
                    className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-[10px] font-bold transition-all ${inspectorMode === 'context' && isInspectorOpen ? 'bg-blue-600 text-white shadow-xl' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`}
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>Runtime Context</span>
                  </button>
                  <div className="border-t border-zinc-800 my-1" />
                  <button 
                    onClick={() => { setIsInspectorOpen(!isInspectorOpen); setIsInspectorDropdownOpen(false); }}
                    className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-[10px] font-bold text-rose-400 hover:bg-rose-500/10 transition-all"
                  >
                    {isInspectorOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
                    <span>{isInspectorOpen ? 'Close Panel' : 'Open Inspector'}</span>
                  </button>
                </div>
              )}
           </div>
           
           <button 
            onClick={() => setIsConsoleOpen(!isConsoleOpen)} 
            className={`p-2 rounded-lg transition-all ${isConsoleOpen ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-600 hover:text-zinc-300'}`}
            title="Runtime Console"
           >
             <Terminal className="w-4 h-4" />
           </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 p-4 md:p-8 flex flex-col items-center justify-center bg-zinc-950/30 overflow-auto relative">
           <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: `radial-gradient(circle, #27272a 1px, transparent 1px)`, backgroundSize: '32px 32px' }} />

           <div className={`bg-white rounded-xl shadow-2xl border border-zinc-800/50 transition-all duration-500 overflow-hidden relative ${viewMode === 'mobile' ? 'w-[375px] h-[667px]' : 'w-full h-full'}`}>
              {isLoading || isDeploying ? (
                <div className="absolute inset-0 bg-white flex flex-col items-center justify-center z-20">
                   <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                   <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                     {isDeploying ? 'Pushing to Global Edge' : 'Refreshing Runtime'}
                   </span>
                </div>
              ) : renderedContent ? (
                <iframe 
                  key={renderedContent.length}
                  title="Pulse Runtime Preview"
                  srcDoc={renderedContent}
                  className="w-full h-full border-none"
                  sandbox="allow-scripts allow-forms allow-modals"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-50">
                   <Sparkles className="w-8 h-8 text-blue-500/20 mb-4" />
                   <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Awaiting Synthesis</span>
                </div>
              )}
           </div>

           {/* Console Drawer (Bottom Sheet) */}
           <div className={`absolute bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-800 transition-all duration-300 z-30 ${isConsoleOpen ? 'h-48' : 'h-0 overflow-hidden'}`}>
              <div className="h-8 border-b border-zinc-900 flex items-center px-4 justify-between bg-zinc-950">
                 <div className="flex items-center space-x-2 text-emerald-400 text-[9px] font-black uppercase tracking-widest">
                    <Terminal className="w-3 h-3" />
                    <span>Runtime Event Log</span>
                 </div>
                 <button onClick={() => setIsConsoleOpen(false)} className="text-zinc-600 hover:text-white transition-colors">
                    <ChevronDown className="w-4 h-4" />
                 </button>
              </div>
              <div className="p-4 overflow-y-auto h-40 font-mono text-[10px] space-y-1.5 custom-scrollbar">
                 {runtimeLogs.map((log, i) => (
                   <div key={i} className="flex items-start space-x-3 group">
                      <span className="text-zinc-700 w-12 text-right">{log.time}</span>
                      <span className={log.type === 'success' ? 'text-emerald-400' : log.type === 'warning' ? 'text-amber-400' : 'text-zinc-400'}>
                        {log.msg}
                      </span>
                   </div>
                 ))}
                 <div className="flex items-center space-x-2 text-blue-400/50 italic py-1 animate-pulse">
                    <Zap className="w-3 h-3" />
                    <span>Monitoring live cluster traffic ({targetEnv})...</span>
                 </div>
              </div>
           </div>
        </div>

        {/* Inspector Sidebar */}
        <div className={`border-l border-zinc-800 bg-zinc-950 flex flex-col shrink-0 transition-all duration-300 ease-in-out overflow-hidden h-full ${isInspectorOpen ? 'w-80' : 'w-0'}`}>
           <div className="h-12 border-b border-zinc-800 flex items-center px-4 justify-between bg-zinc-900/20 shrink-0 min-w-[320px]">
              <div className="flex items-center space-x-3">
                 {inspectorMode === 'blueprint' && <Code className="w-3.5 h-3.5 text-blue-400" />}
                 {inspectorMode === 'styles' && <Layout className="w-3.5 h-3.5 text-emerald-400" />}
                 {inspectorMode === 'context' && <Database className="w-3.5 h-3.5 text-amber-400" />}
                 <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                    {inspectorMode === 'blueprint' ? 'Blueprint Assets' : inspectorMode === 'styles' ? 'Style Rules' : 'Runtime Context'}
                 </span>
              </div>
              <div className="flex items-center space-x-2">
                {inspectorMode === 'blueprint' && (
                  <button onClick={onAddFile} className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-emerald-400 transition-colors" title="Add File">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => setIsInspectorOpen(false)} className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-600">
                   <PanelRightClose className="w-4 h-4" />
                </button>
              </div>
           </div>
           
           <div className="flex-1 overflow-y-auto custom-scrollbar min-w-[320px]">
              {inspectorMode === 'blueprint' ? (
                <div className="p-4 space-y-4">
                  {blueprint.map((file, i) => (
                    <div key={i} className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl flex items-center justify-between group cursor-pointer hover:border-blue-500/30 transition-all">
                       <div className="flex items-center space-x-3 min-w-0">
                          <Code className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="text-[10px] font-mono text-zinc-300 truncate">{file.path}</span>
                       </div>
                       <div className="text-[8px] font-bold text-zinc-600 uppercase group-hover:text-zinc-400 transition-colors">{file.language}</div>
                    </div>
                  ))}
                </div>
              ) : inspectorMode === 'styles' ? (
                <div className="p-4 space-y-6">
                   <div className="space-y-3">
                      <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Global Variables</div>
                      <div className="space-y-2">
                         {['--primary', '--secondary', '--accent'].map(v => (
                           <div key={v} className="flex items-center justify-between p-2 bg-zinc-900/50 border border-zinc-800 rounded-lg">
                              <span className="text-[9px] font-mono text-zinc-400">{v}</span>
                              <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                           </div>
                         ))}
                      </div>
                   </div>
                   <div className="space-y-3">
                      <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Active Media Queries</div>
                      <div className="flex items-center space-x-2 p-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                         <ShieldCheck className="w-3 h-3 text-emerald-400" />
                         <span className="text-[9px] font-mono text-emerald-300">screen and (min-width: 1024px)</span>
                      </div>
                   </div>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                   <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                         <span className="text-[9px] font-bold text-zinc-500 uppercase">React Version</span>
                         <span className="text-[10px] font-mono text-blue-400">18.2.0</span>
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-[9px] font-bold text-zinc-500 uppercase">Hydration State</span>
                         <span className="text-[10px] font-mono text-emerald-400">Stable</span>
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-[9px] font-bold text-zinc-500 uppercase">Shadow Link</span>
                         <span className="text-[10px] font-mono text-amber-400">Synchronized</span>
                      </div>
                   </div>
                   <div className="p-4 bg-zinc-900/40 border border-zinc-800/50 border-dashed rounded-xl">
                      <div className="flex items-center space-x-2 text-zinc-600 mb-2">
                         <Info className="w-3 h-3" />
                         <span className="text-[9px] font-bold uppercase tracking-widest">Tip</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 leading-relaxed italic">
                        Context monitoring allows you to track variable mutation across shadow nodes.
                      </p>
                   </div>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default PreviewPlane;
