import React, { useEffect, useState } from 'react';
import { DollarSign, Activity, Shield, TrendingUp, BriefcaseBusiness } from 'lucide-react';

const money = (value) => {
  const number = Number(value || 0);
  return `${number < 0 ? '-' : ''}$${Math.abs(number).toFixed(2)}`;
};

const EconomicSovereigntyMonitor = ({ isConnected }) => {
  const [performance, setPerformance] = useState(null);
  const [runtime, setRuntime] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isConnected) return;
    let active = true;
    const fetchStats = async () => {
      try {
        const [summaryRes, runtimeRes] = await Promise.allSettled([
          fetch('/api/trading/summary').then(res => res.ok ? res.json() : Promise.reject(new Error(`Trading HTTP ${res.status}`))),
          fetch('/api/mission-control/runtime').then(res => res.ok ? res.json() : Promise.reject(new Error(`Runtime HTTP ${res.status}`)))
        ]);
        if (!active) return;
        if (summaryRes.status === 'fulfilled') setPerformance(summaryRes.value.summary || null);
        if (runtimeRes.status === 'fulfilled') setRuntime(runtimeRes.value.runtime || null);
        if (summaryRes.status === 'rejected' && runtimeRes.status === 'rejected') {
          setError('Mission Control data unavailable');
        } else {
          setError(null);
        }
      } catch (e) {
        if (active) setError(e.message);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isConnected]);

  const pnl = Number(performance?.total_pnl || 0);
  const tier = runtime?.activeTier || runtime?.mode || 'paper';
  const strategy = runtime?.activeStrategy?.strategyName || 'No promoted strategy';
  const trades = performance?.total_trades || 0;

  return (
    <div className="p-5 border border-emerald-500/15 rounded-xl bg-[#151518]/60 backdrop-blur-md shadow-lg h-[200px] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-400 flex items-center">
          <DollarSign className="w-3 h-3 mr-1" /> Mission Capital
        </h3>
        <span className="text-[9px] uppercase tracking-widest text-zinc-500">{tier}</span>
      </div>

      {!isConnected && <div className="text-xs text-zinc-600 py-5 text-center">Offline</div>}
      {isConnected && !performance && !runtime && !error && (
        <div className="text-xs text-zinc-600 py-5 text-center animate-pulse">Loading trading evidence...</div>
      )}
      {error && !performance && !runtime && <div className="text-xs text-red-400 py-5 text-center">{error}</div>}

      {(performance || runtime) && (
        <>
          <div className="flex justify-between items-baseline mb-3">
            <span className="text-[10px] text-zinc-500 uppercase font-bold">Paper P&amp;L</span>
            <span className={`text-xl font-mono font-bold ${pnl < 0 ? 'text-red-400' : pnl > 0 ? 'text-emerald-400' : 'text-zinc-300'}`}>
              {money(pnl)}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-black/20 p-2 rounded border border-white/5">
              <div className="text-[9px] text-zinc-500 uppercase flex items-center"><Activity className="w-2.5 h-2.5 mr-1" /> Trades</div>
              <div className="text-xs font-mono text-zinc-100">{trades}</div>
            </div>
            <div className="bg-black/20 p-2 rounded border border-white/5">
              <div className="text-[9px] text-zinc-500 uppercase flex items-center"><TrendingUp className="w-2.5 h-2.5 mr-1" /> Win Rate</div>
              <div className="text-xs font-mono text-zinc-100">{Number(performance?.win_rate || 0).toFixed(1)}%</div>
            </div>
            <div className="bg-black/20 p-2 rounded border border-white/5">
              <div className="text-[9px] text-zinc-500 uppercase flex items-center"><Shield className="w-2.5 h-2.5 mr-1" /> Open</div>
              <div className="text-xs font-mono text-zinc-100">{performance?.open_trades || 0}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 min-w-0 text-[10px] text-zinc-500">
            <BriefcaseBusiness className="w-3 h-3 shrink-0" />
            <span className="truncate">{strategy}</span>
          </div>
        </>
      )}
    </div>
  );
};

export default EconomicSovereigntyMonitor;
