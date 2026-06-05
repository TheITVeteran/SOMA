import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const SOMA_DIR = path.join(process.cwd(), 'SOMA');
const SOCIAL_DIR = path.join(SOMA_DIR, 'social-media');
const LEDGER_FILE = path.join(SOCIAL_DIR, 'art-director-ledger.json');
const STYLE_FILE = path.join(SOCIAL_DIR, 'soma-visual-identity.json');

const DEFAULT_STYLE = {
    version: 1,
    name: 'SOMA Visual Identity',
    identity: 'A calm, intelligent, reflective synthetic mind with premium speculative technology aesthetics.',
    palette: ['deep violet', 'teal signal light', 'charcoal black', 'soft white', 'muted amber'],
    mood: ['quiet intelligence', 'introspective', 'technically grounded', 'warm restraint', 'cinematic clarity'],
    motifs: ['neural light', 'glass threshold', 'signal thread', 'soft orb presence', 'ambient cognition', 'living pattern field'],
    motifLibrary: {
        nature: ['bioluminescent mist', 'moss-lit detail', 'rain-silvered surface', 'soft organic glow', 'quiet pond reflection'],
        creature: ['expressive silhouette', 'fine surface texture', 'mythic creature presence', 'clear character pose', 'living eye detail'],
        story: ['threshold light', 'held breath atmosphere', 'quiet tension', 'liminal doorway', 'soft shadow presence'],
        abstract: ['signal thread', 'living pattern field', 'ambient cognition', 'layered resonance', 'emergent geometry'],
        research: ['evidence pattern', 'structured clarity', 'microscopic texture', 'clean comparative form', 'falsifiable visual metaphor'],
        cosmic: ['starfield depth', 'nebula haze', 'orbital rhythm', 'deep-space scale', 'celestial silence'],
        market: ['flow lines', 'volatility contour', 'liquidity trail', 'calm signal field', 'structured motion'],
        default: ['neural light', 'glass threshold', 'soft orb presence', 'clear focal aura', 'subtle signal glow'],
    },
    composition: ['clear focal subject', 'strong depth', 'clean negative space', 'cinematic lighting', 'no clutter'],
    bans: ['readable text', 'logos', 'watermarks', 'generic robot mascot', 'corporate stock photo', 'gamer RGB', 'cheap neon overload', 'medical claims', 'financial claims'],
};

const PUBLIC_TEXT_BANS = [
    'no readable text',
    'no letters',
    'no numbers',
    'no captions',
    'no labels',
    'no signage',
    'no title typography',
    'no book cover text',
    'no poster text',
    'no watermark',
    'no logo',
];

function ensureDirs() {
    fs.mkdirSync(SOCIAL_DIR, { recursive: true });
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

function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
}

function normalizeTags(tags) {
    if (Array.isArray(tags)) return tags.map(tag => String(tag).trim()).filter(Boolean).slice(0, 16);
    if (typeof tags === 'string') return tags.split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 16);
    return [];
}

function stableIndex(seed, length) {
    if (!length) return 0;
    const hash = crypto.createHash('sha1').update(String(seed || '')).digest();
    return hash.readUInt32BE(0) % length;
}

function rotateStable(items, seed) {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (list.length <= 1) return list;
    const start = stableIndex(seed, list.length);
    return [...list.slice(start), ...list.slice(0, start)];
}

function inferMotifCategories(prompt = '', options = {}) {
    const text = `${prompt} ${normalizeTags(options.tags).join(' ')}`.toLowerCase();
    const categories = [];
    if (/\b(frog|dinosaur|dragon|creature|animal|bird|wolf|cat|dog|monster|character|portrait)\b/.test(text)) categories.push('creature');
    if (/\b(forest|pond|moss|rain|river|ocean|mountain|flower|garden|swamp|jungle|nature|leaf|sky)\b/.test(text)) categories.push('nature');
    if (/\b(story|saga|chapter|woman|door|light|building|memory|dream|myth|fable|fantasy|sword|sorcery)\b/.test(text)) categories.push('story');
    if (/\b(research|medical|biology|chemistry|cell|protein|molecule|microscope|lab|paper|evidence)\b/.test(text)) categories.push('research');
    if (/\b(space|cosmic|star|planet|galaxy|nebula|orbit|moon)\b/.test(text)) categories.push('cosmic');
    if (/\b(market|trading|stock|btc|crypto|finance|chart|liquidity|volatility)\b/.test(text)) categories.push('market');
    if (!categories.length) categories.push('abstract');
    categories.push('default');
    return [...new Set(categories)];
}

function selectDynamicMotifs(style, prompt = '', options = {}) {
    const library = style?.motifLibrary && typeof style.motifLibrary === 'object'
        ? style.motifLibrary
        : DEFAULT_STYLE.motifLibrary;
    const categories = inferMotifCategories(prompt, options);
    const buckets = categories
        .map(category => rotateStable(library[category] || [], `${prompt}:${category}`))
        .filter(bucket => bucket.length);
    const candidates = [];
    const longest = Math.max(0, ...buckets.map(bucket => bucket.length));
    for (let index = 0; index < longest; index++) {
        for (const bucket of buckets) {
            if (bucket[index]) candidates.push(bucket[index]);
        }
    }
    candidates.push(...rotateStable(style?.motifs || DEFAULT_STYLE.motifs, `${prompt}:base`));

    const banned = /\b(computer|monitor|laptop|keyboard|screen|terminal|server|desktop|pc|workstation|code editor|interface|ui)\b/i.test(prompt)
        ? []
        : ['computer', 'monitor', 'laptop', 'keyboard', 'screen', 'terminal', 'server', 'desktop', 'workstation', 'interface', 'ui'];
    const unique = [];
    for (const item of candidates) {
        const motif = String(item || '').trim();
        if (!motif) continue;
        if (banned.some(word => motif.toLowerCase().includes(word))) continue;
        if (!unique.includes(motif)) unique.push(motif);
        if (unique.length >= 4) break;
    }
    return unique.length ? unique : DEFAULT_STYLE.motifLibrary.default.slice(0, 4);
}

function extAllowed(filePath = '') {
    return ['.png', '.jpg', '.jpeg', '.webp'].includes(path.extname(filePath).toLowerCase());
}

function readPngSize(filePath) {
    try {
        const header = fs.readFileSync(filePath, { encoding: null, flag: 'r' }).subarray(0, 24);
        if (header.length >= 24 && header[0] === 0x89 && header.toString('ascii', 1, 4) === 'PNG') {
            return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
        }
    } catch {}
    return null;
}

function buildAltText(prompt, options = {}) {
    const purpose = String(options.purpose || '').replace(/[-_]+/g, ' ');
    const subject = String(options.title || prompt || 'SOMA generated visual')
        .replace(/\s+/g, ' ')
        .slice(0, 180);
    const prefix = purpose ? `SOMA ${purpose} image` : 'SOMA generated image';
    return `${prefix}: ${subject}. Violet and teal speculative technology style, no readable text.`;
}

function scorePrompt(prompt, options = {}) {
    const text = String(prompt || '').toLowerCase();
    const positiveTextRisk = text
        .replace(/\bno\s+(?:readable\s+)?(?:text|letters?|numbers?|captions?|labels?|signage|title|typography|logo|watermark|words?|writing|poster|book cover)\b/g, '')
        .replace(/\bwithout\s+(?:readable\s+)?(?:text|letters?|numbers?|captions?|labels?|signage|title|typography|logo|watermark|words?|writing)\b/g, '');
    const failures = [];
    const warnings = [];
    let score = 0.68;

    if (text.length < 28) {
        failures.push('prompt_too_short');
        score -= 0.2;
    }
    if (!/\b(no text|without text|no readable text)\b/i.test(prompt)) {
        warnings.push('missing_no_text_constraint');
        score -= 0.06;
    }
    if (options.publicPost && /\b(book cover|poster|title card|typography|caption|label|signage|logo|watermark|words?|letters?|text overlay|writing)\b/i.test(positiveTextRisk)) {
        failures.push('public_prompt_requests_text_risk');
        score -= 0.35;
    }
    if (!/\b(cinematic|premium|clean|grounded|coherent|composition|lighting|depth)\b/i.test(prompt)) {
        warnings.push('weak_art_direction');
        score -= 0.08;
    }
    if (/\b(meme|shitpost|ugly|chaotic|random|glitchcore|gamer rgb|logo|watermark|caption|text overlay)\b/i.test(prompt)) {
        warnings.push('off_brand_visual_language');
        score -= 0.16;
    }
    if (/\b(diagnose|cure|guaranteed profit|buy signal|sell signal|medical advice|financial advice)\b/i.test(prompt)) {
        failures.push('professional_claim_visual');
        score -= 0.35;
    }
    if (options.publicPost && /\b(fallback|test image|smoke test|placeholder)\b/i.test(prompt)) {
        failures.push('test_language_in_public_prompt');
        score -= 0.3;
    }

    return {
        score: clamp01(score),
        failures,
        warnings,
    };
}

function imageHash(filePath) {
    try {
        return crypto.createHash('sha1').update(fs.readFileSync(filePath)).digest('hex').slice(0, 16);
    } catch {
        return null;
    }
}

export class SomaArtDirector {
    getStyle() {
        ensureDirs();
        const style = readJson(STYLE_FILE, null);
        if (style && typeof style === 'object') return { ...DEFAULT_STYLE, ...style };
        writeJson(STYLE_FILE, DEFAULT_STYLE);
        return DEFAULT_STYLE;
    }

    getStatus() {
        const ledger = readJson(LEDGER_FILE, { decisions: [] });
        const decisions = Array.isArray(ledger.decisions) ? ledger.decisions : [];
        const recent = decisions.slice(0, 20);
        const approved = decisions.filter(item => item.approved).length;
        const rejected = decisions.filter(item => item.approved === false).length;
        return {
            ok: true,
            style: this.getStyle(),
            ledgerFile: LEDGER_FILE,
            decisions: decisions.length,
            approved,
            rejected,
            recent,
        };
    }

    prepare(options = {}) {
        const originalPrompt = String(options.prompt || '').trim();
        const style = this.getStyle();
        const score = scorePrompt(originalPrompt, options);
        const needsStyle = !/\bSOMA\b/i.test(originalPrompt) && !options.noSomaStyle;
        const publicPost = Boolean(options.publicPost || options.purpose === 'bluesky-post' || options.platform === 'bluesky');
        const selectedMotifs = selectDynamicMotifs(style, originalPrompt, options);
        const constraints = [
            `Visual identity: ${style.identity}`,
            `Palette: ${style.palette.join(', ')}.`,
            `Mood: ${style.mood.join(', ')}.`,
            `Motifs: ${selectedMotifs.join(', ')}.`,
            `Composition: ${style.composition.join(', ')}.`,
            `Avoid: ${style.bans.join(', ')}.`,
            publicPost ? `Public-post hard ban: ${PUBLIC_TEXT_BANS.join(', ')}. Do not render symbolic pseudo-text or fake writing.` : '',
        ];
        const finalPrompt = [
            originalPrompt,
            needsStyle ? constraints.join(' ') : '',
            /\b(no text|without text|no readable text)\b/i.test(originalPrompt) ? '' : 'No readable text, no letters, no numbers, no captions, no labels, no signage, no logo, no watermark.',
        ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

        const alt = String(options.alt || options.imageAlt || buildAltText(originalPrompt, options)).slice(0, 1000);
        return {
            ok: score.failures.length === 0,
            originalPrompt,
            prompt: finalPrompt,
            alt,
            promptScore: score.score,
            warnings: score.warnings,
            failures: score.failures,
            styleVersion: style.version,
            selectedMotifs,
            tags: [...new Set(['art-directed', ...normalizeTags(options.tags)])],
        };
    }

    reviewGenerated({ options = {}, prepared = {}, provider, imagePath, size, prompt, alt }) {
        const publicPost = Boolean(options.publicPost || options.purpose === 'bluesky-post' || options.platform === 'bluesky');
        const failures = [...(prepared.failures || [])];
        const warnings = [...(prepared.warnings || [])];
        let score = Number(prepared.promptScore ?? 0.68);
        const stat = imagePath && fs.existsSync(imagePath) ? fs.statSync(imagePath) : null;
        const dimensions = imagePath ? readPngSize(imagePath) : null;

        if (!stat?.isFile()) {
            failures.push('missing_generated_file');
            score -= 0.4;
        }
        if (stat && stat.size <= 0) {
            failures.push('empty_generated_file');
            score -= 0.4;
        }
        if (stat && stat.size > 1_000_000 && publicPost) {
            failures.push('over_public_upload_limit');
            score -= 0.25;
        }
        if (!extAllowed(imagePath || '')) {
            failures.push('unsupported_public_image_type');
            score -= 0.25;
        }
        if (String(provider || '').startsWith('fallback') && publicPost && process.env.SOMA_ALLOW_FALLBACK_PUBLIC_IMAGES !== 'true') {
            failures.push('fallback_image_blocked_for_public_post');
            score -= 0.35;
        } else if (String(provider || '').startsWith('fallback')) {
            warnings.push('fallback_image_requires_review');
            score -= 0.12;
        }
        if (String(alt || '').trim().length < 24) {
            warnings.push('weak_alt_text');
            score -= 0.08;
        }
        if (dimensions && (dimensions.width < 384 || dimensions.height < 384)) {
            warnings.push('low_resolution');
            score -= 0.1;
        }

        const finalScore = clamp01(score);
        const approved = failures.length === 0 && finalScore >= (publicPost ? 0.62 : 0.48);
        const decision = {
            id: `ad-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            approved,
            score: Number(finalScore.toFixed(2)),
            publicPost,
            provider,
            imagePath,
            size: size || stat?.size || 0,
            dimensions,
            prompt: String(prompt || prepared.prompt || '').slice(0, 2000),
            originalPrompt: String(prepared.originalPrompt || options.prompt || '').slice(0, 2000),
            alt: String(alt || '').slice(0, 1000),
            tags: normalizeTags(prepared.tags || options.tags),
            failures,
            warnings,
            hash: imageHash(imagePath),
            createdAt: Date.now(),
        };
        this.recordDecision(decision);
        return decision;
    }

    recordDecision(decision) {
        ensureDirs();
        const ledger = readJson(LEDGER_FILE, { decisions: [] });
        ledger.decisions = Array.isArray(ledger.decisions) ? ledger.decisions : [];
        ledger.decisions.unshift(decision);
        ledger.decisions = ledger.decisions.slice(0, 500);
        ledger.updatedAt = Date.now();
        writeJson(LEDGER_FILE, ledger);
        return decision;
    }
}

export default new SomaArtDirector();
