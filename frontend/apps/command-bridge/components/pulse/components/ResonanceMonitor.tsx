import React, { useEffect, useState, useRef } from 'react';
import { pulseClient } from '../services/PulseClient';
import { Activity, Zap, Heart } from 'lucide-react';

/**
 * ResonanceMonitor — Visualizes SOMA's 400ms cognitive heartbeat.
 * Synchronized with the backend 'system.resonance.pulse' event.
 */
const ResonanceMonitor: React.FC<{ isCollapsed: boolean }> = ({ isCollapsed }) => {
  const [pulse, setPulse] = useState<{ score: number, driftMs: number, bufferSize: number } | null>(null);
  const [lastPulseAt, setLastPulseAt] = useState<number>(Date.now());
  const [isBeating, setIsBeating] = useState(false);
  
  const pulseRef = useRef<any>(null);

  useEffect(() => {
    const handlePulse = (data: any) => {
      setPulse(data);
      setLastPulseAt(Date.now());
      setIsBeating(true);
      setTimeout(() => setIsBeating(false), 200);
    };

    pulseClient.on('resonance_pulse', handlePulse);
    return () => pulseClient.off('resonance_pulse', handlePulse);
  }, []);

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center py-4 space-y-4 border-t border-zinc-900/50 mt-4">
        <div className={`transition-all duration-300 ${isBeating ? 'scale-125 text-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.5)]' : 'scale-100 text-zinc-700'}`}>
          <Heart className="w-4 h-4 fill-current" />
        </div>
      </div>
    );
  }

  const resonanceScore = pulse?.score || 0.5;
  const drift = pulse?.driftMs || 0;
  const status = resonanceScore > 0.8 ? 'FLOW' : resonanceScore < 0.4 ? 'STAGNANT' : 'COHERENT';
  const statusColor = resonanceScore > 0.8 ? 'text-emerald-400' : resonanceScore < 0.4 ? 'text-amber-400' : 'text-blue-400';

  return (
    <div className="px-4 py-6 border-t border-zinc-900/50 mt-4 space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Activity className={`w-3.5 h-3.5 ${statusColor} transition-all duration-300 ${isBeating ? 'scale-110' : 'scale-100'}`} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Cognitive Resonance</span>
        </div>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border border-current bg-current/5 ${statusColor} opacity-80`}>
          {status}
        </span>
      </div>

      <div className="bg-zinc-950/50 border border-zinc-900 rounded-lg p-3 space-y-3">
        {/* Heartbeat Visualization */}
        <div className="h-8 flex items-center justify-center relative overflow-hidden">
           <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/5 to-transparent transition-transform duration-400 ease-linear ${isBeating ? 'translate-x-full' : '-translate-x-full'}`} />
           <div className="flex items-end space-x-0.5 h-full">
             {Array.from({ length: 20 }).map((_, i) => (
                <div 
                  key={i} 
                  className={`w-1 rounded-full transition-all duration-300 ${isBeating ? 'bg-blue-400' : 'bg-zinc-800'}`}
                  style={{ 
                    height: `${Math.max(10, Math.sin((i / 20) * Math.PI) * (resonanceScore * 100))}%`,
                    opacity: 0.3 + (Math.sin((i / 20) * Math.PI) * 0.7)
                  }}
                />
             ))}
           </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-0.5">
            <span className="text-[8px] text-zinc-600 uppercase font-bold tracking-tighter">Density</span>
            <div className="text-xs font-mono text-zinc-300">{(resonanceScore * 100).toFixed(1)}%</div>
          </div>
          <div className="space-y-0.5">
             <span className="text-[8px] text-zinc-600 uppercase font-bold tracking-tighter">Jitter</span>
             <div className={`text-xs font-mono ${Math.abs(drift) > 50 ? 'text-red-400' : 'text-zinc-400'}`}>
               {drift > 0 ? '+' : ''}{drift}ms
             </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${statusColor.replace('text', 'bg')}`}
            style={{ width: `${resonanceScore * 100}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-[8px] font-medium text-zinc-600 px-1 uppercase tracking-widest">
        <div className="flex items-center space-x-1">
          <div className={`w-1 h-1 rounded-full ${isBeating ? 'bg-pink-500 animate-ping' : 'bg-zinc-800'}`} />
          <span>400ms Rhythm</span>
        </div>
        <span>SOMA-OS v4.5</span>
      </div>
    </div>
  );
};

export default ResonanceMonitor;
