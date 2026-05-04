/**
 * core/MaxAgentBridge.js
 *
 * Live HTTP bridge from SOMA to the running MAX instance.
 * MAX exposes a tool API at /api/tools/:tool/:action — this module wraps it so
 * SOMA can do real file edits, shell execution, and more without spawning processes.
 *
 * MAX must be running at MAX_URL (default: http://127.0.0.1:3100).
 * If MAX is offline, all calls throw — callers should catch and fall back.
 */

const DEFAULT_MAX_URL  = 'http://127.0.0.1:3100';
const DEFAULT_TIMEOUT  = 30_000;

export class MaxAgentBridge {
    constructor(config = {}) {
        this.maxUrl  = config.maxUrl  || process.env.MAX_URL  || DEFAULT_MAX_URL;
        this.timeout = config.timeout || DEFAULT_TIMEOUT;
        this._available = null;   // null = unchecked, true/false = known
        this.logger = config.logger || console;
    }

    // ─── Health check ──────────────────────────────────────────────────────

    async isAvailable() {
        try {
            const res = await this._fetch('GET', '/health');
            this._available = res?.ok === true;
        } catch {
            this._available = false;
        }
        return this._available;
    }

    // ─── File tools ────────────────────────────────────────────────────────

    /** Read a file. Pass startLine/endLine for range reads. */
    async readFile(filePath, opts = {}) {
        return this._tool('file', 'read', {
            filePath,
            ...( opts.startLine != null ? { startLine: opts.startLine } : {} ),
            ...( opts.endLine   != null ? { endLine:   opts.endLine   } : {} ),
        });
    }

    /** Write a file (creates or overwrites). */
    async writeFile(filePath, content) {
        return this._tool('file', 'write', { filePath, content });
    }

    /**
     * Replace text in a file.
     * Surgical edit — only oldText→newText is changed.
     * Returns { success, error, hint } — check success before continuing.
     */
    async replaceInFile(filePath, oldText, newText) {
        return this._tool('file', 'replace', { filePath, oldText, newText });
    }

    /** List files in a directory. */
    async listFiles(dirPath) {
        return this._tool('file', 'list', { dirPath });
    }

    /** Regex search across files. */
    async grepFiles(dir, pattern, opts = {}) {
        return this._tool('file', 'grep', {
            dir,
            pattern,
            ...(opts.filePattern  ? { filePattern:  opts.filePattern  } : {}),
            ...(opts.ignoreCase   ? { ignoreCase:   true               } : {}),
            ...(opts.maxResults   ? { maxResults:   opts.maxResults    } : {}),
        });
    }

    // ─── Shell tools ───────────────────────────────────────────────────────

    /** Run a shell command and wait for output. */
    async runShell(command, timeoutMs = 60_000) {
        return this._tool('shell', 'run', { command, timeoutMs });
    }

    /** Start a background process in MAX's shell manager. */
    async startProcess(command, name) {
        return this._tool('shell', 'start', { command, name });
    }

    // ─── Goal injection ────────────────────────────────────────────────────

    /**
     * Queue a goal into MAX's AgentLoop.
     * MAX will work on it autonomously.
     */
    async injectGoal(title, opts = {}) {
        const res = await this._fetchJSON('POST', '/api/goals', {
            title,
            description: opts.description || title,
            priority:    opts.priority    ?? 0.7,
        });
        if (res?.id) {
            this.logger.log?.(`[MaxAgentBridge] 🎯 Goal injected into MAX: "${title}" → ${res.id}`);
        }
        return res;
    }

    // ─── Chat dispatch ─────────────────────────────────────────────────────

    /**
     * Send a message to MAX and get a response.
     * Useful for SOMA to ask MAX to investigate or explain something.
     */
    async chat(message, opts = {}) {
        return this._fetchJSON('POST', '/api/chat', {
            message,
            persona:     opts.persona     || null,
            temperature: opts.temperature ?? 0.7,
            maxTokens:   opts.maxTokens   ?? 1024,
        });
    }

    // ─── Internal helpers ──────────────────────────────────────────────────

    async _tool(toolName, action, params) {
        const result = await this._fetchJSON('POST', `/api/tools/${toolName}/${action}`, params);
        if (!result) throw new Error(`MAX tool ${toolName}:${action} returned no response`);
        if (result.success === false) {
            throw new Error(`MAX tool ${toolName}:${action} failed: ${result.error || 'unknown error'}`);
        }
        return result;
    }

    async _fetchJSON(method, path, body = null) {
        const opts = {
            method,
            headers: body ? { 'Content-Type': 'application/json' } : {},
            ...(body ? { body: JSON.stringify(body) } : {}),
        };
        return this._fetch(method, path, body);
    }

    /**
     * SOVEREIGN GATEWAY v1.0.0
     * Enables Barry (Master SOMA-ID) to remote into MAX for diagnostics via EdgeWorker tunnel.
     */
    async establishArchitectLink(remoteNodeId, masterKey, system) {
        this.logger.log?.(`🤝 [MAX_BRIDGE] Initiating Sovereign Handshake: ${remoteNodeId}`);
        
        // 1. Verify Barry's Master ID via Thalamus
        const thalamus = system?.thalamusArbiter;
        if (thalamus && typeof thalamus.verifyMasterKey === 'function') {
            if (!thalamus.verifyMasterKey(masterKey)) {
                this.logger.error?.('🛑 [MAX_BRIDGE] Handshake Rejected: Unauthorized ID.');
                return { success: false, reason: 'unauthorized' };
            }
        }

        // 2. Establish the P2P Edge Tunnel
        const edge = system?.edgeWorkerOrchestrator;
        if (edge && typeof edge.connectToNode === 'function') {
            try {
                await edge.connectToNode(remoteNodeId);
                this.logger.log?.('🌌 [MAX_BRIDGE] Sovereign Tunnel Established. Remote diagnostics ACTIVE.');
                return { success: true, mode: 'P2P_ARCHITECT' };
            } catch (e) {
                this.logger.error?.(`❌ [MAX_BRIDGE] Tunnel Failed: ${e.message}`);
                return { success: false, reason: 'tunnel_failure', error: e.message };
            }
        }

        return { success: false, reason: 'orchestrator_offline' };
    }
}

// Singleton — import and use directly
export default new MaxAgentBridge();
