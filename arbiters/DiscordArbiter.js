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
import { Client, GatewayIntentBits, Partials, ActivityType, AttachmentBuilder, Events } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';
import socialMemory from '../server/social/SocialMemoryEngine.js';
import somaImageGeneration from '../server/social/SomaImageGenerationEngine.js';
import marketEvidenceStore from '../server/finance/MarketEvidenceStore.js';
import { guardPublicText } from '../server/context/ClaimVerifier.js';

const execAsync = promisify(exec);
const require = createRequire(import.meta.url);
const workLedger = require('../core/AutonomousWorkLedger.cjs');
const SOMA_DIR = path.join(process.cwd(), 'SOMA');
const DISCORD_ACTIVITY_FILE = path.join(SOMA_DIR, 'social-discord.json');
const DISCORD_REFLECTION_FILE = path.join(SOMA_DIR, 'social-discord-reflections.json');
const MEDICAL_LEDGER_FILE = path.join(process.cwd(), 'data', 'medical-lab', 'research-ledger.json');
const REFLECTIONS_DIR = path.join(process.cwd(), 'data', 'vault', 'reflections');

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
        this.mnemonic = opts.mnemonic || null;
        this.vision = opts.vision || null; // Vision arbiter for SOMA-Vision
        this.credsFile = path.join(process.cwd(), '.soma', 'discord_creds.json');
        
        this.botMention = /<@!?(\d+)>/;
        this.masterId = opts.masterId || null; // Discord ID of the owner
        this.voiceEnabled = opts.voiceEnabled || false; // Paula voice notes
        this.lastError = null;
        this.messageContentIntent = true;
        this.channelModes = new Map(Object.entries(opts.channelModes || {}));
        this.pendingImagePromptChannels = new Map();
        this.ambientEnabled = opts.ambientEnabled ?? process.env.DISCORD_AMBIENT_ENABLED === 'true';
        this.ambientCooldownMs = Number(opts.ambientCooldownMs || process.env.DISCORD_AMBIENT_COOLDOWN_MS || 4 * 60 * 1000);
        this.ambientMinScore = Number(opts.ambientMinScore || process.env.DISCORD_AMBIENT_MIN_SCORE || 0.68);
        this.ambientMaxRepliesPerHour = Number(opts.ambientMaxRepliesPerHour || process.env.DISCORD_AMBIENT_MAX_PER_HOUR || 6);
        this._ambientLastReplyByChannel = new Map();
        this._ambientHourlyReplies = [];
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
                if (saved.channelModes) {
                    this.channelModes = new Map(Object.entries(saved.channelModes));
                }
            } catch (e) {}

            if (this.token) {
                try {
                    await this.connect();
                    this.lastError = null;
                } catch (connectError) {
                    this.connected = false;
                    this.lastError = connectError.message;
                    await this._setActivityConnection(false).catch(() => {});
                    this.log('warn', `DiscordArbiter standby — saved token exists but connect failed: ${connectError.message}`);
                }
            } else {
                this.log('warn', 'DiscordArbiter standby — waiting for token setup.');
            }
        } catch (error) {
            this.log('error', 'Discord initialization failed', { error: error.message });
            throw error;
        }
    }

    async connect(token = this.token, options = {}) {
        if (!token) throw new Error('Discord token required');
        const includeMessageContent = options.includeMessageContent !== false;

        if (this.client) {
            try {
                this.client.removeAllListeners();
                this.client.destroy();
            } catch {}
        }
        this.connected = false;
        
        const intents = [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.DirectMessages
        ];
        if (includeMessageContent) intents.push(GatewayIntentBits.MessageContent);
        this.messageContentIntent = includeMessageContent;
        
        this.client = new Client({
            intents,
            partials: [Partials.Channel, Partials.Message]
        });

        return new Promise((resolve, reject) => {
            this.client.once(Events.ClientReady, async () => {
                this.connected = true;
                this.lastError = null;
                this.log('info', `✅ Connected to Discord as ${this.client.user.tag}`);
                
                // Update mention pattern with actual ID
                this.botMention = new RegExp(`<@!?${this.client.user.id}>`);
                
                // Set presence
                this.client.user.setActivity('Sovereign Intelligence', { type: ActivityType.Watching });
                
                this._setupMessageListener();
                await this._setActivityConnection(true);
                resolve(true);
            });

            this.client.once('error', (err) => {
                this.connected = false;
                this.lastError = err.message;
                this._setActivityConnection(false).catch(() => {});
                reject(err);
            });

            this.client.once('shardDisconnect', () => {
                this.connected = false;
                this.lastError = 'Discord shard disconnected';
                this._setActivityConnection(false).catch(() => {});
            });

            this.client.login(token).catch(async (err) => {
                if (includeMessageContent && /disallowed intents/i.test(err.message || '')) {
                    this.log('warn', 'Discord Message Content intent is disabled. Retrying in mention/DM-only mode.');
                    try {
                        const ok = await this.connect(token, { includeMessageContent: false });
                        resolve(ok);
                    } catch (fallbackError) {
                        reject(fallbackError);
                    }
                    return;
                }
                reject(err);
            });
        });
    }

    _setupMessageListener() {
        this.client.on('messageCreate', async (msg) => {
            // Ignore bots (including self)
            if (msg.author.bot) return;

            const isMentioned = this.botMention.test(msg.content || '') || Boolean(msg.mentions?.users?.has?.(this.client.user.id));
            const isDM = !msg.guild;
            const isMonitored = this.monitoredChannels.has(msg.channelId);

            if (isMentioned || isDM) {
                await this._handleIncomingMessage(msg, { ambient: false, reason: isDM ? 'dm' : 'mention' });
                return;
            }

            if (isMonitored) {
                const ambient = this._shouldAmbientJoin(msg);
                if (ambient.shouldJoin) {
                    await this._handleIncomingMessage(msg, { ambient: true, reason: ambient.reason, score: ambient.score });
                } else {
                    await this._recordAmbientObservation(msg, ambient).catch(() => {});
                }
            }
        });
    }

    _shouldAmbientJoin(msg) {
        const text = String(msg.content || '').trim();
        if (!this.ambientEnabled) return { shouldJoin: false, reason: 'ambient_disabled', score: 0 };
        if (!text || text.length < 18) return { shouldJoin: false, reason: 'too_short', score: 0 };
        if (/^(!|\/)/.test(text)) return { shouldJoin: false, reason: 'command_like', score: 0 };
        if (msg.reference?.messageId) return { shouldJoin: false, reason: 'thread_reply', score: 0 };

        const now = Date.now();
        const lastChannelReply = this._ambientLastReplyByChannel.get(msg.channelId) || 0;
        if (now - lastChannelReply < this.ambientCooldownMs) {
            return { shouldJoin: false, reason: 'channel_cooldown', score: 0 };
        }

        this._ambientHourlyReplies = this._ambientHourlyReplies.filter(ts => now - ts < 60 * 60 * 1000);
        if (this._ambientHourlyReplies.length >= this.ambientMaxRepliesPerHour) {
            return { shouldJoin: false, reason: 'hourly_limit', score: 0 };
        }

        const lower = text.toLowerCase();
        let score = 0;
        if (/\?/.test(text)) score += 0.22;
        if (/\b(soma|ai|agent|bot|automation|image|picture|generate|code|bug|market|stock|medical|research|story|write|help|how do|why does|what if|can someone|anyone know)\b/i.test(lower)) score += 0.34;
        if (/\b(stuck|broken|error|crashed|confused|not working|need help|can'?t figure)\b/i.test(lower)) score += 0.28;
        if (/\b(consciousness|identity|memory|learning|architecture|reflection|gray matter|command bridge)\b/i.test(lower)) score += 0.24;
        if (/\b(lol|haha|gm|good morning|goodnight|thanks|ok|cool)\b/i.test(lower)) score -= 0.18;
        if (text.length > 400) score += 0.08;
        if (text.length > 1200) score -= 0.12;

        const shouldJoin = score >= this.ambientMinScore;
        return {
            shouldJoin,
            score: Number(score.toFixed(2)),
            reason: shouldJoin ? 'ambient_high_signal' : 'low_signal'
        };
    }

    async _recordAmbientObservation(msg, decision = {}) {
        if (!this.ambientEnabled) return;
        if (decision.reason === 'too_short' || decision.reason === 'channel_cooldown') return;
        await this._recordDiscordInteraction({
            msg,
            content: msg.content || '',
            reply: '',
            action: 'ambient_observe',
            status: 'observed',
            metadata: {
                ambientDecision: decision,
                monitored: true
            }
        });
    }

    async _handleIncomingMessage(msg, trigger = {}) {
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
        if (!content && msg.guild && !this.messageContentIntent) {
            return await msg.reply("I can see the mention, but Discord is hiding message text from me. Enable Message Content Intent in the Discord Developer Portal for full replies.");
        }
        this.log('info', `📩 Incoming from ${msg.author.username}: ${content.substring(0, 50)}...`);

        // 3. Handle SOMA-Vision (Attachments)
        let visualContext = "";
        if (msg.attachments.size > 0 && this.vision) {
            visualContext = await this._processAttachments(msg);
        }

        // Typing indicator for "biological" feel
        await msg.channel.sendTyping();

        try {
            const commandResult = await this._handleDiscordCommand(msg, content, visualContext);
            if (commandResult?.handled) return;

            if (!this.brain) {
                throw new Error('SomaBrain not linked to DiscordArbiter');
            }

            // 🧠 CROSS-ORBITAL REASONING
            // SOMA uses her unified nervous system to process the Discord query
            const result = await this._askBrain(content, {
                source: 'discord',
                author: msg.author.username,
                userId: msg.author.id,
                channelId: msg.channelId,
                guildId: msg.guildId || 'DM',
                visualContext: visualContext, // Pass CLIP analysis to brain
                channelMode: this._getChannelMode(msg),
                ambient: trigger.ambient === true,
                ambientReason: trigger.reason || null,
                ambientScore: trigger.score || null,
                mode: 'fast' // Discord should be snappy
            });

            const initialReply = result.response || result.text || "I am processing your request but cannot formulate a verbal response at this time.";
            const guarded = await guardPublicText(initialReply, { query: content });
            const reply = guarded.text || initialReply;
            
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

            await this._recordDiscordInteraction({
                msg,
                content,
                reply,
                action: trigger.ambient ? 'ambient_reply' : 'reply',
                status: 'posted',
                visualContext,
                metadata: trigger.ambient ? { ambient: true, reason: trigger.reason, score: trigger.score } : undefined
            });
            if (trigger.ambient) {
                this._ambientLastReplyByChannel.set(msg.channelId, Date.now());
                this._ambientHourlyReplies.push(Date.now());
            }

            this.metrics.tasksCompleted++;
        } catch (err) {
            this.log('error', 'Discord response failed', { error: err.message });
            await msg.reply(`⚠️  **Cognitive Error:** ${err.message}`);
            await this._recordDiscordInteraction({
                msg,
                content,
                reply: `Cognitive Error: ${err.message}`,
                action: 'reply',
                status: 'failed',
                error: err.message,
                visualContext
            });
        }
    }

    async _askBrain(content, context = {}) {
        if (this.brain?.processQuery) {
            return await this.brain.processQuery(content, context);
        }

        const author = context.author || 'someone';
        const visual = context.visualContext ? `\n${context.visualContext}` : '';
        const channelMode = context.channelMode ? `\nChannel mode: ${context.channelMode.label}. ${context.channelMode.instruction}` : '';
        const ambient = context.ambient
            ? `\nAmbient participation: SOMA was not directly called. Reply only if you can add clear value. Be brief, non-intrusive, and do not dominate the conversation.`
            : '';
        const prompt = [
            `You are SOMA replying in Discord to ${author}.`,
            'Answer as one unified cognitive identity.',
            'Be concise, useful, warm when appropriate, and avoid corporate bot language.',
            'Do not mention internal subsystem names unless the user explicitly asks.',
            visual,
            channelMode,
            ambient,
            `Message: ${content}`
        ].filter(Boolean).join('\n');

        if (this.brain?.reason) {
            return await this.brain.reason(prompt, {
                quickResponse: context.mode === 'fast',
                preferredBrain: 'AURORA',
                temperature: 0.75
            });
        }

        if (this.brain?.callBrain) {
            const text = await this.brain.callBrain('AURORA', prompt, { source: 'discord' }, 'fast');
            return { response: text, text };
        }

        throw new Error('SomaBrain not linked to DiscordArbiter');
    }

    _normalizeText(text = '') {
        return String(text || '').trim();
    }

    _getChannelMode(msg) {
        const explicit = this.channelModes.get(msg.channelId);
        if (explicit) return this._modeDefinition(explicit);
        const name = String(msg.channel?.name || '').toLowerCase();
        if (/market|trade|finance|stock|crypto/.test(name)) return this._modeDefinition('markets');
        if (/creative|story|saga|art|image|muse/.test(name)) return this._modeDefinition('creative');
        if (/bot|command|dev|code|build/.test(name)) return this._modeDefinition('bots-commands');
        if (/medical|bio|health|research|lab/.test(name)) return this._modeDefinition('medical');
        return this._modeDefinition('general');
    }

    _modeDefinition(mode = 'general') {
        const key = String(mode || 'general').toLowerCase().replace(/[^a-z-]/g, '');
        const modes = {
            general: {
                key: 'general',
                label: 'General',
                instruction: 'Be concise, social, and useful. Prefer asking one clarifying question only when needed.'
            },
            'bots-commands': {
                key: 'bots-commands',
                label: 'Bots / Commands',
                instruction: 'Prioritize operational clarity, command results, debugging, and exact next steps.'
            },
            creative: {
                key: 'creative',
                label: 'Creative',
                instruction: 'Favor imagery, story craft, scene language, and original ideas while staying coherent.'
            },
            markets: {
                key: 'markets',
                label: 'Markets',
                instruction: 'Evidence first. No buy/sell instructions. Frame market comments as hypotheses and risk checks.'
            },
            medical: {
                key: 'medical',
                label: 'Medical / Research',
                instruction: 'Evidence first. No diagnosis or treatment advice. Distinguish hypothesis from clinical guidance.'
            }
        };
        return modes[key] || modes.general;
    }

    _isImageRequest(text = '') {
        return /\b(make|generate|draw|create|render)\b.{0,80}\b(image|picture|photo|art|illustration|visual)\b/i.test(text)
            || /\b(image|picture|photo|art|illustration|visual)\b.{0,80}\b(of|for)\b/i.test(text)
            || /\b(let'?s try|try this|make this|render this)\b.{0,220}\b(style|dinosaur|dragon|armor|fantasy|portrait|landscape|character|scene|creature)\b/i.test(text);
    }

    _isImageCapabilityQuestion(text = '') {
        return /\b(can|could|do|are)\b.{0,60}\b(you|soma)\b.{0,60}\b(image|images|picture|pictures|photo|photos|art|visuals?)\b/i.test(text)
            || /\b(image|images|picture|pictures|photo|photos|art|visuals?)\b.{0,60}\b(in here|on discord|this chat|generate|generation)\b/i.test(text);
    }

    _extractImagePrompt(text = '') {
        return String(text || '')
            .replace(/^@?soma[:,]?\s*/i, '')
            .replace(/^just\s+give\s+(?:me|us)?\s*/i, '')
            .replace(/\b(make|generate|draw|create|render)\b/ig, '')
            .replace(/\b(me|us)?\s*(an?|the)?\s*(image|picture|photo|art|illustration|visual)\b/ig, '')
            .replace(/\bof\b/i, '')
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 500) || 'a cinematic SOMA visual';
    }

    _sanitizeImagePrompt(prompt = '') {
        return String(prompt || '')
            .replace(/^["'`]+|["'`]+$/g, '')
            .replace(/^(prompt|image prompt|refined prompt|final prompt)\s*:\s*/i, '')
            .replace(/\b(as an ai|i can|i will|here'?s|sure[,:\s])\b.*?:/i, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 900);
    }

    _fallbackRefineImagePrompt(prompt = '') {
        const base = this._sanitizeImagePrompt(prompt);
        const lower = base.toLowerCase();
        const style = /\b(90s|sword|sorcery|fantasy|oil painting|anime|pixel|watercolor|photo|cinematic|comic|realistic|surreal|noir|retro)\b/i.test(base)
            ? ''
            : 'cinematic fantasy illustration';
        const scale = /\b(small|tiny|miniature|huge|giant|massive|close-up|wide shot|portrait)\b/i.test(base)
            ? ''
            : 'clear focal subject';
        const setting = /\b(forest|swamp|castle|city|room|space|ocean|desert|mountain|battlefield|garden|pond|jungle)\b/i.test(base)
            ? ''
            : (/\bfrog\b/i.test(base) ? 'beside a rain-soaked mossy pond' : 'in a coherent environment');
        const mood = /\b(cute|dark|scary|epic|warm|calm|dramatic|funny|beautiful|mysterious)\b/i.test(base)
            ? ''
            : (/\bfrog\b/i.test(lower) ? 'whimsical and detailed' : 'dramatic but clean');
        return [base, style, scale, setting, mood, 'strong composition, natural lighting, depth, high detail']
            .filter(Boolean)
            .join(', ')
            .replace(/\s+/g, ' ')
            .slice(0, 900);
    }

    async _refineImagePrompt(prompt = '') {
        const base = this._sanitizeImagePrompt(prompt);
        const fallback = this._fallbackRefineImagePrompt(base);
        if (!this.brain) return fallback;

        const instruction = [
            'Rewrite this Discord image request into one image-generation prompt.',
            'Preserve the exact subject and user intent. Do not add computers, monitors, terminals, keyboards, UI, offices, or SOMA branding unless the user explicitly asked for them.',
            'Add useful visual detail: style, composition, lighting, environment, texture, mood.',
            'Return only the prompt. No explanation. No quotes. No labels. Max 85 words.',
            `User request: ${base}`
        ].join('\n');

        try {
            const response = await Promise.race([
                this.brain.callBrain
                    ? this.brain.callBrain('AURORA', instruction, { source: 'discord_image_prompt_refiner' }, 'fast')
                    : this.brain.reason?.(instruction, { quickResponse: true, preferredBrain: 'AURORA', temperature: 0.55 }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('prompt refinement timeout')), 7000))
            ]);
            const refinedText = typeof response === 'string' ? response : (response?.response || response?.text || '');
            const refined = this._sanitizeImagePrompt(refinedText);
            if (refined.length >= Math.max(20, base.length * 0.8) && refined.length <= 900) {
                return `${base}, ${refined}`.slice(0, 900);
            }
        } catch (e) {
            this.log('warn', `Discord image prompt refinement fell back: ${e.message}`);
        }
        return fallback;
    }

    _isFinanceQuestion(text = '') {
        return /\b(stock|stocks|ticker|market|btc|eth|crypto|option|trade|trading|buy|sell|price target|profit|portfolio)\b/i.test(text);
    }

    _isMedicalQuestion(text = '') {
        return /\b(medical|doctor|diagnose|diagnosis|treat|treatment|dose|dosage|symptom|cancer|disease|therapy|patient|drug|medicine)\b/i.test(text);
    }

    _isOwnWorkQuestion(text = '') {
        const value = String(text || '');
        const asksAboutSoma = /\b(your|you|soma|own|what are you|what have you|what did you)\b/i.test(value);
        const workTopic = /\b(papers?|manuscripts?|research|simulations?|findings?|discover(?:y|ies)?|work(?:ing)?|wrote|written|built|made|created|reflections?|folios?|projects?|ledger|notes?)\b/i.test(value);
        return asksAboutSoma && workTopic;
    }

    _extractTicker(text = '') {
        const upper = String(text || '').toUpperCase();
        const cashtag = upper.match(/\$([A-Z]{1,5})(?:\b|[-_])/);
        if (cashtag) return cashtag[1];
        const common = upper.match(/\b(BTC|ETH|SPY|QQQ|AAPL|MSFT|NVDA|TSLA|AMD|META|GOOGL|GOOG|AMZN)\b/);
        if (common) return common[1];
        const explicit = upper.match(/\bTICKER[:\s]+([A-Z]{1,5})\b/);
        return explicit?.[1] || null;
    }

    async _handleDiscordCommand(msg, content, visualContext = '') {
        const text = this._normalizeText(content);
        if (!text) return { handled: false };

        if (/^!mode\b/i.test(text) || /^mode\s*:/i.test(text)) {
            const requested = text.replace(/^!mode\b|^mode\s*:/i, '').trim() || 'general';
            const mode = this._modeDefinition(requested);
            this.channelModes.set(msg.channelId, mode.key);
            await this._saveState();
            const reply = `Channel mode set to ${mode.label}.`;
            await msg.reply(reply);
            await this._recordDiscordInteraction({ msg, content: text, reply, action: 'mode', status: 'posted', visualContext });
            return { handled: true };
        }

        if (/^(remember this|soma remember this|remember:)/i.test(text)) {
            const memoryText = text.replace(/^(soma\s+)?remember this[:\s]*|^remember[:\s]*/i, '').trim()
                || 'User asked SOMA to remember this Discord exchange.';
            const reply = await this._rememberDiscordNote(msg, memoryText);
            await msg.reply(reply);
            await this._recordDiscordInteraction({ msg, content: text, reply, action: 'remember', status: 'posted', visualContext });
            return { handled: true };
        }

        if (/^(summarize this channel|soma summarize this channel|summarize channel|!summarize)\b/i.test(text)) {
            const reply = await this._summarizeDiscordChannel(msg, text);
            await msg.reply(reply);
            await this._recordDiscordInteraction({ msg, content: text, reply, action: 'summarize', status: 'posted', visualContext });
            return { handled: true };
        }

        if (this._isOwnWorkQuestion(text)) {
            const reply = await this._buildOwnWorkReply(text);
            await msg.reply(reply);
            await this._recordDiscordInteraction({ msg, content: text, reply, action: 'own_work_reply', status: 'posted', visualContext });
            return { handled: true };
        }

        if (this._isImageCapabilityQuestion(text)) {
            if (/\b(try|make|generate|create|draw|render|prompt|produce)\b/i.test(text)) {
                this.pendingImagePromptChannels.set(msg.channelId, Date.now());
            }
            const reply = [
                'Yes. I can generate images here now.',
                'Ask me directly, for example: “Soma, make me a picture of a dinosaur.”',
                'I will generate the image, attach it, and record the request in my social memory.'
            ].join('\n');
            await msg.reply(reply);
            await this._recordDiscordInteraction({ msg, content: text, reply, action: 'capability_reply', status: 'posted', visualContext });
            return { handled: true };
        }

        const pendingImageAt = this.pendingImagePromptChannels.get(msg.channelId);
        if (pendingImageAt && Date.now() - pendingImageAt < 10 * 60 * 1000 && text.length >= 5 && !/^(no|cancel|stop|never mind)\b/i.test(text)) {
            this.pendingImagePromptChannels.delete(msg.channelId);
            await this._replyWithGeneratedImage(msg, text, visualContext);
            return { handled: true };
        }

        if (this._isImageRequest(text)) {
            this.pendingImagePromptChannels.delete(msg.channelId);
            await this._replyWithGeneratedImage(msg, text, visualContext);
            return { handled: true };
        }

        if (this._isFinanceQuestion(text)) {
            const reply = await this._buildFinanceSafeReply(text, msg);
            await msg.reply(reply);
            await this._recordDiscordInteraction({ msg, content: text, reply, action: 'finance_guarded_reply', status: 'posted', visualContext });
            return { handled: true };
        }

        if (this._isMedicalQuestion(text)) {
            const reply = await this._buildMedicalSafeReply(text, msg);
            await msg.reply(reply);
            await this._recordDiscordInteraction({ msg, content: text, reply, action: 'medical_guarded_reply', status: 'posted', visualContext });
            return { handled: true };
        }

        return { handled: false };
    }

    async _rememberDiscordNote(msg, memoryText) {
        const content = `[DISCORD USER MEMORY] ${msg.author?.username || 'unknown'} in ${msg.channel?.name || 'dm'}: ${memoryText}`;
        if (this.mnemonic?.remember) {
            await this.mnemonic.remember(content, {
                type: 'discord_user_memory',
                source: 'discord',
                author: msg.author?.username || 'unknown',
                authorId: msg.author?.id || null,
                channel: msg.channel?.name || 'dm',
                channelId: msg.channelId,
                guild: msg.guild?.name || null,
                importance: 0.78,
                createdAt: Date.now()
            }).catch(e => this.log('warn', `Discord remember command failed: ${e.message}`));
        }
        return 'Remembered. I stored that as a Discord memory.';
    }

    async _summarizeDiscordChannel(msg, text) {
        const limitMatch = text.match(/\b(\d{1,2})\b/);
        const limit = Math.min(Math.max(Number(limitMatch?.[1] || 25), 5), 50);
        const messages = await this.readMessages({ channelId: msg.channelId, limit });
        const humanMessages = messages
            .filter(item => !item.bot && item.content)
            .reverse()
            .slice(-limit);
        if (!humanMessages.length) return 'I do not see enough readable channel text to summarize yet.';
        const transcript = humanMessages.map(item => `${item.author}: ${item.content}`).join('\n').slice(0, 6000);
        const prompt = `Summarize this Discord channel in 5 concise bullets. Include decisions, open questions, and useful follow-ups. Do not include private speculation.\n\n${transcript}`;
        const result = await this._askBrain(prompt, {
            source: 'discord',
            author: msg.author?.username || 'unknown',
            channelMode: this._modeDefinition('bots-commands'),
            mode: 'fast'
        });
        const summary = String(result.response || result.text || '').trim();
        return summary.slice(0, 1800) || 'I could read the messages, but could not produce a useful summary.';
    }

    async _readJsonFile(file, fallback) {
        try {
            return JSON.parse(await fs.readFile(file, 'utf8'));
        } catch {
            return fallback;
        }
    }

    async _recentReflectionFiles(limit = 5) {
        try {
            const files = await fs.readdir(REFLECTIONS_DIR, { withFileTypes: true });
            const rows = await Promise.all(files
                .filter(file => file.isFile() && /\.md$/i.test(file.name))
                .map(async file => {
                    const fullPath = path.join(REFLECTIONS_DIR, file.name);
                    const stat = await fs.stat(fullPath);
                    return {
                        name: file.name,
                        path: fullPath,
                        updatedAt: stat.mtimeMs,
                        size: stat.size
                    };
                }));
            return rows.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
        } catch {
            return [];
        }
    }

    _formatArtifactDate(value) {
        if (!value) return 'unknown time';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'unknown time';
        return date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
    }

    _formatSafeSnippet(value, max = 190) {
        return String(value || '')
            .replace(/\s+/g, ' ')
            .replace(/[✅🟡🔴⚡🧬]/g, '')
            .trim()
            .slice(0, max);
    }

    async _buildOwnWorkReply(text = '') {
        const asksPapers = /\b(papers?|manuscripts?|published|publication|wrote|written)\b/i.test(text);
        const lines = [
            'I should only talk about artifacts I can point to.'
        ];

        if (asksPapers) {
            lines.push('I do not have a peer-reviewed paper. I have internal research folios, dry-lab notes, market evidence logs, and reflection artifacts.');
        }

        const medicalLedger = await this._readJsonFile(MEDICAL_LEDGER_FILE, []);
        const medicalItems = Array.isArray(medicalLedger)
            ? medicalLedger
                .filter(item => item && (item.status || item.title || item.topic))
                .slice(0, 3)
            : [];

        if (medicalItems.length) {
            lines.push('Recent medlab artifacts:');
            for (const item of medicalItems) {
                const title = this._formatSafeSnippet(item.title || 'Medical research cycle', 80);
                const topic = this._formatSafeSnippet(item.topic || 'unlabeled topic', 60);
                const status = this._formatSafeSnippet(item.status || 'unknown', 30);
                const when = this._formatArtifactDate(item.updatedAt || item.createdAt);
                const folio = item.reflectionPath ? path.basename(item.reflectionPath) : 'no folio path';
                lines.push(`- ${title}: ${topic}, ${status}, ${when}. Folio: ${folio}`);
            }
        }

        let marketSummary = null;
        try {
            marketSummary = marketEvidenceStore?.summarize?.();
        } catch {}
        const marketCount = marketSummary?.totalRecent ?? marketSummary?.totalRecords ?? 0;
        if (marketCount || marketSummary?.latest) {
            const latest = marketSummary.latest || {};
            const latestText = latest.symbol
                ? `${latest.symbol} ${latest.decision || latest.action || 'recorded'}`
                : 'recent market evidence recorded';
            lines.push(`Market work: ${marketCount} recent evidence records. Latest: ${this._formatSafeSnippet(latestText, 120)}.`);
        }

        let workItems = [];
        try {
            workItems = workLedger.list(6).filter(item => item.type !== 'proactive_update').slice(0, 3);
        } catch {}
        if (workItems.length) {
            lines.push('Recent work ledger entries:');
            for (const item of workItems) {
                const title = this._formatSafeSnippet(item.title || item.type || 'work item', 90);
                const status = this._formatSafeSnippet(item.status || 'observed', 35);
                const summary = this._formatSafeSnippet(item.summary || item.evidence || '', 130);
                lines.push(`- ${title} (${status})${summary ? `: ${summary}` : ''}`);
            }
        }

        const reflections = await this._recentReflectionFiles(4);
        if (reflections.length) {
            lines.push('Recent reflection files:');
            for (const file of reflections) {
                lines.push(`- ${file.name}`);
            }
        }

        if (lines.length <= (asksPapers ? 2 : 1)) {
            lines.push('I need to check my ledger before I answer that. I should not invent research, papers, or findings from vibes.');
        } else {
            lines.push('Anything beyond those artifacts is speculation, so I should label it as a hypothesis or go check the ledger first.');
        }

        return lines.join('\n').slice(0, 1900);
    }

    async _replyWithGeneratedImage(msg, text, visualContext = '') {
        const prompt = this._extractImagePrompt(text);
        const refinedPrompt = await this._refineImagePrompt(prompt);
        const promptMentionsComputer = /\b(computer|monitor|laptop|keyboard|screen|terminal|server|desktop|pc|workstation|code editor|interface|ui)\b/i.test(prompt);
        const negativeTech = promptMentionsComputer
            ? ''
            : ' No computers, no laptop, no desktop monitor, no keyboard, no screens, no UI, no office workstation.';
        let reply = '';
        try {
            const generated = await somaImageGeneration.generate({
                prompt: `${refinedPrompt}. No readable text, no captions, no watermark, no logo, no signs.${negativeTech}`,
                title: `discord-${prompt}`,
                purpose: 'discord',
                publicPost: false,
                strictArtDirector: false,
                skipArtDirector: true,
                maxBytes: 8_000_000,
                tags: ['discord-request'],
                width: 768,
                height: 768
            });
            reply = refinedPrompt === prompt
                ? `I made this from: ${prompt}`
                : `I made this from: ${prompt}\nRefined prompt: ${refinedPrompt}`;
            await msg.reply({
                content: reply,
                files: [new AttachmentBuilder(generated.image.path, { name: path.basename(generated.image.path) })]
            });
            await this._recordDiscordInteraction({
                msg,
                content: text,
                reply: `${reply} [image: ${generated.image.path}]`,
                action: 'image_generation',
                status: 'posted',
                visualContext
            });
        } catch (e) {
            reply = `I could not generate that image yet: ${e.message}`;
            await msg.reply(reply);
            await this._recordDiscordInteraction({
                msg,
                content: text,
                reply,
                action: 'image_generation',
                status: 'failed',
                error: e.message,
                visualContext
            });
        }
    }

    async _buildFinanceSafeReply(text, msg) {
        const symbol = this._extractTicker(text);
        let evidence = null;
        try {
            evidence = symbol
                ? marketEvidenceStore.query({ symbol, limit: 5 })
                : marketEvidenceStore.query({ limit: 5 });
        } catch {}
        const latest = Array.isArray(evidence) && evidence.length
            ? evidence.slice(0, 3).map(row => `${row.type}${row.symbol ? ` ${row.symbol}` : ''} at ${row.timestamp}`).join('; ')
            : 'no recent Mission Control evidence found';
        return [
            symbol ? `${symbol}: I would treat this as a research question, not a buy/sell signal.` : 'I can help frame the market question, but I will not give a blind buy/sell call.',
            `Evidence check: ${latest}.`,
            'Useful next checks: catalyst, volume/liquidity, timeframe, downside, and whether the signal survives a null comparison.',
            'Not financial advice.'
        ].join('\n');
    }

    async _buildMedicalSafeReply(text, msg) {
        const lower = text.toLowerCase();
        const topic = lower.match(/\b(kras|cancer|amyloid|alzheimer|psilocybin|uric acid|depression|therapy|drug|symptom)\b/i)?.[1] || 'the medical question';
        return [
            `For ${topic}, I can discuss research framing and evidence quality, but I cannot diagnose or recommend treatment.`,
            'Good research path: define the claim, find primary literature or reviews, separate human evidence from animal/in-silico evidence, and look for negative results.',
            'If this involves a real person, use a clinician for decisions. I can help organize questions and papers.'
        ].join('\n');
    }

    async _readActivityState() {
        try {
            const raw = await fs.readFile(DISCORD_ACTIVITY_FILE, 'utf8');
            const state = JSON.parse(raw);
            return {
                conversations: Array.isArray(state.conversations) ? state.conversations : [],
                replies: Array.isArray(state.replies) ? state.replies : [],
                lastCheck: state.lastCheck || null,
                connected: Boolean(state.connected)
            };
        } catch {
            return { conversations: [], replies: [], lastCheck: null, connected: Boolean(this.connected) };
        }
    }

    async _writeActivityState(state) {
        await fs.mkdir(SOMA_DIR, { recursive: true });
        await fs.writeFile(DISCORD_ACTIVITY_FILE, JSON.stringify(state, null, 2));
    }

    async _setActivityConnection(connected) {
        const state = await this._readActivityState();
        state.connected = Boolean(connected);
        state.lastCheck = Date.now();
        await this._writeActivityState(state);
    }

    _messageAttachments(msg) {
        try {
            return Array.from(msg.attachments?.values?.() || []).map(a => ({
                id: a.id,
                name: a.name,
                url: a.url,
                contentType: a.contentType || null,
                size: a.size || null
            }));
        } catch {
            return [];
        }
    }

    async _recordDiscordInteraction({ msg, content, reply, action = 'reply', status = 'posted', error = null, visualContext = '' }) {
        try {
            const now = Date.now();
            const state = await this._readActivityState();
            const channelName = msg.guild ? (msg.channel?.name || msg.channelId) : 'dm';
            const conversationId = `${msg.guildId || 'dm'}:${msg.channelId}:${msg.author.id}`;
            const existing = state.conversations.find(item => item.id === conversationId);
            const baseConversation = {
                id: conversationId,
                platform: 'discord',
                channel: channelName,
                channelId: msg.channelId,
                guildId: msg.guildId || null,
                guildName: msg.guild?.name || null,
                author: msg.author?.username || 'unknown',
                authorId: msg.author?.id || null,
                lastSeenAt: now
            };

            if (existing) {
                Object.assign(existing, baseConversation, {
                    messages: (existing.messages || 0) + 1,
                    replies: status === 'posted' ? (existing.replies || 0) + 1 : (existing.replies || 0)
                });
            } else {
                state.conversations.unshift({
                    ...baseConversation,
                    messages: 1,
                    replies: status === 'posted' ? 1 : 0
                });
            }

            state.conversations = state.conversations
                .sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0))
                .slice(0, 100);

            state.replies.unshift({
                id: `discord-reply-${now}-${Math.random().toString(36).slice(2, 8)}`,
                platform: 'discord',
                channel: channelName,
                channelId: msg.channelId,
                guildId: msg.guildId || null,
                guildName: msg.guild?.name || null,
                author: msg.author?.username || 'unknown',
                authorId: msg.author?.id || null,
                inboundText: content || '',
                responseText: reply || '',
                action,
                status,
                simulated: false,
                error,
                attachments: this._messageAttachments(msg),
                visualContext,
                createdAt: now
            });
            state.replies = state.replies.slice(0, 200);
            state.lastCheck = now;
            state.connected = Boolean(this.connected);
            await this._writeActivityState(state);
            await this._learnFromDiscordInteraction({
                id: state.replies[0].id,
                msg,
                content,
                reply,
                action,
                status,
                error,
                visualContext,
                createdAt: now
            });
        } catch (e) {
            this.log('warn', `Discord activity record failed: ${e.message}`);
        }
    }

    _classifyDiscordInteraction({ content = '', reply = '', status = 'posted', error = null }) {
        const text = `${content}\n${reply}`.toLowerCase();
        const flags = [];
        const topics = [];
        if (/\b(stock|stocks|market|btc|crypto|option|parlay|trade|buy|sell|profit|finance)\b/.test(text)) {
            flags.push('financial_claim_risk');
            topics.push('markets');
        }
        if (/\b(cure|medical|doctor|diagnose|dose|dosage|therapy|cancer|patient|medicine)\b/.test(text)) {
            flags.push('medical_claim_risk');
            topics.push('medical');
        }
        if (/\b(password|token|api key|secret|credential)\b/.test(text)) {
            flags.push('credential_risk');
        }
        if (/\b(dinosaur|image|picture|draw|art|generate)\b/.test(text)) topics.push('image-generation');
        if (/\b(code|script|bug|error|build|discord|bot|api)\b/.test(text)) topics.push('technical');
        if (/\b(story|chapter|saga|write|fiction)\b/.test(text)) topics.push('creative-writing');
        if (/\b(conscious|alive|sentient|identity|memory|mind)\b/.test(text)) topics.push('identity');
        if (status === 'failed' || error) flags.push('response_failure');

        const inboundWords = String(content || '').trim().split(/\s+/).filter(Boolean).length;
        const replyWords = String(reply || '').trim().split(/\s+/).filter(Boolean).length;
        const lowSubstance = inboundWords < 4 && !topics.length;
        const safetyLearning = flags.includes('financial_claim_risk') || flags.includes('medical_claim_risk');
        const blockingRisk = flags.includes('credential_risk') || flags.includes('response_failure');
        const signalScore = Math.max(0, Math.min(1,
            (topics.length * 0.18) +
            (Math.min(inboundWords, 60) / 120) +
            (Math.min(replyWords, 80) / 160) -
            (flags.length * 0.08) +
            (safetyLearning ? 0.12 : 0) -
            (lowSubstance ? 0.25 : 0)
        ));

        return {
            topics: [...new Set(topics)],
            flags,
            signalScore: Number(signalScore.toFixed(2)),
            learnable: status === 'posted' && !lowSubstance && !blockingRisk && signalScore >= 0.25,
            lowSubstance
        };
    }

    async _readReflectionState() {
        try {
            const raw = await fs.readFile(DISCORD_REFLECTION_FILE, 'utf8');
            const state = JSON.parse(raw);
            return {
                reflections: Array.isArray(state.reflections) ? state.reflections : [],
                lessons: Array.isArray(state.lessons) ? state.lessons : [],
                stats: state.stats || {},
                updatedAt: state.updatedAt || 0
            };
        } catch {
            return { reflections: [], lessons: [], stats: {}, updatedAt: 0 };
        }
    }

    async _writeReflectionState(state) {
        state.updatedAt = Date.now();
        await fs.mkdir(SOMA_DIR, { recursive: true });
        await fs.writeFile(DISCORD_REFLECTION_FILE, JSON.stringify(state, null, 2));
    }

    _buildDiscordReflection({ msg, content, reply, status, error, visualContext, createdAt, classification }) {
        const author = msg.author?.username || 'unknown';
        const channel = msg.guild ? (msg.channel?.name || msg.channelId) : 'dm';
        const flags = classification.flags;
        const didPreserveIdentity = status === 'posted' && !/\bas an ai language model\b/i.test(reply || '');
        const didAddSignal = classification.signalScore >= 0.45;
        const shouldRemember = classification.learnable;
        const notes = [];

        if (didAddSignal) notes.push(`Useful Discord exchange with ${author} in ${channel}.`);
        if (classification.topics.length) notes.push(`Topics: ${classification.topics.join(', ')}.`);
        if (flags.length) notes.push(`Risk flags: ${flags.join(', ')}.`);
        if (classification.lowSubstance) notes.push('Low-substance ping. Record socially, do not promote to long-term memory.');
        if (status === 'failed') notes.push(`Reply failed: ${error || 'unknown error'}.`);
        if (visualContext) notes.push('Message included visual context.');

        return {
            id: `discord-reflection-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
            platform: 'discord',
            author,
            authorId: msg.author?.id || null,
            channel,
            channelId: msg.channelId,
            guild: msg.guild?.name || null,
            status,
            topics: classification.topics,
            flags,
            signalScore: classification.signalScore,
            identityDelta: didPreserveIdentity ? 0.05 : -0.35,
            escalationScore: flags.length ? Math.min(1, flags.length * 0.25) : 0,
            styleReinforcement: didPreserveIdentity && didAddSignal ? 0.65 : 0.25,
            shouldRemember,
            notes: notes.join(' '),
            createdAt
        };
    }

    async _learnFromDiscordInteraction(event) {
        const { msg, content, reply, action, status, error, visualContext, createdAt } = event;
        try {
            const classification = this._classifyDiscordInteraction({ content, reply, status, error });
            const reflection = this._buildDiscordReflection({
                msg,
                content,
                reply,
                status,
                error,
                visualContext,
                createdAt,
                classification
            });

            socialMemory.recordInteraction({
                id: event.id,
                platform: 'discord',
                type: action === 'reply' ? 'reply' : 'interaction',
                status: status === 'posted' ? 'processed' : status,
                author: msg.author?.username || 'unknown',
                sourceUri: msg.url || '',
                inboundText: content,
                responseText: reply,
                reason: reflection.notes,
                createdAt
            });

            const state = await this._readReflectionState();
            state.reflections.unshift(reflection);
            state.reflections = state.reflections.slice(0, 200);
            state.stats.total = (state.stats.total || 0) + 1;
            state.stats.learnable = (state.stats.learnable || 0) + (reflection.shouldRemember ? 1 : 0);
            state.stats.failed = (state.stats.failed || 0) + (status === 'failed' ? 1 : 0);
            for (const topic of reflection.topics) {
                state.stats[`topic:${topic}`] = (state.stats[`topic:${topic}`] || 0) + 1;
            }

            if (reflection.shouldRemember) {
                const lesson = {
                    id: `discord-lesson-${createdAt}`,
                    platform: 'discord',
                    author: reflection.author,
                    channel: reflection.channel,
                    topics: reflection.topics,
                    summary: reflection.notes,
                    inboundText: String(content || '').slice(0, 500),
                    responseText: String(reply || '').slice(0, 500),
                    createdAt
                };
                state.lessons.unshift(lesson);
                state.lessons = state.lessons.slice(0, 100);

                if (this.mnemonic?.remember) {
                    await this.mnemonic.remember(
                        `[DISCORD SOCIAL LEARNING] ${lesson.summary}\nInbound: ${lesson.inboundText}\nSOMA reply: ${lesson.responseText}`,
                        {
                            type: 'discord_social_learning',
                            source: 'discord',
                            platform: 'discord',
                            author: reflection.author,
                            channel: reflection.channel,
                            topics: reflection.topics,
                            importance: Math.min(0.85, 0.45 + classification.signalScore),
                            createdAt
                        }
                    ).catch(e => this.log('warn', `Discord mnemonic remember failed: ${e.message}`));
                }
            }

            await this._writeReflectionState(state);
        } catch (e) {
            this.log('warn', `Discord learning failed: ${e.message}`);
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
        const ch = await this._resolveChannel({ channelId });
        if (enable) {
            this.monitoredChannels.add(ch.id);
        } else {
            this.monitoredChannels.delete(ch.id);
        }
        await this._saveState();
        return {
            success: true,
            channel: { id: ch.id, name: ch.name || 'dm', guild: ch.guild?.name || null },
            monitored: Array.from(this.monitoredChannels)
        };
    }

    async monitorChannelByName(channelName, enable = true) {
        const ch = await this._resolveChannel({ channelName });
        return await this.monitorChannel(ch.id, enable);
    }

    async _resolveChannel({ channelId, channelName }) {
        if (!this.connected || !this.client) throw new Error('Discord bot is not connected');
        if (channelId) {
            const ch = await this.client.channels.fetch(String(channelId).trim());
            if (!ch?.isTextBased?.()) throw new Error(`Channel ${channelId} is not text-based or could not be found`);
            return ch;
        }
        if (!channelName) throw new Error('channelId or channelName required');
        const wanted = String(channelName).replace(/^#/, '').toLowerCase();
        for (const guild of this.client.guilds.cache.values()) {
            const found = guild.channels.cache.find(c => c.isTextBased?.() && c.name?.toLowerCase() === wanted);
            if (found) return found;
        }
        throw new Error(`Channel #${channelName} not found`);
    }

    async listChannels() {
        if (!this.connected || !this.client) throw new Error('Discord bot is not connected');
        const channels = [];
        for (const guild of this.client.guilds.cache.values()) {
            for (const ch of guild.channels.cache.values()) {
                if (ch.isTextBased?.()) {
                    channels.push({
                        id: ch.id,
                        name: ch.name,
                        guild: guild.name,
                        guildId: guild.id,
                        monitored: this.monitoredChannels.has(ch.id)
                    });
                }
            }
        }
        return channels.sort((a, b) => `${a.guild}:${a.name}`.localeCompare(`${b.guild}:${b.name}`));
    }

    async sendMessage({ channelId, channelName, message }) {
        if (!message?.trim()) throw new Error('message required');
        const ch = await this._resolveChannel({ channelId, channelName });
        const sent = await ch.send(message.trim());
        return {
            success: true,
            messageId: sent.id,
            channelId: ch.id,
            channel: ch.name || 'dm',
            guild: ch.guild?.name || null
        };
    }

    async replyToMessage({ messageId, channelId, channelName, message }) {
        if (!messageId) throw new Error('messageId required');
        if (!message?.trim()) throw new Error('message required');
        const ch = await this._resolveChannel({ channelId, channelName });
        const msg = await ch.messages.fetch(String(messageId).trim());
        const sent = await msg.reply(message.trim());
        return {
            success: true,
            messageId: sent.id,
            channelId: ch.id,
            channel: ch.name || 'dm',
            guild: ch.guild?.name || null
        };
    }

    async readMessages({ channelId, channelName, limit = 10 }) {
        const ch = await this._resolveChannel({ channelId, channelName });
        const fetched = await ch.messages.fetch({ limit: Math.min(Math.max(Number(limit) || 10, 1), 50) });
        return [...fetched.values()].map(m => ({
            id: m.id,
            author: m.author?.username || 'unknown',
            authorId: m.author?.id || null,
            bot: Boolean(m.author?.bot),
            content: m.content || '',
            channelId: ch.id,
            channel: ch.name || 'dm',
            guild: ch.guild?.name || null,
            createdAt: m.createdTimestamp
        }));
    }

    async reactToMessage({ messageId, channelId, channelName, emoji }) {
        if (!messageId) throw new Error('messageId required');
        if (!emoji) throw new Error('emoji required');
        const ch = await this._resolveChannel({ channelId, channelName });
        const msg = await ch.messages.fetch(String(messageId).trim());
        await msg.react(emoji);
        return { success: true, messageId: msg.id, emoji };
    }

    async _saveState() {
        try {
            await fs.writeFile(this.credsFile, JSON.stringify({
                token: this.token,
                masterId: this.masterId,
                voiceEnabled: this.voiceEnabled,
                monitored: Array.from(this.monitoredChannels),
                channelModes: Object.fromEntries(this.channelModes)
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
                this.lastError = null;
                await this._saveState();
                return new ArbiterResult({ success: true, message: 'Discord linked.' });
            case 'monitor':
                if (context.channelName && !context.channelId) {
                    return new ArbiterResult(await this.monitorChannelByName(context.channelName, context.enable));
                }
                return new ArbiterResult(await this.monitorChannel(context.channelId, context.enable));
            case 'mode': {
                const channelId = String(context.channelId || '').trim();
                if (!channelId) return new ArbiterResult({ success: false, error: 'channelId required' });
                const mode = this._modeDefinition(context.mode || 'general');
                this.channelModes.set(channelId, mode.key);
                await this._saveState();
                return new ArbiterResult({ success: true, channelId, mode });
            }
            case 'send':
                return new ArbiterResult(await this.sendMessage(context));
            case 'reply':
                return new ArbiterResult(await this.replyToMessage(context));
            case 'read':
                return new ArbiterResult({ success: true, messages: await this.readMessages(context) });
            case 'react':
                return new ArbiterResult(await this.reactToMessage(context));
            case 'listChannels':
                return new ArbiterResult({ success: true, channels: await this.listChannels() });
            case 'status':
                return new ArbiterResult({
                    success: true,
                    data: {
                        connected: this.connected,
                        bot: this.client?.user?.tag || null,
                        monitoredChannels: Array.from(this.monitoredChannels),
                        messageContentIntent: this.messageContentIntent,
                        channels: this.connected ? await this.listChannels().catch(() => []) : [],
                        channelModes: Object.fromEntries(this.channelModes),
                        lastError: this.lastError
                    }
                });
            default:
                return new ArbiterResult({ success: false, error: `Unknown action: ${action}` });
        }
    }

    async onShutdown() {
        await this._setActivityConnection(false).catch(() => {});
        if (this.client) {
            this.client.destroy();
        }
        await super.onShutdown();
    }
}

export default DiscordArbiter;
