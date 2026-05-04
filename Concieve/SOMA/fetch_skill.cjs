
const https = require('https');

https.get('https://moltbook.com/skill.md', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log(data));
}).on('error', (err) => {
  console.error('Error:', err.message);
});
