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

async function run() {
    console.log('--- Submitting Market Buy Order to Server ---');
    const orderRes = await makeRequest('/api/alpaca/order', 'POST', {
        symbol: 'AAPL',
        side: 'buy',
        qty: 1,
        orderType: 'market',
        timeInForce: 'day'
    });
    console.log('Order Response:', JSON.stringify(orderRes, null, 2));

    if (orderRes.statusCode !== 200) {
        console.error('Order failed!');
        process.exit(1);
    }

    console.log('\n--- Waiting 2 seconds ---');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n--- Fetching Open Positions from Server ---');
    const posRes = await makeRequest('/api/alpaca/positions', 'GET');
    console.log('Positions:', JSON.stringify(posRes, null, 2));

    console.log('\n--- Closing AAPL Position on Server ---');
    const closeRes = await makeRequest('/api/alpaca/position/AAPL', 'DELETE');
    console.log('Close Response:', JSON.stringify(closeRes, null, 2));
}

run().catch(console.error);
