import express from 'express';
import missionControlRuntime from './MissionControlRuntime.js';
import strategyRegistry from './StrategyRegistry.js';
import trainingJobRunner from './TrainingJobRunner.js';
import historicalDataCache from './HistoricalDataCache.js';
import tradeThesisStore from './TradeThesisStore.js';

const router = express.Router();

router.get('/runtime', (req, res) => {
    try {
        res.json({ success: true, runtime: missionControlRuntime.getStatus() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/thesis', (req, res) => {
    try {
        const { symbol = null, limit = 50, active = 'false' } = req.query || {};
        if (String(active).toLowerCase() === 'true') {
            return res.json({ success: true, thesis: tradeThesisStore.active(symbol || null) });
        }
        const theses = tradeThesisStore.list({ symbol: symbol || null, limit });
        res.json({ success: true, theses, count: theses.length, status: tradeThesisStore.getStatus() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/thesis/:id', (req, res) => {
    try {
        const thesis = tradeThesisStore.get(req.params.id);
        if (!thesis) return res.status(404).json({ success: false, error: 'Trade thesis not found' });
        res.json({ success: true, thesis });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/thesis', (req, res) => {
    try {
        const thesis = tradeThesisStore.upsert(req.body || {});
        res.json({ success: true, thesis, validation: tradeThesisStore.validate(thesis) });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

router.post('/thesis/:id/validate', (req, res) => {
    try {
        const thesis = tradeThesisStore.get(req.params.id);
        if (!thesis) return res.status(404).json({ success: false, error: 'Trade thesis not found' });
        res.json({ success: true, validation: tradeThesisStore.validate(thesis), thesis });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/thesis/:id/status', (req, res) => {
    try {
        const { status, details = {} } = req.body || {};
        if (!status) return res.status(400).json({ success: false, error: 'status is required' });
        const thesis = tradeThesisStore.updateStatus(req.params.id, status, details);
        if (!thesis) return res.status(404).json({ success: false, error: 'Trade thesis not found' });
        res.json({ success: true, thesis, validation: tradeThesisStore.validate(thesis) });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

router.post('/hydrate', (req, res) => {
    try {
        const activeStrategy = missionControlRuntime.hydrateFromMarketLab();
        res.json({ success: true, activeStrategy, runtime: missionControlRuntime.getStatus() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.put('/risk', (req, res) => {
    try {
        const runtime = missionControlRuntime.updateRiskConfig(req.body || {});
        res.json({ success: true, runtime });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

router.post('/tier', (req, res) => {
    try {
        const { tier, confirmation = '' } = req.body || {};
        const promotion = missionControlRuntime.evaluatePromotion();
        const target = promotion.activeTierProfile?.id === tier
            ? promotion.activeTierProfile
            : missionControlRuntime.getStatus().promotionTiers.find(t => t.id === tier);
        if (!target) return res.status(400).json({ success: false, error: 'Unknown promotion tier' });
        if (target.liveTradingEnabled && confirmation !== target.typedConfirmation) {
            return res.status(400).json({
                success: false,
                error: `Typed confirmation required: ${target.typedConfirmation}`,
                requiredConfirmation: target.typedConfirmation,
                promotion
            });
        }
        const runtime = missionControlRuntime.updateRiskConfig({ activeTier: tier });
        res.json({ success: true, runtime, promotion: missionControlRuntime.evaluatePromotion({ recordEvidence: true }) });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

router.get('/journal', (req, res) => {
    try {
        const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || '100', 10)));
        const events = missionControlRuntime.getJournal(limit);
        res.json({ success: true, events, count: events.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/promotion', (req, res) => {
    try {
        res.json({ success: true, promotion: missionControlRuntime.evaluatePromotion() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/promotion/evaluate', (req, res) => {
    try {
        res.json({ success: true, promotion: missionControlRuntime.evaluatePromotion({ recordEvidence: true }) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/strategies', (req, res) => {
    try {
        res.json({ success: true, strategies: strategyRegistry.list(), status: strategyRegistry.getStatus() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/training', (req, res) => {
    try {
        res.json({ success: true, ...trainingJobRunner.getStatus() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/training/start', (req, res) => {
    try {
        const job = trainingJobRunner.startJob(req.body || {});
        res.json({ success: true, job });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/training/:id/stop', (req, res) => {
    try {
        const job = trainingJobRunner.stopJob(req.params.id);
        if (!job) return res.status(404).json({ success: false, error: 'Training job not found' });
        res.json({ success: true, job });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/training/:id', (req, res) => {
    try {
        const job = trainingJobRunner.getJob(req.params.id);
        if (!job) return res.status(404).json({ success: false, error: 'Training job not found' });
        res.json({ success: true, job });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/historical', (req, res) => {
    try {
        res.json({ success: true, historical: historicalDataCache.getStatus() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/historical/cache', async (req, res) => {
    try {
        const { symbol = 'SPY', timeframe = '5Min', limit = 500, refresh = false } = req.body || {};
        const bars = await historicalDataCache.getBars(symbol, timeframe, limit, { refresh });
        res.json({ success: true, symbol, timeframe, bars: bars.length, historical: historicalDataCache.getStatus() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
