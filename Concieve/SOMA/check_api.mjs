import fetch from 'node-fetch';

const baseUrl = 'http://localhost:3001';

async function checkApi() {
    const endpoints = [
        '/health',
        '/api/status',
        '/api/population',
        '/api/memory/status',
        '/api/analytics/summary',
        '/api/knowledge/load'
    ];

    console.log('Checking SOMA API endpoints...\n');

    for (const endpoint of endpoints) {
        try {
            const res = await fetch(`${baseUrl}${endpoint}`);
            console.log(`[${res.status}] ${endpoint}`);
            if (res.ok) {
                const data = await res.json();
                console.log('Data:', JSON.stringify(data, null, 2).substring(0, 200) + '...');
            } else {
                const text = await res.text();
                console.log('Error:', text);
            }
        } catch (e) {
            console.log(`[FAILED] ${endpoint}: ${e.message}`);
        }
        console.log('------------------');
    }
}

checkApi();
