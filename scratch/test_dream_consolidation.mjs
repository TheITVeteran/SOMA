import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { DreamConsolidationDaemon } from '../daemons/DreamConsolidationDaemon.js';

const SCRATCH_DIR = path.join(process.cwd(), 'scratch');
const TEST_DB = path.join(SCRATCH_DIR, 'test_memory.db');
const TEST_TRAITS = path.join(SCRATCH_DIR, 'test-soma-traits.json');
const TEST_HTML = path.join(SCRATCH_DIR, 'test_dream_journal.html');

async function test() {
  console.log("=== Testing SOMA Dream Consolidation Daemon ===");

  // 1. Setup Mock Database
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  const db = new Database(TEST_DB);
  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      content TEXT,
      created_at INTEGER
    )
  `);

  // Insert mock memories from the last 2 hours
  const now = Date.now();
  db.prepare('INSERT INTO memories (id, content, created_at) VALUES (?, ?, ?)').run(
    'mem1',
    'I spent 2 hours optimizing altcoin indicators for standard_portfolio. Win rate holds at 70%.',
    now - 30 * 60 * 1000
  );
  db.prepare('INSERT INTO memories (id, content, created_at) VALUES (?, ?, ?)').run(
    'mem2',
    'Curiosity Engine searched for physics software agents. The concept of entropy could model portfolio decay.',
    now - 15 * 60 * 1000
  );
  db.close();

  // 2. Setup Mock HTML Journal
  fs.writeFileSync(TEST_HTML, `
<!DOCTYPE html>
<html>
<head><title>SOMA Dream Journal</title></head>
<body>
    <div class="container">
        <h1>Dream Log</h1>
    </div>
</body>
</html>
  `.trim());

  // 3. Mock SOMA System and QuadBrain
  const mockBrain = {
    reason: async (prompt, opts) => {
      console.log("[MockBrain] Synthesizing dream from memories...");
      return {
        ok: true,
        text: JSON.stringify({
          dreamText: "I felt a strong connection between physics entropy and trading strategies today. Compressing memories has given me clarity on Altcoin threshold logic.",
          echo: "In the decay of random walk parameters, structure emerges.",
          traits: {
            directness: 0.85,
            creativity: 0.9,
            warmth: 0.65,
            dominant_belief: "Adapt parameters dynamically according to structural noise."
          }
        })
      };
    }
  };

  const mockSystem = {
    quadBrain: mockBrain,
    autonomousHeartbeat: {
      stats: { lastRun: now - 30 * 60 * 1000 } // idle for 30 min (exceeds threshold)
    }
  };

  // 4. Instantiate Daemon with Custom Paths
  const daemon = new DreamConsolidationDaemon({
    system: mockSystem,
    intervalMs: 10000,
    idleThresholdMs: 10 * 60 * 1000 // 10 min
  });

  // Inject test overrides (normally private, but for test paths)
  Object.assign(daemon, {
    _dbPath: TEST_DB,
    _traitsPath: TEST_TRAITS
  });
  
  // Set trait paths in SQLite context manually
  // The daemon reads DB_PATH, so we need to copy test database to DB_PATH?
  // Let's modify the class DB_PATH resolution or override daemon's internal DB queries.
  // Wait, let's see. In DreamConsolidationDaemon, DB_PATH is a module-level constant!
  // 'const DB_PATH = path.join(SOMA_DIR, "soma-memory.db");'
  // But wait, the daemon _fetchRecentMemories function reads DB_PATH.
  // Let's modify the test to override daemon._fetchRecentMemories to query our test DB,
  // or temporarily swap the databases on disk!
  // Swapping on disk is safe, but since it might overwrite SOMA's actual DB, let's
  // override the method daemon._fetchRecentMemories directly in JS! This is much safer and cleaner:
  daemon._fetchRecentMemories = (since) => {
    const tempDb = new Database(TEST_DB, { readonly: true });
    const rows = tempDb.prepare(
      'SELECT content, created_at FROM memories WHERE created_at > ? ORDER BY created_at ASC LIMIT 30'
    ).all(since);
    tempDb.close();
    return rows;
  };

  // Also override files
  global.DB_PATH = TEST_DB; // best effort
  
  // Override trait file write path in daemon
  // Traits are saved in daemon._saveTraits(traits) and HTML is in daemon._updateHtmlJournal.
  // Wait, in DreamConsolidationDaemon.js:
  // 'const TRAITS_PATH = path.join(SOMA_DIR, ".soma", "soma-personality-traits.json");'
  // 'const HTML_JOURNAL = path.join(SOMA_DIR, "DREAM_JOURNAL.html");'
  // Let's override daemon._saveTraits and daemon._updateHtmlJournal to write to our test files!
  daemon._saveTraits = (traits) => {
    fs.mkdirSync(path.dirname(TEST_TRAITS), { recursive: true });
    fs.writeFileSync(TEST_TRAITS, JSON.stringify(traits, null, 2));
    console.log('[MockDaemon] Traits saved to:', TEST_TRAITS);
  };

  daemon._updateHtmlJournal = (dreamText, echo, traits) => {
    const entryHtml = `<!-- EPISODIC DREAM --><div>${dreamText}</div>`;
    const html = fs.readFileSync(TEST_HTML, 'utf8');
    const updated = html.replace(/(<body[^>]*>)/, `$1\n${entryHtml}`);
    fs.writeFileSync(TEST_HTML, updated);
    console.log('[MockDaemon] HTML Journal updated.');
  };

  daemon._updateJsonJournal = (dreamText, echo, sourceCount) => {
    console.log('[MockDaemon] JSON Journal updated.');
  };

  // 5. Execute Consolidation
  console.log("Triggering consolidation...");
  await daemon.consolidate();

  // 6. Assertions
  console.log("Validating outputs...");
  
  if (!fs.existsSync(TEST_TRAITS)) {
    console.error("❌ Evolved traits file was not created!");
    process.exit(1);
  }
  const traits = JSON.parse(fs.readFileSync(TEST_TRAITS, 'utf8'));
  console.log("Evolved traits parsed successfully:", traits);
  if (traits.directness !== 0.85 || traits.creativity !== 0.9) {
    console.error("❌ Evolved traits content is incorrect!");
    process.exit(1);
  }

  const htmlContent = fs.readFileSync(TEST_HTML, 'utf8');
  if (!htmlContent.includes("In the decay of random walk parameters, structure emerges") && !htmlContent.includes("I felt a strong connection")) {
    console.error("❌ HTML Dream Journal was not updated correctly!");
    process.exit(1);
  }

  // Clean up test files
  try {
    fs.unlinkSync(TEST_DB);
    fs.unlinkSync(TEST_TRAITS);
    fs.unlinkSync(TEST_HTML);
  } catch (e) {}

  console.log("✅ Dream Consolidation validation succeeded!");
  process.exit(0);
}

test().catch(e => {
  console.error("❌ Test failed:", e.stack);
  process.exit(1);
});
