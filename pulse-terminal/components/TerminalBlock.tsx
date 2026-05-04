
import React, { useState } from 'react';
import { TerminalBlock, SearchStep, BlueprintFile } from '../types';
import ReasoningBlock from './ReasoningBlock';
import CognitiveArtifact from './CognitiveArtifact';
import { 
  Check, 
  AlertCircle, 
  Play, 
  Copy, 
  Rocket, 
  Zap, 
  Loader2, 
  ChevronRight, 
  ShieldCheck,
  Search,
  Activity,
  Crown,
  Cpu,
  Eye,
  Square,
  Layers,
  File,
  Folder,
  FileSearch,
  Code,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface Props {
  block: TerminalBlock;
  onExecute: (cmd: string) => void;
  onDeploy?: () => void;
  onStopSoma?: () => void;
  onSyncBlueprint?: (files: BlueprintFile[]) => void;
}

const CodeSurface: React.FC<{ file: BlueprintFile }> = ({ file }) => {
  const lines = file.content.split('\n');
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono px-2 py-1 bg-zinc-950/40 rounded-t-lg border-b border-zinc-800/50">
        <span className="flex items-center space-x-2">
          <File className="w-3 h-3 text-blue-400" />
          <span className="text-zinc-300 font-bold">{file.path}</span>
        </span>
        <div className="flex items-center space-x-3">
           <span className="text-[9px] opacity-40">{file.language}</span>
           <button 
             onClick={() => navigator.clipboard.writeText(file.content)}
             className="hover:text-blue-400 transition-colors"
           >
             <Copy className="w-3 h-3" />
           </button>
        </div>
      </div>
      <div className="relative group bg-black/60 border border-zinc-800/50 rounded-b-lg overflow-hidden">
        <div className="flex font-mono text-[10px] leading-relaxed py-3">
          {/* Line Numbers */}
          <div className="w-10 select-none text-right pr-3 text-zinc-700 border-r border-zinc-900 bg-zinc-950/20 shrink-0">
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          {/* Code Content */}
          <pre className="flex-1 px-4 overflow-x-auto custom-scrollbar text-zinc-400 selection:bg-blue-500/30">
            <code>
              {lines.map((line, i) => (
                <div key={i} className="whitespace-pre hover:bg-zinc-800/30 transition-colors px-1 -mx-1">{line || ' '}</div>
              ))}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
};

const TerminalBlockView: React.FC<Props> = ({ block, onExecute, onDeploy, onStopSoma, onSyncBlueprint }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const renderSearchStep = (step: SearchStep, index: number) => {
    const isFile = step.path.includes('.');
    return (
      <div key={index} className="flex items-center space-x-3 py-1 group animate-in fade-in slide-in-from-left-1 duration-200">
        <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
          {step.status === 'scanning' ? (
            <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
          ) : step.status === 'matched' ? (
            <Check className="w-3 h-3 text-emerald-500" />
          ) : step.status === 'found' ? (
            <Check className="w-3 h-3 text-blue-400" />
          ) : (
            <div className="w-1 h-1 bg-zinc-700 rounded-full" />
          )}
        </div>
        <div className={`flex items-center space-x-2 font-mono text-[10px] transition-colors ${
          step.status === 'matched' ? 'text-emerald-400' :
          step.status === 'skipped' ? 'text-zinc-600' : 'text-zinc-400'
        }`}>
          {isFile ? <File className="w-3 h-3 opacity-50" /> : <Folder className="w-3 h-3 opacity-50" />}
          <span className="truncate">{step.path}</span>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (block.type) {
      case 'command':
        return (
          <div className="flex items-center space-x-3 text-zinc-100 font-mono font-medium opacity-90 pl-3 border-l-2 border-blue-500 shadow-[inset_10px_0_15px_-10px_rgba(59,130,246,0.1)]">
            <span className="text-blue-500">❯</span>
            <span>{block.content}</span>
            <span className="text-[9px] text-zinc-700 ml-auto font-normal">{new Date(block.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
        );

      case 'code-gen':
        const blueprint = block.metadata?.blueprint || [];
        return (
          <div className="bg-[#121214] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-2">
            <div className="p-4 border-b border-zinc-800/50 bg-zinc-950/50 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <Code className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-[10px] font-black text-zinc-100 uppercase tracking-widest">Architectural Blueprint</h4>
                  <p className="text-[9px] text-zinc-500 font-mono tracking-tighter">Manifest: {blueprint.length} artifacts synthesized</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => onSyncBlueprint?.(blueprint)}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Sync Surface</span>
                </button>
                <button 
                  onClick={() => setIsExpanded(!isExpanded)}
                  className={`p-2 rounded-lg transition-all ${isExpanded ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-800 text-zinc-500'}`}
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className={`p-4 space-y-4 overflow-hidden transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 py-0'}`}>
              {blueprint.map((file, i) => (
                <CodeSurface key={i} file={file} />
              ))}
            </div>
            
            {!isExpanded && (
               <div className="px-4 py-3 bg-zinc-950/20 flex items-center space-x-6 overflow-x-auto custom-scrollbar no-scrollbar border-t border-zinc-800/30">
                  {blueprint.map((file, i) => (
                    <div key={i} className="flex items-center space-x-2 text-[9px] text-zinc-500 whitespace-nowrap group cursor-pointer hover:text-zinc-300 transition-colors">
                       <File className="w-3 h-3 opacity-40 group-hover:text-blue-400 group-hover:opacity-100 transition-all" />
                       <span className="font-mono">{file.path}</span>
                    </div>
                  ))}
               </div>
            )}
          </div>
        );

      case 'soma-task':
        const task = block.metadata?.soma;
        if (!task) return null;
        return (
          <div className={`bg-zinc-900 border rounded-2xl overflow-hidden shadow-2xl transition-all duration-500 ${
            task.state === 'stopped' ? 'border-rose-500/30 grayscale' : 
            task.state === 'completed' ? 'border-emerald-500/30' : 'border-blue-500/30'
          }`}>
             <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
                <div className="flex items-center space-x-3">
                   <div className={`p-2 rounded-lg ${
                     task.state === 'stopped' ? 'bg-rose-500/10 text-rose-400' : 
                     task.state === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'
                   }`}>
                      {task.state === 'running' ? <Activity className="w-4 h-4 animate-pulse" /> : <Rocket className="w-4 h-4" />}
                   </div>
                   <div>
                      <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-widest">SOMA: {task.name}</h4>
                   </div>
                </div>
                {task.state === 'running' && (
                  <button onClick={onStopSoma} className="flex items-center space-x-2 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all">
                    <Square className="w-3 h-3 fill-current" />
                    <span>STOP</span>
                  </button>
                )}
             </div>
             <div className="p-5 space-y-4">
                <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase">
                   <span className="flex items-center space-x-2">
                      <ChevronRight className="w-3 h-3 text-blue-500" />
                      <span>{task.stepLabel}</span>
                   </span>
                   <span className="font-mono">{Math.round((task.currentStep / task.totalSteps) * 100)}%</span>
                </div>
                <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                   <div className={`h-full transition-all duration-700 ${task.state === 'stopped' ? 'bg-rose-500' : task.state === 'completed' ? 'bg-emerald-500' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'}`} style={{ width: `${(task.currentStep / task.totalSteps) * 100}%` }} />
                </div>
             </div>
          </div>
        );

      default:
        // Intervention Watchdog Block
        if (block.metadata?.intervention) {
          const { originalCmd, fixCmd, reason } = block.metadata.intervention;
          return (
            <div className="my-2 bg-rose-950/20 border border-rose-500/30 rounded-xl p-4 animate-pulse-slow">
              <div className="flex items-center space-x-2 text-rose-400 font-bold text-xs uppercase tracking-widest mb-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Intervention Protocol Active</span>
              </div>
              <p className="text-zinc-400 text-xs mb-3">{reason}</p>
              <div className="flex flex-col gap-2 font-mono text-[10px]">
                <div className="flex items-center gap-2 opacity-50 line-through text-zinc-500">
                  <span className="text-rose-500">FAILED:</span> {originalCmd}
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <span className="text-emerald-500">EXECUTING:</span> {fixCmd}
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="flex flex-col space-y-2">
            {block.metadata?.reasoning && (
              <ReasoningBlock steps={block.metadata.reasoning} isThinking={block.status === 'running'} />
            )}
            
            <div className="flex items-start space-x-4 group">
              <div className="w-0.5 h-full bg-zinc-800 group-hover:bg-zinc-700 transition-colors mt-2 rounded-full" />
              <div className="text-zinc-400 text-xs whitespace-pre-wrap flex-1 leading-relaxed py-1 opacity-90 select-text selection:bg-zinc-800">
                {block.content}
              </div>
            </div>

            {block.metadata?.artifacts && (
              <div className="space-y-4 pl-4">
                {block.metadata.artifacts.map((file, i) => (
                  <CognitiveArtifact 
                    key={i} 
                    file={file} 
                    onApply={() => onSyncBlueprint?.([file])} 
                  />
                ))}
              </div>
            )}
          </div>
        );
    }
  };

  return <div className="group animate-in fade-in slide-in-from-bottom-2 duration-400 ease-out">{renderContent()}</div>;
};

export default TerminalBlockView;
