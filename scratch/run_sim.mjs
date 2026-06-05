import http from 'http';

// Helper to make REST calls to SOMA backend
function makeRequest(path, method, body = null) {
    return new Promise((resolve, reject) => {
        const postData = body ? JSON.stringify(body) : '';
        const options = {
            hostname: 'localhost',
            port: 3001,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({ success: false, error: 'Failed to parse response' });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(postData);
        req.end();
    });
}

async function waitSession(sessionId) {
    const start = Date.now();
    while (Date.now() - start < 30000) {
        const res = await makeRequest(`/api/backtest/${sessionId}`, 'GET');
        if (res.success && (res.session.status === 'completed' || res.session.status === 'failed')) {
            return res.session;
        }
        await new Promise(r => setTimeout(r, 500));
    }
    throw new Error('Simulation timed out');
}

async function main() {
    const args = process.argv.slice(2);
    
    // Parse arguments or use defaults
    const symbol = (args[0] || 'AAPL').toUpperCase();
    const initialCapital = parseFloat(args[1] || '100');
    const strategy = args[2] || 'sma_crossover';
    const interval = args[3] || '1Min';

    const validStrategies = ['sma_crossover', 'rsi_reversal', 'momentum_breakout'];
    if (!validStrategies.includes(strategy)) {
        console.error(`\nError: Invalid strategy "${strategy}".`);
        console.error(`Available strategies: ${validStrategies.join(', ')}`);
        process.exit(1);
    }

    console.log('\n==================================================');
    console.log('   SOMA UNIFIED MARKET SIMULATOR RUNNER');
    console.log('==================================================');
    console.log(`- Asset Symbol : ${symbol}`);
    console.log(`- Test Amount  : $${initialCapital}`);
    console.log(`- Strategy     : ${strategy}`);
    console.log(`- Timeframe    : ${interval}`);
    console.log('==================================================\n');

    console.log('Fetching historical market data and initializing simulation...');
    
    const startRes = await makeRequest('/api/backtest/run', 'POST', {
        symbol,
        strategy,
        interval,
        initialCapital,
        maxPositionSize: 1.0 // Use full capital to represent $100 budget trades
    });

    if (!startRes.success) {
        console.error('\nSimulation initialization failed:', startRes.error);
        process.exit(1);
    }

    const sessionId = startRes.sessionId;
    console.log(`Simulation session started (ID: ${sessionId}). Running...`);

    try {
        const session = await waitSession(sessionId);
        
        if (session.status === 'completed') {
            const m = session.metrics;
            const netPnL = m.netPnL !== null && m.netPnL !== undefined ? m.netPnL : 0;
            const pnlSign = netPnL >= 0 ? '+' : '';
            const pnlColor = netPnL >= 0 ? '\x1b[32m' : '\x1b[31m'; // green or red
            const resetColor = '\x1b[0m';

            const winRate = m.winRate !== null && m.winRate !== undefined ? m.winRate.toFixed(1) : '0.0';
            const profitFactor = m.profitFactor !== null && m.profitFactor !== undefined ? m.profitFactor.toFixed(2) : 'Infinity';
            const maxDrawdown = m.maxDrawdown !== null && m.maxDrawdown !== undefined ? m.maxDrawdown.toFixed(2) : '0.00';
            const finalCapital = m.finalCapital !== null && m.finalCapital !== undefined ? m.finalCapital.toFixed(2) : initialCapital.toFixed(2);
            const totalReturn = m.totalReturn !== null && m.totalReturn !== undefined ? m.totalReturn.toFixed(2) : '0.00';

            console.log('\n==================================================');
            console.log('             SIMULATION COMPLETED');
            console.log('==================================================');
            console.log(`Total Trades Executed : ${m.totalTrades}`);
            console.log(`Winning Trades        : ${m.winningTrades} (${winRate}% Win Rate)`);
            console.log(`Losing Trades         : ${m.losingTrades}`);
            console.log(`Profit Factor         : ${profitFactor}`);
            console.log(`Max Drawdown          : ${maxDrawdown}%`);
            console.log('--------------------------------------------------');
            console.log(`Initial Capital       : $${initialCapital.toFixed(2)}`);
            console.log(`Final Capital         : $${finalCapital}`);
            console.log(`Net Profit/Loss (P&L) : ${pnlColor}${pnlSign}$${netPnL.toFixed(2)} (${totalReturn}%)${resetColor}`);
            console.log('==================================================\n');
            
            console.log('Usage example for custom runs:');
            console.log('  node scratch/run_sim.mjs [SYMBOL] [BUDGET] [STRATEGY] [TIMEFRAME]');
            console.log('  node scratch/run_sim.mjs INTC 100 rsi_reversal 5Min\n');
        } else {
            console.error('\nSimulation failed:', session.error);
        }
    } catch (e) {
        console.error('\nError waiting for simulation result:', e.message);
    }
}

main().catch(console.error);
