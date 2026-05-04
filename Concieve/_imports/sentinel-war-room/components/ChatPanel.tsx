
import React, { useState, useEffect, useRef } from 'react';
import { Audit, Message, MessageType } from '../types';
import { Icons, PARTICIPANTS } from '../constants';
import { analyzeAuditProgress } from '../services/gemini';

interface ChatPanelProps {
  audit: Audit;
  messages: Message[];
  onSendMessage: (text: string, type?: MessageType) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ audit, messages, onSendMessage, isOpen = true, onClose }) => {
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input, 'message');
      setInput('');
    }
  };

  const handleAIAnalysis = async () => {
    setIsAnalyzing(true);
    onSendMessage("Initiating tactical analysis of engagement status...", "ai");
    try {
      const result = await analyzeAuditProgress(audit);
      const aiResponseText = `Tactical Analysis: ${result.analysis}\n\nRecommendations:\n${result.recommendations.map(r => `• ${r}`).join('\n')}\n\nAssessed Threat Level: ${result.riskLevel}`;
      onSendMessage(aiResponseText, 'ai');
    } catch (e) {
      onSendMessage("Analysis sub-systems offline. Manual review advised.", "alert");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isOpen && window.innerWidth < 1024) return null;

  return (
    <div className={`fixed inset-y-0 right-0 w-full sm:w-96 lg:relative lg:w-96 border-l border-slate-200 bg-white flex flex-col h-full shadow-2xl z-50 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <h3 className="font-bold text-slate-900 tracking-tight">Comms Channel</h3>
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{audit.title}</div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleAIAnalysis}
            disabled={isAnalyzing}
            className={`p-2 rounded-lg transition-all ${isAnalyzing ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white shadow-sm'}`}
            title="Strategic AI Analysis"
          >
            <Icons.Zap size={18} className={isAnalyzing ? 'animate-spin' : ''} />
          </button>
          {onClose && (
            <button onClick={onClose} className="lg:hidden p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
              {/* Correctly rotating MoreVertical icon */}
              <Icons.MoreVertical size={20} className="rotate-90" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-white">
        {messages.map(msg => {
          // Resolve sender details from global PARTICIPANTS list
          const sender = PARTICIPANTS.find(p => p.id === msg.senderId) || PARTICIPANTS[4];
          return (
            <div key={msg.id} className="group flex space-x-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-[10px] font-black tracking-tighter shadow-md shrink-0 ${
                msg.type === 'ai' ? 'bg-gradient-to-br from-indigo-500 to-purple-700' : 'bg-slate-800'
              }`}>
                {msg.type === 'ai' ? 'AI' : (sender.avatar.length === 1 ? sender.avatar : <img src={sender.avatar} className="w-full h-full object-cover rounded-xl" alt="" />)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-slate-900">{sender.name}</span>
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">{msg.timestamp}</span>
                  </div>
                </div>
                <div className={`text-sm leading-relaxed whitespace-pre-wrap p-3 rounded-2xl border ${
                  msg.type === 'ai' 
                    ? 'bg-indigo-50/30 border-indigo-100 text-indigo-900' 
                    : msg.type === 'alert'
                    ? 'bg-rose-50/30 border-rose-100 text-rose-900 font-medium'
                    : 'bg-slate-50 border-slate-100 text-slate-700'
                }`}>
                  {msg.message}
                </div>
                {msg.attachments && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {msg.attachments.map((file, idx) => (
                      <div key={idx} className="flex items-center space-x-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-600 hover:border-blue-400 cursor-pointer shadow-sm transition-colors">
                        <Icons.Paperclip size={12} className="text-slate-400" />
                        <span>{file}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="p-5 border-t border-slate-100 bg-slate-50/50 pb-24 md:pb-5">
        <div className="flex items-end space-x-3">
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-inner focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all overflow-hidden">
            <textarea 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Transmit tactical data..."
              className="w-full px-4 py-3 bg-transparent resize-none focus:outline-none text-sm font-medium placeholder:text-slate-300 min-h-[44px] max-h-32"
              rows={1}
            />
            <div className="hidden sm:flex px-4 py-2 border-t border-slate-50 items-center justify-between">
              <div className="flex space-x-2">
                <button className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors">
                  <Icons.Paperclip size={16} />
                </button>
              </div>
              <div className="text-[10px] font-bold text-slate-300 uppercase">Secure Link</div>
            </div>
          </div>
          <button 
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-4 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-500/20 hover:bg-blue-700 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all shrink-0"
          >
            <Icons.Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
