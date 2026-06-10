import portalDb from '../server/storage/portalDb.js';
import assert from 'assert';

const BACKEND_URL = 'http://localhost:3001';

async function runDatabaseTests() {
  console.log('--- 1. Running Database direct CRUD verification ---');
  
  const testOrigin = 'https://portal-db-test.com';
  const user = 'john_doe';
  const pass = 'secret123';
  const passUpdated = 'newSecret456';

  // Cleanup
  const existing = portalDb.getCredentials(testOrigin);
  for (const cred of existing) {
    portalDb.deleteCredential(cred.id);
  }

  // Create
  const cred = portalDb.saveCredential(testOrigin, user, pass);
  assert.ok(cred.id, 'Credential ID should exist');
  assert.strictEqual(cred.username, user);
  assert.strictEqual(cred.password, pass);
  console.log('✔ DB: Saved credential');

  // Update
  const updated = portalDb.saveCredential(testOrigin, user, passUpdated);
  assert.strictEqual(updated.id, cred.id, 'ID should remain unchanged on update');
  assert.strictEqual(updated.password, passUpdated, 'Password should be updated');
  console.log('✔ DB: Updated password');

  // Retrieve
  const list = portalDb.getCredentials(testOrigin);
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].username, user);
  console.log('✔ DB: Retrieved credential list');

  // Delete
  const deleted = portalDb.deleteCredential(cred.id);
  assert.ok(deleted, 'Delete should return true');
  assert.strictEqual(portalDb.getCredentials(testOrigin).length, 0);
  console.log('✔ DB: Deleted credential');
  console.log('DB CRUD tests passed successfully.\n');
}

async function runRouteTests() {
  console.log('--- 2. Running Express API Route verification ---');

  const testOrigin = 'https://portal-route-test.com';
  const username = 'jane_route';
  const password = 'routePassword123';
  const updatedPassword = 'routePassword456';

  // 1. POST /api/aperture/portal/credentials (Create)
  console.log('POSTing to create credential...');
  let res = await fetch(`${BACKEND_URL}/api/aperture/portal/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin: testOrigin, username, password })
  });
  let data = await res.json();
  assert.ok(data.success, 'Response should be success');
  assert.ok(data.credential.id, 'Should return created credential with ID');
  const credId = data.credential.id;
  console.log('✔ API: Saved credential via POST');

  // 2. GET /api/aperture/portal/credentials?origin=... (Retrieve)
  console.log('GETting credentials for origin...');
  res = await fetch(`${BACKEND_URL}/api/aperture/portal/credentials?origin=${encodeURIComponent(testOrigin)}`);
  data = await res.json();
  assert.ok(data.success);
  assert.strictEqual(data.credentials.length, 1);
  assert.strictEqual(data.credentials[0].username, username);
  assert.strictEqual(data.credentials[0].password, password);
  console.log('✔ API: Retrieved credential via GET');

  // 3. POST /api/aperture/portal/credentials (Update password)
  console.log('POSTing to update credential password...');
  res = await fetch(`${BACKEND_URL}/api/aperture/portal/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin: testOrigin, username, password: updatedPassword })
  });
  data = await res.json();
  assert.ok(data.success);
  assert.strictEqual(data.credential.id, credId);
  assert.strictEqual(data.credential.password, updatedPassword);
  console.log('✔ API: Updated password via POST');

  // 4. DELETE /api/aperture/portal/credentials/:id (Delete)
  console.log('DELETing credential...');
  res = await fetch(`${BACKEND_URL}/api/aperture/portal/credentials/${credId}`, {
    method: 'DELETE'
  });
  data = await res.json();
  assert.ok(data.success);
  assert.ok(data.removed);
  console.log('✔ API: Deleted credential via DELETE');

  // Verify deletion
  res = await fetch(`${BACKEND_URL}/api/aperture/portal/credentials?origin=${encodeURIComponent(testOrigin)}`);
  data = await res.json();
  assert.strictEqual(data.credentials.length, 0);
  console.log('✔ API: Verified deletion via GET');

  // 5. Test Site Permissions Route
  console.log('\nTesting Site Permissions API Route...');
  const testPermOrigin = 'https://portal-perms-route-test.com';

  // GET default permissions
  res = await fetch(`${BACKEND_URL}/api/aperture/portal/permissions/origin?origin=${encodeURIComponent(testPermOrigin)}`);
  data = await res.json();
  assert.ok(data.success);
  assert.strictEqual(data.permissions.camera, 'ask');
  console.log('✔ API: Default permission is "ask"');

  // POST update permission
  res = await fetch(`${BACKEND_URL}/api/aperture/portal/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin: testPermOrigin, permission: 'camera', value: 'allow' })
  });
  data = await res.json();
  assert.ok(data.success);
  assert.strictEqual(data.permissions.camera, 'allow');
  console.log('✔ API: Set camera permission to "allow"');

  // DELETE permission
  res = await fetch(`${BACKEND_URL}/api/aperture/portal/permissions`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin: testPermOrigin })
  });
  data = await res.json();
  assert.ok(data.success);
  assert.ok(data.removed);
  console.log('✔ API: Deleted permission');

  // 6. Test Downloads Route
  console.log('\nTesting Downloads API Route...');
  const dlId = `dl-route-${Date.now()}`;
  const filename = 'test-route-file.zip';
  const url = 'https://example.com/test-route-file.zip';
  const savePath = 'C:\\Users\\barry\\Downloads\\test-route-file.zip';
  const totalBytes = 5000000;

  // POST create download
  res = await fetch(`${BACKEND_URL}/api/aperture/portal/downloads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: dlId, filename, url, savePath, totalBytes })
  });
  data = await res.json();
  assert.ok(data.success);
  assert.strictEqual(data.download.id, dlId);
  assert.strictEqual(data.download.state, 'progress');
  console.log('✔ API: Created download record');

  // PUT update progress
  res = await fetch(`${BACKEND_URL}/api/aperture/portal/downloads/${dlId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receivedBytes: 2500000, state: 'progress' })
  });
  data = await res.json();
  assert.ok(data.success);
  assert.strictEqual(data.download.received_bytes, 2500000);
  console.log('✔ API: Updated progress');

  // POST complete download
  res = await fetch(`${BACKEND_URL}/api/aperture/portal/downloads/${dlId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ totalBytes })
  });
  data = await res.json();
  assert.ok(data.success);
  assert.strictEqual(data.download.state, 'completed');
  console.log('✔ API: Completed download');

  // DELETE download
  res = await fetch(`${BACKEND_URL}/api/aperture/portal/downloads/${dlId}`, {
    method: 'DELETE'
  });
  data = await res.json();
  assert.ok(data.success);
  assert.ok(data.removed);
  console.log('✔ API: Deleted download record');

  console.log('API Route tests passed successfully.\n');
}

async function run() {
  console.log('======================================================');
  console.log('   PORTAL V2 AI BROWSER UPGRADES VERIFICATION');
  console.log('======================================================\n');

  try {
    await runDatabaseTests();
    await runRouteTests();
    console.log('======================================================');
    console.log('  ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!  ');
    console.log('======================================================');
  } catch (err) {
    console.error('\n❌ VERIFICATION TEST FAILED:');
    console.error(err);
    process.exit(1);
  }
}

run();
