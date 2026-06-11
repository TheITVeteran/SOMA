#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// SOMA Level 4.5 - ULTRA MODULAR BOOTSTRAP (V3 STABILITY)
// "The Ghost in the Machine"
// ═══════════════════════════════════════════════════════════

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import path from 'path';
import http from 'http';
import { config as dotenvConfig } from 'dotenv';
import fs from 'fs';
import express from 'express';
import { WebSocketServer } from 'ws';

// Load environment variables FIRST — .env first, then config/api-keys.env overrides
// (api-keys.env has the real DeepSeek key; .env may have placeholder values)
dotenvConfig();
const apiKeysPath = join(dirname(fileURLToPath(import.meta.url)), 'config', 'api-keys.env');
if (fs.existsSync(apiKeysPath)) dotenvConfig({ path: apiKeysPath, override: true });

import { CONFIG } from './core/SomaConfig.js';
import { SomaBootstrapV2 as SomaBootstrap } from './core/SomaBootstrapV2.js';
import { SystemValidator } from './core/SystemValidator.js';
import { logger } from './core/Logger.js';

const DEBUG_LOG = join(process.cwd(), 'logs', 'launcher_debug.log');
const logSync = (msg) => {
    const entry = `[${new Date().toISOString()}] ${msg}\n`;
    try { fs.appendFileSync(DEBUG_LOG, entry); } catch (e) {}
};

// --- ANSI COLOR LOGGER (Restoring the "Green" Matrix vibe) ---
const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    blue: "\x1b[34m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    cyan: "\x1b[36m",
    magenta: "\x1b[35m",
    dim: "\x1b[2m"
};

const cLog = (type, msg) => {
    let color = colors.reset;
    let label = type;
    
    switch (type) {
        case 'ULTRA': color = colors.magenta; break;
        case 'SERVER': color = colors.green; break;
        case 'BACKEND': color = colors.green; break; // Legacy compat
        case 'BOOTSTRAP': color = colors.cyan; break;
        case 'ERROR': color = colors.red; break;
        case 'WARN': color = colors.yellow; break;
    }
    
    console.log(`${colors.dim}[${new Date().toLocaleTimeString()}]${colors.reset} ${color}[${label}]${colors.reset} ${msg}`);
};

logSync('>>> SOMA ENGINE STARTUP <<<');

process.on('exit', (code) => {
    logSync(`[PROCESS] System exiting with code: ${code}`);
    cLog('ULTRA', `System exiting with code: ${code}`);
});

process.on('SIGTERM', () => {
    logSync(`[SIGNAL] Received SIGTERM`);
    process.exit(0);
});

process.on('SIGINT', () => {
    logSync(`[SIGNAL] Received SIGINT`);
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    logSync(`[FATAL] Uncaught Exception: ${err.message}\n${err.stack}`);
    cLog('ERROR', `Uncaught Exception: ${err.message}`);
    // Only exit on truly fatal errors, not transient async issues
    if (!global.__SOMA_SERVER_READY) {
        process.exit(1);
    }
});

process.on('unhandledRejection', (reason) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : '';
    logSync(`[WARN] Unhandled Rejection: ${msg}\n${stack}`);
    cLog('ERROR', `Unhandled Rejection: ${msg}`);
    // Don't crash on non-critical async errors after server is running
    if (!global.__SOMA_SERVER_READY) {
        process.exit(1);
    }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Port zombie recovery ────────────────────────────────────
import { execSync } from 'child_process';

/**
 * If a HEALTHY SOMA instance already owns the port, this launcher must yield
 * — not murder the incumbent. Killing healthy owners caused repeated silent
 * engine losses when multiple launchers (human + agents) raced each other.
 * Returns true when a healthy instance responded.
 */
async function portOwnerIsHealthy(port) {
    try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`http://localhost:${port}/api/autonomous/status`, { signal: controller.signal });
        clearTimeout(t);
        return res.ok;
    } catch {
        return false; // no response — genuine zombie or free port
    }
}

function killPortOwner(port) {
    try {
        const pidStr = execSync(
            `powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess) -join ','"`
        , { encoding: 'utf8', timeout: 3000 }).trim();

        if (!pidStr) return false;

        for (const pid of pidStr.split(',').map(s => s.trim()).filter(Boolean)) {
            // Skip PID 0 — Windows system process, cannot and should not be killed
            if (pid === '0') continue;

            let cmdline = '';
            try {
                cmdline = execSync(
                    `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}' -ErrorAction SilentlyContinue).CommandLine"`,
                    { encoding: 'utf8', timeout: 2000 }
                );
            } catch (e) { /* wmic may fail on zombie; proceed */ }

            const lower = cmdline.toLowerCase();
            // Skip protected processes
            if (!lower.includes('node') && !lower.includes('launch') && lower.length > 0) {
                logSync(`[PORT-RECOVERY] PID ${pid} is not a standard node process — skipping.`);
                continue;
            }
            
            cLog('ULTRA', `Killing zombie process on port ${port} (PID: ${pid})...
`);
            try {
                process.kill(parseInt(pid), 'SIGKILL');
                logSync(`[PORT-RECOVERY] Killed PID ${pid}`);
            } catch (e) {
                logSync(`[PORT-RECOVERY] Failed to kill PID ${pid}: ${e.message}`);
            }
        }
        return true;
    } catch (e) {
        return false;
    }
}

// --- HARDENING: Prevents EPIPE crashes ---
process.stdout.on('error', (err) => {
    if (err.code === 'EPIPE') return;
});
process.stderr.on('error', (err) => {
    if (err.code === 'EPIPE') return;
});

async function main() {
    try {
        cLog('ULTRA', '🟢 Initializing SOMA System...');

        // 1. Start Server IMMEDIATELY (Atomic Port Binding)
        const PORT = 3001;
        if (await portOwnerIsHealthy(PORT)) {
            cLog('ULTRA', `🟡 A healthy SOMA instance already owns port ${PORT}. Yielding — this launcher will exit.`);
            logSync(`[PORT-RECOVERY] Healthy instance on ${PORT}; exiting instead of taking over.`);
            process.exit(0);
        }
        killPortOwner(PORT); // only unresponsive zombies reach this point
        await new Promise(r => setTimeout(r, 1000)); // brief pause for OS

        const app = express();
        const server = http.createServer(app);
        const wss = new WebSocketServer({ server, path: '/ws' });

        // Add middleware BEFORE routes
        app.use(express.json({ limit: '50mb' }));
        app.use(express.urlencoded({ extended: true, limit: '50mb' }));

        // CORS for frontend
        app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            next();
        });

        // 🟢 RESTORED: Serve Frontend (built output lives in frontend/dist)
        app.use(express.static(join(__dirname, 'frontend', 'dist')));

        // Health endpoint — shallow at boot, deep once system is ready
        app.get('/health', (req, res) => {
            const ready = global.__SOMA_SERVER_READY;
            if (!ready) {
                return res.json({ ok: true, status: 'initializing', uptime: process.uptime() });
            }
            try {
                const sys = global.__SOMA_SYSTEM;
                const rawStatus = sys?.quadBrain?.getStatus?.() ?? null;
                const brainOk = rawStatus ? (rawStatus.providers?.some(p => p.available) ?? true) : true;
                res.json({
                    ok: brainOk,
                    status: brainOk ? 'healthy' : 'degraded',
                    uptime: process.uptime(),
                    brain: rawStatus ? {
                        name: rawStatus.name ?? null,
                        providers: (rawStatus.providers || []).map(p => ({ name: p.name, available: p.available }))
                    } : null,
                    memory: {
                        heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                        heapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
                    }
                });
            } catch (e) {
                res.json({ ok: true, status: 'healthy', uptime: process.uptime() });
            }
        });

        server.listen(PORT, '0.0.0.0', () => {
            logSync(`[SERVER] Active on port ${PORT}`);
            cLog('SERVER', `SOMA Core online at http://0.0.0.0:${PORT}`);
        });

        // 2. Database Health Check
        const dbPath = path.join(__dirname, 'soma-memory.db');
        if (fs.existsSync(dbPath)) {
            const stats = fs.statSync(dbPath);
            const sizeGB = stats.size / (1024 * 1024 * 1024);
            if (sizeGB > 2.0) {
                cLog('DATABASE', `⚠️  CRITICAL BLOAT: Database is ${sizeGB.toFixed(2)} GB!`, colors.red);
            } else {
                cLog('DATABASE', `✅ Health: ${sizeGB.toFixed(2)} GB`, colors.green);
            }
        }

        // 3. Pre-Flight
        await SystemValidator.runPreFlightChecks();

        // 4. Bootstrap - Register API Routes
        cLog('BOOTSTRAP', 'Initializing SOMA systems and routes...');
        const bootstrap = new SomaBootstrap();
        await bootstrap.initialize(app, server, wss);
        global.__SOMA_SYSTEM = bootstrap.system;

        // React SPA fallback: direct browser navigation to UI paths should
        // return the Command Bridge instead of Express' 404 handler.
        const frontendIndex = join(__dirname, 'frontend', 'dist', 'index.html');
        app.get(/^\/(?!api\/|health$|socket\.io|ws).*/, (req, res, next) => {
            if (req.method !== 'GET') return next();
            if (!fs.existsSync(frontendIndex)) return next();
            res.sendFile(frontendIndex);
        });

        // 🧠 MEMORY MANAGEMENT: Periodic GC if available
        if (global.gc) {
            setInterval(() => {
                const usage = process.memoryUsage();
                if (usage.heapUsed > 1500 * 1024 * 1024) { // > 1.5GB
                    cLog('SYSTEM', '🧤 High memory detected, triggering manual GC...');
                    global.gc();
                }
            }, 60000);
        }

        logSync('[BOOTSTRAP] Success - Routes Registered');

        // Mark server as ready so unhandled rejections don't crash it
        global.__SOMA_SERVER_READY = true;
        cLog('ULTRA', 'SOMA Fully Operational');

        // Start MessageBroker network bridge — lets external agents (MAX, etc.)
        // register as virtual arbiters and participate in the signal flow
        try {
            const { createRequire } = await import('module');
            const req = createRequire(import.meta.url);
            const broker = req('./core/MessageBroker.cjs');
            const bridgePort = parseInt(process.env.SOMA_BRIDGE_PORT || '4201');
            broker.startNetworkBridge(bridgePort);
        } catch (e) {
            cLog('WARN', `Network bridge skipped: ${e.message}`);
        }

    } catch (error) {
        logSync(`[FATAL] main() error: ${error.message}\n${error.stack}`);
        cLog('ERROR', `main() error: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

// Start Main
main();

// IMMORTALITY LOOP
setInterval(() => {
    // Keep event loop alive
}, 10000);
