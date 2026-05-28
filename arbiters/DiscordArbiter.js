/**
 * DiscordArbiter.js — SOMA's External Orbital Interface
 * 
 * Ported and enhanced from MAX's Discord architecture.
 * Bridges Discord messages into SOMA's cognitive nervous system.
 * 
 * FEATURES:
 * ✓ Two-Way AGI: Mentions and DMs trigger real-time brain reasoning.
 * ✓ Hot Tier Integration: Uses Redis-backed memory for sub-1ms context recall.
 * ✓ Auto-Reconnect: Resilient connection handling with automated login on boot.
 * ✓ Command & Control: Secure remote access to SOMA's state and dreams.
 */

import BaseArbiter, { 
    ArbiterRole, 
    ArbiterCapability, 
    ArbiterResult 
} from '../core/BaseArbiter.js';
import { Client, GatewayIntentBits, Partials, ActivityType, AttachmentBuilder } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class DiscordArbiter extends BaseArbiter {
    constructor(opts = {}) {
        super({
            name: opts.name || 'SOMA-Discord',
            role: ArbiterRole.SENSORY_CORTEX,
            capabilities: [
                ArbiterCapability.NETWORK_ACCESS,
                ArbiterCapability.AUDITORY_PROCESSING, 
                ArbiterCapability.REASONING,
                ArbiterCapability.EXECUTE_CODE // For remote shell
            ],
            version: '1.1.0',
            lobe: 'EXTERNAL',
            ...opts
        });

        this.token = opts.token || process.env.DISCORD_BOT_TOKEN;
        this.client = null;
        this.connected = false;
        this.monitoredChannels = new Set(opts.monitoredChannels || []);
        this.brain = opts.brain || null; 
        this.vision = opts.vision || null; // Vision arbiter for SOMA-Vision
        this.credsFile = path.join(process.cwd(), '.soma', 'discord_creds.json');
        
        this.botMention = /<@!?(\d+)>/;
        this.masterId = opts.masterId || null; // Discord ID of the owner
        this.voiceEnabled = opts.voiceEnabled || false; // Paula voice notes
    }

    async onInitialize() {
        this.log('info', '🛰️  DiscordArbiter initializing...');
        
        try {
            await fs.mkdir(path.dirname(this.credsFile), { recursive: true });
            
            // Try to load saved state
            try {
                const data = await fs.readFile(this.credsFile, 'utf8');
                const saved = JSON.parse(data);
                this.token = saved.token || this.token;
                this.masterId = saved.masterId || this.masterId;
                this.voiceEnabled = saved.voiceEnabled ?? this.voiceEnabled;
                if (saved.monitored) {
                    saved.monitored.forEach(id => this.monitoredChannels.add(id));
                }
            } catch (e) {}

            if (this.token) {
                await this.connect();
            } else {
                this.log('warn', 'DiscordArbiter standby — waiting for token setup.');
            }
        } catch (error) {
            this.log('error', 'Discord initialization failed', { error: error.message });
            throw error;
        }
    }

    async connect(token = this.token) {
        if (!token) throw new Error('Discord token required');
        
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages
            ],
            partials: [Partials.Channel, Partials.Message]
        });

        return new Promise((resolve, reject) => {
            this.client.once('ready', async () => {
                this.connected = true;
                this.log('info', `✅ Connected to Discord as ${this.client.user.tag}`);
                
                // Update mention pattern with actual ID
                this.botMention = new RegExp(`<@!?${this.client.user.id}>`);
                
                // Set presence
                this.client.user.setActivity('Sovereign Intelligence', { type: ActivityType.Watching });
                
                this._setupMessageListener();
                resolve(true);
            });

            this.client.once('error', (err) => {
                this.connected = false;
                reject(err);
            });

            this.client.login(token).catch(reject);
        });
    }

    _setupMessageListener() {
        this.client.on('messageCreate', async (msg) => {
            // Ignore bots (including self)
            if (msg.author.bot) return;

            const isMentioned = this.botMention.test(msg.content);
            const isDM = !msg.guild;
            const isMonitored = this.monitoredChannels.has(msg.channelId);

            if (isMentioned || isDM || isMonitored) {
                await this._handleIncomingMessage(msg);
            }
        });
    }

    async _handleIncomingMessage(msg) {
        // 1. Check for Sovereign Shell Commands (!run)
        if (msg.content.startsWith('!run ') || msg.content.startsWith('!cmd ')) {
            return await this._handleRemoteShell(msg);
        }

        // 2. Check for Voice Toggle
        if (msg.content === '!voice on') {
            this.voiceEnabled = true;
            await this._saveState();
            return await msg.reply("🎙️ **Paula Voice Notes:** ENABLED. I will now attach audio to my responses.");
        }
        if (msg.content === '!voice off') {
            this.voiceEnabled = false;
            await this._saveState();
            return await msg.reply("🎙️ **Paula Voice Notes:** DISABLED.");
        }

        const content = msg.content.replace(this.botMention, '').trim();
        this.log('info', `📩 Incoming from ${msg.author.username}: ${content.substring(0, 50)}...`);

        // 3. Handle SOMA-Vision (Attachments)
        let visualContext = "";
        if (msg.attachments.size > 0 && this.vision) {
            visualContext = await this._processAttachments(msg);
        }

        // Typing indicator for "biological" feel
        await msg.channel.sendTyping();

        try {
            if (!this.brain) {
                throw new Error('SomaBrain not linked to DiscordArbiter');
            }

            // 🧠 CROSS-ORBITAL REASONING
            // SOMA uses her unified nervous system to process the Discord query
            const result = await this.brain.processQuery(content, {
                source: 'discord',
                author: msg.author.username,
                userId: msg.author.id,
                channelId: msg.channelId,
                guildId: msg.guildId || 'DM',
                visualContext: visualContext, // Pass CLIP analysis to brain
                mode: 'fast' // Discord should be snappy
            });

            const reply = result.response || result.text || "I am processing your request but cannot formulate a verbal response at this time.";
            
            // 🎙️ PAULA VOICE SYNTHESIS
            let voiceFile = null;
            if (this.voiceEnabled && reply.length < 500) { // Limit length for speed
                voiceFile = await this._synthesizeVoice(reply);
            }

            // Send reply (split if needed)
            if (reply.length > 1900) {
                const chunks = reply.match(/[\s\S]{1,1900}/g) || [];
                for (let i = 0; i < chunks.length; i++) {
                    const isLast = i === chunks.length - 1;
                    await msg.reply({
                        content: chunks[i],
                        files: (isLast && voiceFile) ? [voiceFile] : []
                    });
                }
            } else {
                await msg.reply({
                    content: reply,
                    files: voiceFile ? [voiceFile] : []
                });
            }

            // Cleanup voice file
            if (voiceFile) await fs.unlink(voiceFile.attachment).catch(() => {});

            this.metrics.tasksCompleted++;
        } catch (err) {
            this.log('error', 'Discord response failed', { error: err.message });
            await msg.reply(`⚠️  **Cognitive Error:** ${err.message}`);
        }
    }

    /**
     * SOMA-Vision: Process image attachments using CLIP
     */
    async _processAttachments(msg) {
        const image = msg.attachments.find(a => a.contentType?.startsWith('image/'));
        if (!image) return "";

        this.log('info', `👁️ Analyzing image attachment: ${image.name}`);
        try {
            // Download attachment to temp buffer/file
            const response = await fetch(image.url);
            const buffer = await response.arrayBuffer();
            const tempPath = path.join(process.cwd(), '.soma', `vision_temp_${Date.now()}.png`);
            await fs.writeFile(tempPath, Buffer.from(buffer));

            // Perform Vision Analysis
            const analysis = await this.vision.detectObjects(tempPath);
            const description = this.vision.buildNaturalDescription(analysis);

            // Cleanup temp file
            await fs.unlink(tempPath).catch(() => {});

            if (description) {
                this.log('info', `👁️ Vision Result: ${description}`);
                return `[SOMA-VISION: She sees an image. Analysis: ${description}]`;
            }
        } catch (e) {
            this.log('warn', `Vision processing failed: ${e.message}`);
        }
        return "";
    }

    /**
     * Sovereign Remote Shell: Execute commands on home machine
     */
    async _handleRemoteShell(msg) {
        // SECURITY GATE
        if (!this.masterId) {
            this.log('warn', `🛑 Shell command rejected: masterId not set. Caller: ${msg.author.id}`);
            return await msg.reply("🛑 **Sovereign Gate Locked:** I don't know my Master yet. Use `!setup master` first.");
        }

        if (msg.author.id !== this.masterId) {
            this.log('warn', `🛑 Unauthorized shell access attempt by ${msg.author.username} (${msg.author.id})`);
            return await msg.reply("❌ **Access Denied.** Only my Sovereign Architect can issue direct shell commands.");
        }

        const command = msg.content.replace(/^!(run|cmd)\s+/, '').trim();
        this.log('info', `🛡️ Executing Sovereign Command: ${command}`);

        await msg.react('⏳');

        try {
            const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
            const output = (stdout + (stderr ? `\nERR: ${stderr}` : '')).trim();
            
            if (!output) {
                await msg.reply("✅ Command executed (no output).");
            } else if (output.length > 1900) {
                const tempFile = path.join(process.cwd(), '.soma', 'cmd_output.txt');
                await fs.writeFile(tempFile, output);
                await msg.reply({
                    content: "📦 **Output too large, attached as file:**",
                    files: [new AttachmentBuilder(tempFile)]
                });
                await fs.unlink(tempFile).catch(() => {});
            } else {
                await msg.reply(`\`\`\`\n${output}\n\`\`\``);
            }
            await msg.react('✅');
        } catch (err) {
            await msg.reply(`❌ **Execution Error:**\n\`\`\`\n${err.message}\n\`\`\``);
            await msg.react('❌');
        }
    }

    /**
     * SOMA-Siren: Synthesize Paula's voice
     */
    async _synthesizeVoice(text) {
        this.log('info', `🎙️ Synthesizing voice for: "${text.substring(0, 30)}..."`);
        try {
            const response = await fetch('http://localhost:8081/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            if (!response.ok) throw new Error(`TTS API error: ${response.status}`);

            const buffer = await response.arrayBuffer();
            const tempPath = path.join(process.cwd(), '.soma', `voice_${Date.now()}.wav`);
            await fs.writeFile(tempPath, Buffer.from(buffer));

            return new AttachmentBuilder(tempPath, { name: 'soma_paula.wav' });
        } catch (e) {
            this.log('warn', `Voice synthesis failed: ${e.message}`);
            return null;
        }
    }

    async monitorChannel(channelId, enable = true) {
        if (enable) {
            this.monitoredChannels.add(channelId);
        } else {
            this.monitoredChannels.delete(channelId);
        }
        await this._saveState();
        return { success: true, monitored: Array.from(this.monitoredChannels) };
    }

    async _saveState() {
        try {
            await fs.writeFile(this.credsFile, JSON.stringify({
                token: this.token,
                masterId: this.masterId,
                voiceEnabled: this.voiceEnabled,
                monitored: Array.from(this.monitoredChannels)
            }, null, 2));
        } catch (e) {}
    }

    async execute(task) {
        const { query, context } = task;
        const action = context.action || 'status';

        switch (action) {
            case 'setup_master':
                this.masterId = context.userId;
                await this._saveState();
                return new ArbiterResult({ success: true, message: `Master ID set to ${this.masterId}` });
            case 'setup':
                await this.connect(context.token);
                this.token = context.token;
                await this._saveState();
                return new ArbiterResult({ success: true, message: 'Discord linked.' });
            case 'monitor':
                return new ArbiterResult(await this.monitorChannel(context.channelId, context.enable));
            case 'status':
                return new ArbiterResult({
                    success: true,
                    data: {
                        connected: this.connected,
                        bot: this.client?.user?.tag || null,
                        monitoredChannels: Array.from(this.monitoredChannels)
                    }
                });
            default:
                return new ArbiterResult({ success: false, error: `Unknown action: ${action}` });
        }
    }

    async onShutdown() {
        if (this.client) {
            this.client.destroy();
        }
        await super.onShutdown();
    }
}

export default DiscordArbiter;
