import { BacktestEngine, SMAStrategy, RSIStrategy, MomentumStrategy } from '../server/finance/BacktestEngine.js';

// Generate synthetic candles for simulation
function generateMockCandles(length = 5000, startPrice = 100) {
    const candles = [];
    let price = startPrice;
    const now = Date.now();

    for (let i = 0; i < length; i++) {
        const change = (Math.random() - 0.5) * 0.8 + Math.sin(i / 50) * 0.2; // random walk + periodic wave
        const open = price;
        const close = price + change;
        const high = Math.max(open, close) + Math.random() * 0.3;
        const low = Math.min(open, close) - Math.random() * 0.3;
        const volume = Math.round(Math.random() * 1000 + 100);
        const timestamp = now - (length - i) * 60000; // 1-minute steps

        candles.push({
            openTime: timestamp,
            time: new Date(timestamp).toLocaleTimeString(),
            timestamp,
            open,
            high,
            low,
            close,
            volume
        });

        price = close;
    }
    return candles;
}

async function run() {
    const length = 10000;
    const initialCapital = 100;
    console.log(`=== Simulating Active Protocols on ${length} Synthetic Bars with $${initialCapital} Budget ===\n`);

    const candles = generateMockCandles(length);

    const strategies = [
        {
            name: 'SMA Crossover (Fast)',
            strategy: SMAStrategy(5, 15)
        },
        {
            name: 'RSI Reversal (Sensitive)',
            strategy: RSIStrategy(10, 40, 60)
        },
        {
            name: 'Momentum Breakout (Tight)',
            strategy: MomentumStrategy(10, 0.005)
        }
    ];

    const results = [];
    for (const item of strategies) {
        const engine = new BacktestEngine({
            initialCapital,
            feeRate: 0.0005, // 0.05% fee
            slippage: 0.0002, // low slippage
            maxPositionSize: 0.8 // Max 80% position size to represent ~$80 trade value
        });

        const result = await engine.runBacktest(candles, item.strategy, { symbol: 'SYNTHETIC' });
        const metrics = result.metrics;

        results.push({
            Strategy: item.name,
            Trades: metrics.totalTrades,
            'Win Rate %': metrics.winRate.toFixed(1) + '%',
            'Profit Factor': metrics.profitFactor.toFixed(2),
            'Max Drawdown %': metrics.maxDrawdown.toFixed(2) + '%',
            'Total Return %': metrics.totalReturn.toFixed(2) + '%',
            'Net PnL': '$' + metrics.netPnL.toFixed(2),
            'Final Capital': '$' + metrics.finalCapital.toFixed(2)
        });
    }

    console.log('=== Simulation Results Summary ===');
    console.table(results);
}

run().catch(console.error);
