import fetch from 'node-fetch';

console.log('Sending chat request to Kevin endpoint...');

try {
    const res = await fetch('http://localhost:3001/api/kevin/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'hows the work coming along?' })
    });
    const json = await res.json();
    console.log('RESPONSE:', JSON.stringify(json, null, 2));
} catch (e) {
    console.error('ERROR:', e.message);
}
