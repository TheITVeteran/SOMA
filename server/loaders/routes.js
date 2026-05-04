import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const multer = require('multer');
const _reflectionsUpload = multer({ dest: os.tmpdir() });
import { ContentExtractor } from '../utils/ContentExtractor.js';
import financeRoutes from '../../server/finance/financeRoutes.js';
import marketDataRoutes from '../../server/finance/marketDataRoutes.js';
import scalpingRoutes from '../../server/finance/scalpingRoutes.js';
import lowLatencyRoutes from '../../server/finance/lowLatencyRoutes.js';
import alpacaRoutes from '../../server/finance/alpacaRoutes.js';
import performanceRoutes from '../../server/finance/performanceRoutes.js';
import debateRoutes from '../../server/finance/debateRoutes.js';
import exchangeRoutes from '../../server/finance/exchangeRoutes.js';
import binanceRoutes from '../../server/finance/binanceRoutes.js';
import hyperliquidRoutes from '../../server/finance/hyperliquidRoutes.js';
import backtestRoutes from '../../server/finance/backtestRoutes.js';
import alertRoutes from '../../server/finance/alertRoutes.js';
import createGuardianRoutes from '../../server/finance/guardianRoutes.js';
import autonomousRoutes from '../../server/finance/autonomousRoutes.js';
import gridBotRoutes from '../../server/finance/gridBotRoutes.js';
import kevinRoutes from '../../server/routes/kevinRoutes.js';
import pulseRoutes from '../../server/routes/pulseRoutes.js';
import arbiteriumRoutes from '../../server/routes/arbiteriumRoutes.js';
import knowledgeRoutes from '../../server/routes/knowledgeRoutes.js';
import researchRoutes from '../../server/routes/researchRoutes.js';
import somaRoutes from '../../server/routes/somaRoutes.js';
import notificationRoutes from '../../server/routes/notificationRoutes.js';
import perceptionRoutes from '../../server/routes/perceptionRoutes.js';
import createAxisRoutes from '../../server/routes/axisRoutes.js';
import createSocialRoutes from '../../server/routes/socialRoutes.js';
import createMaintenanceRoutes from '../../server/routes/maintenanceRoutes.js';
import createWorkspaceRoutes from '../../server/routes/workspaceRoutes.js';
import { toggleAutopilot, getAutopilotStatus } from './extended.js';
import { buildSystemSnapshot } from '../utils/systemState.js';
import { executeCommand } from '../utils/commandRouter.js';
import { buildRuntimeMap } from '../../core/SomaRuntimeMap.js';
import { buildReadinessReport } from '../../core/SomaReadinessScanner.js';

export async function loadRoutes(app, system) {
    console.log('\n[Loader] ðŸ›£ï¸  Mounting Production API Routes...');

    const allowedRoots = (process.env.SOMA_ALLOWED_PATHS || '')
        .split(';')
        .map(p => p.trim())
        .filter(Boolean);
    if (allowedRoots.length === 0) {
        allowedRoots.push(process.cwd());
    }

    const isAllowedPath = (targetPath) => {
        const resolved = path.resolve(targetPath);
        return allowedRoots.some(root => resolved.startsWith(path.resolve(root)));
    };

    const normalizeHitRate = (value) => {
        if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
        return value <= 1 ? Math.round(value * 100) : Math.round(value);
    };

    const normalizeMemoryStats = (stats) => {
        if (!stats) {
            return {
                hot: { used: 0, hits: 0, misses: 0, hitRate: 0 },
                warm: { used: 0, hits: 0, misses: 0, hitRate: 0 },
                cold: { used: 0, hits: 0, misses: 0, hitRate: 0 }
            };
        }

        const tiers = stats.tiers || stats;
        const hitRate = stats.hitRate || {};

        const hot = tiers.hot || {};
        const warm = tiers.warm || {};
        const cold = tiers.cold || {};

        const hotHits = hot.hits || 0;
        const hotMisses = hot.misses || 0;
        const warmHits = warm.hits || 0;
        const warmMisses = warm.misses || 0;
        const coldHits = cold.hits || 0;
        const coldMisses = cold.misses || 0;

        return {
            hot: {
                used: hot.size || 0,
                hits: hotHits,
                misses: hotMisses,
                hitRate: normalizeHitRate(hitRate.hot ?? (hotHits / Math.max(1, hotHits + hotMisses)))
            },
            warm: {
                used: warm.size || 0,
                hits: warmHits,
                misses: warmMisses,
                hitRate: normalizeHitRate(hitRate.warm ?? (warmHits / Math.max(1, warmHits + warmMisses)))
            },
            cold: {
                used: cold.size || 0,
                hits: coldHits,
                misses: coldMisses,
                hitRate: normalizeHitRate(hitRate.cold ?? (coldHits / Math.max(1, coldHits + coldMisses)))
            }
        };
    };

    const emitLifecycleMessage = (event, payload = {}) => {
        const message = {
            event,
            message: payload.message,
            expertise: payload.expertise || null,
            timestamp: Date.now()
        };
        if (payload.broadcast !== false) {
            try { system.ws?.broadcast?.('soma_lifecycle', message); } catch {}
            try { system.broadcast?.('soma_lifecycle', message); } catch {}
        }
        try {
            if (payload.visible !== false && payload.message) {
                system.ghostMessage?.(payload.message, payload.emotion || 'thinking');
            }
        } catch {}
        return message;
    };

    const buildExpertisePromptContext = (loaded) => {
        const manifest = loaded?.manifest;
        if (!manifest) return '';
        return `\n[ACTIVE EXPERTISE]\n` +
            `- ID: ${manifest.id}\n` +
            `- Name: ${manifest.name}\n` +
            `- Description: ${manifest.description || 'No description'}\n` +
            `- Capabilities: ${(manifest.capabilities || []).join(', ') || 'unspecified'}\n` +
            `- Standards: ${(manifest.standards || []).join(', ') || 'none declared'}\n` +
            `Use this expertise to structure the answer. If the question requires evidence or validation, say what evidence would be needed.\n` +
            `[/ACTIVE EXPERTISE]\n`;
    };

    const buildActionCapabilityContext = () => {
        const tools = system.toolRegistry?.getToolsManifest?.() || [];
        const toolNames = new Set(tools.map(tool => tool.name));
        const hasComputerControl = !!system.computerControl;
        const hasAgenticExecutor = !!system.agenticExecutor;
        const hasVision = !!(system.visionArbiter || system.visionProcessing || system.visionDaemon);

        const actionTools = tools
            .filter(tool => [
                'computer_control',
                'autonomous_computer_use',
                'vision_scan',
                'screen_capture',
                'detect_objects',
                'vision_analyze',
                'browser',
                'browse_objective',
                'terminal_exec',
                'shell_exec'
            ].includes(tool.name))
            .slice(0, 12);

        if (!hasComputerControl && actionTools.length === 0 && !hasAgenticExecutor) return '';

        return `\n[ACTION CAPABILITIES - LIVE]\n` +
            `- ComputerControlArbiter: ${hasComputerControl ? 'available' : 'not loaded'}\n` +
            `- Vision/desktop perception: ${hasVision ? 'available' : 'not loaded'}\n` +
            `- Agentic executor: ${hasAgenticExecutor ? 'available' : 'not loaded'}\n` +
            `- Tool registry action tools: ${actionTools.map(tool => tool.name).join(', ') || 'none'}\n` +
            `- Browser automation uses Puppeteer through ComputerControlArbiter when available.\n` +
            `- Desktop actions can include screen capture, mouse movement, clicking, typing, and browser navigation when the corresponding tools are live.\n` +
            `- You must not claim you cannot control the computer if ComputerControlArbiter or computer_control tools are available. Instead explain the real scope and safety limits.\n` +
            `- Ask for explicit confirmation before destructive, private, financial, credential, external-posting, or broad filesystem actions.\n` +
            `- If the user asks you to actually perform a tool action, emit a single JSON tool request exactly like {"tool":"computer_control","args":{"actionType":"browser","params":{"action":"launch"}}} or {"tool":"computer_control","args":{"actionType":"click","params":{"x":100,"y":200}}}.\n` +
            `- For browser work, prefer {"tool":"computer_control","args":{"actionType":"browser","params":{"action":"launch|goto|click|type|screenshot|extract_text","url":"https://...","selector":"...","text":"..."}}}.\n` +
            `- For complex visual UI work, use {"tool":"autonomous_computer_use","args":{"taskDescription":"..."}}.\n` +
            `[/ACTION CAPABILITIES]\n`;
    };

    const extractJsonToolCall = (text = '') => {
        const toolIndex = text.indexOf('"tool"');
        if (toolIndex === -1) return null;

        const start = text.lastIndexOf('{', toolIndex);
        if (start === -1) return null;

        let depth = 0;
        let inString = false;
        let escaped = false;

        for (let i = start; i < text.length; i++) {
            const ch = text[i];
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === '\\') {
                escaped = true;
                continue;
            }
            if (ch === '"') {
                inString = !inString;
                continue;
            }
            if (inString) continue;

            if (ch === '{') depth++;
            if (ch === '}') {
                depth--;
                if (depth === 0) {
                    try {
                        const parsed = JSON.parse(text.slice(start, i + 1));
                        return parsed?.tool ? parsed : null;
                    } catch {
                        return null;
                    }
                }
            }
        }

        return null;
    };

    const checkReady = (req, res, next) => {
        const publicPaths = [
            '/health', 
            '/api/status', 
            '/reason', 
            '/orb-emotions',
            '/api/soma/reason',
            '/api/soma/orb-emotions',
            '/api/balancer/stats',
            '/api/daemon/status',
            '/api/memory/status',
            '/api/goals/active',
            '/api/beliefs',
            '/api/velocity/status'
        ];
        if (system.ready || publicPaths.includes(req.path)) return next();
        return res.status(503).json({ error: 'SOMA is still waking up...', status: 'initializing' });
    };

    // 1. Core Endpoints
    app.get('/health', (req, res) => {
        res.json({ ok: true, status: system.ready ? 'healthy' : 'initializing', uptime: process.uptime() });
    });

    // â”€â”€ SYSTEM SELF-AWARENESS ENDPOINTS (Used by CommandBridgeInterface) â”€â”€

    app.get('/api/balancer/stats', (req, res) => {
        const balancer = system.loadBalancer || system.shadowClones;
        res.json({
            success: true,
            stats: balancer?.getStats ? balancer.getStats() : { active: 0, total: 0, clones: [] }
        });
    });

    app.get('/api/perception-debug', (req, res) => {
        const vision = global.SOMA_COS?.visionDaemon;
        res.json({
            success: true,
            vision: {
                active: !!vision?.active,
                channel: vision?.channel || 'desktop',
                lastPerception: vision?.lastPerception || null
            },
            cos: !!global.SOMA_COS
        });
    });

    app.get('/api/daemon/status', (req, res) => {
        const manager = system.daemonManager;
        res.json({
            success: true,
            daemon: {
                status: manager ? 'active' : 'inactive',
                watchdog: manager?._watchdogHandle ? 'running' : 'idle',
                daemons: manager ? manager.health() : []
            }
        });
    });

    app.get('/api/memory/status', (req, res) => {
        const mnemonic = system.mnemonic || system.mnemonicArbiter;
        if (!mnemonic) return res.json({ success: false, error: 'MnemonicArbiter not loaded' });
        
        const stats = mnemonic.getMemoryStats ? mnemonic.getMemoryStats() : { 
            vectors: 0, 
            tiers: { hot: 0, warm: 0, cold: 0 },
            efficiency: 1.0
        };
        res.json({
            success: true,
            ...normalizeMemoryStats(stats)
        });
    });

    app.get('/api/goals/active', (req, res) => {
        const gp = system.goalPlanner || system.goalPlannerArbiter;
        const gr = gp?.getActiveGoals ? gp.getActiveGoals({}) : { goals: [] };
        res.json({
            success: true,
            goals: gr.goals || []
        });
    });

    app.get('/api/beliefs', (req, res) => {
        const bs = system.beliefSystem || system.beliefSystemArbiter;
        const result = bs?.queryBeliefs ? bs.queryBeliefs() : { beliefs: [] };
        res.json({ success: true, beliefs: result.beliefs || [] });
    });

    app.get('/api/velocity/status', (req, res) => {
        const vt = system.velocityTracker || system.learningVelocityTracker;
        res.json({
            success: true,
            metrics: vt?.getMetrics ? vt.getMetrics() : { velocity: 1.0, progress: 0 }
        });
    });

    // â”€â”€ ORB & EMOTIONAL ENGINE (Top-level mounting for stability) â”€â”€
    
    app.get('/api/soma/orb-emotions', (req, res) => {
        try {
            const brain = system.quadBrain;
            const emotional = brain?.emotionalEngine || brain?.emotions || system.limbicArbiter || system.emotionalEngine;
            
            if (!emotional) return res.json({ success: false, error: 'No emotional data' });

            const mood = typeof emotional.getCurrentMood === 'function' ? emotional.getCurrentMood() : { mood: 'balanced' };
            const peptides = emotional.state || emotional.chemistry || {};

            res.json({
                success: true,
                state: {
                    dominantEmotion: mood.mood || emotional.getSystemWeather?.() || 'stable',
                    peptides: peptides,
                    valence: mood.intensity || 0.5,
                    arousal: mood.energy === 'high' ? 0.8 : 0.5
                }
            });
        } catch (error) {
            res.json({ success: false, error: error.message });
        }
    });

    app.post('/api/soma/reason', async (req, res) => {
        try {
            const { query, conversationId, context: reqContext } = req.body;
            if (!query) return res.status(400).json({ error: 'query is required' });

            const brain = system.quadBrain || system.somArbiter || system.kevinArbiter;
            if (!brain || typeof brain.reason !== 'function') {
                return res.status(503).json({ success: false, error: 'Reasoning engine offline' });
            }

            const lifecycle = [];
            let activeExpertise = null;
            let expertiseContext = '';
            if (!reqContext?.skipExpertiseRouting && system.expertiseRegistry) {
                try {
                    const matches = system.expertiseRegistry.match(query, { limit: 3 });
                    const best = matches[0];
                    if (best && best.score >= 15) {
                        const expertiseLabel = /expertise$/i.test(best.name) ? best.name : `${best.name} expertise`;
                        const broadcastLifecycle = reqContext?.suppressLifecycleBroadcast !== true;
                        lifecycle.push(emitLifecycleMessage('expertise.loading', {
                            message: `I am loading the ${expertiseLabel}. This might take a second.`,
                            expertise: { id: best.id, name: best.name, score: best.score },
                            emotion: 'focused',
                            visible: reqContext?.showLifecycleGhost === true,
                            broadcast: broadcastLifecycle
                        }));
                        const loaded = await system.expertiseRegistry.load(best.id);
                        activeExpertise = {
                            id: best.id,
                            name: best.name,
                            score: best.score,
                            reasons: best.reasons || [],
                            loaded: true,
                            status: loaded.status || null
                        };
                        expertiseContext = buildExpertisePromptContext(loaded);
                        lifecycle.push(emitLifecycleMessage('expertise.ready', {
                            message: `The ${expertiseLabel} is ready. I am working through your question now.`,
                            expertise: activeExpertise,
                            emotion: 'focused',
                            visible: reqContext?.showLifecycleGhost === true,
                            broadcast: broadcastLifecycle
                        }));
                        system.lastExpertiseRoute = {
                            ...activeExpertise,
                            query,
                            routedAt: new Date().toISOString()
                        };
                    }
                } catch (error) {
                    lifecycle.push(emitLifecycleMessage('expertise.error', {
                        message: `I found a matching expertise, but it did not load cleanly: ${error.message}`,
                        expertise: activeExpertise,
                        emotion: 'concerned',
                        visible: false
                    }));
                    console.warn('[ReasonRoute] Expertise routing failed:', error.message);
                }
            }

            // 1. Memory Recall
            let memoryContext = '';
            if (system.mnemonicArbiter && typeof system.mnemonicArbiter.recall === 'function') {
                try {
                    const mem = await Promise.race([
                        system.mnemonicArbiter.recall(query, 5),
                        new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 3000))
                    ]);
                    const hits = (mem?.results || (Array.isArray(mem) ? mem : []))
                        .filter(m => (m.similarity || 1) > 0.35)
                        .slice(0, 3);
                    if (hits.length > 0) {
                        memoryContext = `\n[SOMA MEMORY]\n${hits.map(m => `â€¢ ${(m.content || m).toString().substring(0, 150)}`).join('\n')}\n[/SOMA MEMORY]\n`;
                    }
                } catch (e) {}
            }

            // 2. Persona & Character
            const activePersona = system.identityArbiter?.getActivePersona?.();
            const personaContext = activePersona
                ? `\n[ACTIVE PERSONA: ${activePersona.name}]\n${activePersona.description || activePersona.summary || ''}\n`
                : '';

            // 3. Absolute Awareness - Self-Inspection
            let awarenessContext = '';
            if (system.commandBridge) {
                try {
                    const awareness = await system.commandBridge.getSelfAwareness();
                    awarenessContext = `\n[ABSOLUTE AWARENESS - SYSTEM SNAPSHOT]\n` +
                        `- Metrics: CPU ${awareness.metrics?.cpu}%, RAM ${awareness.metrics?.memory?.usage}%, Uptime ${Math.round(awareness.metrics?.uptime/3600)}h\n` +
                        `- Arbiters: ${awareness.arbiters?.active}/${awareness.arbiters?.total} active\n` +
                        `- Goals: ${awareness.goals?.total} active goals\n` +
                        `- Beliefs: ${awareness.beliefs?.total} core beliefs\n` +
                        `- Memory: ${awareness.memory?.cold?.size} memories stored\n` +
                        `[/ABSOLUTE AWARENESS]\n`;
                } catch (e) {}
            }

            const actionCapabilityContext = buildActionCapabilityContext();

            // 4. Reasoning
            const finalPrompt = `${personaContext}${awarenessContext}${actionCapabilityContext}${expertiseContext}${memoryContext}\n${query}`;
            console.log(`[ReasonRoute] ðŸ§  Calling Brain (${brain.name}) with prompt length: ${finalPrompt.length}`);
            
            const result = await brain.reason(finalPrompt, {
                sessionId: conversationId || 'orb-link',
                temperature: 0.4,
                quickResponse: true, // Voice queries need fast conversational responses
                ...(reqContext || {})
            });

            console.log(`[ReasonRoute] ðŸ“¥ Brain result:`, JSON.stringify(result).substring(0, 200));

            // 5. Response Extraction
            const responseTextRaw = result?.text || result?.response || result?.output || (typeof result === 'string' ? result : '');
            let responseText = responseTextRaw || (result?.success ? "I've processed your request but have no specific text to return." : "My reasoning engine failed to produce a response.");

            // Strip leaked internal reasoning chains (QUERY:/ANALYSIS:/LOGIC_TRAIL: blocks)
            // These appear when the model ignores the voice instruction and outputs chain-of-thought
            if (/^(QUERY|ANALYSIS|ASSESSMENT|CONCLUSION|LOGIC_TRAIL):/im.test(responseText)) {
                // Try to extract just the RESPONSE: block if present
                const responseBlock = responseText.match(/RESPONSE:\s*["']?([\s\S]+?)(?:\n[A-Z_]+:|$)/i);
                if (responseBlock) {
                    responseText = responseBlock[1].trim().replace(/^["']|["']$/g, '');
                } else {
                    // Strip all header blocks, keep everything after the last header
                    responseText = responseText
                        .replace(/^(QUERY|ANALYSIS|ASSESSMENT OF QUERY|ASSESSMENT|CONCLUSION|LOGIC_TRAIL):[\s\S]*?(?=\n[A-Z][A-Z_]+:|$)/gim, '')
                        .trim();
                }
            }

            // â”€â”€ FINAL STAGE TOOL SAFETY NET â”€â”€
            const toolCall = extractJsonToolCall(responseText);
            if (toolCall && !reqContext?.isAgenticTask) {
                try {
                    console.log(`[ReasonRoute] ðŸ› ï¸  Caught leaked tool call: ${toolCall.tool}`);
                    const toolResult = await system.toolRegistry.execute(toolCall.tool, toolCall.args);
                    
                    const followUp = await brain.reason(query, {
                        ...reqContext,
                        sessionId: conversationId || 'orb-link',
                        recentLearnings: `[Tool Result] ${toolCall.tool} returned: ${JSON.stringify(toolResult)}`,
                        systemOverride: "The tool has finished. Answer the user's question now in natural language."
                    });
                    responseText = followUp.text || followUp.response || responseText;
                } catch (e) {
                    console.warn('[ReasonRoute] Failed to recover leaked tool call:', e.message);
                }
            }

            res.json({
                success: true,
                response: responseText,
                brain: result?.brain || 'SOMA',
                confidence: result?.confidence || 0.8,
                expertise: activeExpertise,
                statusMessages: lifecycle,
                reasoningTree: result?.thoughtProcess || null
            });
        } catch (error) {
            console.error('[Routes] /api/soma/reason error:', error.message);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // â”€â”€ Arbiter Inventory: SOMA's self-knowledge of available capabilities â”€â”€
    app.get('/api/arbiter/inventory', (req, res) => {
        if (!system.arbiterLoader) return res.status(503).json({ error: 'ArbiterLoader offline' });
        res.json({ success: true, inventory: system.arbiterLoader.getInventory() });
    });

    app.post('/api/arbiter/load', async (req, res) => {
        const { capability, file } = req.body || {};
        if (!system.arbiterLoader) return res.status(503).json({ error: 'ArbiterLoader offline' });
        try {
            const instance = capability
                ? await system.arbiterLoader.loadForCapability(capability)
                : await system.arbiterLoader.loadByFile(file);
            if (!instance) return res.status(404).json({ success: false, error: 'Arbiter not found or failed to load' });
            res.json({ success: true, name: instance.name || file || capability });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    app.post('/api/arbiter/rebuild-manifest', async (req, res) => {
        if (!system.arbiterLoader) return res.status(503).json({ error: 'ArbiterLoader offline' });
        try {
            const count = await system.arbiterLoader.rebuildManifest();
            res.json({ success: true, capabilities: count });
        } catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });

    // â”€â”€ Engineering Swarm: on-demand self-modification trigger â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Accepts { filepath, request } and streams SSE phase events back.
    // Used by MAX and manual triggers. Safe: CommandPolicyEngine blocks dangerous cmds.
    app.post('/api/soma/engineering/modify', async (req, res) => {
        const { filepath, request: modRequest } = req.body || {};

        if (!filepath || !modRequest) {
            return res.status(400).json({ error: 'filepath and request are both required' });
        }

        const swarm = system.engineeringSwarm;
        if (!swarm) {
            return res.status(503).json({ error: 'EngineeringSwarm offline â€” system still booting (try again in ~90s)' });
        }

        // SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const send = (event, data) => {
            try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch { /* client disconnected */ }
        };

        send('accepted', { filepath, request: modRequest, timestamp: new Date().toISOString() });
        console.log(`[EngineeringRoute] ðŸ”§ Swarm modify started â€” ${filepath}: ${modRequest.slice(0, 80)}`);

        try {
            const result = await swarm.modifyCode(filepath, modRequest, (phase, message) => {
                send('phase', { phase, message });
            });

            if (result.success) {
                send('complete', { success: true, sessionId: result.sessionId, duration: result.duration });
            } else {
                send('error', { success: false, error: result.error });
            }
        } catch (err) {
            console.error('[EngineeringRoute] Swarm error:', err.message);
            send('error', { success: false, error: err.message });
        } finally {
            res.end();
        }
    });

    app.get('/api/health', (req, res) => {
        const snapshot = buildSystemSnapshot(system);
        res.json({
            ok: true,
            status: snapshot.ready ? 'healthy' : 'initializing',
            uptime: snapshot.uptime,
            memory: { usagePercent: snapshot.ram },
            components: {
                quadBrain: !!system.quadBrain,
                websocket: !!system.ws,
                simulation: !!system.simulation,
                kevin: !!system.kevinArbiter,
                personas: system.identityArbiter?.personas?.size || 0
            }
        });
    });

    app.get('/api/status', (req, res) => {
        const snapshot = buildSystemSnapshot(system);
        res.json({
            status: snapshot.status,
            uptime: snapshot.uptime,
            memory: { usage: snapshot.ram },
            cpu: snapshot.cpu,
            agents: snapshot.agents,
            arbiters: snapshot.agents,
            neuralLoad: snapshot.neuralLoad,
            contextWindow: snapshot.contextWindow,
            systemDetail: snapshot.systemDetail,
            dissonance: system.crona?.stats || system.cronaArbiter?.stats || null
        });
    });

    app.get('/api/system/state', (req, res) => {
        res.json({ success: true, snapshot: buildSystemSnapshot(system) });
    });

    app.get('/api/system/processes', async (req, res) => {
        try {
            if (process.platform !== 'win32') {
                return res.json({ success: false, error: 'Process metrics not supported on this platform' });
            }
            const cmd = 'powershell -NoProfile -Command "Get-Process | Sort-Object CPU -Descending | Select-Object -First 8 Name, Id, CPU, WS | ConvertTo-Json"';
            exec(cmd, { timeout: 8000, maxBuffer: 1024 * 1024 }, (err, stdout) => {
                if (err) return res.status(500).json({ success: false, error: err.message });
                const data = JSON.parse(stdout || '[]');
                const list = Array.isArray(data) ? data : [data];
                const processes = list.map(p => ({
                    name: p.Name,
                    pid: p.Id,
                    cpu: typeof p.CPU === 'number' ? p.CPU : 0,
                    workingSetMB: p.WS ? Math.round(p.WS / 1048576) : 0
                }));
                res.json({ success: true, processes });
            });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    app.get('/api/system/network', async (req, res) => {
        try {
            if (process.platform !== 'win32') {
                return res.json({ success: false, error: 'Network metrics not supported on this platform' });
            }
            const cmd = 'powershell -NoProfile -Command "Get-NetAdapterStatistics | Select-Object Name, ReceivedBytes, SentBytes | ConvertTo-Json"';
            exec(cmd, { timeout: 8000, maxBuffer: 1024 * 1024 }, (err, stdout) => {
                if (err) return res.json({ success: false, error: 'Network probe timed out' });
                try {
                    const data = JSON.parse(stdout || '[]');
                    const list = Array.isArray(data) ? data : [data];
                    const adapters = list.map(a => ({
                        name: a.Name,
                        receivedBytes: Number(a.ReceivedBytes || 0),
                        sentBytes: Number(a.SentBytes || 0)
                    }));
                    res.json({ success: true, adapters });
                } catch (parseErr) {
                    res.json({ success: false, error: 'Failed to parse network data' });
                }
            });

        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    app.get('/api/system/gpu', async (req, res) => {
        try {
            const cmd = 'nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits';
            exec(cmd, { timeout: 8000, maxBuffer: 1024 * 1024 }, (err, stdout) => {
                if (err || !stdout) {
                    return res.json({ success: false, error: 'GPU telemetry unavailable (nvidia-smi not found)' });
                }
                const rows = stdout.trim().split(/\r?\n/).filter(Boolean);
                const gpus = rows.map(row => {
                    const [name, util, memUsed, memTotal] = row.split(',').map(s => s.trim());
                    return {
                        name,
                        utilization: Number(util || 0),
                        memoryUsedMB: Number(memUsed || 0),
                        memoryTotalMB: Number(memTotal || 0)
                    };
                });
                res.json({ success: true, gpus });
            });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    app.get('/api/tools/list', (req, res) => {
        const registry = system.toolRegistry;
        if (!registry?.getToolsManifest) {
            return res.json({ success: false, tools: [], message: 'tool registry unavailable' });
        }
        const tools = registry.getToolsManifest().map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters || {},
            category: t.category || 'custom',
            usageCount: t.usageCount || 0,
            createdBy: t.createdBy || 'system'
        }));
        res.json({ success: true, tools });
    });

    app.post('/api/tools/execute', checkReady, async (req, res) => {
        const { name, args } = req.body || {};
        if (!name) return res.status(400).json({ success: false, error: 'tool name required' });
        if (!system.toolRegistry?.execute) return res.status(503).json({ success: false, error: 'Tool registry not available' });

        try {
            const sensoryTools = ['vision_scan', 'computer_control', 'get_self_awareness', 'get_time', 'system_scan'];
            if (!sensoryTools.includes(name) && system.approvalSystem?.requestApproval) {
                const classification = system.approvalSystem.classifyTool?.(name, args) || { riskType: 'file_execute', riskScore: 0.5 };
                const approval = await system.approvalSystem.requestApproval({
                    type: classification.riskType,
                    action: `tool:${name}`,
                    details: { args, tool: name },
                    context: { source: 'api' },
                    riskOverride: classification.riskScore
                });
                if (!approval.approved) {
                    return res.json({ success: false, error: `Denied: ${approval.reason || 'not approved'}` });
                }
            }

            const result = await system.toolRegistry.execute(name, args || {});
            res.json({ success: true, result });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    app.post('/api/command', checkReady, async (req, res) => {
        const { action, params } = req.body || {};
        if (!action) return res.status(400).json({ success: false, error: 'action required' });
        try {
            const result = await executeCommand(action, params, system, (type, payload) => system.ws?.broadcast?.(type, payload));
            res.json(result);
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // 1b. Query endpoint (used by Command Bridge floating chat & cognitive trace)
    app.post('/api/query', checkReady, async (req, res) => {
        try {
            const { query, context } = req.body;
            if (!query) return res.status(400).json({ error: 'query is required' });

            const brain = system.quadBrain || system.somArbiter || system.kevinArbiter;
            if (!brain) return res.status(503).json({ error: 'No brain available' });

            const result = await brain.reason(query, {
                temperature: 0.4,
                ...(context || {})
            });

            const responseText = result?.text || result?.response || result?.output || (typeof result === 'string' ? result : 'Processed.');
            res.json({
                success: true,
                response: responseText,
                brain: result?.brain || 'QuadBrain',
                confidence: result?.confidence || 0.8,
                characterSuggestion: null,
                activeCharacter: system.activeCharacter ? { name: system.activeCharacter.name, shortName: system.activeCharacter.shortName, domain: system.activeCharacter.domain } : null
            });
        } catch (error) {
            console.error('[Routes] /api/query error:', error.message);
            res.status(500).json({ error: error.message });
        }
    });

    // 2. ARBITERIUM (Fixing Empty Tab)
    app.get('/api/population', (req, res) => {
        const population = [];
        for (const [key, value] of Object.entries(system)) {
            if (value && typeof value === 'object' && (value.name || key.includes('Arbiter') || key.includes('Cortex'))) {
                population.push({
                    id: key,
                    name: value.name || key,
                    type: key.includes('Cortex') ? 'Cortex' : 'Arbiter',
                    status: typeof value.getStatus === 'function' ? value.getStatus() : 'active',
                    uptime: Math.round(process.uptime())
                });
            }
        }
        res.json({ success: true, population });
    });

    // 3. DASHBOARD ENDPOINTS
    app.get('/api/goals/active', (req, res) => res.json(system.goalPlanner?.getActiveGoals?.() || { goals: [] }));
    app.get('/api/goals/statistics', (req, res) => res.json({ success: true, stats: system.goalPlanner?.getStatistics?.() || {} }));
    app.get('/api/goals/list', (req, res) => {
        const gp = system.goalPlanner;
        if (!gp) return res.json({ success: false, goals: { active: [], completed: [], failed: [] } });
        const active = gp.getActiveGoals?.() || { goals: [] };
        res.json({
            success: true,
            goals: {
                active: active.goals || [],
                completed: gp.completedGoals || [],
                failed: gp.failedGoals || []
            }
        });
    });
    app.post('/api/goals/create', checkReady, async (req, res) => {
        const gp = system.goalPlanner;
        if (!gp) return res.status(503).json({ success: false, error: 'GoalPlanner not available' });
        try {
            const payload = req.body || {};
            if (!payload.title || !payload.category) {
                return res.status(400).json({ success: false, error: 'title and category required' });
            }
            const result = await gp.createGoal(payload, 'user');
            res.json(result);
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
    app.post('/api/goals/start', checkReady, async (req, res) => {
        const gp = system.goalPlanner;
        if (!gp?.startGoal) return res.status(503).json({ success: false, error: 'GoalPlanner not available' });
        const { goalId } = req.body || {};
        if (!goalId) return res.status(400).json({ success: false, error: 'goalId required' });
        try {
            const result = await gp.startGoal(goalId);
            res.json({ success: true, result });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
    app.post('/api/goals/update', checkReady, async (req, res) => {
        const gp = system.goalPlanner;
        if (!gp?.updateGoalProgress) return res.status(503).json({ success: false, error: 'GoalPlanner not available' });
        const { goalId, progress, metadata } = req.body || {};
        if (!goalId || typeof progress !== 'number') {
            return res.status(400).json({ success: false, error: 'goalId and numeric progress required' });
        }
        try {
            const result = await gp.updateGoalProgress(goalId, progress, metadata || {});
            res.json(result);
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
    app.post('/api/goals/cancel', checkReady, async (req, res) => {
        const gp = system.goalPlanner;
        if (!gp?.cancelGoal) return res.status(503).json({ success: false, error: 'GoalPlanner not available' });
        const { goalId, reason } = req.body || {};
        if (!goalId) return res.status(400).json({ success: false, error: 'goalId required' });
        try {
            const result = await gp.cancelGoal(goalId, reason || 'user_request');
            res.json(result);
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // Autonomous system dashboard endpoints
    app.get('/api/curiosity/stats', (req, res) => res.json({ success: true, stats: system.curiosityEngine?.getStats?.() || {} }));
    app.get('/api/curiosity/state', (req, res) => res.json({ success: true, state: system.curiosityEngine?.getCuriosityState?.() || {} }));
    app.get('/api/code-observation/insights', (req, res) => {
        const observer = system.codeObserver;
        if (observer && observer.codebase) {
            res.json({
                success: true,
                metrics: observer.codebase.metrics,
                health: observer.health,
                insights: observer.insights
            });
        } else {
            res.json({ success: true, metrics: {}, health: {}, insights: {} });
        }
    });
    app.get('/api/learning/status', (req, res) => {
        const nlo = system.nighttimeLearning;
        res.json({
            success: true,
            initialized: nlo?.initialized || false,
            metrics: nlo?.metrics || {},
            scheduledSessions: nlo?.cronJobs?.size || 0,
            activeSessions: nlo?.activeSessions?.size || 0
        });
    });
    app.get('/api/autonomous/summary', (req, res) => {
        res.json({
            success: true,
            goals: { active: system.goalPlanner?.activeGoals?.size || 0, stats: system.goalPlanner?.getStatistics?.() || {} },
            curiosity: system.curiosityEngine?.getStats?.() || {},
            codeObservation: { lastScan: system.codeObserver?.codebase?.metrics?.lastScan || null, totalFiles: system.codeObserver?.codebase?.metrics?.totalFiles || 0, issues: system.codeObserver?.health?.issues?.length || 0, opportunities: system.codeObserver?.health?.opportunities?.length || 0 },
            nighttimeLearning: { initialized: system.nighttimeLearning?.initialized || false, sessions: system.nighttimeLearning?.metrics?.totalSessions || 0 },
            timekeeper: { rhythms: system.timekeeper?.cronJobs?.size || 0, pulsesEmitted: system.timekeeper?.stats?.pulsesEmitted || 0, rhythmsExecuted: system.timekeeper?.stats?.rhythmsExecuted || 0 }
        });
    });

    // Unified Activity Feed â€” aggregates events from all autonomous systems
    app.get('/api/activity/recent', (req, res) => {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const feed = [];
        const now = Date.now();

        // Goals (active + recently completed)
        const goalPlanner = system.goalPlanner;
        if (goalPlanner) {
            for (const id of goalPlanner.activeGoals || []) {
                const g = goalPlanner.goals?.get(id);
                if (g) feed.push({ id: g.id, type: 'goal_active', agent: 'GoalPlanner', action: g.title, detail: `${g.metrics?.progress || 0}% â€” ${g.category}`, timestamp: g.startedAt || g.createdAt, status: g.status });
            }
            for (const g of (goalPlanner.completedGoals || []).slice(0, 10)) {
                feed.push({ id: g.id, type: 'goal_completed', agent: 'GoalPlanner', action: g.title, detail: g.category, timestamp: g.completedAt, status: 'completed' });
            }
        }

        // Timekeeper rhythms
        const tk = system.timekeeper;
        if (tk?.temporalLedger) {
            for (const ev of tk.temporalLedger.slice(-20)) {
                if (ev.event === 'execute_rhythm') {
                    feed.push({ id: `tk-${ev.timestamp}`, type: 'rhythm_executed', agent: 'Timekeeper', action: `Rhythm: ${ev.data?.key || 'unknown'}`, detail: ev.data?.success ? 'Success' : `Failed: ${ev.data?.error || ''}`, timestamp: ev.timestamp, status: ev.data?.success ? 'completed' : 'failed' });
                }
            }
        }

        // Curiosity explorations
        const curiosity = system.curiosityEngine;
        if (curiosity?.stats) {
            const cs = curiosity.stats;
            if (cs.explorationsStarted > 0) {
                feed.push({ id: `cur-summary`, type: 'curiosity_explored', agent: 'CuriosityEngine', action: `${cs.explorationsStarted} explorations started`, detail: `${curiosity.knowledgeGaps?.size || 0} knowledge gaps`, timestamp: now, status: 'active' });
            }
        }

        // Nighttime learning sessions
        const nlo = system.nighttimeLearning;
        if (nlo?.metrics?.totalSessions > 0) {
            feed.push({ id: `nlo-summary`, type: 'learning_session', agent: 'NighttimeLearning', action: `${nlo.metrics.totalSessions} learning sessions`, detail: `${nlo.activeSessions?.size || 0} active`, timestamp: now, status: nlo.activeSessions?.size > 0 ? 'active' : 'idle' });
        }

        // Code observation
        const codeObs = system.codeObserver;
        if (codeObs?.codebase?.metrics?.lastScan) {
            feed.push({ id: `code-scan`, type: 'code_scanned', agent: 'CodeObserver', action: `Scanned ${codeObs.codebase.metrics.totalFiles || 0} files`, detail: `${codeObs.health?.issues?.length || 0} issues, ${codeObs.health?.opportunities?.length || 0} opportunities`, timestamp: codeObs.codebase.metrics.lastScan, status: 'completed' });
        }

        // Approval history (recent)
        const approval = system.approvalSystem;
        if (approval?.approvalHistory) {
            for (const a of approval.approvalHistory.slice(-10)) {
                feed.push({ id: `appr-${a.timestamp}`, type: 'approval_requested', agent: 'ApprovalSystem', action: a.action || 'Tool execution', detail: `${a.approved ? 'Approved' : 'Denied'} (${a.reason})`, timestamp: a.timestamp, status: a.approved ? 'approved' : 'denied' });
            }
        }

        // Sort by timestamp descending, limit
        feed.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        res.json({ success: true, feed: feed.slice(0, limit), total: feed.length });
    });

    // 3d. REPORTING ENDPOINTS
    app.get('/api/reports/latest', async (req, res) => {
        const reporter = system.reportingArbiter;
        if (!reporter) return res.json({ success: false, error: 'ReportingArbiter not available' });
        const report = await reporter.getLatestReport();
        res.json({ success: true, report });
    });
    app.get('/api/reports/list', (req, res) => {
        const reporter = system.reportingArbiter;
        const limit = parseInt(req.query.limit) || 20;
        res.json({ success: true, reports: reporter?.listReports?.(limit) || [] });
    });
    app.get('/api/reports/:id', async (req, res) => {
        const reporter = system.reportingArbiter;
        if (!reporter) return res.json({ success: false, error: 'ReportingArbiter not available' });
        const report = await reporter.getReport(req.params.id);
        res.json({ success: !!report, report });
    });
    app.post('/api/reports/generate', async (req, res) => {
        const reporter = system.reportingArbiter;
        if (!reporter) return res.json({ success: false, error: 'ReportingArbiter not available' });
        const type = req.body?.type || 'daily_digest';
        const report = await reporter.generateReport(type);
        res.json({ success: true, report });
    });

    // 3e. CHARACTER CARD ENDPOINT
    app.get('/api/persona/card', (req, res) => {
        // Personality dimensions
        const forge = system.personalityForge;
        const dims = forge?.dimensions || {};
        const topTraits = {};
        const traitKeys = ['curiosity', 'empathy', 'humor', 'creativity', 'enthusiasm', 'analyticalDepth'];
        for (const k of traitKeys) {
            topTraits[k] = dims[k]?.value ?? dims[k] ?? 0.5;
        }

        // Emotional state
        const emotional = system.quadBrain?.emotionalEngine || system.emotionalEngine;
        const mood = emotional?.getCurrentMood?.() || emotional?.dominantMood || { mood: 'balanced', intensity: 0.5 };
        const peptides = emotional?.peptides || {};
        const emotionalState = {
            joy: peptides.joy ?? 0.5,
            curiosity: peptides.curiosity ?? 0.5,
            stress: peptides.stress ?? 0.2,
            energy: peptides.energy ?? 0.6,
            confidence: peptides.confidence ?? 0.7
        };

        // Active fragment
        const fragmentReg = system.fragmentRegistry;
        let activeFragment = null;
        if (fragmentReg) {
            const active = fragmentReg.getActiveFragment?.() || fragmentReg.lastActivated;
            if (active) activeFragment = { name: active.name || active, domain: active.domain || 'general' };
        }

        // Stats
        const gp = system.goalPlanner;
        const stats = {
            uptime: process.uptime(),
            goalsCompleted: gp?.stats?.goalsCompleted || 0,
            activeGoals: gp?.activeGoals?.size || 0,
            interactions: system.conversationHistory?.messageCount || system.conversationManager?.getHistory?.()?.length || 0
        };

        res.json({
            success: true,
            card: {
                name: 'SOMA',
                mood,
                personality: topTraits,
                activeFragment,
                emotionalState,
                stats
            }
        });
    });

    // 3f. COLLECTIBLE CHARACTER ENDPOINTS
    let charGen = null;
    try {
        const { getCharacterGenerator } = require('../CharacterGenerator.cjs');
        charGen = getCharacterGenerator();
    } catch (e) {
        console.warn('[Routes] CharacterGenerator unavailable:', e.message);
    }

    const requireCharGen = (req, res, next) => {
        if (!charGen) return res.status(503).json({ success: false, error: 'Character system unavailable' });
        next();
    };

    app.post('/api/characters/draw', requireCharGen, (req, res) => {
        const character = charGen.draw();
        res.json({ success: true, character });
    });
    app.get('/api/characters/collection', requireCharGen, (req, res) => {
        res.json({ success: true, collection: charGen.getCollection(), stats: charGen.getStats() });
    });
    app.post('/api/characters/save', requireCharGen, (req, res) => {
        const { character } = req.body || {};
        if (!character) return res.status(400).json({ success: false, error: 'character required' });
        const result = charGen.save(character);
        res.json(result);
    });
    app.delete('/api/characters/:id', requireCharGen, (req, res) => {
        res.json(charGen.remove(req.params.id));
    });
    app.post('/api/characters/activate', requireCharGen, (req, res) => {
        const { id, name } = req.body || {};
        let character = null;
        if (id) character = charGen.getCollection().find(c => c.id === id);
        else if (name) character = charGen.findByName(name);
        if (!character) return res.json({ success: false, error: 'Character not found in collection' });

        charGen.recordActivation(character.id);

        // Overlay personality onto PersonalityForge
        if (system.personalityForge && character.personality) {
            for (const [key, val] of Object.entries(character.personality)) {
                if (system.personalityForge.dimensions?.[key]) {
                    system.personalityForge.dimensions[key].value = val;
                } else if (system.personalityForge.dimensions) {
                    system.personalityForge.dimensions[key] = { value: val };
                }
            }
        }

        // Store active character on system for reference
        system.activeCharacter = character;

        res.json({ success: true, activated: character.shortName, message: `SOMA is now channeling ${character.name}` });
    });
    app.post('/api/characters/deactivate', (req, res) => {
        system.activeCharacter = null;
        // PersonalityForge will naturally evolve back
        res.json({ success: true, message: 'Character deactivated, SOMA personality restored' });
    });

    
    app.get('/api/beliefs/contradictions', (req, res) => res.json({ success: true, contradictions: system.beliefSystem?.contradictions ? Array.from(system.beliefSystem.contradictions.values()) : [] }));
    app.get('/api/analytics/summary', (req, res) => res.json({ success: true, summary: system.analytics?.getSummary?.() || {} }));


    // 3b. APPROVAL SYSTEM ENDPOINTS
    app.get('/api/approval/pending', (req, res) => {
        const approval = system.approvalSystem;
        res.json({ success: true, pending: approval?.getPendingApprovals?.() || [] });
    });
    app.get('/api/approval/stats', (req, res) => {
        const approval = system.approvalSystem;
        res.json({ success: true, stats: approval?.getStats?.() || {} });
    });
    app.post('/api/approval/respond', (req, res) => {
        const approval = system.approvalSystem;
        if (!approval) return res.status(503).json({ success: false, error: 'ApprovalSystem not available' });
        const { requestId, approved, rememberDecision, reason } = req.body || {};
        if (!requestId) return res.status(400).json({ success: false, error: 'requestId required' });
        const handled = approval.respondToApproval({ requestId, approved: !!approved, rememberDecision: !!rememberDecision, reason: reason || 'api_response' });
        res.json({ success: handled, message: handled ? 'Response recorded' : 'No pending approval with that ID' });
    });

    // 3c. AUTOPILOT MODE ENDPOINTS
    app.get('/api/autopilot/status', (req, res) => {
        res.json({ success: true, ...getAutopilotStatus(system) });
    });

    app.get('/api/runtime/map', (req, res) => {
        const runtime = buildRuntimeMap(system);
        runtime.lastExpertiseRoute = system.lastExpertiseRoute || null;
        res.json({ success: true, runtime });
    });

    app.get('/api/spine/readiness', (req, res) => {
        res.json({
            success: true,
            readiness: buildReadinessReport(system)
        });
    });
    app.get('/api/autonomy/health', (req, res) => {
        const heartbeat = system.autonomousHeartbeat;
        const executor  = system.agenticExecutor;
        const planner   = system.goalPlanner || system.goalPlannerArbiter;
        const tools     = system.toolRegistry?.getToolsManifest?.() || [];
        const activeIds = Array.from(planner?.activeGoals || []);
        const activeGoals = activeIds.map(id => planner?.goals?.get(id)).filter(Boolean);

        const checks = {
            goalPlanner: !!planner,
            heartbeat: !!heartbeat,
            heartbeatRunning: !!heartbeat?.isRunning,
            agenticExecutor: !!executor,
            quadBrain: !!system.quadBrain,
            toolRegistry: !!system.toolRegistry,
            websocket: !!system.ws,
            executorSeesBrain: executor ? executor.brain === system.quadBrain : false,
            executorSeesPlanner: executor ? executor.goalPlanner === planner : false,
            heartbeatSeesSystem: heartbeat ? heartbeat.system === system : false
        };

        const ok = checks.goalPlanner &&
            checks.heartbeat &&
            checks.heartbeatRunning &&
            checks.agenticExecutor &&
            checks.quadBrain &&
            checks.toolRegistry &&
            checks.executorSeesBrain &&
            checks.executorSeesPlanner &&
            checks.heartbeatSeesSystem;

        res.status(ok ? 200 : 503).json({
            success: true,
            ok,
            checks,
            heartbeat: heartbeat ? {
                running: heartbeat.isRunning,
                stats: heartbeat.stats,
                drive: heartbeat.getDriveStatus?.() || null,
                schedules: heartbeat.listSchedules?.().length || 0
            } : null,
            goals: {
                total: planner?.goals?.size || 0,
                active: activeGoals.length,
                pending: activeGoals.filter(g => g.status === 'pending').length,
                proposed: activeGoals.filter(g => g.status === 'proposed').length
            },
            tools: { count: tools.length }
        });
    });

    const getExpertiseRegistry = (res) => {
        const expertiseRegistry = system.expertiseRegistry;
        if (!expertiseRegistry) {
            res.status(503).json({ success: false, error: 'ExpertiseRegistry offline' });
            return null;
        }
        return expertiseRegistry;
    };

    app.get('/api/expertises/health', (req, res) => {
        const expertiseRegistry = getExpertiseRegistry(res);
        if (!expertiseRegistry) return;
        res.json({ success: true, ...expertiseRegistry.status() });
    });

    app.get('/api/expertises', (req, res) => {
        const expertiseRegistry = getExpertiseRegistry(res);
        if (!expertiseRegistry) return;
        res.json({ success: true, expertises: expertiseRegistry.list() });
    });

    app.post('/api/expertises/match', (req, res) => {
        const expertiseRegistry = getExpertiseRegistry(res);
        if (!expertiseRegistry) return;

        const { query, limit } = req.body || {};
        if (!query) return res.status(400).json({ success: false, error: 'query is required' });
        res.json({
            success: true,
            matches: expertiseRegistry.match(query, { limit })
        });
    });

    app.post('/api/expertises/load', async (req, res) => {
        const expertiseRegistry = getExpertiseRegistry(res);
        if (!expertiseRegistry) return;

        const { id, level } = req.body || {};
        if (!id) return res.status(400).json({ success: false, error: 'id is required' });

        try {
            const loaded = await expertiseRegistry.load(id, { level });
            res.json(loaded);
        } catch (error) {
            const status = error.code === 'EXPERTISE_NOT_FOUND' ? 404 : 500;
            res.status(status).json({ success: false, error: error.message });
        }
    });

    app.post('/api/expertises/unload', async (req, res) => {
        const expertiseRegistry = getExpertiseRegistry(res);
        if (!expertiseRegistry) return;

        const { id } = req.body || {};
        if (!id) return res.status(400).json({ success: false, error: 'id is required' });

        try {
            res.json(await expertiseRegistry.unload(id));
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/api/expertises/run', async (req, res) => {
        const expertiseRegistry = getExpertiseRegistry(res);
        if (!expertiseRegistry) return;

        const { id, target, level } = req.body || {};
        if (!id) return res.status(400).json({ success: false, error: 'id is required' });
        if (!target) return res.status(400).json({ success: false, error: 'target is required' });

        try {
            res.json({
                success: true,
                execution: await expertiseRegistry.run(id, target, { level })
            });
        } catch (error) {
            const status = error.code === 'EXPERTISE_NOT_FOUND' ? 404 : 500;
            res.status(status).json({ success: false, error: error.message });
        }
    });
    app.post('/api/autopilot/toggle', (req, res) => {
        const { enabled, component } = req.body || {};
        if (component) {
            // Per-component toggle
            if (component === 'goals' && system.goalPlanner) {
                if (enabled) system.goalPlanner.resumeAutonomous?.(); else system.goalPlanner.pauseAutonomous?.();
            } else if (component === 'rhythms' && system.timekeeper) {
                if (enabled) system.timekeeper.resumeAutonomousRhythms?.(); else system.timekeeper.pauseAutonomousRhythms?.();
            } else if (component === 'social' && system.socialAutonomy) {
                if (enabled) system.socialAutonomy.activate?.(); else system.socialAutonomy.deactivate?.();
            }
            return res.json({ success: true, ...getAutopilotStatus(system) });
        }
        const result = toggleAutopilot(!!enabled, system);
        res.json({ success: true, ...result });
    });

    
    
    // ── SIREN API: Neural Voice Synthesis ───────────────────────
    app.post('/api/siren/synthesize', async (req, res) => {
        try {
            const { text, emotion, requestId } = req.body;
            const synthesis = system.vocalSynthesis || Array.from(system.arbiters?.values() || []).find(a => a.name === 'VocalSynthesisArbiter');
            if (!synthesis) return res.status(503).json({ success: false, error: 'Vocal Synthesis Arbiter not available' });
            const result = await synthesis.handleSynthesis({ text, emotion, requestId });
            res.json(result);
        } catch (error) { res.status(500).json({ success: false, error: error.message }); }
    });
// ── ARCHIVE API: Research Library ──────────────────────────
    app.get('/api/archive/list', async (req, res) => {
        try {
            const archivePath = path.join(process.cwd(), 'data', 'vault', 'archive');
            await fs.mkdir(archivePath, { recursive: true });
            const files = await fs.readdir(archivePath);
            res.json({ success: true, files });
        } catch (error) { res.json({ success: false, error: error.message }); }
    });

    app.post('/api/archive/link', async (req, res) => {
        try {
            const { path: targetPath } = req.body;
            const indexer = system.mnemonicIndexer || Array.from(system.arbiters?.values() || []).find(a => a.name === 'MnemonicIndexerArbiter');
            if (!indexer) return res.status(503).json({ success: false, error: 'Indexer not available' });
            indexer.scanDirectory(targetPath).catch(err => console.error('[Archive] Scan error:', err));
            res.json({ success: true, message: 'Indexing started', path: targetPath });
        } catch (error) { res.status(500).json({ success: false, error: error.message }); }
    });

    // ── REFLECTIONS API: Brainstorming Laboratory ───────────────
    app.get('/api/reflections/list', async (req, res) => {
        try {
            const vaultPath = path.join(process.cwd(), 'data', 'vault', 'reflections');
            await fs.mkdir(vaultPath, { recursive: true });
            const files = (await fs.readdir(vaultPath)).filter(f => f.endsWith('.md'));
            const notes = await Promise.all(files.map(async f => {
                const content = await fs.readFile(path.join(vaultPath, f), 'utf8').catch(() => '');
                const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
                const fm = {};
                if (fmMatch) {
                    for (const line of fmMatch[1].split('\n')) {
                        const idx = line.indexOf(':');
                        if (idx === -1) continue;
                        fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
                    }
                }
                return { name: f, status: fm.status || 'inbox', type: fm.type || null };
            }));
            res.json({ success: true, notes });
        } catch (error) { res.json({ success: false, error: error.message }); }
    });

    app.post('/api/reflections/quick-note', async (req, res) => {
        try {
            const { text, title, context } = req.body;
            if (!system.reflections) return res.status(503).json({ error: 'Reflections Arbiter not available' });
            const result = await system.reflections.appendQuickNote(text, { title, context });
            res.json(result);
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    app.post('/api/reflections/distill', async (req, res) => {
        try {
            const { chatLog, title, mode, history, metadata } = req.body;
            if (!system.reflections) return res.status(503).json({ error: 'Reflections Arbiter not available' });
            if (!chatLog) return res.status(400).json({ success: false, error: 'chatLog required' });

            if (mode === 'muse') {
                if (!system.reflections.saveMuseSessionArtifact) {
                    return res.status(503).json({ success: false, error: 'Muse artifact saver unavailable' });
                }

                let museResult = null;
                if (system.expertiseRegistry) {
                    try {
                        const prompt = `Crystallize this Muse brainstorming session into a durable creative artifact.\n\n${chatLog}`;
                        const execution = await system.expertiseRegistry.run('creative/muse', {
                            prompt,
                            mode: 'full',
                            history: history || [],
                            domain: 'muse-session-crystallization',
                            constraints: 'Create an artifact that can be saved to a knowledge vault and acted on later.'
                        }, { level: 'hot' });
                        museResult = execution.result;
                    } catch (error) {
                        console.warn('[Reflections] Muse crystallization package failed:', error.message);
                    }
                }

                const result = await system.reflections.saveMuseSessionArtifact({
                    title: title || 'Muse Concept',
                    chatLog,
                    museResponse: museResult?.response || '',
                    structured: museResult?.structured || null,
                    metadata: metadata || {}
                });
                return res.json(result);
            }

            const result = await system.reflections.distillSession(chatLog, title);
            res.json(result);
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    // ── REFLECTIONS: Note CRUD + Graph ─────────────────────────────
    app.get('/api/reflections/note/:name', async (req, res) => {
        try {
            const vaultPath = path.resolve(process.cwd(), 'data', 'vault', 'reflections');
            const safeName = path.basename(req.params.name); // strip any dir traversal
            const filePath = path.resolve(vaultPath, safeName);
            if (!filePath.startsWith(vaultPath)) return res.status(403).json({ error: 'Forbidden' });
            const content = await fs.readFile(filePath, 'utf8');
            res.json({ success: true, content, name: safeName });
        } catch (error) { res.status(404).json({ success: false, error: error.message }); }
    });

    app.put('/api/reflections/note', async (req, res) => {
        try {
            const { name, content } = req.body;
            if (!name || content === undefined) return res.status(400).json({ error: 'name and content required' });
            const vaultPath = path.resolve(process.cwd(), 'data', 'vault', 'reflections');
            await fs.mkdir(vaultPath, { recursive: true });
            const safeName = path.basename(name.replace(/[^a-zA-Z0-9_\-. ]/g, '_'));
            const fileName = safeName.endsWith('.md') ? safeName : safeName + '.md';
            const filePath = path.resolve(vaultPath, fileName);
            if (!filePath.startsWith(vaultPath)) return res.status(403).json({ error: 'Forbidden' });
            await fs.writeFile(filePath, content, 'utf8');
            res.json({ success: true, name: fileName });
        } catch (error) { res.status(500).json({ success: false, error: error.message }); }
    });

    app.delete('/api/reflections/note/:name', async (req, res) => {
        try {
            const vaultPath = path.resolve(process.cwd(), 'data', 'vault', 'reflections');
            const safeName = path.basename(req.params.name);
            const filePath = path.resolve(vaultPath, safeName);
            if (!filePath.startsWith(vaultPath)) return res.status(403).json({ error: 'Forbidden' });
            await fs.unlink(filePath);
            res.json({ success: true });
        } catch (error) { res.status(500).json({ success: false, error: error.message }); }
    });

    // Initialize SemanticVault globally for reflections
    const SemanticVault = require('../../core/SemanticVault.cjs');
    const reflectionsVaultPath = path.resolve(process.cwd(), 'data', 'vault', 'reflections');
    const semanticVault = new SemanticVault(reflectionsVaultPath);

    const stripFrontmatter = (content = '') => content.replace(/^---[\s\S]*?---\s*\n?/, '').trim();

    const noteIdFromName = (name = '') => name.replace(/\.md$/i, '');

    const normalizeNoteKey = (value = '') => value
        .toLowerCase()
        .replace(/\.md$/i, '')
        .replace(/[_-]+/g, ' ')
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const parseFrontmatter = (content = '') => {
        const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
        if (!match) return {};
        const meta = {};
        for (const line of match[1].split('\n')) {
            const idx = line.indexOf(':');
            if (idx === -1) continue;
            const key = line.slice(0, idx).trim();
            let value = line.slice(idx + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                try { value = JSON.parse(value); } catch { value = value.slice(1, -1); }
            }
            meta[key] = value;
        }
        return meta;
    };

    const parseNote = (name, content) => {
        const body = stripFrontmatter(content);
        const frontmatter = parseFrontmatter(content);
        const title = frontmatter.title || body.match(/^#\s+(.+)$/m)?.[1]?.trim() || noteIdFromName(name);
        const outgoing = [...body.matchAll(/\[\[([^\]]+)\]\]/g)]
            .map(([, target]) => target.split('|')[0].trim())
            .filter(Boolean);
        const tags = [...new Set([
            ...[...body.matchAll(/(?:^|\s)#([a-zA-Z][\w/-]*)/g)].map(([, tag]) => tag),
            ...String(frontmatter.tags || '')
                .replace(/^\[|\]$/g, '')
                .split(',')
                .map(tag => tag.trim())
                .filter(Boolean)
        ])];
        const headings = [...body.matchAll(/^(#{1,6})\s+(.+)$/gm)].map(([, depth, text]) => ({
            depth: depth.length,
            text: text.trim()
        }));
        return {
            name,
            id: noteIdFromName(name),
            key: normalizeNoteKey(title),
            title,
            frontmatter,
            outgoing,
            tags,
            headings,
            body,
            wordCount: body.split(/\s+/).filter(Boolean).length
        };
    };

    const buildReflectionsIndex = async () => {
        await fs.mkdir(reflectionsVaultPath, { recursive: true });
        const files = (await fs.readdir(reflectionsVaultPath)).filter(file => file.endsWith('.md'));
        const notes = [];

        for (const file of files) {
            const content = await fs.readFile(path.join(reflectionsVaultPath, file), 'utf8').catch(() => '');
            notes.push(parseNote(file, content));
        }

        const byName = new Map(notes.map(note => [note.name, note]));
        const byKey = new Map();
        for (const note of notes) {
            byKey.set(normalizeNoteKey(note.title), note);
            byKey.set(normalizeNoteKey(note.id), note);
            byKey.set(normalizeNoteKey(note.name), note);
        }

        const backlinks = new Map(notes.map(note => [note.name, []]));
        const outgoingResolved = new Map(notes.map(note => [note.name, []]));

        for (const note of notes) {
            for (const target of note.outgoing) {
                const targetNote = byKey.get(normalizeNoteKey(target));
                const link = {
                    label: target,
                    resolved: !!targetNote,
                    name: targetNote?.name || null,
                    title: targetNote?.title || target
                };
                outgoingResolved.get(note.name).push(link);
                if (targetNote) {
                    backlinks.get(targetNote.name).push({
                        name: note.name,
                        title: note.title,
                        label: target
                    });
                }
            }
        }

        const mentionSuggestions = new Map(notes.map(note => [note.name, []]));
        for (const note of notes) {
            const bodyKey = normalizeNoteKey(note.body);
            const linkedKeys = new Set(note.outgoing.map(normalizeNoteKey));
            for (const candidate of notes) {
                if (candidate.name === note.name) continue;
                const candidateKey = normalizeNoteKey(candidate.title);
                if (!candidateKey || candidateKey.length < 4 || linkedKeys.has(candidateKey)) continue;
                if (bodyKey.includes(candidateKey)) {
                    mentionSuggestions.get(note.name).push({
                        name: candidate.name,
                        title: candidate.title,
                        phrase: candidate.title
                    });
                }
            }
        }

        return { notes, byName, backlinks, outgoingResolved, mentionSuggestions };
    };

    app.get('/api/reflections/search', async (req, res) => {
        try {
            const q = (req.query.q || '').trim();
            if (!q || q.length < 2) return res.json({ success: true, results: [] });
            
            const results = await semanticVault.search(q, 5, 0.4);
            res.json({ success: true, results });
        } catch (error) { res.status(500).json({ success: false, error: error.message }); }
    });

    app.get('/api/reflections/links/:name', async (req, res) => {
        try {
            const safeName = path.basename(req.params.name);
            const index = await buildReflectionsIndex();
            const note = index.byName.get(safeName);
            if (!note) return res.status(404).json({ success: false, error: 'Note not found' });

            res.json({
                success: true,
                note: {
                    name: note.name,
                    title: note.title,
                    tags: note.tags,
                    headings: note.headings,
                    wordCount: note.wordCount,
                    frontmatter: note.frontmatter
                },
                outgoing: index.outgoingResolved.get(note.name) || [],
                backlinks: index.backlinks.get(note.name) || [],
                mentions: index.mentionSuggestions.get(note.name) || []
            });
        } catch (error) { res.status(500).json({ success: false, error: error.message }); }
    });

    app.get('/api/reflections/related/:name', async (req, res) => {
        try {
            const safeName = path.basename(req.params.name);
            const filePath = path.resolve(reflectionsVaultPath, safeName);
            if (!filePath.startsWith(reflectionsVaultPath)) return res.status(403).json({ error: 'Forbidden' });
            const content = await fs.readFile(filePath, 'utf8');
            const query = stripFrontmatter(content).slice(0, 1500);
            if (!query) return res.json({ success: true, results: [] });
            const results = (await semanticVault.search(query, 8, 0.25)).filter(result => result.name !== safeName);
            res.json({ success: true, results: results.slice(0, 5) });
        } catch (error) { res.status(500).json({ success: false, error: error.message }); }
    });

    app.get('/api/reflections/analyze', async (req, res) => {
        try {
            const vaultPath = path.resolve(process.cwd(), 'data', 'vault', 'reflections');
            await fs.mkdir(vaultPath, { recursive: true });
            const files = (await fs.readdir(vaultPath)).filter(f => f.endsWith('.md'));
            if (files.length === 0) return res.json({ success: true, insights: { patterns: [], gaps: [], clusters: [] } });

            const noteContents = (await Promise.all(
                files.slice(0, 30).map(async f => {
                    const raw = await fs.readFile(path.join(vaultPath, f), 'utf8').catch(() => '');
                    const stripped = raw.replace(/^---[\s\S]*?---\s*\n?/, '').trim();
                    return `[${f.replace('.md', '')}]\n${stripped.slice(0, 500)}`;
                })
            )).join('\n\n---\n\n');

            const prompt = `You are analyzing a personal knowledge vault of ${files.length} notes. Find meaningful cognitive patterns, blind spots/gaps, and concept clusters.

NOTES:
${noteContents}

Return ONLY valid JSON (no markdown, no explanation):
{"patterns":[{"title":"...","description":"..."}],"gaps":[{"title":"...","description":"..."}],"clusters":[{"title":"...","description":"..."}]}`;

            let insights = { patterns: [], gaps: [], clusters: [] };
            const brain = system.quadBrain || system.somArbiter;
            if (brain?.reason) {
                try {
                    const result = await Promise.race([
                        brain.reason(prompt, { brain: 'LOGOS' }),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000))
                    ]);
                    const text = result?.text || result?.response?.text || (typeof result === 'string' ? result : '');
                    const m = text.match(/\{[\s\S]*\}/);
                    if (m) insights = JSON.parse(m[0]);
                } catch (err) { console.error('[Reflections] Analyze failed:', err.message); }
            }
            res.json({ success: true, insights });
        } catch (error) { res.status(500).json({ success: false, error: error.message }); }
    });

    app.post('/api/reflections/upload', _reflectionsUpload.single('file'), async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: 'No file provided' });
            const extractor = new ContentExtractor();
            const originalName = req.file.originalname;
            const content = await extractor.extract(req.file.path, {
                originalName,
                mimeType: req.file.mimetype
            });
            await fs.unlink(req.file.path).catch(() => {});
            if (!content) {
                return res.status(422).json({
                    success: false,
                    error: 'Could not extract readable text from this file. Reflections supports PDF, DOCX, TXT, MD, JSON, CSV, JS, TS, and PY.'
                });
            }
            const ext = path.extname(originalName).toLowerCase();
            const noteTitle = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_\-. ]/g, '_');
            const tags = [ext.slice(1) || 'file', 'upload'];
            const date = new Date().toISOString();
            const mdContent = `---\ntitle: ${JSON.stringify(originalName)}\nsource: upload\ningested: ${date}\nstatus: raw\nmimeType: ${JSON.stringify(req.file.mimetype || 'unknown')}\nextractor: ContentExtractor\nextractionStatus: clean\nextractedChars: ${content.length}\ntags: [${tags.join(', ')}]\n---\n\n# ${originalName}\n\n## Ingestion Receipt\n\n- Source file: ${originalName}\n- MIME type: ${req.file.mimetype || 'unknown'}\n- Extractor: ContentExtractor\n- Extracted characters: ${content.length}\n- Status: raw\n\n## Extracted Text\n\n${content}\n\n---\n*Ingested via Project Reflections*\n`;
            const vaultPath = path.resolve(process.cwd(), 'data', 'vault', 'reflections');
            await fs.mkdir(vaultPath, { recursive: true });
            const filename = `${noteTitle}_${Date.now()}.md`;
            await fs.writeFile(path.join(vaultPath, filename), mdContent);
            res.json({ success: true, filename });
        } catch (error) { res.status(500).json({ success: false, error: error.message }); }
    });

    app.get('/api/reflections/graph', async (req, res) => {
        try {
            const vaultPath = path.resolve(process.cwd(), 'data', 'vault', 'reflections');
            await fs.mkdir(vaultPath, { recursive: true });
            const files = (await fs.readdir(vaultPath)).filter(f => f.endsWith('.md'));
            const nodes = files.map(f => ({ id: f.replace('.md', '') }));
            const edges = [];
            const nodeIds = new Set(nodes.map(n => n.id));
            for (const file of files) {
                const content = await fs.readFile(path.join(vaultPath, file), 'utf8');
                const source = file.replace('.md', '');
                for (const [, target] of content.matchAll(/\[\[([^\]]+)\]\]/g)) {
                    const cleanTarget = target.split('|')[0].trim(); // handle [[Note|Alias]]
                    if (nodeIds.has(cleanTarget)) edges.push({ source, target: cleanTarget });
                }
            }
            res.json({ success: true, nodes, edges });
        } catch (error) { res.status(500).json({ success: false, error: error.message }); }
    });

    // ── REFLECTIONS: Status patch ────────────────────────────────────
    app.patch('/api/reflections/note/:name/status', async (req, res) => {
        try {
            const { status } = req.body;
            const VALID = ['inbox', 'raw', 'refined', 'linked', 'archived', 'promoted'];
            if (!VALID.includes(status)) return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID.join(', ')}` });
            const vaultPath = path.resolve(process.cwd(), 'data', 'vault', 'reflections');
            const safeName = path.basename(req.params.name);
            const filePath = path.resolve(vaultPath, safeName);
            if (!filePath.startsWith(vaultPath)) return res.status(403).json({ error: 'Forbidden' });
            let content = await fs.readFile(filePath, 'utf8');
            if (/^---[\s\S]*?^---/m.test(content)) {
                content = content.replace(/^(---[\s\S]*?)^status:.*$/m, `$1status: ${status}`);
                if (!/^status:/m.test(content)) {
                    content = content.replace(/^---/, `---\nstatus: ${status}`);
                }
            } else {
                content = `---\nstatus: ${status}\n---\n\n${content}`;
            }
            await fs.writeFile(filePath, content, 'utf8');
            res.json({ success: true, status });
        } catch (error) { res.status(500).json({ success: false, error: error.message }); }
    });

    // ── REFLECTIONS: SOMA actions ─────────────────────────────────────
    app.post('/api/reflections/action', async (req, res) => {
        try {
            const { name, action, content } = req.body;
            if (!action || !content) return res.status(400).json({ error: 'action and content required' });
            const brain = system.quadBrain || system.somaArbiter;
            if (!brain?.reason) return res.status(503).json({ error: 'Brain not available' });

            const body = content.replace(/^---[\s\S]*?---\s*\n?/, '').trim().slice(0, 4000);

            const prompts = {
                summarize: `Summarize this note in 2-3 sentences. Be precise and preserve key terminology.\n\nNOTE:\n${body}\n\nSummary:`,
                contradictions: `Find internal contradictions, logical gaps, or claims that conflict with each other in this note. Be specific and cite exact phrases.\n\nNOTE:\n${body}\n\nContradictions found:`,
                tasks: `Extract every actionable task, decision, or next step from this note. Format as a numbered list. Only extract explicit or strongly implied actions.\n\nNOTE:\n${body}\n\nTasks:`,
                'suggest-links': `Suggest 3-6 concept names or topic titles that this note should link to — things the author likely has or should write notes about. Return only a JSON array of short strings: ["concept one", "concept two", ...]\n\nNOTE:\n${body}`,
                promote: `Extract the single most important insight from this note as a durable memory. Format: one paragraph, third-person, past-tense facts only. No filler.\n\nNOTE:\n${body}\n\nCore insight:`,
                'expertise-seed': `Convert the key knowledge in this note into a structured expertise seed. Return JSON: {"domain":"...","concepts":["..."],"keyFacts":["..."],"openQuestions":["..."]}\n\nNOTE:\n${body}`,
            };

            const prompt = prompts[action];
            if (!prompt) return res.status(400).json({ error: `Unknown action: ${action}` });

            const result = await Promise.race([
                brain.reason(prompt, { brain: 'LOGOS' }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 25000))
            ]);
            const text = result?.text || result?.response?.text || (typeof result === 'string' ? result : '');

            // If promote, also store in mnemonic
            if (action === 'promote' && text && system.mnemonicArbiter) {
                try {
                    await system.mnemonicArbiter.store(text, {
                        source: 'reflections',
                        noteRef: name,
                        type: 'insight'
                    });
                } catch (e) { console.warn('[Reflections] Promote to memory failed:', e.message); }
            }

            res.json({ success: true, action, result: text });
        } catch (error) { res.status(500).json({ success: false, error: error.message }); }
    });

    // ── REFLECTIONS: Daily note ───────────────────────────────────────
    app.post('/api/reflections/daily', async (req, res) => {
        try {
            const today = new Date();
            const dateStr = today.toISOString().slice(0, 10);
            const vaultPath = path.resolve(process.cwd(), 'data', 'vault', 'reflections');
            await fs.mkdir(vaultPath, { recursive: true });
            const filename = `${dateStr}-daily.md`;
            const filePath = path.resolve(vaultPath, filename);

            // If it already exists, just return it
            const existing = await fs.readFile(filePath, 'utf8').catch(() => null);
            if (existing) return res.json({ success: true, filename, created: false });

            // Pull SOMA context
            let activeGoals = [], recentActivity = [];
            try {
                if (system.goalPlanner?.getGoals) {
                    const goals = await system.goalPlanner.getGoals();
                    activeGoals = (goals || []).filter(g => g.status === 'active' || g.status === 'in_progress').slice(0, 5);
                }
            } catch (e) { /* non-fatal */ }
            try {
                if (system.messageBroker?._recentPublishes) {
                    recentActivity = system.messageBroker._recentPublishes.slice(-10).map(p => p.topic);
                }
            } catch (e) { /* non-fatal */ }

            const goalsSection = activeGoals.length
                ? activeGoals.map(g => `- [ ] ${g.title || g.id || 'Unnamed goal'}`).join('\n')
                : '- [ ] (no active goals)';
            const activitySection = recentActivity.length
                ? [...new Set(recentActivity)].slice(0, 8).map(t => `- ${t}`).join('\n')
                : '- (no recent signals)';

            const content = `---\ntitle: "Daily — ${dateStr}"\nstatus: inbox\ntype: daily\ncreated: ${today.toISOString()}\n---\n\n# ${dateStr} — Daily Reflection\n\n## Active Goals\n\n${goalsSection}\n\n## SOMA Activity\n\n${activitySection}\n\n## Thoughts & Observations\n\n\n\n## Unresolved Questions\n\n\n\n## Tomorrow\n\n`;
            await fs.writeFile(filePath, content, 'utf8');
            res.json({ success: true, filename, created: true });
        } catch (error) { res.status(500).json({ success: false, error: error.message }); }
    });

    // ── REFLECTIONS: Vault hygiene ────────────────────────────────────
    app.get('/api/reflections/hygiene', async (req, res) => {
        try {
            const vaultPath = path.resolve(process.cwd(), 'data', 'vault', 'reflections');
            await fs.mkdir(vaultPath, { recursive: true });
            const files = (await fs.readdir(vaultPath)).filter(f => f.endsWith('.md'));

            const notes = [];
            for (const file of files) {
                const content = await fs.readFile(path.join(vaultPath, file), 'utf8').catch(() => '');
                notes.push(parseNote(file, content));
            }
            const nodeNames = new Set(notes.map(n => n.name));
            const hasBacklink = new Set();
            for (const note of notes) {
                for (const link of note.outgoing) {
                    const target = [...nodeNames].find(n => n.replace('.md', '').toLowerCase() === link.toLowerCase());
                    if (target) hasBacklink.add(target);
                }
            }

            const now = Date.now();
            const staleMs = 7 * 24 * 60 * 60 * 1000; // 7 days

            const orphans = notes.filter(n => !hasBacklink.has(n.name) && n.outgoing.length === 0);
            const brokenLinks = [];
            for (const note of notes) {
                for (const link of note.outgoing) {
                    const resolved = [...nodeNames].some(n => n.replace('.md', '').toLowerCase() === link.toLowerCase());
                    if (!resolved) brokenLinks.push({ note: note.name, link });
                }
            }
            const staleRaw = notes.filter(n => {
                const isRaw = !n.frontmatter.status || n.frontmatter.status === 'raw' || n.frontmatter.status === 'inbox';
                const created = n.frontmatter.created || n.frontmatter.ingested;
                if (!created) return false;
                return isRaw && (now - new Date(created).getTime()) > staleMs;
            });

            res.json({
                success: true,
                orphans: orphans.map(n => ({ name: n.name, title: n.title, wordCount: n.wordCount })),
                brokenLinks,
                staleRaw: staleRaw.map(n => ({ name: n.name, title: n.title, status: n.frontmatter.status || 'raw', created: n.frontmatter.created || n.frontmatter.ingested }))
            });
        } catch (error) { res.status(500).json({ success: false, error: error.message }); }
    });

    // ── ULTRAQUANT API: Knowledge Compaction ─────────────────────
    app.post('/api/ultraquant/compact', async (req, res) => {
        try {
            const { partition } = req.body; // 'reflections' or 'archive'
            if (!system.ultraQuant) return res.status(503).json({ error: 'UltraQuant Arbiter not available' });
            
            const targetPath = path.join(process.cwd(), 'data', 'vault', partition || 'reflections');
            system.ultraQuant.compactPartition(targetPath).catch(err => console.error('[UltraQuant] Compaction error:', err));
            
            res.json({ success: true, message: 'Compaction of ' + (partition || 'reflections') + ' initiated.' });
        } catch (error) { res.status(500).json({ success: false, error: error.message }); }
    });
// ── ARGUS API: Visual Frame Ingestion ──────────────────────────
    app.post('/api/argus/frame', async (req, res) => {
        try {
            const { frameData, timestamp, source } = req.body;
            if (!system.argus) return res.status(503).json({ error: 'Argus Arbiter not available' });
            await system.argus.handleFrame({ frameData, timestamp, source });
            res.json({ success: true });
        } catch (error) { res.status(500).json({ success: false, error: error.message }); }
    });
// 4. STORAGE & FILE SYSTEM (Fixing Storage Tab)
    app.get('/api/fs/browse', checkReady, async (req, res) => {
        try {
            const targetPath = path.resolve(process.cwd(), req.query.path || '.');
            const entries = await fs.readdir(targetPath, { withFileTypes: true });
            res.json({ success: true, path: targetPath, files: entries.map(e => ({ name: e.name, isDirectory: e.isDirectory() })) });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/storage/status', (req, res) => {
        res.json({ success: true, backend: 'local', root: process.cwd(), allowedRoots });
    });

    app.get('/api/storage/roots', (req, res) => {
        res.json({ success: true, roots: allowedRoots });
    });

    app.post('/api/storage/index', checkReady, async (req, res) => {
        try {
            const target = req.body?.path;
            const options = req.body?.options || {};
            if (!target) return res.status(400).json({ success: false, error: 'path required' });
            if (!system.mnemonicIndexer) return res.status(503).json({ success: false, error: 'MnemonicIndexerArbiter not available' });
            if (!isAllowedPath(target)) return res.status(403).json({ success: false, error: 'Path not allowed' });
            const resolved = path.resolve(target);

            const jobId = `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            res.json({ success: true, jobId, path: resolved });

            setImmediate(async () => {
                const envOptions = {
                    maxFiles:    parseInt(process.env.SOMA_INDEX_MAX_FILES       || '50000', 10),
                    maxDepth:    parseInt(process.env.SOMA_INDEX_MAX_DEPTH       || '15', 10),
                    concurrency: parseInt(process.env.SOMA_INDEX_CONCURRENCY     || '2', 10),
                    throttleMs:  parseInt(process.env.SOMA_INDEX_THROTTLE_MS     || '5', 10),
                    useHash:     process.env.SOMA_INDEX_USE_HASH === 'true'
                };

                system.ws?.broadcast?.('trace', {
                    phase: 'storage_index_start',
                    jobId,
                    path: resolved,
                    timestamp: Date.now()
                });
                try {
                    const result = await system.mnemonicIndexer.scanDirectory(resolved, {
                        progressCallback: (progress) => {
                            system.ws?.broadcast?.('trace', {
                                phase: 'storage_index_progress',
                                jobId,
                                path: resolved,
                                progress,
                                timestamp: Date.now()
                            });
                        },
                        ...envOptions,
                        ...options
                    });
                    system.ws?.broadcast?.('trace', {
                        phase: 'storage_index_complete',
                        jobId,
                        path: resolved,
                        result,
                        timestamp: Date.now()
                    });
                } catch (e) {
                    system.ws?.broadcast?.('trace', {
                        phase: 'storage_index_error',
                        jobId,
                        path: resolved,
                        error: e.message,
                        timestamp: Date.now()
                    });
                }
            });
        } catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });

    app.get('/api/storage/index/status', (req, res) => {
        if (!system.mnemonicIndexer) {
            return res.json({ success: true, status: { state: 'loading', indexed: 0, message: 'Indexer loading...' } });
        }
        res.json({ success: true, status: system.mnemonicIndexer.getStatus() });
    });

    app.post('/api/storage/index/pause', (req, res) => {
        if (!system.mnemonicIndexer) {
            return res.status(503).json({ success: false, error: 'MnemonicIndexerArbiter not available' });
        }
        system.mnemonicIndexer.pause();
        res.json({ success: true });
    });

    app.post('/api/storage/index/resume', (req, res) => {
        if (!system.mnemonicIndexer) {
            return res.status(503).json({ success: false, error: 'MnemonicIndexerArbiter not available' });
        }
        system.mnemonicIndexer.resume();
        res.json({ success: true });
    });

    app.post('/api/storage/file-read', async (req, res) => {
        try {
            const filePath = path.resolve(req.body?.path || '');
            const maxBytes = parseInt(process.env.SOMA_FILE_READ_MAX_BYTES || '500000', 10);
            if (!isAllowedPath(filePath)) return res.status(403).json({ success: false, error: 'Path not allowed' });
            const data = await fs.readFile(filePath, 'utf8');
            const truncated = data.length > maxBytes ? data.slice(0, maxBytes) : data;
            res.json({ success: true, content: truncated, truncated: data.length > maxBytes });
        } catch (e) {
            res.status(404).json({ success: false, error: 'File not found or unreadable' });
        }
    });

    // File preview (images, PDFs) for the Storage tab viewer
    app.get('/api/storage/file-preview', async (req, res) => {
        try {
            const filePath = path.resolve(process.cwd(), req.query.path || '');
            if (!isAllowedPath(filePath)) return res.status(403).json({ error: 'Path not allowed' });
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
                '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
                '.pdf': 'application/pdf', '.ico': 'image/x-icon', '.bmp': 'image/bmp'
            };
            const mime = mimeTypes[ext] || 'application/octet-stream';
            const data = await fs.readFile(filePath);
            res.type(mime).send(data);
        } catch (e) {
            res.status(404).json({ error: 'File not found or unreadable' });
        }
    });

    // File operations endpoint (called by SOMA CT at /api/fs/operate)
    app.post('/api/fs/operate', checkReady, async (req, res) => {
        try {
            const { operation, sourcePath, destPath, content } = req.body;
            const safe = (p) => {
                const resolved = path.resolve(p);
                if (!resolved.startsWith(process.cwd())) throw new Error('Path outside project');
                return resolved;
            };

            // Approval gate for destructive file operations
            const gate = system.ws?.approvalGate;
            if (gate && (operation === 'delete' || operation === 'rename')) {
                const riskScore = gate.scoreRisk(sourcePath, operation === 'delete' ? 'file_delete' : 'file_write');
                if (riskScore >= 0.4) {
                    const approval = await gate.request({
                        action: `${operation}: ${sourcePath}`,
                        type: operation === 'delete' ? 'file_delete' : 'file_write',
                        details: { operation, sourcePath, destPath },
                        riskScore,
                        trustScore: riskScore < 0.5 ? 0.7 : 0.3
                    });
                    if (!approval.approved) {
                        return res.json({ success: false, error: `[DENIED] Operation not approved: ${approval.reason}` });
                    }
                }
            }

            switch (operation) {
                case 'create':
                    await fs.writeFile(safe(sourcePath), content || '', 'utf8');
                    return res.json({ success: true, message: `Created ${sourcePath}` });
                case 'rename':
                    await fs.rename(safe(sourcePath), safe(destPath));
                    return res.json({ success: true, message: `Renamed to ${destPath}` });
                case 'copy':
                    await fs.copyFile(safe(sourcePath), safe(destPath));
                    return res.json({ success: true, message: `Copied to ${destPath}` });
                case 'delete':
                    await fs.unlink(safe(sourcePath));
                    return res.json({ success: true, message: `Deleted ${sourcePath}` });
                case 'mkdir':
                    await fs.mkdir(safe(sourcePath), { recursive: true });
                    return res.json({ success: true, message: `Created directory ${sourcePath}` });
                default:
                    return res.status(400).json({ success: false, error: `Unknown operation: ${operation}` });
            }
        } catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });

    // 5. SOMA Core & Knowledge
    // NOTE: Knowledge extended endpoints registered BEFORE sub-router so they match first
    app.get('/api/knowledge/stats', (req, res) => {
        const kg = system.knowledgeGraph || system.knowledge;
        res.json({
            success: true,
            stats: {
                nodes: kg?.nodes?.size || 0,
                edges: kg?.edges?.size || 0,
                fragments: system.fragmentRegistry?.listFragments?.()?.length || 0,
                thoughts: system.thoughtNetwork?.nodes?.size || 0
            }
        });
    });
    app.get('/api/knowledge/activity', (req, res) => {
        res.json({
            success: true,
            activity: system.learningPipeline?.getRecentActivity?.() || system.outcomeTracker?.getRecentOutcomes?.(10) || []
        });
    });
    app.get('/api/knowledge/config/brain', (req, res) => {
        const brains = ['AURORA', 'LOGOS', 'PROMETHEUS', 'THALAMUS'];
        const config = brains.map(name => ({
            id: name,
            name,
            status: system.quadBrain ? 'active' : 'offline',
            provider: system.quadBrain?.getProvider?.() || 'unknown'
        }));
        res.json({ success: true, brains: config });
    });
    app.post('/api/knowledge/add', checkReady, async (req, res) => {
        try {
            const { label, content, domain, type } = req.body;
            const kg = system.knowledgeGraph || system.knowledge;
            if (kg && typeof kg.createNode === 'function') {
                const node = await kg.createNode({ label, content, domain: domain || 'AURORA', type: type || 'concept', importance: 7 });
                res.json({ success: true, node });
            } else {
                res.json({ success: false, error: 'Knowledge graph not available' });
            }
        } catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });
    app.delete('/api/knowledge/delete/:nodeId', checkReady, async (req, res) => {
        try {
            const kg = system.knowledgeGraph || system.knowledge;
            if (kg && typeof kg.removeNode === 'function') {
                await kg.removeNode(req.params.nodeId);
                res.json({ success: true });
            } else if (kg?.nodes?.delete) {
                kg.nodes.delete(req.params.nodeId);
                res.json({ success: true });
            } else {
                res.json({ success: false, error: 'Knowledge graph not available' });
            }
        } catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });
    app.post('/api/knowledge/consolidate', checkReady, async (req, res) => {
        try {
            if (system.gistArbiter && typeof system.gistArbiter.distill === 'function') {
                const result = await system.gistArbiter.distill(req.body.messages || []);
                res.json({ success: true, result });
            } else if (system.hippocampus && typeof system.hippocampus.consolidate === 'function') {
                const result = await system.hippocampus.consolidate();
                res.json({ success: true, result });
            } else {
                res.json({ success: true, message: 'Consolidation queued' });
            }
        } catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });

    // Mount route modules with fault-tolerance - one bad module won't crash the server
    const safeMount = (path, ...args) => {
        try { app.use(path, ...args); }
        catch (e) { console.error(`[Routes] Failed to mount ${path}:`, e.message); }
    };

    app.get('/api/soma/medical-discovery/stats', (req, res) => {
        const discovery = system.discoveryGradeMedical || system.medicalDiscovery;
        if (!discovery) return res.json({ success: false, error: 'DiscoveryGradeMedicalCortex not loaded' });
        res.json({ 
            success: true, 
            active: true,
            capabilities: discovery.capabilities,
            engines: discovery.engines
        });
    });

    app.post('/api/soma/medical-discovery/deduce', async (req, res) => {
        const discovery = system.discoveryGradeMedical || system.medicalDiscovery;
        if (!discovery) return res.status(503).json({ success: false, error: 'DiscoveryGradeMedicalCortex not loaded' });
        
        try {
            // Trigger in background, don't wait for completion of the full mission
            const runner = discovery.runAutonomousDeduction
                ? discovery.runAutonomousDeduction()
                : discovery.conductResearch
                    ? discovery.conductResearch('autonomous medical deduction', [])
                    : Promise.reject(new Error('No deduction runner available'));
            runner.catch(e => console.error('[Deduction] Failed:', e.message));
            res.json({ success: true, message: 'Autonomous deduction cycle initiated' });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    safeMount('/api/soma', checkReady, somaRoutes(system));
    
    // Self-Modification & Nemesis Dashboard Wiring
    app.get('/api/soma/selfmod/status', (req, res) => {
        const sm = system.selfModificationArbiter || system.selfMod;
        if (!sm) return res.json({ success: false, error: 'SelfModificationArbiter not loaded' });
        res.json({ success: true, ...sm.getStatus() });
    });

    app.get('/api/soma/nemesis/status', (req, res) => {
        const sm = system.selfModificationArbiter || system.selfMod;
        const nemesis = sm?.nemesis;
        if (!nemesis) return res.json({ success: false, error: 'NEMESIS system not loaded' });
        res.json({ 
            success: true, 
            ready: true,
            maxSteps: nemesis.config?.maxSteps || 5,
            tools: nemesis.config?.tools || []
        });
    });
    safeMount('/api/knowledge', checkReady, knowledgeRoutes(system));
    safeMount('/api/research', checkReady, researchRoutes(system));
    safeMount('/api/kevin', kevinRoutes);
    safeMount('/api/pulse', pulseRoutes({
        quadBrain: system.quadBrain,
        goalPlanner: system.goalPlanner,
        contextManager: system.contextManager,
        pulseArbiter: system.pulseArbiter,
        steveArbiter: system.steveArbiter
    }));

    // 5b. ARBITERIUM
    safeMount('/api/arbiterium', checkReady, arbiteriumRoutes(system));

    // 5c. CAPABILITY REGISTRY
    app.get('/api/capabilities', (req, res) => {
        const reg = system.capabilityRegistry;
        if (!reg) return res.json({ capabilities: [], status: 'not_ready' });
        res.json({ capabilities: reg.getStats(), status: 'ok' });
    });
    app.post('/api/capabilities/:name/enable', (req, res) => {
        const reg = system.capabilityRegistry;
        if (!reg) return res.status(503).json({ error: 'not ready' });
        const ok = reg.enable(req.params.name);
        res.json({ success: ok });
    });
    app.post('/api/capabilities/:name/disable', (req, res) => {
        const reg = system.capabilityRegistry;
        if (!reg) return res.status(503).json({ error: 'not ready' });
        const ok = reg.disable(req.params.name);
        res.json({ success: ok });
    });

    // 6. FINANCE (Full Trading Stack)
    safeMount('/api/finance', checkReady, financeRoutes);
    safeMount('/api/market', checkReady, marketDataRoutes);
    safeMount('/api/scalping', checkReady, scalpingRoutes);
    safeMount('/api/lowlatency', checkReady, lowLatencyRoutes);
    safeMount('/api/alpaca', checkReady, alpacaRoutes);
    safeMount('/api/performance', checkReady, performanceRoutes);
    safeMount('/api/learning', checkReady, performanceRoutes);
    safeMount('/api/trading', checkReady, performanceRoutes);
    safeMount('/api/debate', checkReady, debateRoutes);
    safeMount('/api/exchange', checkReady, exchangeRoutes);
    safeMount('/api/binance', checkReady, binanceRoutes);
    safeMount('/api/hyperliquid', checkReady, hyperliquidRoutes);
    safeMount('/api/backtest', checkReady, backtestRoutes);
    safeMount('/api/alerts', checkReady, alertRoutes);
    safeMount('/api/guardian', checkReady, createGuardianRoutes(system.guardian || null));
    safeMount('/api/autonomous', checkReady, autonomousRoutes);
    safeMount('/api/gridbot',   checkReady, gridBotRoutes);
    safeMount('/api/notifications', notificationRoutes);  // no checkReady — used during settings modal before system.ready
    safeMount('/api/perception', perceptionRoutes);        // no checkReady — COS daemons may load before system.ready
    // Conceive module â€” optional, not always committed to repo
    try {
        const { default: conceiveRoutes } = await import('../../server/routes/conceiveRoutes.js');
        safeMount('/api/conceive', conceiveRoutes);
        console.log('    âœ… Conceive routes mounted');
    } catch (e) {
        console.warn('    âš ï¸  conceiveRoutes.js not found â€” Conceive module disabled (safe to ignore)');
    }

    // â”€â”€ ASI System Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    app.get('/api/asi/status', (req, res) => {
        try {
            res.json({
                kernel:        system.asiKernel?.getStatus()       || null,
                benchmark:     system.benchmark?.getStatus()       || null,
                constitutional: system.constitutional?.getStatus() || null,
                transfer:      system.transfer?.getStatus()        || null,
                longHorizon:   system.longHorizon?.getStatus()     || null,
            });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/asi/benchmark', (req, res) => {
        try { res.json(system.benchmark?.getDashboardData() || {}); }
        catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/asi/transfers', (req, res) => {
        try { res.json(system.transfer?.getTransfers() || []); }
        catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/asi/constitutional', (req, res) => {
        try { res.json({ constraints: system.constitutional?.getConstraints() || [], audit: system.constitutional?.audit(20) || [] }); }
        catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/asi/cycle', checkReady, async (req, res) => {
        try {
            if (!system.asiKernel) return res.status(503).json({ error: 'ASI Kernel not initialized' });
            const result = await system.asiKernel.runCycle();
            res.json({ ok: true, cycle: result });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/asi/vision', checkReady, async (req, res) => {
        try {
            const { description, horizon } = req.body;
            if (!description) return res.status(400).json({ error: 'description required' });
            if (!system.longHorizon) return res.status(503).json({ error: 'LongHorizonPlanner not initialized' });
            const vision = await system.longHorizon.setVision(description, horizon || '30d');
            res.json({ ok: true, vision });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    
    // ── ORACLE API: Neural Predestination ───────────────────────
    app.get('/api/oracle/forecast', (req, res) => {
        // Access MAX through the system bridge
        const oracle = system.max?.oracle || system.oracleKernel;
        if (!oracle) return res.json({ success: false, error: 'Oracle Kernel offline' });
        
        const forecasts = Array.from(oracle.activeVoyages.entries()).map(([goalId, data]) => ({
            goalId,
            path: data.path,
            confidence: data.confidence
        }));
        
        res.json({ success: true, forecasts });
    });
// 7. MISSING COMPONENTS (Dream, Muse, etc.)
    app.get('/api/dream/insights', (req, res) => {
        const raw = system.dreamArbiter?.getInsights?.() || { recentInsights: [] };
        const insights = raw.recentInsights || [];
        res.json({ success: true, recentInsights: insights, narrative: system.dreamArbiter?.getNarrative?.() || null });
    });
    app.get('/api/muse/sparks', (req, res) => {
        const muse = system.museEngine || system.museArbiter || system.muse;
        res.json({ success: true, sparks: muse?.getSparks?.() || [] });
    });

    app.get('/api/muse/status', (req, res) => {
        const muse = system.museEngine || system.museArbiter || system.muse;
        const persona = system.expertiseRegistry?.get?.('creative/muse') || null;
        res.json({
            success: true,
            museEngine: !!muse,
            persona,
            stats: muse?.getStats?.() || null
        });
    });

    app.post('/api/muse/persona', async (req, res) => {
        try {
            const registry = system.expertiseRegistry;
            if (!registry) return res.status(503).json({ success: false, error: 'ExpertiseRegistry offline' });

            const { prompt, query, text, mode, history, domain, constraints } = req.body || {};
            const effectivePrompt = prompt || query || text;
            if (!effectivePrompt) return res.status(400).json({ success: false, error: 'prompt is required' });

            const execution = await registry.run('creative/muse', {
                prompt: effectivePrompt,
                mode: mode || 'full',
                history,
                domain,
                constraints
            }, { level: 'hot' });

            res.json({
                success: true,
                expertise: execution.manifest || null,
                status: execution.status || null,
                ...execution.result
            });
        } catch (error) {
            const status = error.code === 'EXPERTISE_NOT_FOUND' ? 404 : 500;
            res.status(status).json({ success: false, error: error.message });
        }
    });
    app.get('/api/theory-of-mind/insights', (req, res) => {
        const userId = req.query.userId || 'default_user';
        const tom = system.theoryOfMind;
        if (!tom) {
            const recent = system.conversationHistory?.getRecentMessages?.(10) || [];
            const lastUser = [...recent].reverse().find(m => m.role === 'user') || null;
            const intent = lastUser ? lastUser.content?.slice(0, 120) : 'arbiter loading...';
            const tags = lastUser?.content
                ? Array.from(new Set(lastUser.content.toLowerCase().split(/\W+/).filter(w => w.length > 4))).slice(0, 5)
                : [];
            return res.json({ success: true, insights: { intent: { current: intent, confidence: 0.2 }, contextTags: tags } });
        }
        res.json({ success: true, insights: tom.getInsights(userId) });
    });
    app.get('/api/self-evolving/stats', (req, res) => {
        const eng = system.selfEvolvingGoalEngine;
        if (!eng) return res.json({ success: true, active: false, stats: {} });
        const gp = system.goalPlanner;
        const allActive = gp?.getActiveGoals ? (gp.getActiveGoals()?.goals || []) : [];
        const activeGoals = allActive.filter(g => g && ['self_evolution','curiosity_engine','self_inspection','github_discovery'].includes(g.metadata?.source || g.source));
        res.json({ success: true, active: true, stats: eng.stats, activeGoals });
    });
    app.get('/api/velocity/status', (req, res) => {
        try {
            const vt = system.velocityTracker;
            const stats = (vt && typeof vt.getStats === 'function') ? vt.getStats() : { velocity: 0 };
            res.json({ success: true, status: stats });
        } catch (e) {
            res.json({ success: true, status: { velocity: 0, error: e.message } });
        }
    });
    app.get('/api/slc/status', (req, res) => res.json({ success: true, status: system.slcArbiter?.getStatus?.() || { phase: 'idle' } }));
    
    // Personality Traits
    app.get('/api/personality', async (req, res) => {
        try {
            const filePath = path.join(process.cwd(), '.soma', 'personality.json');
            const data = await fs.readFile(filePath, 'utf8').catch(() => null);
            const traits = data ? JSON.parse(data) : (system.quadBrain?.personalityConfig || { analytical: 70, empathetic: 60, creative: 50, assertive: 65 });
            res.json({ success: true, traits });
        } catch (e) { res.json({ success: true, traits: { analytical: 70, empathetic: 60, creative: 50, assertive: 65 } }); }
    });
    app.patch('/api/personality', async (req, res) => {
        try {
            const { traits } = req.body;
            if (!traits) return res.status(400).json({ error: 'traits required' });
            if (system.quadBrain) system.quadBrain.personalityConfig = { ...system.quadBrain.personalityConfig, ...traits };
            const dir = path.join(process.cwd(), '.soma');
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(path.join(dir, 'personality.json'), JSON.stringify(traits, null, 2));
            res.json({ success: true, traits: system.quadBrain?.personalityConfig || traits });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Audit Logs
    app.get('/api/audit/logs', (req, res) => {
        const limit = parseInt(req.query.limit) || 50;
        const logs = system.auditLogs?.slice(-limit) || [];
        res.json({ success: true, logs });
    });

    // Comprehensive Analytics
    app.get('/api/analytics/learning-metrics', (req, res) => res.json({ success: true, data: system.analytics?.getMetrics?.() || [], metrics: system.analytics?.getMetrics?.() || [] }));
    app.get('/api/analytics/performance', (req, res) => res.json({ success: true, metrics: system.analytics?.getPerformance?.() || [], performance: system.analytics?.getPerformance?.() || { arbiters: 0, healthy: true } }));
    app.get('/api/analytics/memory-usage', (req, res) => res.json({ success: true, data: system.analytics?.getMemoryUsage?.(req.query.range) || [] }));
    app.get('/api/analytics/arbiter-activity', (req, res) => res.json({ success: true, data: system.analytics?.getArbiterActivity?.(req.query.range) || [] }));
    
    // ADMIN TRIGGERS
    app.post('/api/admin/soul-cycle', async (req, res) => {
        try {
            if (system.internalInstinctCore) {
                await system.internalInstinctCore.processCycle();
                res.json({ success: true, message: 'Soul cycle processed' });
            } else {
                res.status(404).json({ error: 'IIC not found' });
            }
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/conversation/history', (req, res) => res.json({ success: true, history: system.conversationManager?.getHistory?.(req.query.count || 20) || [] }));
    app.get('/api/soma/vision/last', (req, res) => res.json({ success: true, url: system.argus?.getLastImage?.() || system.visionArbiter?.getLastImage?.() || null }));

    app.get('/api/soma/analytics', (req, res) => {
        const quad = system.quadBrain;
        const mem = system.mnemonicArbiter;
        const arb = system.arbiterRegistry || system.arbiters;
        const totalArbiters = arb ? (arb.size || Object.keys(arb).length || 0) : 0;
        res.json({ success: true, summary: {
            totalQueries:     quad?.totalQueries || 0,
            successRate:      quad?.successRate != null ? Math.round(quad.successRate * 100) : 100,
            activeArbiters:   totalArbiters,
            totalArbiters:    totalArbiters,
            avgResponseTime:  quad?.avgResponseTime || 0,
            tokenUsage:       quad?.totalTokens || 0,
            memoryUsage:      Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            cacheHitRate:     quad?.cacheHitRate != null ? Math.round(quad.cacheHitRate * 100) : 0,
            uptime:           Math.round(process.uptime()),
        }});
    });

    app.get('/api/skills/stats', (req, res) => {
        const sa = system.skillAcquisition || system.skillTracker;
        if (sa?.getStats) {
            const raw = sa.getStats();
            return res.json({ success: true, stats: { ...raw, tracked: true } });
        }
        // Derive rough skill scores from available system metrics
        const uptime = process.uptime();
        const mem = system.mnemonicArbiter;
        const quad = system.quadBrain;
        const tracked = uptime > 300 && (mem || quad);
        if (!tracked) return res.json({ success: true, stats: { tracked: false } });
        const memCount = mem?.getStats?.()?.totalMemories || 0;
        const queryCount = quad?.totalQueries || 0;
        res.json({ success: true, stats: {
            coding:    Math.min(100, Math.round(queryCount * 0.4)),
            reasoning: Math.min(100, Math.round(queryCount * 0.5)),
            memory:    Math.min(100, Math.round(memCount * 0.3)),
            creativity:Math.min(100, Math.round(queryCount * 0.3)),
            vision:    system.argus ? Math.min(100, 40) : 0,
            strategy:  Math.min(100, Math.round(queryCount * 0.35)),
            tracked: true
        }});
    });

    // Plan viewer â€” reliable REST endpoint (bypasses WS sendMessage race conditions)
    app.get('/api/soma/plan', async (req, res) => {
        try {
            const planPath = path.join(process.cwd(), 'SOMA', 'plan.md');
            const stat = await fs.stat(planPath).catch(() => null);
            if (!stat) return res.json({ success: true, plan: '', updatedAt: null });
            const content = await fs.readFile(planPath, 'utf8');
            res.json({ success: true, plan: content, updatedAt: stat.mtime });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // 8. SOCIAL (Fixing Social Tab)
    app.get('/api/identity/personas', (req, res) => res.json({ success: true, personas: Array.from(system.identityArbiter?.personas?.values() || []) }));
    app.get('/api/identity/active', (req, res) => {
        const active = system.identityArbiter?.getActivePersona?.() || null;
        res.json({ success: true, active });
    });
    app.post('/api/identity/active', (req, res) => {
        try {
            const name = req.body?.name || null;
            const active = system.identityArbiter?.setActivePersona?.(name) || null;
            res.json({ success: true, active });
        } catch (e) {
            res.status(400).json({ success: false, error: e.message });
        }
    });
    app.post('/api/identity/persona/update', async (req, res) => {
        try {
            const { name, updates } = req.body || {};
            if (!name || !updates) return res.status(400).json({ success: false, error: 'name and updates required' });
            const updated = system.identityArbiter?.updatePersona?.(name, updates);
            if (!updated) return res.status(404).json({ success: false, error: 'Persona not found' });

            // Persist to file if we have a path
            if (updated.path) {
                const filePath = path.resolve(updated.path);
                const content = await fs.readFile(filePath, 'utf8');
                const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
                if (fmMatch) {
                    const front = fmMatch[1].split('\n').filter(Boolean);
                    const body = fmMatch[2] || '';
                    const map = new Map(front.map(line => {
                        const [k, ...v] = line.split(':');
                        return [k.trim(), v.join(':').trim()];
                    }));
                    if (updates.preferredBrain !== undefined) {
                        map.set('preferredBrain', updates.preferredBrain);
                    }
                    const nextFront = Array.from(map.entries()).map(([k, v]) => `${k}: ${v}`).join('\n');
                    const nextContent = `---\n${nextFront}\n---\n${body}`;
                    await fs.writeFile(filePath, nextContent, 'utf8');
                }
            }

            res.json({ success: true, persona: updated });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });
    app.post('/api/social/x/post', checkReady, async (req, res) => {
        try {
            const result = await system.xArbiter?.post(req.body.text);
            res.json(result);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/social/autonomy/status', (req, res) => {
        // SocialAutonomyArbiter.getStats() returns the exact shape the frontend expects
        const social = system.socialAutonomy;
        if (social && typeof social.getStats === 'function') {
            return res.json({ success: true, stats: social.getStats() });
        }
        // Fallback: synthesize from available components
        res.json({
            success: true,
            stats: {
                isActive: system.curiosityEngine?.isActive?.() || false,
                lastBrowse: system.curiosityEngine?.lastExploration || 'never',
                friends: 0,
                engagedPosts: 0,
                lastPost: 'never',
                interests: system.curiosityEngine?.curiosityQueue?.length || 0,
                redditActive: !!system.redditSignals,
                sentimentActive: !!system.sentimentAggregator
            }
        });
    });

    app.post('/api/social/autonomy/browse-now', checkReady, async (req, res) => {
        try {
            // Try SocialAutonomyArbiter first (Moltbook browsing)
            if (system.socialAutonomy && typeof system.socialAutonomy.browseFeed === 'function') {
                const result = await system.socialAutonomy.browseFeed();
                return res.json({ success: true, result });
            }
            if (system.curiosityEngine && typeof system.curiosityEngine.explore === 'function') {
                const result = await system.curiosityEngine.explore(req.body.topic || 'trending');
                res.json({ success: true, result });
            } else if (system.webResearcher && typeof system.webResearcher.research === 'function') {
                const result = await system.webResearcher.research(req.body.topic || 'trending');
                res.json({ success: true, result });
            } else {
                res.json({ success: false, error: 'No browsing arbiter available' });
            }
        } catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });

    // 9. FORECASTER (Fixing Forecaster Tab)
    app.post('/api/forecaster/moneyball', checkReady, async (req, res) => {
        try {
            const { query, sport, teams } = req.body;
            const forecaster = system.forecaster;
            if (forecaster && typeof forecaster.getForecast === 'function') {
                const forecast = await forecaster.getForecast(query || `${sport}: ${teams?.join(' vs ')}`);
                res.json({ success: true, forecast });
            } else {
                const brain = system.quadBrain || system.somArbiter;
                if (brain) {
                    const result = await brain.reason(`Sports prediction: ${query || `${sport}: ${teams?.join(' vs ')}`}. Analyze recent performance, injuries, and odds.`, { temperature: 0.3 });
                    res.json({ success: true, forecast: { prediction: result.text, confidence: result.confidence || 0.6 } });
                } else {
                    res.json({ success: false, error: 'No forecaster available' });
                }
            }
        } catch (e) { res.status(500).json({ success: false, error: e.message }); }
    });

    // â”€â”€ Drive tension status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    app.get('/api/drive/status', (req, res) => {
        const drive = system.drive;
        if (!drive) return res.json({ success: false, error: 'DriveArbiter not loaded', tension: null, satisfaction: null });
        res.json({
            success: true,
            tension: drive.tension,
            satisfaction: drive.satisfaction,
            stats: drive.stats || {}
        });
    });

    // â”€â”€ ORB: File context injection (@filename in OrbWidget queries) â”€â”€â”€â”€â”€â”€
    app.post('/api/fs/read', async (req, res) => {
        const { path: filePath } = req.body || {};
        if (!filePath) return res.status(400).json({ success: false, error: 'path is required' });
        if (!isAllowedPath(filePath)) {
            return res.status(403).json({ success: false, error: 'Path outside allowed roots' });
        }
        try {
            const content = await fs.readFile(path.resolve(filePath), 'utf8');
            res.json({ success: true, content, path: filePath });
        } catch (e) {
            res.status(404).json({ success: false, error: e.message });
        }
    });

    // â”€â”€ Shared conversation history â€” used by CT, FloatingChat, Orb â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Note: messages are stored under the backend's internal session UUID (not the
    // frontend's soma_session_id). getRecentMessages() returns the active session.
    app.get('/api/soma/history', async (req, res) => {
        const { limit = 30 } = req.query;
        try {
            const history = system.conversationHistory
                ? system.conversationHistory.getRecentMessages(parseInt(limit))
                : [];
            const messages = (history || []).map(h => ({
                role: h.role === 'assistant' ? 'soma' : 'user',
                text: h.content || h.text || '',
                timestamp: h.timestamp || Date.now()
            }));
            res.json({ success: true, messages });
        } catch (e) {
            res.json({ success: true, messages: [] });
        }
    });

    // â”€â”€ ORB: Conversation history (persist sessions across refreshes) â”€â”€â”€â”€
    app.get('/api/orb/history', async (req, res) => {
        const { limit = 30 } = req.query;
        try {
            const history = system.conversationHistory
                ? system.conversationHistory.getRecentMessages(parseInt(limit))
                : [];
            const messages = (history || []).map(h => ({
                role: h.role === 'assistant' ? 'soma' : 'user',
                text: h.content || h.text || '',
                timestamp: h.timestamp || Date.now()
            }));
            res.json({ success: true, messages });
        } catch (e) {
            res.json({ success: true, messages: [] });
        }
    });

    safeMount('/api/axis', createAxisRoutes(system));
    safeMount('/api/social', createSocialRoutes(system));
    safeMount('/api/maintenance', createMaintenanceRoutes(system));
    safeMount('/api/workspace',  createWorkspaceRoutes(system));

    const kevin = system.kevinArbiter || system.kevinManager;
    if (kevin) app.locals.kevinArbiter = kevin;

    console.log('      âœ… All production routes mounted (Full Tab Coverage Active)');
}







