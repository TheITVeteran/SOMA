// Quick diagnostic to check SOMA configuration
const http = require('http');

console.log('=== SOMA Diagnostic Check ===\n');

// Check 1: Backend port 3001
console.log('Checking backend on port 3001...');
const req = http.get('http://localhost:3001/health', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('✅ Backend is responding:', data);
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.log('❌ Backend is NOT responding:', err.message);
  console.log('\nTroubleshooting:');
  console.log('1. Run: npm run soma');
  console.log('2. Wait for "SOMA Server running on port 3001"');
  console.log('3. Then run this diagnostic again\n');
  process.exit(1);
});

req.setTimeout(5000, () => {
  console.log('❌ Backend connection TIMEOUT (server hung)');
  console.log('\nThe backend is listening but not responding to requests.');
  console.log('This means the server is likely frozen or stuck during initialization.\n');
  req.destroy();
  process.exit(1);
});
