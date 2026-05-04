
import React from 'react';
import { Vulnerability, ComplianceCheck } from '../types';
import { ShieldCheck, AlertTriangle, CheckCircle, Lock, AlertOctagon, XCircle } from 'lucide-react';

interface Props {
  score: number;
  vulnerabilities: Vulnerability[];
  compliance: ComplianceCheck[];
}

const SecurityPanel: React.FC<Props> = ({ score, vulnerabilities, compliance }) => {
  return (
    <div className="p-4 space-y-6 animate-in fade-in duration-500">
      {/* Security Score Header */}
      <div className="flex items-center justify-between bg-zinc-900/40 p-4 rounded-xl border border-zinc-800">
        <div className="flex items-center space-x-4">
          <div className={`p-3 rounded-full ${score >= 90 ? 'bg-emerald-500/10 text-emerald-500' : score >= 70 ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'}`}>
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-200">Security Audit Score</h2>
            <p className="text-[10px] text-zinc-500">Real-time threat assessment</p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-mono font-bold ${score >= 90 ? 'text-emerald-500' : score >= 70 ? 'text-amber-500' : 'text-rose-500'}`}>
            {score}/100
          </div>
        </div>
      </div>

      {/* Vulnerabilities Section */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center space-x-2">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Active Vulnerabilities</span>
        </h3>
        <div className="space-y-2">
          {vulnerabilities.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-zinc-800 rounded-xl">
              <CheckCircle className="w-8 h-8 mx-auto text-emerald-500/20 mb-2" />
              <p className="text-[10px] text-zinc-500">No active vulnerabilities detected</p>
            </div>
          ) : (
            vulnerabilities.map(vuln => (
              <div key={vuln.id} className="flex items-start justify-between p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg group hover:border-zinc-700 transition-all">
                <div className="flex items-start space-x-3">
                  <AlertOctagon className={`w-4 h-4 mt-0.5 ${
                    vuln.severity === 'critical' ? 'text-rose-500' : 
                    vuln.severity === 'high' ? 'text-orange-500' : 
                    vuln.severity === 'medium' ? 'text-amber-500' : 'text-blue-500'
                  }`} />
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-zinc-300">{vuln.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border ${
                        vuln.severity === 'critical' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 
                        vuln.severity === 'high' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' : 
                        vuln.severity === 'medium' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                      }`}>
                        {vuln.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">{vuln.description}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-[9px] uppercase font-bold ${vuln.status === 'open' ? 'text-rose-500' : 'text-zinc-600'}`}>
                    {vuln.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Compliance Section */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center space-x-2">
          <Lock className="w-3.5 h-3.5" />
          <span>Compliance Checks</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {compliance.map(check => (
            <div key={check.id} className="flex items-center justify-between p-2.5 bg-zinc-900/30 border border-zinc-800 rounded-lg">
              <span className="text-[10px] text-zinc-300 font-mono">{check.name}</span>
              {check.status === 'passed' ? (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              ) : check.status === 'failed' ? (
                <XCircle className="w-3.5 h-3.5 text-rose-500" />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-zinc-700 border-t-zinc-400 animate-spin" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SecurityPanel;
