import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const SOMA_DIR = path.join(process.cwd(), 'SOMA');
const SOCIAL_DIR = path.join(SOMA_DIR, 'social-media');
const IMAGE_DIR = path.join(SOCIAL_DIR, 'images');
const LEDGER_FILE = path.join(SOCIAL_DIR, 'image-ledger.json');
const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

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

function toAbsolute(inputPath) {
    if (!inputPath || typeof inputPath !== 'string') throw new Error('image path required');
    return path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);
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
        return {
            ok: true,
            imageDir: IMAGE_DIR,
            images: (ledger.images || [])
                .filter(item => item?.path)
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
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
            createdAt: existingIndex >= 0 ? ledger.images[existingIndex].createdAt || now : now,
            updatedAt: now,
        };

        ledger.images = ledger.images || [];
        if (existingIndex >= 0) ledger.images[existingIndex] = { ...ledger.images[existingIndex], ...record };
        else ledger.images.push(record);
        writeJson(LEDGER_FILE, ledger);
        return { ok: true, image: record, imageDir: IMAGE_DIR };
    }

    import(options = {}) {
        ensureDirs();
        const { absolutePath } = validateImage(options.path);
        const destination = path.normalize(absolutePath).startsWith(path.normalize(IMAGE_DIR))
            ? absolutePath
            : uniqueDestination(absolutePath);
        if (destination !== absolutePath) fs.copyFileSync(absolutePath, destination);
        return this.register({ ...options, path: destination, source: options.source || absolutePath });
    }
}

export default new SocialImageLibrary();
