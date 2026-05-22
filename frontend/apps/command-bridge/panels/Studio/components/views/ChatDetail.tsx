import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Phone, Video, Info, Image as ImageIcon, Mic, Sticker, Heart, Search, X } from 'lucide-react';
import { ChatSession, ChatMessage, IdentityProfile } from '../../types';
import { getDirectMessages, searchDirectMessages, sendDirectMessage } from '../../services/directsService';
import { stableAvatar } from '../../services/avatarService';
import IdentityChip from '../identity/IdentityChip';

interface Props {
  chat: ChatSession;
  onBack: () => void;
  currentUserAvatar: string;
}

const ChatDetail: React.FC<Props> = ({ chat, onBack, currentUserAvatar }) => {
  const chatAvatar = stableAvatar({ id: chat.id, title: chat.title, image: chat.image });
  const userAvatar = stableAvatar({ id: 'studio-user', name: 'You', image: currentUserAvatar });
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'other',
      text: "Did you see the new update?",
      timestamp: '10:02 AM',
      avatar: chatAvatar
    },
    {
      id: '2',
      sender: 'user',
      text: "Yeah looks amazing! The dark mode is perfect.",
      timestamp: '10:05 AM',
    },
    {
      id: '3',
      sender: 'other',
      text: "Sending you the files now.",
      timestamp: '10:11 AM',
      avatar: chatAvatar
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  useEffect(() => {
      let cancelled = false;
      getDirectMessages(chat)
          .then(nextMessages => {
              if (!cancelled && Array.isArray(nextMessages)) setMessages(nextMessages);
          })
          .catch(() => {});
      return () => { cancelled = true; };
  }, [chat.id]);

  useEffect(() => {
      let cancelled = false;
      if (!searchQuery.trim()) {
          setSearchResults([]);
          return () => { cancelled = true; };
      }
      const timer = window.setTimeout(() => {
          searchDirectMessages(chat, searchQuery)
              .then(results => {
                  if (!cancelled) setSearchResults(results);
              })
              .catch(() => {
                  if (!cancelled) setSearchResults([]);
              });
      }, 180);
      return () => {
          cancelled = true;
          window.clearTimeout(timer);
      };
  }, [chat, searchQuery]);

  const localSearchResults = useMemo(() => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return [];
      return messages
          .filter(message => message.text.toLowerCase().includes(q))
          .slice(-12)
          .map(message => ({ id: message.id, text: message.text, timestamp: message.timestamp, senderName: message.sender === 'user' ? 'You' : chat.title }));
  }, [chat.title, messages, searchQuery]);

  const visibleSearchResults = searchResults.length ? searchResults : localSearchResults;

  const jumpToMessage = (id: string) => {
      setHighlightedId(id);
      messageRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => setHighlightedId(null), 1400);
  };

  const handleSend = async () => {
      if(!inputText.trim()) return;
      const newMsg: ChatMessage = {
          id: Date.now().toString(),
          sender: 'user',
          text: inputText,
          timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      };
      setMessages(prev => [...prev, newMsg]);
      setInputText('');
      try {
          const nextMessages = await sendDirectMessage(chat, newMsg.text, userAvatar);
          if (Array.isArray(nextMessages)) setMessages(nextMessages);
      } catch {}
  };

  const handleSubmit = (event: React.FormEvent) => {
      event.preventDefault();
      handleSend();
  };

  const handleAction = (action: string) => {
      window.dispatchEvent(new CustomEvent('axis:action', { detail: { action, chatId: chat.id, chat } }));
  };

  const openInAxis = () => {
      const detail = { module: 'axis', channelId: chat.id, workspaceId: chat.workspaceId, type: 'dm', isDirect: true };
      localStorage.setItem('axis:pending-channel', JSON.stringify(detail));
      localStorage.setItem('axis:pending-direct-home', JSON.stringify({ directId: chat.id, workspaceId: chat.workspaceId }));
      window.dispatchEvent(new CustomEvent('commandbridge:navigate', { detail }));
      window.dispatchEvent(new CustomEvent('soma:navigate', { detail }));
      window.dispatchEvent(new CustomEvent('axis:navigate-channel', { detail }));
      window.dispatchEvent(new CustomEvent('axis:open-direct-home', { detail: { directId: chat.id, workspaceId: chat.workspaceId } }));
  };

  const identity: IdentityProfile = {
      id: String(chat.id),
      name: chat.title,
      handle: chat.members || chat.title,
      avatar: chatAvatar,
      role: chat.axisSource === 'axis' ? 'Axis Direct' : 'Studio Direct',
      status: chat.online ? 'online' : 'offline',
      source: 'direct',
      recentActivity: chat.lastMessage || chat.messagesCount,
      mutualSpaces: ['Studio', 'Axis', 'Directs'],
  };

  const openStudioSpace = (profile: IdentityProfile) => {
      window.dispatchEvent(new CustomEvent('app:navigate', { detail: { view: 'studio-space', context: { identity: profile } } }));
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black z-50">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="text-white p-1 -ml-1 hover:opacity-70 transition-opacity">
                    <ArrowLeft size={28} />
                </button>
                <IdentityChip identity={identity} compact={false} onOpenStudio={openStudioSpace} />
            </div>
            <div className="flex items-center gap-6 pr-1">
                {chat.axisSource === 'axis' && (
                    <button onClick={openInAxis} title="Open in Axis" className="hover:opacity-70 transition-opacity">
                        <Info size={24} strokeWidth={1.5} />
                    </button>
                )}
                <button onClick={() => setSearchOpen(prev => !prev)} title="Search Direct" className="hover:opacity-70 transition-opacity">
                    <Search size={24} strokeWidth={1.5} />
                </button>
                <button onClick={() => handleAction('Voice Call')} className="hover:opacity-70 transition-opacity">
                    <Phone size={26} strokeWidth={1.5} />
                </button>
                <button onClick={() => handleAction('Video Call')} className="hover:opacity-70 transition-opacity">
                    <Video size={28} strokeWidth={1.5} />
                </button>
            </div>
        </div>

        {searchOpen && (
            <div className="border-b border-white/10 bg-black/95 px-4 py-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" size={16} />
                    <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search this Direct..."
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.06] py-2.5 pl-10 pr-9 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/25"
                    />
                    <button
                        onClick={() => { setSearchOpen(false); setSearchQuery(''); setSearchResults([]); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white"
                    >
                        <X size={15} />
                    </button>
                </div>
                {searchQuery.trim() && (
                    <div className="mt-2 max-h-36 overflow-y-auto rounded-2xl border border-white/8 bg-white/[0.03]">
                        {visibleSearchResults.length ? visibleSearchResults.map(result => (
                            <button
                                key={result.id}
                                onClick={() => jumpToMessage(result.id)}
                                className="block w-full border-b border-white/5 px-3 py-2 text-left last:border-b-0 hover:bg-white/5"
                            >
                                <div className="text-[11px] font-semibold text-white/45">{result.senderName || result.sender || 'Direct'} · {result.timestamp}</div>
                                <div className="truncate text-[13px] text-white/80">{String(result.text || result.snippet || '').replace(/\[\[|\]\]/g, '')}</div>
                            </button>
                        )) : (
                            <div className="px-3 py-3 text-center text-xs text-white/30">No matching messages.</div>
                        )}
                    </div>
                )}
            </div>
        )}

        {/* Directs Area */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-0.5 pb-28">
            <div className="text-center text-[11px] font-medium text-white/40 my-4">Today</div>
            
            {messages.map((msg) => (
                <motion.div 
                    ref={node => { messageRefs.current[msg.id] = node; }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={msg.id} 
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2 rounded-2xl transition-colors ${highlightedId === msg.id ? 'bg-yellow-300/10' : ''}`}
                >
                    {msg.sender === 'other' && (
                        <img src={chatAvatar} className="w-7 h-7 rounded-full object-cover mb-1" alt="" />
                    )}
                    
                    <div 
                        className={`max-w-[70%] px-4 py-2.5 text-[15px] leading-snug rounded-[22px] font-normal
                            ${msg.sender === 'user' 
                                ? 'bg-[#3797F0] text-white rounded-br-md' 
                                : 'bg-[#262626] text-white rounded-bl-md'
                            }`}
                    >
                        {msg.text}
                    </div>
                </motion.div>
            ))}
        </div>

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="fixed bottom-0 left-0 right-0 z-[240] flex items-center gap-3 bg-black p-3 pb-8 pointer-events-auto">
             {/* Camera Button */}
             <button
                type="button"
                onClick={() => handleAction('Camera')}
                className="relative w-10 h-10 rounded-full bg-[#262626] flex items-center justify-center shrink-0 active:scale-95 transition-transform cursor-pointer group"
             >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 to-purple-500 p-[2px]">
                    <div className="w-full h-full bg-black rounded-full flex items-center justify-center border-2 border-transparent">
                        <div className="w-full h-full bg-[#262626] rounded-full group-hover:bg-[#333] transition-colors"></div>
                    </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-3 h-3 bg-white rounded-full shadow-sm"></div>
                </div>
             </button>
             
             {/* Input Pill */}
             <div className="flex-1 bg-[#262626] rounded-full h-11 flex items-center px-4 gap-2 transition-all">
                 <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder="Direct..."
                    autoComplete="off"
                    className="flex-1 bg-transparent border-none text-white focus:outline-none placeholder:text-white/50 text-[15px] h-full"
                 />
                 
                 {inputText ? (
                     <button type="submit" className="text-[#3797F0] font-semibold text-[15px] ml-2 hover:text-[#3797F0]/80 transition-colors">
                        Send
                     </button>
                 ) : (
                     <div className="flex items-center gap-3 text-white">
                         <button type="button" onClick={() => handleAction('Mic')} className="p-1 hover:opacity-70 transition-opacity">
                            <Mic size={22} strokeWidth={1.5} />
                         </button>
                         <button type="button" onClick={() => handleAction('Gallery')} className="p-1 hover:opacity-70 transition-opacity">
                            <ImageIcon size={22} strokeWidth={1.5} />
                         </button>
                         <button type="button" onClick={() => handleAction('Sticker')} className="p-1 hover:opacity-70 transition-opacity">
                            <Sticker size={22} strokeWidth={1.5} />
                         </button>
                     </div>
                 )}
             </div>
             
             {/* Heart Button (Only visible if not typing) */}
             {!inputText && (
                <button type="button" onClick={() => handleAction('Like')} className="p-1 hover:opacity-70 transition-opacity">
                    <Heart size={26} strokeWidth={1.5} />
                </button>
             )}
        </form>
    </div>
  );
};

export default ChatDetail;
