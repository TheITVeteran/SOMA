import http from 'http';

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
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ statusCode: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, raw: data });
                }
            });
        });

        req.on('error', reject);
        if (body) {
            req.write(postData);
        }
        req.end();
    });
}

async function waitSession(sessionId) {
    const start = Date.now();
    while (Date.now() - start < 30000) { // 30s max wait
        const res = await makeRequest(`/api/backtest/${sessionId}`, 'GET');
        if (res.statusCode === 200 && (res.data.session.status === 'completed' || res.data.session.status === 'failed')) {
            return res.data.session;
        }
        await new Promise(r => setTimeout(r, 500));
    }
    throw new Error(`Session ${sessionId} timed out`);
}

async function run() {
    const strategies = ['sma_crossover', 'rsi_reversal', 'momentum_breakout'];
    const symbol = 'AAPL';
    const initialCapital = 100;

    console.log(`=== Running Backtest Suite for ${symbol} with $${initialCapital} Initial Capital ===\n`);

    const results = [];
    for (const strategy of strategies) {
        console.log(`Starting backtest for: ${strategy}...`);
        const startRes = await makeRequest('/api/backtest/run', 'POST', {
            symbol,
            strategy,
            interval: '1Min', // fast interval to get many trades
            initialCapital,
            maxPositionSize: 1.0 // Use full capital to trade $100 positions
        });

        if (startRes.statusCode !== 200 || !startRes.data.success) {
            console.error(`Failed to start backtest for ${strategy}:`, startRes.data);
            continue;
        }

        const sessionId = startRes.data.sessionId;
        console.log(`Session ID: ${sessionId}. Waiting for completion...`);

        try {
            const session = await waitSession(sessionId);
            if (session.status === 'completed') {
                const metrics = session.metrics;
                results.push({
                    Strategy: strategy,
                    Status: session.status,
                    Trades: session.trades,
                    'Total Return %': metrics ? (metrics.totalReturn).toFixed(2) + '%' : 'N/A',
                    'Win Rate %': metrics ? (metrics.winRate).toFixed(1) + '%' : 'N/A',
                    'Max Drawdown %': metrics ? (metrics.maxDrawdown).toFixed(2) + '%' : 'N/A',
                    'Net PnL': metrics ? '$' + (metrics.netPnL).toFixed(2) : 'N/A'
                });
                console.log(`Completed ${strategy}! Return: ${results[results.length-1]['Total Return %']}, Trades: ${session.trades}`);
            } else {
                console.error(`Backtest failed: ${session.error}`);
            }
        } catch (e) {
            console.error(`Error waiting for ${strategy}:`, e.message);
        }
        console.log('');
    }

    console.log('=== Backtest Results Summary ===');
    console.table(results);
}

run().catch(console.error);
