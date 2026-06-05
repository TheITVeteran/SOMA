import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import socialMemory from './SocialMemoryEngine.js';

const SOMA_DIR = path.join(process.cwd(), 'SOMA');
const SOCIAL_DIR = path.join(SOMA_DIR, 'social-media');
const IMAGE_DIR = path.join(SOCIAL_DIR, 'images');
const LEDGER_FILE = path.join(SOCIAL_DIR, 'image-ledger.json');
const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const MAX_FOLDER_IMPORTS = 250;

function ensureDirs() {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
}

function readJson(file, fallback) {
    try {
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {}
    return fallback;
}

function writeJson(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function normalizeTags(tags) {
    if (Array.isArray(tags)) return tags.map(t => String(t).trim()).filter(Boolean).slice(0, 12);
    if (typeof tags === 'string') return tags.split(',').map(t => t.trim()).filter(Boolean).slice(0, 12);
    return [];
}

function normalizeInputPath(inputPath) {
    if (!inputPath || typeof inputPath !== 'string') throw new Error('image path required');
    let cleaned = inputPath.trim()
        .replace(/^[`"'\u201c\u201d\u2018\u2019]+|[`"'\u201c\u201d\u2018\u2019]+$/g, '')
        .trim();

    // Windows users often paste a quoted absolute path into a relative-path field.
    // If that creates C:\repo\"C:\real\path.png", recover the final absolute path.
    const windowsPaths = [...cleaned.matchAll(/[a-zA-Z]:[\\/][^`"'\u201c\u201d\u2018\u2019]+/g)]
        .map(match => match[0].trim())
        .filter(Boolean);
    if (windowsPaths.length > 1) cleaned = windowsPaths[windowsPaths.length - 1];

    return cleaned;
}

function toAbsolute(inputPath) {
    const cleaned = normalizeInputPath(inputPath);
    return path.normalize(path.isAbsolute(cleaned) ? cleaned : path.resolve(process.cwd(), cleaned));
}

function validateImage(filePath) {
    const absolutePath = toAbsolute(filePath);
    if (!fs.existsSync(absolutePath)) throw new Error(`Image not found: ${absolutePath}`);
    const stat = fs.statSync(absolutePath);
    if (!stat.isFile()) throw new Error(`Image path is not a file: ${absolutePath}`);
    const ext = path.extname(absolutePath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) throw new Error(`Unsupported image type: ${ext || 'unknown'}`);
    return { absolutePath, ext, size: stat.size };
}

function collectImageFiles(folderPath, results = []) {
    if (results.length >= MAX_FOLDER_IMPORTS) return results;
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    for (const entry of entries) {
        if (results.length >= MAX_FOLDER_IMPORTS) break;
        const entryPath = path.join(folderPath, entry.name);
        if (entry.isDirectory()) {
            collectImageFiles(entryPath, results);
        } else if (entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
            results.push(entryPath);
        }
    }
    return results;
}

function imageId(filePath) {
    return crypto.createHash('sha1').update(path.normalize(filePath).toLowerCase()).digest('hex').slice(0, 14);
}

function uniqueDestination(sourcePath) {
    const ext = path.extname(sourcePath).toLowerCase();
    const base = path.basename(sourcePath, ext).toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'soma-image';
    let candidate = path.join(IMAGE_DIR, `${base}${ext}`);
    let index = 2;
    while (fs.existsSync(candidate)) {
        candidate = path.join(IMAGE_DIR, `${base}-${index}${ext}`);
        index += 1;
    }
    return candidate;
}

export class SocialImageLibrary {
    constructor() {
        ensureDirs();
    }

    list() {
        ensureDirs();
        const ledger = readJson(LEDGER_FILE, { images: [] });
        const images = (ledger.images || [])
            .filter(item => item?.path)
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return {
            ok: true,
            imageDir: IMAGE_DIR,
            images,
        };
    }

    register(options = {}) {
        ensureDirs();
        const { absolutePath, ext, size } = validateImage(options.path);
        const id = imageId(absolutePath);
        const now = Date.now();
        const ledger = readJson(LEDGER_FILE, { images: [] });
        const existingIndex = (ledger.images || []).findIndex(item => item.id === id || path.normalize(item.path || '') === path.normalize(absolutePath));
        const record = {
            id,
            path: absolutePath,
            filename: path.basename(absolutePath),
            ext,
            size,
            alt: String(options.alt || options.imageAlt || '').trim(),
            source: String(options.source || 'local').trim(),
            license: String(options.license || 'user-provided').trim(),
            tags: normalizeTags(options.tags),
            metadata: options.metadata && typeof options.metadata === 'object' ? options.metadata : {},
            artDirector: options.artDirector || options.metadata?.artDirector || null,
            createdAt: existingIndex >= 0 ? ledger.images[existingIndex].createdAt || now : now,
            updatedAt: now,
        };

        ledger.images = ledger.images || [];
        if (existingIndex >= 0) ledger.images[existingIndex] = { ...ledger.images[existingIndex], ...record };
        else ledger.images.push(record);
        writeJson(LEDGER_FILE, ledger);
        socialMemory.recordImage(record);
        return { ok: true, image: record, imageDir: IMAGE_DIR };
    }

    import(options = {}) {
        ensureDirs();
        const sourcePath = toAbsolute(options.path);
        if (!fs.existsSync(sourcePath)) throw new Error(`Image not found: ${sourcePath}`);

        const sourceStat = fs.statSync(sourcePath);
        if (sourceStat.isDirectory()) {
            const files = collectImageFiles(sourcePath);
            if (!files.length) throw new Error(`No supported images found in folder: ${sourcePath}`);

            const imported = [];
            const skipped = [];
            for (const file of files) {
                try {
                    const result = this.import({ ...options, path: file, source: options.source || sourcePath });
                    imported.push(result.image);
                } catch (error) {
                    skipped.push({ path: file, error: error.message });
                }
            }

            return {
                ok: imported.length > 0,
                image: imported[0] || null,
                images: imported,
                imported: imported.length,
                skipped,
                sourceDir: sourcePath,
                imageDir: IMAGE_DIR,
            };
        }

        const { absolutePath } = validateImage(options.path);
        const destination = path.normalize(absolutePath).startsWith(path.normalize(IMAGE_DIR))
            ? absolutePath
            : uniqueDestination(absolutePath);
        if (destination !== absolutePath) fs.copyFileSync(absolutePath, destination);
        return this.register({ ...options, path: destination, source: options.source || absolutePath });
    }

    recordUsage(images = [], usage = {}) {
        ensureDirs();
        const list = Array.isArray(images) ? images : images ? [images] : [];
        if (!list.length) return { ok: true, updated: 0 };
        const ledger = readJson(LEDGER_FILE, { images: [] });
        let updated = 0;
        ledger.images = (ledger.images || []).map(record => {
            const matched = list.some(image => {
                const imagePath = typeof image === 'string' ? image : image?.path || image?.imagePath || image?.file || image?.url;
                return imagePath && path.normalize(imagePath) === path.normalize(record.path || '');
            });
            if (!matched) return record;
            updated += 1;
            const usageEntry = {
                platform: usage.platform || 'unknown',
                queueId: usage.queueId || null,
                postUrl: usage.postUrl || usage.uri || null,
                caption: usage.caption || usage.text || '',
                status: usage.status || 'used',
                usedAt: usage.usedAt || Date.now(),
            };
            return {
                ...record,
                usageHistory: [usageEntry, ...(record.usageHistory || [])].slice(0, 50),
                lastUsedAt: usageEntry.usedAt,
                updatedAt: Date.now(),
            };
        });
        writeJson(LEDGER_FILE, ledger);
        return { ok: true, updated };
    }
}

export default new SocialImageLibrary();
