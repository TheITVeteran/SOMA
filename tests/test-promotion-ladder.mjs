import assert from 'node:assert/strict';
import { applyTierProfile, clampTier, evaluatePromotionLadder, getTier } from '../server/finance/PromotionLadder.js';

function test(name, fn) {
    try {
        fn();
        console.log(`OK ${name}`);
    } catch (error) {
        console.error(`FAIL ${name}: ${error.message}`);
        process.exitCode = 1;
    }
}

test('weak paper evidence stays paper-only', () => {
    const result = evaluatePromotionLadder({
        stats: { totalTrades: 12, winRate: 50, profitFactor: 1.1 },
        activeStrategy: { score: 0.5 },
        testingDays: 1,
        worstTradePct: 8,
        latestTraining: null
    });

    assert.equal(result.maxEligibleTier, 'paper');
    assert.equal(result.liveEligible, false);
    assert.equal(result.nextTier, 'tiny_live');
    assert.ok(result.nextBlockedBy.length > 0);
});

test('strong paper evidence unlocks tiny live only', () => {
    const result = evaluatePromotionLadder({
        stats: { totalTrades: 125, winRate: 64, profitFactor: 1.7 },
        activeStrategy: { score: 0.78 },
        testingDays: 8,
        worstTradePct: 6,
        latestTraining: { best: { score: 0.66 } }
    });

    assert.equal(result.maxEligibleTier, 'tiny_live');
    assert.equal(result.liveEligible, true);
    assert.equal(result.tiers.tiny_live.eligible, true);
    assert.equal(result.tiers.small_live.eligible, false);
});

test('live evidence unlocks small live but not normal', () => {
    const result = evaluatePromotionLadder({
        stats: { totalTrades: 200, winRate: 66, profitFactor: 1.9 },
        activeStrategy: { score: 0.82 },
        testingDays: 15,
        worstTradePct: 5,
        latestTraining: { best: { score: 0.72 } },
        liveStats: { closedTrades: 80, profitFactor: 1.18, avgSlippagePct: 0.05, emergencyStops: 0, maxDrawdownPct: 3 }
    });

    assert.equal(result.maxEligibleTier, 'small_live');
    assert.equal(result.tiers.small_live.eligible, true);
    assert.equal(result.tiers.normal_live.eligible, false);
});

test('tier profile applies hard trade limits', () => {
    const config = applyTierProfile({ minConfidence: 0.2, maxTradeValue: 9999 }, 'tiny_live');
    assert.equal(config.promotionTier, 'tiny_live');
    assert.equal(config.liveTradingEnabled, true);
    assert.equal(config.maxTradeValue, 25);
    assert.equal(config.maxOpenPositions, 1);
    assert.equal(config.minConfidence, 0.75);
});

test('requested tier is clamped to eligible tier', () => {
    assert.equal(clampTier('normal_live', 'paper'), 'paper');
    assert.equal(clampTier('normal_live', 'tiny_live'), 'tiny_live');
    assert.equal(clampTier('small_live', 'normal_live'), 'small_live');
    assert.equal(getTier('missing').id, 'paper');
});
