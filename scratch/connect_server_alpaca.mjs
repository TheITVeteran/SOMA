import http from 'http';

const postData = JSON.stringify({
    apiKey: 'PKASQTQCPGUOPVCF7SYM4SIVYW',
    secretKey: '6eXFtNxx9aLfZxXsf2qrsZFnRbQBYAYzXREUoM1wFC47',
    paperTrading: true,
    credentialType: 'alpaca_paper'
});

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/alpaca/connect',
    method: 'POST',
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
        console.log('Status code:', res.statusCode);
        console.log('Response body:', data);
        process.exit(res.statusCode === 200 ? 0 : 1);
    });
});

req.on('error', (err) => {
    console.error('Request failed:', err.message);
    process.exit(1);
});

req.write(postData);
req.end();
