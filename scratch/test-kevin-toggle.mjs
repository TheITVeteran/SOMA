import fetch from 'node-fetch';

(async () => {
    console.log('Toggling Kevin online...');
    const toggleRes = await fetch('http://localhost:3001/api/kevin/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    const toggleJson = await toggleRes.json();
    console.log('Toggle response:', toggleJson);

    console.log('Sending message to Kevin...');
    const chatRes = await fetch('http://localhost:3001/api/kevin/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'hows the work coming along?' })
    });
    const chatJson = await chatRes.json();
    console.log('Chat response:', chatJson);
})();
