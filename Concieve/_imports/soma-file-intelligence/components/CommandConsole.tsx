import React, { useState, useRef, useCallback } from 'react';
import { AppState } from '../types';

interface CommandConsoleProps {
    onQuery: (query: string) => void;
    onFileUpload: (files: File[]) => void;
    isProcessing: boolean;
    appState: AppState;
}

const CommandConsole: React.FC<CommandConsoleProps> = ({ 
    onQuery, 
    onFileUpload, 
    isProcessing, 
    appState 
}) => {
    const [inputValue, setInputValue] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || isProcessing) return;
        onQuery(inputValue);
        setInputValue("");
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e as any);
        }
    };

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
    };

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Prevent flickering when dragging over children
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            onFileUpload(files);
        }
    }, [onFileUpload]);

    const handleManualUpload = () => {
        fileInputRef.current?.click();
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) {
            onFileUpload(Array.from(e.target.files));
        }
    };

    return (
        <div 
            className="w-full bg-gradient-to-t from-background via-background/95 to-transparent py-4 px-4 relative z-50"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className={`max-w-3xl mx-auto w-full relative transition-transform duration-500 ease-out ${isFocused ? 'scale-[1.01]' : 'scale-100'}`}>
                
                {/* Drag Overlay - Integrated */}
                <div className={`absolute inset-0 -m-4 rounded-3xl border-2 border-dashed border-accent bg-background/90 z-50 flex items-center justify-center backdrop-blur-md transition-all duration-300 ${isDragging ? 'opacity-100 visible scale-100' : 'opacity-0 invisible scale-95'}`}>
                    <div className="flex flex-col items-center gap-2 animate-bounce">
                        <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                        <span className="font-bold text-accent tracking-widest text-xs uppercase">Drop to Index</span>
                    </div>
                </div>

                <form 
                    onSubmit={handleSubmit} 
                    className={`
                        relative flex items-end gap-2 p-1.5 rounded-2xl border transition-all duration-300 shadow-2xl
                        ${isFocused 
                            ? 'bg-surface border-accent/40 shadow-[0_0_30px_rgba(16,185,129,0.1)] ring-1 ring-accent/10' 
                            : 'bg-surface/60 backdrop-blur-xl border-white/5 hover:border-white/10 hover:bg-surface/80'
                        }
                    `}
                    onFocus={() => setIsFocused(true)}
                    onBlur={(e) => {
                        // Only remove focus if we aren't clicking inside the form
                        if (!e.currentTarget.contains(e.relatedTarget)) {
                            setIsFocused(false);
                        }
                    }}
                >
                    
                    {/* Attachment Button */}
                    <button 
                        type="button" 
                        onClick={handleManualUpload}
                        className={`
                            p-2 rounded-xl transition-all duration-200 shrink-0 h-[36px] w-[36px] flex items-center justify-center
                            ${isFocused ? 'text-accent hover:bg-accent/10' : 'text-text-muted hover:text-text-primary hover:bg-white/5'}
                        `}
                        title="Attach Files"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileInput} className="hidden" multiple />

                    {/* Text Input */}
                    <textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={handleInput}
                        onKeyDown={handleKeyDown}
                        placeholder={appState === AppState.READY ? "Ask SOMA..." : "Initialize system first..."}
                        disabled={isProcessing}
                        rows={1}
                        className="flex-1 bg-transparent border-none py-2 text-sm text-text-primary placeholder-text-muted/50 focus:ring-0 focus:outline-none font-mono resize-none min-h-[36px] max-h-48 leading-relaxed"
                    />

                    {/* Submit Button */}
                    <button 
                        type="submit" 
                        disabled={!inputValue.trim() || isProcessing}
                        className={`
                            p-2 rounded-xl transition-all duration-300 shrink-0 h-[36px] w-[36px] flex items-center justify-center
                            ${inputValue.trim() && !isProcessing
                                ? 'bg-accent text-white shadow-lg shadow-accent/20 hover:bg-accent-hover hover:scale-105 hover:shadow-accent/30' 
                                : 'bg-transparent text-text-muted/20 cursor-not-allowed'
                            }
                        `}
                    >
                        {isProcessing ? (
                            <div className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <svg className={`w-5 h-5 ${inputValue.trim() ? 'translate-x-0.5' : ''} transition-transform`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CommandConsole;