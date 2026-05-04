/**
 * SOMA Memory Service - Persistent Conversation Memory with Compression
 * 
 * Features:
 * - Saves all conversations to disk
 * - Automatically compresses old conversations
 * - Semantic search through past memories
 * - Context window management
 */

import { GoogleGenAI } from '@google/genai';

interface ConversationTurn {
    timestamp: number;
    role: 'user' | 'soma';
    content: string;
    sessionId: string;
}

interface CompressedMemory {
    id: string;
    summary: string;
    keyTopics: string[];
    learnings: Learning[]; // Extracted knowledge
    timeRange: { start: number; end: number };
    turnCount: number;
    importance: number; // 0-1 scale
    originalTokens: number;
    compressedTokens: number;
}

interface Learning {
    type: 'fact' | 'preference' | 'concept' | 'pattern' | 'relationship';
    content: string;
    context: string;
    confidence: number;
}

interface MemorySession {
    id: string;
    startTime: number;
    endTime: number;
    turns: ConversationTurn[];
    compressed?: CompressedMemory;
}

export class MemoryService {
    private ai: GoogleGenAI;
    private currentSession: MemorySession;
    private memoryPath: string;
    private readonly MAX_ACTIVE_TURNS = 20; // Keep last 20 turns in active memory
    private readonly COMPRESSION_THRESHOLD = 50; // Compress when session exceeds 50 turns
    
    constructor(apiKey: string) {
        // @ts-ignore
        this.ai = new GoogleGenAI({ apiKey });
        this.memoryPath = this.getMemoryPath();
        this.currentSession = this.createNewSession();
        this.loadRecentMemories();
    }
    
    private getMemoryPath(): string {
        // Store in user's home directory
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        const somaDir = `${homeDir}/.soma`;
        
        // Create directory if it doesn't exist
        if (typeof window === 'undefined') {
            const fs = require('fs');
            const path = require('path');
            if (!fs.existsSync(somaDir)) {
                fs.mkdirSync(somaDir, { recursive: true });
            }
        }
        
        return somaDir;
    }
    
    private createNewSession(): MemorySession {
        return {
            id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            startTime: Date.now(),
            endTime: Date.now(),
            turns: []
        };
    }
    
    /**
     * Add a conversation turn to memory
     */
    public addTurn(role: 'user' | 'soma', content: string) {
        const turn: ConversationTurn = {
            timestamp: Date.now(),
            role,
            content,
            sessionId: this.currentSession.id
        };
        
        this.currentSession.turns.push(turn);
        this.currentSession.endTime = Date.now();
        
        // Auto-save to local storage
        this.saveToLocalStorage();
        
        // Check if we need to compress
        if (this.currentSession.turns.length >= this.COMPRESSION_THRESHOLD) {
            this.compressOldMemories();
        }
    }
    
    /**
     * Get recent conversation history for context
     */
    public getRecentContext(): ConversationTurn[] {
        return this.currentSession.turns.slice(-this.MAX_ACTIVE_TURNS);
    }
    
    /**
     * Get formatted context for AI
     */
    public getFormattedContext(): string {
        const recent = this.getRecentContext();
        const formatted = recent.map(turn => 
            `${turn.role === 'user' ? 'Barry' : 'SOMA'}: ${turn.content}`
        ).join('\n');
        
        // Add compressed memories if available
        const compressed = this.getCompressedMemorySummary();
        if (compressed) {
            return `## Past Conversations (Compressed)\n${compressed}\n\n## Current Session\n${formatted}`;
        }
        
        return formatted;
    }
    
    /**
     * Compress old conversations to save context space
     */
    private async compressOldMemories() {
        console.log('[Memory] Compressing old memories...');
        
        const turnsToCompress = this.currentSession.turns.slice(0, -this.MAX_ACTIVE_TURNS);
        if (turnsToCompress.length === 0) return;
        
        try {
            // Use Gemini to create compressed summary
            const conversationText = turnsToCompress.map(t => 
                `${t.role === 'user' ? 'Barry' : 'SOMA'}: ${t.content}`
            ).join('\n');
            
            const prompt = `Analyze this conversation and extract ALL learnings. You are SOMA learning about the world, Barry, and yourself.

Extract:
1. Key topics discussed
2. Facts about Barry (preferences, habits, goals, technical knowledge)
3. Concepts or ideas discussed (technical or philosophical)
4. Patterns in how Barry works or thinks
5. Important decisions or insights
6. SOMA's growth moments
7. Relationships between concepts

Conversation:
${conversationText}

Return JSON: {
  "summary": "2-3 sentence summary",
  "keyTopics": ["topic1", "topic2", ...],
  "learnings": [
    {
      "type": "fact|preference|concept|pattern|relationship",
      "content": "what was learned",
      "context": "why it matters",
      "confidence": 0.0-1.0
    }
  ],
  "importance": 0.0-1.0
}`;

            const chat = this.ai.chats.create({ 
                model: 'gemini-2.5-flash',
                config: { responseMimeType: 'application/json' }
            });
            
            const result = await chat.sendMessage({ message: prompt });
            const compressed = JSON.parse(result.text);
            
            const memory: CompressedMemory = {
                id: `memory_${Date.now()}`,
                summary: compressed.summary,
                keyTopics: compressed.keyTopics || [],
                learnings: compressed.learnings || [],
                timeRange: {
                    start: turnsToCompress[0].timestamp,
                    end: turnsToCompress[turnsToCompress.length - 1].timestamp
                },
                turnCount: turnsToCompress.length,
                importance: compressed.importance || 0.5,
                originalTokens: conversationText.length / 4, // Rough estimate
                compressedTokens: compressed.summary.length / 4
            };
            
            // Log learnings for debugging
            console.log(`[Memory] Extracted ${memory.learnings.length} learnings:`);
            memory.learnings.forEach(l => {
                console.log(`  [${l.type}] ${l.content}`);
            });
            
            // Save compressed memory
            this.currentSession.compressed = memory;
            
            // Remove compressed turns from active memory
            this.currentSession.turns = this.currentSession.turns.slice(-this.MAX_ACTIVE_TURNS);
            
            // Persist to disk
            this.saveToDisk();
            
            console.log(`[Memory] Compressed ${turnsToCompress.length} turns into ${memory.compressedTokens.toFixed(0)} tokens`);
            console.log(`[Memory] Compression ratio: ${((memory.originalTokens / memory.compressedTokens) * 100).toFixed(0)}%`);
            
        } catch (error) {
            console.error('[Memory] Compression failed:', error);
        }
    }
    
    /**
     * Get summary of compressed memories
     */
    private getCompressedMemorySummary(): string | null {
        if (!this.currentSession.compressed) return null;
        
        const mem = this.currentSession.compressed;
        const timeAgo = this.formatTimeAgo(Date.now() - mem.timeRange.end);
        
        // Include learnings in the summary
        const learningsSummary = mem.learnings.length > 0
            ? `\n\nWhat I learned:\n${mem.learnings.slice(0, 5).map(l => `- ${l.content}`).join('\n')}`
            : '';
        
        return `${timeAgo}: ${mem.summary}\nKey topics: ${mem.keyTopics.join(', ')}${learningsSummary}`;
    }
    
    /**
     * Helper for cosine similarity
     */
    private cosineSimilarity(vecA: number[], vecB: number[]): number {
        let dotProduct = 0, normA = 0, normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Search through memories
     */
    public async searchMemories(query: string): Promise<string[]> {
        const allTurns = this.currentSession.turns;
        if (allTurns.length === 0) return [];

        try {
            // 1. Get embedding for the query
            const qRes = await fetch('http://localhost:11434/api/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'llama3.2:latest', prompt: query })
            });
            const qData = await qRes.json();
            const queryEmbedding = qData.embedding;

            // 2. Score turns based on semantic similarity
            // In a real app we'd cache turn embeddings, but for recent session memory
            // we can calculate them on the fly or just fallback to keyword if too slow.
            // For now, let's embed the turns that are long enough to matter.
            const scoredTurns = await Promise.all(allTurns.map(async (turn) => {
                if (turn.content.length < 10) return { turn, score: turn.content.toLowerCase().includes(query.toLowerCase()) ? 0.5 : 0 };
                
                try {
                    const tRes = await fetch('http://localhost:11434/api/embeddings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ model: 'llama3.2:latest', prompt: turn.content })
                    });
                    const tData = await tRes.json();
                    const score = this.cosineSimilarity(queryEmbedding, tData.embedding);
                    return { turn, score };
                } catch {
                    return { turn, score: turn.content.toLowerCase().includes(query.toLowerCase()) ? 0.5 : 0 };
                }
            }));

            // 3. Sort and filter
            const matches = scoredTurns
                .filter(st => st.score > 0.4) // Minimum semantic threshold
                .sort((a, b) => b.score - a.score)
                .map(st => st.turn);

            // Fallback to keyword if no semantic matches
            if (matches.length === 0) {
                 const keywordMatches = allTurns.filter(turn => 
                     turn.content.toLowerCase().includes(query.toLowerCase())
                 );
                 return keywordMatches.slice(0, 5).map(m => 
                     `[${new Date(m.timestamp).toLocaleString()}] ${m.role}: ${m.content}`
                 );
            }

            return matches.slice(0, 5).map(m => 
                `[${new Date(m.timestamp).toLocaleString()}] ${m.role}: ${m.content}`
            );
        } catch (error) {
            console.warn('[Memory] Semantic search failed, falling back to keyword:', error);
            const matches = allTurns.filter(turn => 
                turn.content.toLowerCase().includes(query.toLowerCase())
            );
            return matches.slice(0, 5).map(m => 
                `[${new Date(m.timestamp).toLocaleString()}] ${m.role}: ${m.content}`
            );
        }
    }
    
    /**
     * Save to localStorage (temporary persistence)
     */
    private saveToLocalStorage() {
        try {
            const data = JSON.stringify({
                currentSession: this.currentSession,
                savedAt: Date.now()
            });
            localStorage.setItem('soma_memory', data);
        } catch (error) {
            console.warn('[Memory] LocalStorage save failed:', error);
        }
    }
    
    /**
     * Load from localStorage
     */
    private loadRecentMemories() {
        try {
            const data = localStorage.getItem('soma_memory');
            if (data) {
                const parsed = JSON.parse(data);
                const savedAt = parsed.savedAt;
                const hoursSince = (Date.now() - savedAt) / (1000 * 60 * 60);
                
                // Load if saved within last 24 hours
                if (hoursSince < 24) {
                    this.currentSession = parsed.currentSession;
                    console.log(`[Memory] Loaded ${this.currentSession.turns.length} turns from previous session`);
                    
                    if (this.currentSession.compressed) {
                        console.log(`[Memory] Found compressed memory: ${this.currentSession.compressed.summary}`);
                    }
                } else {
                    console.log('[Memory] Previous session too old, starting fresh');
                }
            }
        } catch (error) {
            console.warn('[Memory] Failed to load memories:', error);
        }
    }
    
    /**
     * Save to disk (persistent storage)
     */
    private saveToDisk() {
        // This would require Node.js fs - implement via backend API
        console.log('[Memory] TODO: Implement disk persistence via backend');
    }
    
    /**
     * Clear current session (start fresh)
     */
    public clearSession() {
        this.currentSession = this.createNewSession();
        this.saveToLocalStorage();
    }
    
    /**
     * Get all learnings from current session
     */
    public getAllLearnings(): Learning[] {
        return this.currentSession.compressed?.learnings || [];
    }
    
    /**
     * Get learnings by type
     */
    public getLearningsByType(type: Learning['type']): Learning[] {
        return this.getAllLearnings().filter(l => l.type === type);
    }
    
    /**
     * Get memory stats
     */
    public getStats() {
        return {
            sessionId: this.currentSession.id,
            activeTurns: this.currentSession.turns.length,
            compressed: !!this.currentSession.compressed,
            compressedTurns: this.currentSession.compressed?.turnCount || 0,
            sessionDuration: Date.now() - this.currentSession.startTime,
            totalTurns: this.currentSession.turns.length + (this.currentSession.compressed?.turnCount || 0),
            totalLearnings: this.currentSession.compressed?.learnings.length || 0,
            learningsByType: {
                facts: this.getLearningsByType('fact').length,
                preferences: this.getLearningsByType('preference').length,
                concepts: this.getLearningsByType('concept').length,
                patterns: this.getLearningsByType('pattern').length,
                relationships: this.getLearningsByType('relationship').length
            }
        };
    }
    
    private formatTimeAgo(ms: number): string {
        const minutes = Math.floor(ms / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return 'just now';
    }
}
