const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const axios = require('axios');
const pdfParse = require('pdf-parse');
const ExcelJS = require('exceljs');
const sqlite3 = require('sqlite3');
const sharp = require('sharp');
const os = require('os');
const { spawnSync } = require('child_process');

let mammoth = null;
try {
  mammoth = require('mammoth');
} catch (e) {
  mammoth = null;
}

const SOMA_API_URL = process.env.SOMA_API_URL || 'http://localhost:3001';
const STORAGE_DIR = path.join(__dirname, '..', 'storage', 'indexer');
const DB_PATH = path.join(STORAGE_DIR, 'indexer.db');
const LOG_PATH = path.join(STORAGE_DIR, 'indexer.log');

const DEFAULTS = {
  batchSize: 12,
  maxBytes: 50 * 1024 * 1024,
  throttleMs: 0,
  ocrEnabled: true
};

const state = {
  running: false,
  root: null,
  startedAt: null,
  processed: 0,
  indexed: 0,
  skipped: 0,
  failed: 0,
  lastPath: null,
  message: null,
  paused: false,
  throttleMs: 0,
  ocrEnabled: true
};

let stopRequested = false;
let pauseRequested = false;
let db = null;
let tesseractPath = null;

const ensureStorage = async () => {
  await fsp.mkdir(STORAGE_DIR, { recursive: true });
};

const logLine = async (text) => {
  const line = `[${new Date().toISOString()}] ${text}\n`;
  await fsp.appendFile(LOG_PATH, line).catch(() => {});
};

const openDb = async () => {
  if (db) return db;
  await ensureStorage();
  db = new sqlite3.Database(DB_PATH);
  await run(`
    CREATE TABLE IF NOT EXISTS files (
      path TEXT PRIMARY KEY,
      mtime INTEGER,
      size INTEGER,
      hash TEXT,
      indexed_at INTEGER,
      binary INTEGER DEFAULT 0,
      truncated INTEGER DEFAULT 0
    )
  `);
  return db;
};

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve(this);
  });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

const isLikelyText = (buffer) => {
  if (!buffer || buffer.length === 0) return false;
  const sample = buffer.slice(0, Math.min(buffer.length, 8000));
  let nonPrintable = 0;
  for (const byte of sample) {
    if (byte === 0) {
      nonPrintable++;
      continue;
    }
    if (byte < 9 || (byte > 13 && byte < 32)) nonPrintable++;
  }
  return (nonPrintable / sample.length) < 0.18;
};

const resolveTesseractPath = () => {
  if (tesseractPath) return tesseractPath;
  if (process.env.TESSERACT_PATH && fs.existsSync(process.env.TESSERACT_PATH)) {
    tesseractPath = process.env.TESSERACT_PATH;
    return tesseractPath;
  }
  try {
    const result = spawnSync('where', ['tesseract'], { encoding: 'utf8' });
    if (result.status === 0 && result.stdout) {
      const line = result.stdout.split(/\r?\n/).find(Boolean);
      if (line && fs.existsSync(line.trim())) {
        tesseractPath = line.trim();
        return tesseractPath;
      }
    }
  } catch (e) {}
  return null;
};

const runOcr = async (imageBuffer) => {
  const bin = resolveTesseractPath();
  if (!bin) return '';
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'concieve-ocr-'));
  const inputPath = path.join(tempDir, 'input.png');
  try {
    await fsp.writeFile(inputPath, imageBuffer);
    const result = spawnSync(bin, [inputPath, 'stdout', '-l', 'eng'], { encoding: 'utf8' });
    if (result.status === 0) return result.stdout || '';
    return '';
  } finally {
    try { await fsp.rm(tempDir, { recursive: true, force: true }); } catch (e) {}
  }
};

const extractText = async (filePath, buffer) => {
  const ext = path.extname(filePath).toLowerCase();

  try {
    if (ext === '.pdf') {
      const result = await pdfParse(buffer);
      const text = result.text || '';
      if (text.trim().length > 0) return text;
      try {
        const png = await sharp(buffer, { density: 200 }).png().toBuffer();
        const ocrText = await runOcr(png);
        return ocrText || '';
      } catch (e) {
        return '';
      }
    }
    if (ext === '.xlsx' || ext === '.xlsm' || ext === '.xls') {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      let text = '';
      workbook.eachSheet((sheet) => {
        sheet.eachRow((row) => {
          text += row.values.filter(Boolean).join('\t') + '\n';
        });
      });
      return text;
    }
    if (ext === '.csv' || ext === '.tsv') {
      return buffer.toString('utf8');
    }
    if (ext === '.docx' && mammoth) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    }
    if (isLikelyText(buffer)) {
      return buffer.toString('utf8');
    }
    const imageExts = ['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif', '.gif', '.webp'];
    if (imageExts.includes(ext)) {
      const png = await sharp(buffer).png().toBuffer();
      const ocrText = await runOcr(png);
      return ocrText || '';
    }
  } catch (error) {
    await logLine(`Extract error: ${filePath} -> ${error.message}`);
  }

  return '';
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForResume = async () => {
  while (pauseRequested) {
    await sleep(500);
    if (stopRequested) break;
  }
};

const walk = async function* (root) {
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    let dir;
    try {
      dir = await fsp.opendir(current);
    } catch (e) {
      await logLine(`Skip dir (no access): ${current}`);
      continue;
    }
    for await (const entry of dir) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        yield full;
      }
    }
  }
};

const ingestBatch = async (documents) => {
  if (!documents.length) return;
  const response = await axios.post(`${SOMA_API_URL}/api/research/ingest`, { documents });
  return response.data;
};

const ingestFilePath = async ({ filePath, originalName, mimeType }) => {
  await openDb();
  let stat;
  try {
    stat = await fsp.stat(filePath);
  } catch (e) {
    throw new Error(`File not found: ${filePath}`);
  }

  let buffer = await fsp.readFile(filePath);
  let truncated = 0;
  if (buffer.length > DEFAULTS.maxBytes) {
    buffer = buffer.slice(0, DEFAULTS.maxBytes);
    truncated = 1;
  }

  const extracted = await extractText(filePath, buffer);
  const binary = extracted.length === 0;
  const safeContent = extracted.length > 0
    ? extracted
    : `${path.basename(filePath)}\n${filePath}`;

  const doc = {
    id: filePath,
    name: originalName || path.basename(filePath),
    path: filePath,
    content: safeContent,
    metadata: {
      name: originalName || path.basename(filePath),
      path: filePath,
      extension: path.extname(filePath).toLowerCase(),
      size: stat.size,
      mtime: stat.mtimeMs,
      binary,
      truncated: Boolean(truncated),
      mimeType: mimeType || ''
    }
  };

  await ingestBatch([doc]);
  await run(
    'INSERT OR REPLACE INTO files(path, mtime, size, hash, indexed_at, binary, truncated) VALUES(?,?,?,?,?,?,?)',
    [filePath, stat.mtimeMs, stat.size, null, Date.now(), binary ? 1 : 0, truncated ? 1 : 0]
  );

  const summary = extracted
    ? extracted.replace(/\s+/g, ' ').trim().slice(0, 400)
    : '';

  return {
    summary,
    binary,
    truncated: Boolean(truncated)
  };
};

const start = async (root, options = {}) => {
  if (state.running) throw new Error('Indexer already running');
  if (!root || typeof root !== 'string') throw new Error('Root path required');
  if (!fs.existsSync(root)) throw new Error(`Root path not found: ${root}`);

  await openDb();
  stopRequested = false;
  pauseRequested = false;

  state.running = true;
  state.root = root;
  state.startedAt = Date.now();
  state.processed = 0;
  state.indexed = 0;
  state.skipped = 0;
  state.failed = 0;
  state.lastPath = null;
  state.message = 'Indexing started';
  state.paused = false;
  state.throttleMs = Number(options.throttleMs || DEFAULTS.throttleMs);
  state.ocrEnabled = options.ocrEnabled !== false;

  const config = { ...DEFAULTS, ...options };
  const batch = [];

  try {
    for await (const filePath of walk(root)) {
      if (stopRequested) break;
      if (pauseRequested) {
        state.paused = true;
        state.message = 'Indexing paused';
        await waitForResume();
        state.paused = false;
        state.message = 'Indexing resumed';
      }
      state.processed++;
      state.lastPath = filePath;

      let stat;
      try {
        stat = await fsp.stat(filePath);
      } catch (e) {
        state.failed++;
        continue;
      }

      const existing = await get('SELECT mtime, size FROM files WHERE path = ?', [filePath]);
      if (existing && existing.mtime === stat.mtimeMs && existing.size === stat.size) {
        state.skipped++;
        continue;
      }

      let buffer = null;
      let truncated = 0;
      try {
        buffer = await fsp.readFile(filePath);
        if (buffer.length > config.maxBytes) {
          buffer = buffer.slice(0, config.maxBytes);
          truncated = 1;
        }
      } catch (e) {
        state.failed++;
        await logLine(`Read failed: ${filePath}`);
        continue;
      }

      let extracted = '';
      if (config.ocrEnabled) {
        extracted = await extractText(filePath, buffer);
      } else if (isLikelyText(buffer)) {
        extracted = buffer.toString('utf8');
      }
      const binary = extracted.length === 0;
      const safeContent = extracted.length > 0
        ? extracted
        : `${path.basename(filePath)}\n${filePath}`;

      const doc = {
        id: filePath,
        name: path.basename(filePath),
        path: filePath,
        content: safeContent,
        metadata: {
          name: path.basename(filePath),
          path: filePath,
          extension: path.extname(filePath).toLowerCase(),
          size: stat.size,
          mtime: stat.mtimeMs,
          binary,
          truncated: Boolean(truncated)
        }
      };

      batch.push(doc);

      if (batch.length >= config.batchSize) {
        try {
          await ingestBatch(batch);
          const now = Date.now();
          for (const item of batch) {
            await run(
              'INSERT OR REPLACE INTO files(path, mtime, size, hash, indexed_at, binary, truncated) VALUES(?,?,?,?,?,?,?)',
              [item.path, stat.mtimeMs, stat.size, null, now, item.metadata.binary ? 1 : 0, item.metadata.truncated ? 1 : 0]
            );
            state.indexed++;
          }
        } catch (e) {
          state.failed += batch.length;
          await logLine(`Ingest batch failed: ${e.message}`);
        } finally {
          batch.length = 0;
        }
      }

      if (config.throttleMs && config.throttleMs > 0) {
        await sleep(config.throttleMs);
      }
    }

    if (batch.length > 0) {
      try {
        await ingestBatch(batch);
        const now = Date.now();
        for (const item of batch) {
          await run(
            'INSERT OR REPLACE INTO files(path, mtime, size, hash, indexed_at, binary, truncated) VALUES(?,?,?,?,?,?,?)',
            [item.path, Date.now(), item.metadata.size, null, now, item.metadata.binary ? 1 : 0, item.metadata.truncated ? 1 : 0]
          );
          state.indexed++;
        }
      } catch (e) {
        state.failed += batch.length;
        await logLine(`Final ingest batch failed: ${e.message}`);
      }
    }
  } finally {
    state.running = false;
    state.message = stopRequested ? 'Indexing stopped' : 'Indexing completed';
  }
};

const stop = () => {
  stopRequested = true;
};

const pause = () => {
  pauseRequested = true;
};

const resume = () => {
  pauseRequested = false;
};

const status = () => ({
  ...state,
  paused: pauseRequested,
  elapsedMs: state.startedAt ? Date.now() - state.startedAt : 0
});

const listDrives = () => {
  const drives = [];
  for (let i = 65; i <= 90; i++) {
    const letter = String.fromCharCode(i);
    const drivePath = `${letter}:\\`;
    if (fs.existsSync(drivePath)) drives.push(drivePath);
  }
  return drives;
};

module.exports = {
  start,
  stop,
  pause,
  resume,
  ingestFilePath,
  status,
  listDrives
};
