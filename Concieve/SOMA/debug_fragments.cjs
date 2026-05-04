const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/knowledge/fragments',
  method: 'GET',
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      console.log('Raw Data Length:', data.length);
      const json = JSON.parse(data);
      console.log('Success:', json.success);
      console.log('Fragment Count:', json.fragments ? json.fragments.length : 'undefined');
      if (json.error) {
          console.log('Error:', json.error);
      }
    } catch (e) {
      console.log('Response not JSON:', data.substring(0, 200));
    }
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.end();
