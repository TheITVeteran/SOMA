/**
 * arbiters/AttentionArbiter.js
 * 
 * The Gatekeeper of SOMA's consciousness.
 * Sits between the CNS and Decision Arbiters to manage focus and noise.
 */

import { BaseArbiterV4, ArbiterRole, ArbiterCapability } from './BaseArbiter.js';
import messageBroker from '../core/MessageBroker.cjs';

export class AttentionArbiter extends BaseArbiterV4 {
    constructor(opts = {}) {
        super({
            ...opts,
            name: opts.name || 'AttentionArbiter',
            role: ArbiterRole.SUPERVISOR,
            capabilities: [ArbiterCapability.MONITOR_HEALTH]
        });

        this.focusTopic = 'general';
        this.focusExpiry = null;
        this.loadThreshold = opts.loadThreshold || 80; // CPU load to start dropping low-priority signals
        this.systemHealth = { cpuUsage: 0, ramUsage: 0 };
    }

    async onInitialize() {
        // Subscribe to all health metrics to adjust attention filters
        messageBroker.subscribe('health.metrics', (signal) => {
            this.systemHealth = signal.payload;
        });

        // Subscribe to global signals to manage "Focus"
        messageBroker.subscribe('ui.navigate', (signal) => {
            this.setFocus(signal.payload.module, 60000); // 1 minute focus on new tab
        });

        this.auditLogger.info('AttentionArbiter initialized');

        // 🔱 RESONANCE SYNC: Align attention with the cognitive heartbeat
        messageBroker.subscribe('system.resonance.pulse', (pulse) => {
            this._handleResonancePulse(pulse);
        });
    }

    /**
     * Handle the 400ms resonance pulse.
     * Modulates attention based on rhythmic coherence.
     */
    _handleResonancePulse(pulse) {
        // High resonance score (activity) allows more signals through
        // Low resonance (idle) tightens the gate
        const thresholdMod = (pulse.score - 0.5) * 20;
        this.loadThreshold = Math.max(40, Math.min(95, 80 + thresholdMod));
        
        // Log pulse occasionally to audit rhythm
        if (Math.random() > 0.99) {
            this.auditLogger.info(`❤️ Heartbeat Sync: score=${pulse.score} loadThreshold=${this.loadThreshold.toFixed(1)}`);
        }
    }

    /**
     * Set the system's global focus topic
     */
    setFocus(topic, durationMs = 0) {
        this.focusTopic = topic;
        this.focusExpiry = durationMs ? Date.now() + durationMs : null;
        this.auditLogger.info(`[Attention] Focus shifted to: ${topic}`);
        
        // Broadcast focus shift to the CNS
        messageBroker.publish('system.focus.shifted', { topic, durationMs });
    }

    /**
     * Analyze intent and recommend a cognitive lobe for the task.
     * Maps user query to: LOGOS | AURORA | PROMETHEUS | THALAMUS
     */
    recommendLobe(query = '') {
        const text = query.toLowerCase();
        
        // 1. THALAMUS (Security, Risk, Policy)
        if (/\b(security|risk|policy|safe|threat|anomal|audit|govern|permission|block|deny)\b/i.test(text)) {
            return 'THALAMUS';
        }
        
        // 2. LOGOS (Logic, Code, Architecture)
        if (/\b(code|bug|error|refactor|debug|architect|system|logic|math|api|file|module|implementation)\b/i.test(text)) {
            return 'LOGOS';
        }
        
        // 3. AURORA (Creativity, Soul, Identity, City Vibe)
        if (/\b(feel|vibe|soul|identity|creat|poem|story|narrative|beautiful|aesthetic|emotion|personality|city|dream)\b/i.test(text)) {
            return 'AURORA';
        }
        
        // 4. PROMETHEUS (Strategy, Goals, Outcomes)
        if (/\b(goal|plan|strategy|roadmap|decision|priority|outcome|milestone|business|market|growth|tradeoff)\b/i.test(text)) {
            return 'PROMETHEUS';
        }
        
        // Default to LOGOS for analytical/general reasoning
        return 'LOGOS';
    }

    /**
     * The Amygdala Gate: Decide if a signal should be noticed by decision arbiters.
     * Logic:
     * 1. 'emergency' or 'high' priority always pass.
     * 2. If load is > loadThreshold, drop 'low' priority unless they match focus.
     * 3. Signals matching focus get a priority boost.
     */
    shouldNotice(signal) {
        const { type, priority, payload } = signal;

        // 1. High-priority bypass
        if (priority === 'high' || priority === 'emergency') return true;

        // Check focus expiration
        if (this.focusExpiry && Date.now() > this.focusExpiry) {
            this.focusTopic = 'general';
            this.focusExpiry = null;
        }

        // 2. Focus match
        const matchesFocus = type.includes(this.focusTopic) || 
                            (payload && JSON.stringify(payload).includes(this.focusTopic));

        // 3. Load-based shedding
        if (this.systemHealth.cpuUsage > this.loadThreshold) {
            if (priority === 'low' && !matchesFocus) {
                return false; // Shed low-priority non-focus signal
            }
        }

        return true;
    }

    async handleMessage(message) {
        // Traditional message handling if needed
        return super.handleMessage(message);
    }
}

// Ensure compatibility with the loader which expects default export
export default AttentionArbiter;
