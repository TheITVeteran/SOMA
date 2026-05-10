export const PROMOTION_TIERS = [
    {
        id: 'paper',
        label: 'Paper Trading',
        liveTradingEnabled: false,
        profile: {
            maxTradeValue: 1000,
            maxDailyLoss: 500,
            maxDailyTrades: 50,
            maxOpenPositions: 3,
            maxPositionPct: 0.08,
            minConfidence: 0.62,
            cooldownMs: 120000,
            maxPaperTradeValue: 1000
        }
    },
    {
        id: 'tiny_live',
        label: 'Tiny Live',
        liveTradingEnabled: true,
        typedConfirmation: 'ENABLE TINY LIVE',
        profile: {
            maxTradeValue: 25,
            maxDailyLoss: 10,
            maxDailyTrades: 5,
            maxOpenPositions: 1,
            maxPositionPct: 0.01,
            minConfidence: 0.75,
            cooldownMs: 300000,
            maxSessionDrawdownPct: 0.01
        }
    },
    {
        id: 'small_live',
        label: 'Small Live',
        liveTradingEnabled: true,
        typedConfirmation: 'ENABLE SMALL LIVE',
        profile: {
            maxTradeValue: 100,
            maxDailyLoss: 35,
            maxDailyTrades: 8,
            maxOpenPositions: 2,
            maxPositionPct: 0.025,
            minConfidence: 0.72,
            cooldownMs: 240000,
            maxSessionDrawdownPct: 0.02
        }
    },
    {
        id: 'normal_live',
        label: 'Normal Live',
        liveTradingEnabled: true,
        typedConfirmation: 'ENABLE NORMAL LIVE',
        profile: {
            maxTradeValue: 500,
            maxDailyLoss: 125,
            maxDailyTrades: 12,
            maxOpenPositions: 3,
            maxPositionPct: 0.05,
            minConfidence: 0.68,
            cooldownMs: 180000,
            maxSessionDrawdownPct: 0.035
        }
    }
];

const TIER_INDEX = new Map(PROMOTION_TIERS.map((tier, index) => [tier.id, index]));

function finite(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function normalizeWinRate(value) {
    const n = finite(value, 0);
    return n <= 1 ? n * 100 : n;
}

function gate(id, label, passed, detail, value = null, threshold = null) {
    return { id, label, passed: !!passed, detail, value, threshold };
}

export function getTier(id = 'paper') {
    return PROMOTION_TIERS.find(tier => tier.id === id) || PROMOTION_TIERS[0];
}

export function clampTier(id = 'paper', maxEligibleTierId = 'paper') {
    const requested = TIER_INDEX.get(id) ?? 0;
    const eligible = TIER_INDEX.get(maxEligibleTierId) ?? 0;
    return PROMOTION_TIERS[Math.min(requested, eligible)]?.id || 'paper';
}

export function evaluatePromotionLadder({
    stats = {},
    activeStrategy = {},
    testingDays = 0,
    worstTradePct = 0,
    latestTraining = null,
    liveStats = {},
    policy = {}
} = {}) {
    const paperPolicy = {
        minClosedTrades: policy.minClosedTrades ?? 100,
        minTestingDays: policy.minTestingDays ?? 7,
        minWinRate: policy.minWinRate ?? 60,
        minProfitFactor: policy.minProfitFactor ?? 1.4,
        maxDrawdownPct: policy.maxDrawdownPct ?? 12,
        minMarketLabScore: policy.minMarketLabScore ?? 0.72,
        requireOutOfSample: policy.requireOutOfSample ?? true
    };

    const closedTrades = finite(stats.totalTrades, 0);
    const winRate = normalizeWinRate(stats.winRate);
    const profitFactor = finite(stats.profitFactor, 0);
    const marketLabScore = finite(activeStrategy.score, 0);
    const drawdownPct = Math.abs(finite(worstTradePct, 0));
    const outOfSampleReady = !paperPolicy.requireOutOfSample || !!latestTraining?.best;

    const tinyGates = [
        gate('closedTrades', 'Closed paper trades', closedTrades >= paperPolicy.minClosedTrades, `${closedTrades}/${paperPolicy.minClosedTrades} closed paper trades`, closedTrades, paperPolicy.minClosedTrades),
        gate('testingAge', 'Testing age', finite(testingDays, 0) >= paperPolicy.minTestingDays, `${finite(testingDays, 0).toFixed(2)}/${paperPolicy.minTestingDays} calendar days`, finite(testingDays, 0), paperPolicy.minTestingDays),
        gate('winRate', 'Win rate', winRate >= paperPolicy.minWinRate, `${winRate.toFixed(1)}%/${paperPolicy.minWinRate}%`, winRate, paperPolicy.minWinRate),
        gate('profitFactor', 'Profit factor', profitFactor >= paperPolicy.minProfitFactor, `${profitFactor.toFixed(2)}/${paperPolicy.minProfitFactor}`, profitFactor, paperPolicy.minProfitFactor),
        gate('drawdown', 'Drawdown cap', drawdownPct <= paperPolicy.maxDrawdownPct, `${drawdownPct.toFixed(2)}%/${paperPolicy.maxDrawdownPct}% max`, drawdownPct, paperPolicy.maxDrawdownPct),
        gate('marketLabScore', 'Market Lab score', marketLabScore >= paperPolicy.minMarketLabScore, `${marketLabScore.toFixed(3)}/${paperPolicy.minMarketLabScore}`, marketLabScore, paperPolicy.minMarketLabScore),
        gate('outOfSample', 'Out-of-sample check', outOfSampleReady, outOfSampleReady ? 'holdout evidence present' : 'holdout evidence required', outOfSampleReady, true)
    ];

    const liveTrades = finite(liveStats.closedTrades, 0);
    const liveProfitFactor = finite(liveStats.profitFactor, 0);
    const liveSlippageOk = Math.abs(finite(liveStats.avgSlippagePct, 0)) <= 0.35;
    const liveEmergencyStops = finite(liveStats.emergencyStops, 0);
    const liveDrawdown = Math.abs(finite(liveStats.maxDrawdownPct, 0));

    const smallGates = [
        gate('tinyLiveTrades', 'Tiny-live sample', liveTrades >= 50, `${liveTrades}/50 tiny-live closed trades`, liveTrades, 50),
        gate('tinyLiveProfitFactor', 'Live profit factor', liveProfitFactor >= 1.1, `${liveProfitFactor.toFixed(2)}/1.10`, liveProfitFactor, 1.1),
        gate('tinyLiveSlippage', 'Slippage', liveSlippageOk, `${Math.abs(finite(liveStats.avgSlippagePct, 0)).toFixed(3)}% avg slippage`, finite(liveStats.avgSlippagePct, 0), 0.35),
        gate('tinyLiveStops', 'Emergency stops', liveEmergencyStops === 0, `${liveEmergencyStops} emergency stops`, liveEmergencyStops, 0),
        gate('tinyLiveDrawdown', 'Live drawdown', liveDrawdown <= 6, `${liveDrawdown.toFixed(2)}%/6%`, liveDrawdown, 6)
    ];

    const normalGates = [
        gate('smallLiveTrades', 'Small-live sample', liveTrades >= 150, `${liveTrades}/150 live closed trades`, liveTrades, 150),
        gate('smallLiveProfitFactor', 'Live profit factor', liveProfitFactor >= 1.2, `${liveProfitFactor.toFixed(2)}/1.20`, liveProfitFactor, 1.2),
        gate('smallLiveDrawdown', 'Live drawdown', liveDrawdown <= 10, `${liveDrawdown.toFixed(2)}%/10%`, liveDrawdown, 10)
    ];

    const tinyEligible = tinyGates.every(g => g.passed);
    const smallEligible = tinyEligible && smallGates.every(g => g.passed);
    const normalEligible = smallEligible && normalGates.every(g => g.passed);
    const maxEligibleTier = normalEligible ? 'normal_live' : smallEligible ? 'small_live' : tinyEligible ? 'tiny_live' : 'paper';
    const nextTier = maxEligibleTier === 'paper' ? 'tiny_live' : maxEligibleTier === 'tiny_live' ? 'small_live' : maxEligibleTier === 'small_live' ? 'normal_live' : null;
    const nextGates = nextTier === 'tiny_live' ? tinyGates : nextTier === 'small_live' ? smallGates : nextTier === 'normal_live' ? normalGates : [];

    return {
        maxEligibleTier,
        nextTier,
        liveEligible: maxEligibleTier !== 'paper',
        tiers: {
            paper: { eligible: true, gates: [] },
            tiny_live: { eligible: tinyEligible, gates: tinyGates },
            small_live: { eligible: smallEligible, gates: smallGates },
            normal_live: { eligible: normalEligible, gates: normalGates }
        },
        nextBlockedBy: nextGates.filter(g => !g.passed),
        evaluatedAt: new Date().toISOString()
    };
}

export function applyTierProfile(baseConfig = {}, tierId = 'paper') {
    const tier = getTier(tierId);
    return {
        ...baseConfig,
        ...tier.profile,
        promotionTier: tier.id,
        liveTradingEnabled: tier.liveTradingEnabled
    };
}
