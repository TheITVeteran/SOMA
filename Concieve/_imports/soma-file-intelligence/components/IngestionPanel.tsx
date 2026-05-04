
import React, { useEffect, useRef } from 'react';
import { LogEntry, AppState } from '../types';

interface IngestionPanelProps {
  logs: LogEntry[];
  appState: AppState;
  progress: number;
}

const IngestionPanel: React.FC<IngestionPanelProps> = ({ logs, appState, progress }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-surface border-r border-border w-72 shrink-0 text-xs font-mono shadow-xl z-20">
      <div className="p-4 border-b border-border bg-background/50 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-text-secondary tracking-wider uppercase text-[10px]">Mesh Stream</h2>
            <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_10px_currentColor] transition-colors duration-500 ${
                appState === AppState.READY ? 'text-emerald-500' : 
                appState === AppState.IDLE ? 'text-text-muted' : 'text-teal-400 animate-pulse'
            } bg-current`}></div>
        </div>
        
        <div className="flex items-center justify-between text-[10px] text-text-muted mb-3 font-medium">
            <span>ACTIVITY</span>
            <span className={`uppercase font-bold ${appState === AppState.READY ? 'text-teal-400' : 'text-text-primary'}`}>{appState}</span>
        </div>

        <div className="w-full bg-surfaceHighlight h-1 rounded-full overflow-hidden">
            <div 
                className={`h-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(45,212,191,0.3)] ${appState === AppState.IDLE ? 'bg-transparent' : 'bg-teal-400'}`}
                style={{ width: `${Math.round(progress)}%` }}
            ></div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-background/30" ref={scrollRef}>
        {logs.length === 0 && (
            <div className="text-text-muted opacity-30 text-center mt-10 text-[10px]">
                // SYSTEM_IDLE
            </div>
        )}
        {logs.map((log, i) => (
          <div key={i} className="flex gap-2 break-all leading-relaxed transition-opacity group">
            <span className="text-text-muted select-none opacity-40 w-10 text-[9px] text-right shrink-0 mt-0.5 group-hover:opacity-100 transition-opacity">
                {new Date(log.timestamp).toLocaleTimeString([], {hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit'})}
            </span>
            <span className={`flex-1 ${
              log.type === 'error' ? 'text-rose-400' :
              log.type === 'success' ? 'text-teal-400' :
              log.type === 'warning' ? 'text-amber-400' : 'text-text-secondary'
            } opacity-90 group-hover:opacity-100`}>
              {i === logs.length - 1 && appState !== AppState.IDLE && <span className="mr-1 animate-pulse">›</span>}
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IngestionPanel;
