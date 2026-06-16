/**
 * core/MaintenanceBridge.js
 *
 * Communication bridge between SOMA and the external MAX maintenance repository.
 * Allows SOMA to "step outside" by delegating self-modification tasks to MAX.
 *
 * Primary path: MAX's live HTTP API at /api/tools/:tool/:action
 * Fallback path: spawn a new MAX process (old behavior, for when MAX is offline)
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { MaxAgentBridge } from './MaxAgentBridge.js';
import { redactObject } from './RedactionUtils.js';

function resolveDefaultMaxPath() {
    const candidates = [
        process.env.MAX_PATH,
        path.resolve(process.cwd(), '..', 'MAX'),
        path.join(process.env.USERPROFILE || '', 'Desktop', 'The Stack', 'MAX'),
        path.join(process.env.USERPROFILE || '', 'Desktop', 'MAX')
    ].filter(Boolean);

    return candidates.find(candidate => existsSync(candidate)) || candidates[candidates.length - 1];
}

export class MaintenanceBridge {
    constructor(config = {}) {
        this.maxPath  = config.maxPath  || resolveDefaultMaxPath();
        this.somaPath = config.somaPath || process.cwd();
        this.ledgerPath = config.ledgerPath || path.join(this.somaPath, 'data', 'maintenance', 'max-delegation.jsonl');
        this.logger   = config.logger   || console;
        this._bridge  = new MaxAgentBridge({ maxUrl: config.maxUrl, logger: this.logger });
    }

    /**
     * Delegate a self-modification task to the external MAX instance.
     *
     * Strategy:
     * 1. If MAX is already running (live HTTP API) — inject a goal directly.
     *    MAX's AgentLoop will read the file, make the change, and verify it.
     * 2. If MAX is offline — fall back to spawning a new MAX process.
     *
     * @param {string} filepath  Path to the file in SOMA to modify (relative to somaPath)
     * @param {string} request   Natural-language description of the change
     */
    async delegateToExternalMax(filepath, request) {
        const started = Date.now();
        this.logger.log?.(`🛰️ [MaintenanceBridge] Delegating to MAX: ${filepath}`);
        this.logger.log?.(`   Request: ${request}`);

        try {
            // ── Try live HTTP bridge first ──────────────────────────────────────
            const online = await this._bridge.isAvailable();

            if (online) {
                // Resolve to absolute path so MAX can find the file
                const absPath = path.isAbsolute(filepath)
                    ? filepath
                    : path.join(this.somaPath, filepath);

                // Inject as a goal — MAX's AgentLoop handles the rest
                const goalTitle = `[SOMA] ${request.slice(0, 80)} — ${path.basename(filepath)}`;
                const goalDesc  = [
                    `SOMA requests a self-modification via MaintenanceBridge.`,
                    `File: ${absPath}`,
                    `Change requested: ${request}`,
                    ``,
                    `Steps:`,
                    `1. Read the file`,
                    `2. Understand the change`,
                    `3. Use file:replace (or file:write for new files) to apply it`,
                    `4. Verify the change is correct`,
                    `5. Report back`,
                ].join('\n');

                const result = await this._bridge.injectGoal(goalTitle, {
                    description: goalDesc,
                    priority:    0.85,
                });

                const evidence = { success: true, method: 'http', goalId: result?.id, goalTitle };
                await this._recordDelegation({ filepath, request, online, durationMs: Date.now() - started, ...evidence });
                this.logger.log?.(`✅ [MaintenanceBridge] Goal dispatched to MAX: ${result?.id || 'ok'}`);
                return evidence;
            }

            // ── Fallback: spawn new MAX process ────────────────────────────────
            this.logger.log?.(`⚠️  [MaintenanceBridge] MAX offline — falling back to process spawn`);
            const spawned = await this._spawnFallback(filepath, request);
            await this._recordDelegation({ filepath, request, online, durationMs: Date.now() - started, ...spawned });
            return spawned;
        } catch (error) {
            await this._recordDelegation({ filepath, request, success: false, durationMs: Date.now() - started, error: error.message });
            throw error;
        }
    }

    /**
     * Direct tool execution — ask MAX to read/write/run without going through AgentLoop.
     * Useful when you have a specific, well-defined operation.
     */
    async executeFile(action, params) {
        const online = await this._bridge.isAvailable();
        if (!online) throw new Error('MAX is offline — cannot execute file tool');
        return this._bridge._tool('file', action, params);
    }

    async executeShell(command, timeoutMs = 30_000) {
        const online = await this._bridge.isAvailable();
        if (!online) throw new Error('MAX is offline — cannot execute shell tool');
        return this._bridge.runShell(command, timeoutMs);
    }

    /**
     * Verify if the external maintenance was successful.
     * Checks the legacy file-based result (process-spawn path).
     */
    async checkMaintenanceStatus() {
        const statusPath = path.join(this.somaPath, '.soma', 'maintenance_result.json');
        try {
            const data = await fs.readFile(statusPath, 'utf8');
            return JSON.parse(data);
        } catch {
            return { status: 'pending' };
        }
    }

    // ─── Private: process-spawn fallback ──────────────────────────────────

    async _spawnFallback(filepath, request) {
        const taskManifest = {
            id:         `maintenance_${Date.now()}`,
            targetRepo: 'SOMA',
            targetPath: this.somaPath,
            file:       filepath,
            request,
            timestamp:  Date.now()
        };

        const manifestPath = path.join(this.somaPath, '.soma', 'external_maintenance_task.json');
        await fs.mkdir(path.dirname(manifestPath), { recursive: true });
        await fs.writeFile(manifestPath, JSON.stringify(taskManifest, null, 2));

        return new Promise((resolve, reject) => {
            const maxProcess = spawn('node', [
                'launcher.mjs',
                '--mode', 'maintenance',
                '--task-file', manifestPath
            ], {
                cwd:      this.maxPath,
                detached: true,
                stdio:    'inherit',
                shell:    true
            });

            maxProcess.on('error', (err) => {
                this.logger.error?.(`❌ [MaintenanceBridge] Spawn failed: ${err.message}`);
                reject(err);
            });

            maxProcess.unref();
            this.logger.log?.(`🚀 [MaintenanceBridge] External MAX process detached (PID: ${maxProcess.pid})`);
            resolve({ success: true, method: 'spawn', pid: maxProcess.pid, manifest: manifestPath });
        });
    }

    async _recordDelegation(event) {
        try {
            await fs.mkdir(path.dirname(this.ledgerPath), { recursive: true });
            const entry = redactObject({
                id: `max-delegation-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
                timestamp: new Date().toISOString(),
                maxPath: this.maxPath,
                somaPath: this.somaPath,
                maxUrl: this._bridge?.maxUrl || null,
                ...event
            });
            await fs.appendFile(this.ledgerPath, JSON.stringify(entry) + '\n', 'utf8');
        } catch {
            // Maintenance should keep running even if the evidence ledger is unavailable.
        }
    }
}

export default new MaintenanceBridge();
