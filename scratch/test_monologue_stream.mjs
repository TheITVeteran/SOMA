import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { writeMonologue } = require('../core/InternalMonologue.cjs');

const MONOLOGUE_FILE = path.join(process.cwd(), '.soma', 'monologue.txt');

async function test() {
  console.log("=== Testing SOMA Internal Monologue Bounding ===");

  // Clear existing monologue to isolate test
  if (fs.existsSync(MONOLOGUE_FILE)) {
    fs.unlinkSync(MONOLOGUE_FILE);
  }

  // Write 170 thoughts (limit is 150)
  console.log("Writing 170 test thoughts to stream...");
  for (let i = 1; i <= 170; i++) {
    writeMonologue(`Thought sequence #${i} - analyzing semantic clusters and delta screen hashes.`, 'TestHarness');
  }

  // Verify file existence
  if (!fs.existsSync(MONOLOGUE_FILE)) {
    console.error("❌ Monologue file was not created!");
    process.exit(1);
  }

  const content = fs.readFileSync(MONOLOGUE_FILE, 'utf8');
  const lines = content.split('\n').filter(Boolean);

  console.log(`Verifying: File contains ${lines.length} lines (expected: 150).`);
  
  if (lines.length !== 150) {
    console.error(`❌ Monologue file length is incorrect: ${lines.length} lines.`);
    process.exit(1);
  }

  // Verify bounded contents contain the final sequence items
  const firstLine = lines[0];
  const lastLine = lines[lines.length - 1];

  console.log(`First entry in stream: "${firstLine}"`);
  console.log(`Last entry in stream: "${lastLine}"`);

  if (!firstLine.includes('sequence #21') || !lastLine.includes('sequence #170')) {
    console.error("❌ Pruning sequence mismatch! Pruned entries are incorrect.");
    process.exit(1);
  }

  console.log("✅ Internal Monologue validation succeeded! Stream bounded correctly.");
  process.exit(0);
}

test().catch(e => {
  console.error("❌ Test failed:", e.message);
  process.exit(1);
});
