import http from 'http';

const req = http.get('http://localhost:3001/api/alpaca/status', (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        console.log('Status code:', res.statusCode);
        console.log('Response body:', data);
        process.exit(0);
    });
});

req.on('error', (err) => {
    console.error('Request failed:', err.message);
    process.exit(1);
});

req.setTimeout(5000, () => {
    console.error('Request timed out after 5s');
    req.destroy();
    process.exit(1);
});
