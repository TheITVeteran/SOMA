import fs from 'fs';
import path from 'path';
import strategyRegistry from './StrategyRegistry.js';
import historicalDataCache from './HistoricalDataCache.js';
import trainingJobRunner from './TrainingJobRunner.js';
import { brokerAdapters } from './BrokerAdapter.js';
import { applyTierProfile, clampTier, evaluatePromotionLadder, getTier, PROMOTION_TIERS } from './PromotionLadder.js';
import marketEvidenceStore from './MarketEvidenceStore.js';
import crypto from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data', 'trading');
const STATE_PATH = path.join(DATA_DIR, 'mission-control-runtime.json');
const MARKET_LEDGER_PATH = path.join(process.cwd(), 'data', 'market-lab', 'strategy-ledger.json');

const STRATEGY_PROFILES = {
    standard_portfolio: { minConfidence: 0.62, maxPositionPct: 0.08, takeProfitPct: 0.05, stopLossPct: 0.02, cooldownMs: 120000, analysisIntervalMs: 60000 },
    swarm_architecture: { minConfidence: 0.58, maxPositionPct: 0.10, takeProfitPct: 0.06, stopLossPct: 0.02, cooldownMs: 90000, analysisIntervalMs: 45000 },
    micro_compounder: { minConfidence: 0.64, maxPositionPct: 0.04, takeProfitPct: 0.018, stopLossPct: 0.009, cooldownMs: 45000, analysisIntervalMs: 30000 },
    micro_scalper: { minConfidence: 0.57, maxPositionPct: 0.03, takeProfitPct: 0.012, stopLossPct: 0.006, cooldownMs: 20000, analysisIntervalMs: 15000 },
    full_aggression: { minConfidence: 0.50, maxPositionPct: 0.18, takeProfitPct: 0.10, stopLossPct: 0.035, cooldownMs: 45000, analysisIntervalMs: 30000 },
    yield_harvester: { minConfidence: 0.68, maxPositionPct: 0.06, takeProfitPct: 0.025, stopLossPct: 0.012, cooldownMs: 180000, analysisIntervalMs: 90000 }
};

function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
}

function normalizeStrategyId(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

class MissionControlRuntime {
    constructor() {
        this.tradeLogger = null;
        this.riskManager = null;
        this.guardrails = null;
        this.learningEngine = null;
        this.initialized = false;
        this.sessionId = null;
        this.state = this._defaultState();
        this._lastPromotionEvidenceHash = null;
    }

    _defaultState() {
        return {
            mode: 'paper',
            activeTier: 'paper',
            liveEligible: false,
            paperCapital: 1000,
            activeStrategy: null,
            council: {
                director: 0.55,
                tech: 0.55,
                risk: 0.55,
                sentiment: 0.55,
                strategist: 0.55
            },
            promotionPolicy: {
                minClosedTrades: 100,
                minWinRate: 60,
                minProfitFactor: 1.4,
                maxAvgSlippagePct: 0.25,
                minMarketLabScore: 0.72,
                minTestingDays: 7,
                maxDrawdownPct: 12,
                requireOutOfSample: true
            },
            lastHydratedAt: null,
            lastPromotion: null
        };
    }

    initialize({ tradeLogger = null, riskManager = null, guardrails = null, simulationLearningEngine = null } = {}) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        this.tradeLogger = tradeLogger || this.tradeLogger;
        this.riskManager = riskManager || this.riskManager;
        this.guardrails = guardrails || this.guardrails;
        this.learningEngine = simulationLearningEngine || this.learningEngine;
        strategyRegistry.initialize();
        historicalDataCache.initialize();
        trainingJobRunner.initialize();
        const defaults = this._defaultState();
        const persisted = this._readState();
        this.state = {
            ...defaults,
            ...persisted,
            council: { ...defaults.council, ...(persisted.council || {}) },
            promotionPolicy: { ...defaults.promotionPolicy, ...(persisted.promotionPolicy || {}) }
        };
        this.hydrateFromMarketLab({ persist: false });
        this.initialized = true;
        this._saveState();
        return this.getStatus();
    }

    _readState() {
        try {
            if (!fs.existsSync(STATE_PATH)) return {};
            return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
        } catch {
            return {};
        }
    }

    _saveState() {
        try {
            fs.writeFileSync(STATE_PATH, JSON.stringify(this.state, null, 2));
        } catch (error) {
            console.warn('[MissionControlRuntime] State save failed:', error.message);
        }
    }

    _readMarketLedger() {
        try {
            if (!fs.existsSync(MARKET_LEDGER_PATH)) return [];
            const parsed = JSON.parse(fs.readFileSync(MARKET_LEDGER_PATH, 'utf8'));
            return Array.isArray(parsed?.entries) ? parsed.entries : Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    hydrateFromMarketLab({ persist = true } = {}) {
        const entries = this._readMarketLedger()
            .filter(entry => entry && entry.strategy && entry.metrics)
            .sort((a, b) => {
                const scoreA = Number(a.prometheusScore ?? a.metrics?.prometheusScore ?? 0);
                const scoreB = Number(b.prometheusScore ?? b.metrics?.prometheusScore ?? 0);
                if (scoreB !== scoreA) return scoreB - scoreA;
                return Number(b.metrics?.pnl || 0) - Number(a.metrics?.pnl || 0);
            });

        const best = entries[0] || null;
        if (!best) return this.state.activeStrategy;

        const strategyId = normalizeStrategyId(best.strategy?.id || best.strategy?.name);
        const council = best.missionCouncil || {};
        this.state.activeStrategy = {
            source: 'market_lab',
            symbol: best.asset?.symbol || best.symbol || null,
            assetClass: best.asset?.type || best.assetClass || null,
            strategyId,
            strategyName: best.strategy?.name || strategyId,
            score: Number(best.prometheusScore ?? best.metrics?.prometheusScore ?? 0),
            pnl: Number(best.metrics?.pnl || 0),
            pnlPct: Number(best.metrics?.pnlPct || 0),
            winRate: Number(best.metrics?.winRate || 0),
            trades: Number(best.metrics?.trades || 0),
            promoted: !!best.promoted,
            learnedAt: best.timestamp || new Date().toISOString()
        };

        this.state.council = {
            director: clamp(council.director?.confidence ?? this.state.council.director, 0, 1),
            tech: clamp(council.tech?.confidence ?? this.state.council.tech, 0, 1),
            risk: clamp(council.risk?.confidence ?? this.state.council.risk, 0, 1),
            sentiment: clamp(council.sentiment?.confidence ?? this.state.council.sentiment, 0, 1),
            strategist: clamp(council.strategist?.confidence ?? this.state.council.strategist, 0, 1)
        };
        this.state.lastHydratedAt = new Date().toISOString();
        if (persist) this._saveState();
        return this.state.activeStrategy;
    }

    getActiveExecutionProfile({ symbol = null, preset = null, baseConfig = {} } = {}) {
        this.hydrateFromMarketLab();
        const active = this.state.activeStrategy;
        const strategyId = normalizeStrategyId(active?.strategyId || preset);
        const learned = STRATEGY_PROFILES[strategyId] || null;
        const profile = learned || STRATEGY_PROFILES.standard_portfolio;
        const council = this.state.council || {};

        let maxPositionPct = profile.maxPositionPct;
        let minConfidence = profile.minConfidence;
        if ((council.risk ?? 0.5) < 0.55) {
            maxPositionPct *= 0.7;
            minConfidence += 0.05;
        }
        if ((council.strategist ?? 0.5) > 0.7 && (council.director ?? 0.5) > 0.65) {
            minConfidence -= 0.02;
        }

        const maxPaperTradeValue = Math.min(this.state.paperCapital || 1000, 1000);
        const config = applyTierProfile({
            ...baseConfig,
            ...profile,
            minConfidence: clamp(minConfidence, 0.45, 0.85),
            maxPositionPct: clamp(maxPositionPct, 0.01, 0.2),
            maxPaperTradeValue
        }, this.state.activeTier || 'paper');
        const tier = getTier(this.state.activeTier || 'paper');

        return {
            runtime: true,
            preset: preset || 'SOMA_LEARNED',
            symbol: symbol || active?.symbol || null,
            activeStrategy: active,
            council,
            config,
            paperCapital: this.state.paperCapital,
            activeTier: tier.id,
            tier,
            liveEligible: this.state.liveEligible,
            liveTradingEnabled: tier.liveTradingEnabled
        };
    }

    adaptSignal(signal, analysis, context = {}) {
        if (!signal) return signal;
        const council = this.state.council || {};
        const risk = council.risk ?? 0.55;
        const tech = council.tech ?? 0.55;
        const sentiment = council.sentiment ?? 0.55;
        const strategist = council.strategist ?? 0.55;
        const director = council.director ?? 0.55;
        const councilMean = (risk + tech + sentiment + strategist + director) / 5;

        let confidence = Number(signal.confidence || 0);
        confidence += (tech - 0.5) * 0.06;
        confidence += (sentiment - 0.5) * 0.04;
        confidence += (strategist - 0.5) * 0.06;
        confidence += (director - 0.5) * 0.04;
        confidence -= Math.max(0, 0.58 - risk) * 0.16;
        confidence = clamp(confidence, 0, 0.98);

        const adapted = {
            ...signal,
            confidence,
            runtime: {
                activeStrategy: this.state.activeStrategy,
                councilConfidence: councilMean,
                paperCapital: this.state.paperCapital,
                adaptedAt: Date.now()
            },
            agents: {
                ...(signal.agents || {}),
                director,
                tech,
                risk,
                sentiment,
                strategist
            }
        };

        if (signal.action !== 'HOLD' && confidence < (context.minConfidence || 0)) {
            adapted.action = 'HOLD';
            adapted.reason = `${signal.reason} Runtime council held the trade below confidence gate (${Math.round(confidence * 100)}%).`;
        }
        return adapted;
    }

    evaluatePromotion({ recordEvidence = false } = {}) {
        this.hydrateFromMarketLab();
        const stats = this.tradeLogger?.getStats?.(90) || {};
        const closedTrades = this.tradeLogger?.getClosedTrades?.(90) || [];
        const policy = this.state.promotionPolicy;
        const active = this.state.activeStrategy || {};
        const firstTradeTime = closedTrades
            .map(trade => Date.parse(trade.entry_time || trade.created_at || trade.exit_time))
            .filter(Number.isFinite)
            .sort((a, b) => a - b)[0] || null;
        const testingDays = firstTradeTime ? (Date.now() - firstTradeTime) / 86400000 : 0;
        const worstTrade = closedTrades.reduce((min, trade) => Math.min(min, Number(trade.pnl_pct || 0)), 0);
        const latestTraining = trainingJobRunner.getStatus().jobs?.[0] || null;
        const outOfSampleReady = !policy.requireOutOfSample || !!latestTraining?.best;
        const checks = {
            closedTrades: (stats.totalTrades || 0) >= policy.minClosedTrades,
            winRate: (stats.winRate || 0) >= policy.minWinRate,
            profitFactor: (stats.profitFactor || 0) >= policy.minProfitFactor,
            slippage: Math.abs(stats.avgSlippage || 0) <= policy.maxAvgSlippagePct,
            marketLabScore: (active.score || 0) >= policy.minMarketLabScore,
            pnlPositive: (stats.totalPnl || 0) > 0 || (active.pnl || 0) > 0,
            testingAge: testingDays >= policy.minTestingDays,
            drawdown: Math.abs(worstTrade) <= policy.maxDrawdownPct,
            outOfSample: outOfSampleReady
        };
        const approved = Object.values(checks).every(Boolean);
        const ladder = evaluatePromotionLadder({
            stats,
            activeStrategy: active,
            testingDays,
            worstTradePct: Math.abs(worstTrade),
            latestTraining,
            policy
        });
        this.state.activeTier = clampTier(this.state.activeTier || 'paper', ladder.maxEligibleTier);
        const result = {
            approved,
            mode: approved ? 'paper_promotable' : 'paper_only',
            checks,
            policy,
            ladder,
            activeTier: this.state.activeTier,
            activeTierProfile: getTier(this.state.activeTier),
            stats,
            testingDays: Number(testingDays.toFixed(2)),
            worstTradePct: Number(worstTrade.toFixed(4)),
            latestTraining: latestTraining ? { id: latestTraining.id, status: latestTraining.status, best: latestTraining.best } : null,
            activeStrategy: active,
            evaluatedAt: new Date().toISOString()
        };
        this.state.liveEligible = ladder.liveEligible;
        this.state.lastPromotion = result;
        if (recordEvidence) try {
            const evidencePayload = {
                approved,
                mode: result.mode,
                activeTier: result.activeTier,
                ladder,
                checks,
                stats,
                testingDays: result.testingDays,
                activeStrategy: active
            };
            const promotionHash = crypto
                .createHash('sha1')
                .update(JSON.stringify({
                    approved,
                    activeTier: result.activeTier,
                    maxEligibleTier: ladder?.maxEligibleTier,
                    liveEligible: ladder?.liveEligible,
                    blockedBy: ladder?.nextBlockedBy || [],
                    checks,
                    totalTrades: stats.totalTrades || 0,
                    winRate: stats.winRate || 0,
                    profitFactor: stats.profitFactor || 0,
                    totalPnl: stats.totalPnl || 0,
                    strategyId: active.strategyId || active.id || null
                }))
                .digest('hex');
            if (promotionHash !== this._lastPromotionEvidenceHash) {
                this._lastPromotionEvidenceHash = promotionHash;
                marketEvidenceStore.append('promotion', evidencePayload, {
                    source: 'MissionControlRuntime',
                    strategyId: active.strategyId || active.id || null
                });
            }
        } catch {
            // Promotion checks should remain available even if evidence mirroring fails.
        }
        this._saveState();
        return result;
    }

    recordLifecycle(event = {}) {
        const lifecycleId = event.lifecycleId || this.sessionId || `mc_${Date.now()}`;
        try {
            return this.tradeLogger?.logLifecycleEvent?.({
                lifecycleId,
                actor: event.actor || 'MissionControlRuntime',
                status: event.status || 'info',
                ...event
            }) || null;
        } catch (error) {
            console.warn('[MissionControlRuntime] Lifecycle log failed:', error.message);
            return null;
        }
    }

    updateRiskConfig(updates = {}) {
        if (updates.paperCapital != null) {
            this.state.paperCapital = clamp(updates.paperCapital, 1, 100000);
        }
        if (updates.promotionPolicy && typeof updates.promotionPolicy === 'object') {
            this.state.promotionPolicy = { ...this.state.promotionPolicy, ...updates.promotionPolicy };
        }
        if (updates.activeTier != null) {
            const promotion = this.evaluatePromotion();
            this.state.activeTier = clampTier(updates.activeTier, promotion.ladder?.maxEligibleTier || 'paper');
        }
        this._saveState();
        return this.getStatus();
    }

    startSession({ symbol = null, preset = null, config = {} } = {}) {
        this.sessionId = `mc_session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        this.recordLifecycle({
            lifecycleId: this.sessionId,
            symbol,
            stage: 'session_start',
            status: 'started',
            payload: { preset, config, activeStrategy: this.state.activeStrategy }
        });
        return this.sessionId;
    }

    getJournal(limit = 100) {
        return this.tradeLogger?.getLifecycleEvents?.({ limit }) || [];
    }

    getStatus() {
        this.hydrateFromMarketLab({ persist: false });
        return {
            initialized: this.initialized,
            mode: this.state.mode,
            activeTier: this.state.activeTier || 'paper',
            activeTierProfile: getTier(this.state.activeTier || 'paper'),
            promotionTiers: PROMOTION_TIERS,
            liveEligible: this.state.liveEligible,
            paperCapital: this.state.paperCapital,
            activeStrategy: this.state.activeStrategy,
            council: this.state.council,
            promotionPolicy: this.state.promotionPolicy,
            lastPromotion: this.state.lastPromotion,
            lastHydratedAt: this.state.lastHydratedAt,
            brokers: Object.fromEntries(Object.entries(brokerAdapters).map(([key, adapter]) => [key, { connected: adapter.connected, name: adapter.name }])),
            strategyRegistry: strategyRegistry.getStatus(),
            historicalData: historicalDataCache.getStatus(),
            training: trainingJobRunner.getStatus(),
            statePath: STATE_PATH
        };
    }
}

const missionControlRuntime = new MissionControlRuntime();
export default missionControlRuntime;
