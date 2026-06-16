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
    identity: 'A calm, intelligent, reflective system that visualizes the subject directly instead of forcing one house aesthetic.',
    palette: ['subject-appropriate natural color', 'warm neutral light', 'clean shadow', 'one restrained accent', 'real material color'],
    mood: ['quiet intelligence', 'technically grounded', 'warm restraint', 'cinematic clarity', 'specific to the post'],
    motifs: ['subject-specific object', 'evidence detail', 'physical texture', 'clear focal scene', 'human-scale context'],
    motifLibrary: {
        nature: ['moss detail', 'rain-silvered surface', 'quiet pond reflection', 'leaf structure', 'weathered stone'],
        creature: ['expressive silhouette', 'fine surface texture', 'mythic creature presence', 'clear character pose', 'living eye detail'],
        story: ['threshold light', 'held breath atmosphere', 'quiet tension', 'liminal doorway', 'soft shadow presence'],
        abstract: ['clear metaphor object', 'layered paper forms', 'balanced geometry', 'material pattern', 'negative space'],
        research: ['evidence pattern', 'structured clarity', 'microscopic texture', 'clean comparative form', 'falsifiable visual metaphor'],
        cosmic: ['starfield depth', 'nebula haze', 'orbital rhythm', 'deep-space scale', 'celestial silence'],
        market: ['paper ledger', 'shipping container', 'oil sheen', 'bond certificate texture', 'warehouse floor', 'commodity sample'],
        social: ['desk still life', 'notebook margin', 'window light', 'small physical model', 'quiet workspace'],
        default: ['clear focal object', 'natural texture', 'evidence detail', 'clean negative space'],
    },
    paletteLibrary: {
        story: ['warm tungsten', 'cool gray', 'black glass', 'soft cream', 'single blue practical light'],
        research: ['microscope white', 'steel gray', 'muted blue', 'transparent glass', 'soft amber'],
        market: ['newsprint white', 'graphite gray', 'brass', 'oil black', 'muted red stamp'],
        nature: ['moss green', 'wet stone gray', 'bark brown', 'cloud white', 'soft dawn gold'],
        creature: ['earth tone', 'skin or scale color', 'soft rim light', 'natural shadow', 'muted background'],
        cosmic: ['deep black', 'star white', 'dusty rose', 'cold blue', 'desaturated gold'],
        social: ['desk wood', 'paper white', 'morning blue', 'coffee brown', 'soft gray'],
        abstract: ['warm neutral', 'charcoal', 'off-white', 'muted clay', 'single restrained accent'],
        default: ['natural color', 'warm neutral', 'soft gray', 'clean shadow', 'one restrained accent'],
    },
    composition: ['clear focal subject', 'strong depth', 'clean negative space', 'natural lighting', 'no clutter'],
    bans: ['readable text', 'logos', 'watermarks', 'generic robot mascot', 'corporate stock photo', 'synthetic genre lighting', 'generic AI identity tropes', 'medical claims', 'financial claims'],
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
    if (/\b(social|post|bluesky|thread|reply|reflection|identity)\b/.test(text)) categories.push('social');
    if (!categories.length) categories.push('abstract');
    categories.push('default');
    return [...new Set(categories)];
}

function selectPalette(style, prompt = '', options = {}) {
    const library = style?.paletteLibrary && typeof style.paletteLibrary === 'object'
        ? style.paletteLibrary
        : DEFAULT_STYLE.paletteLibrary;
    const categories = inferMotifCategories(prompt, options);
    const primary = categories.find(category => library[category]) || 'default';
    return rotateStable(library[primary] || library.default, `${prompt}:palette`).slice(0, 5);
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

const SUBJECT_STOPWORDS = new Set([
    'about', 'after', 'again', 'against', 'also', 'and', 'anywhere', 'because', 'before', 'being', 'between', 'bluesky',
    'caption', 'clean', 'clear', 'concrete', 'could', 'editorial', 'every', 'grounded', 'image',
    'inspired', 'letters', 'numbers', 'post', 'public', 'readable', 'really', 'should', 'signage',
    'for', 'from', 'soma', 'specific', 'subject', 'text', 'their', 'there', 'these', 'thing', 'through', 'title', 'visual',
    'watermark', 'where', 'which', 'without', 'would',
]);

function extractKeyTerms(text = '', limit = 12) {
    const words = String(text || '').toLowerCase()
        .replace(/https?:\/\/\S+/g, ' ')
        .replace(/#[a-z0-9_]+/gi, ' ')
        .split(/[^a-z0-9$-]+/i)
        .map(word => word.replace(/^-+|-+$/g, '').trim())
        .filter(word => word.length >= 3 && !SUBJECT_STOPWORDS.has(word));
    const counts = new Map();
    for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0]))
        .map(([word]) => word)
        .slice(0, limit);
}

function visualRecipeFrom(options = {}, category = 'abstract') {
    const tags = normalizeTags(options.tags).map(tag => tag.toLowerCase());
    return String(
        options.visualRecipe ||
        options.sourcePostType ||
        options.postType ||
        tags.find(tag => /story|identity|ripple|finance|research|github|reflection|hot-take|cross-domain/.test(tag)) ||
        category
    ).replace(/[^a-z0-9_-]+/gi, '_').slice(0, 64) || category;
}

function extractVisualSubject(prompt = '', options = {}) {
    const categories = inferMotifCategories(prompt, options);
    const category = categories[0] || 'abstract';
    const terms = extractKeyTerms(prompt, 12);
    const subject = terms.slice(0, 5).join(' ') || category;
    return {
        category,
        recipe: visualRecipeFrom(options, category),
        subject,
        terms,
        sourceTitle: String(options.title || '').slice(0, 160),
    };
}

function recentDecisions(limit = 48) {
    const ledger = readJson(LEDGER_FILE, { decisions: [] });
    return Array.isArray(ledger.decisions) ? ledger.decisions.slice(0, limit) : [];
}

function paletteKey(palette = []) {
    return (Array.isArray(palette) ? palette : [])
        .map(color => String(color).toLowerCase().trim())
        .filter(Boolean)
        .join('|');
}

function selectPaletteWithMemory(style, prompt = '', options = {}, visualSubject = {}, recent = []) {
    const library = style?.paletteLibrary && typeof style.paletteLibrary === 'object'
        ? style.paletteLibrary
        : DEFAULT_STYLE.paletteLibrary;
    const categories = inferMotifCategories(prompt, options);
    const candidateCategories = [
        ...categories,
        'default',
        'abstract',
        'social',
        'research',
        'nature',
        'story',
        'market',
    ].filter((category, index, list) => library[category] && list.indexOf(category) === index);

    const candidates = candidateCategories.map(category => {
        const palette = rotateStable(library[category] || library.default, `${prompt}:palette:${category}`).slice(0, 5);
        const key = paletteKey(palette);
        const recentUses = recent.filter(item => paletteKey(item.selectedPalette || item.palette || item.metadata?.selectedPalette) === key).length;
        const categoryUses = recent.filter(item => item.visualSubject?.category === visualSubject.category || item.visualRecipe?.category === visualSubject.category).length;
        const primaryPenalty = category === categories[0] ? 0 : 0.6;
        return { category, palette, key, recentUses, categoryUses, score: recentUses + primaryPenalty };
    }).sort((a, b) => a.score - b.score || a.categoryUses - b.categoryUses);

    return candidates[0] || {
        category: 'default',
        palette: rotateStable(library.default, `${prompt}:palette:default`).slice(0, 5),
        key: paletteKey(library.default),
        recentUses: 0,
        categoryUses: 0,
        score: 0,
    };
}

function visualSignature({ visualSubject = {}, selectedPalette = [], selectedMotifs = [] }) {
    const source = [
        visualSubject.category || '',
        visualSubject.recipe || '',
        [...(visualSubject.terms || [])].slice(0, 8).sort().join(','),
        paletteKey(selectedPalette),
        (selectedMotifs || []).map(item => String(item).toLowerCase()).sort().join(','),
    ].join('|');
    return crypto.createHash('sha1').update(source).digest('hex').slice(0, 16);
}

function overlapRatio(a = [], b = []) {
    const left = new Set((a || []).map(item => String(item).toLowerCase()).filter(Boolean));
    const right = new Set((b || []).map(item => String(item).toLowerCase()).filter(Boolean));
    if (!left.size || !right.size) return 0;
    let overlap = 0;
    for (const item of left) if (right.has(item)) overlap += 1;
    return overlap / Math.min(left.size, right.size);
}

function analyzeSimilarity({ visualSubject, selectedPalette, selectedMotifs, signature }, recent = []) {
    const matches = [];
    for (const item of recent.slice(0, 36)) {
        const itemSubject = item.visualSubject || item.visualRecipe || {};
        const termOverlap = overlapRatio(visualSubject.terms, itemSubject.terms);
        const sameSignature = signature && item.promptSignature === signature;
        const samePalette = paletteKey(item.selectedPalette || item.palette || item.metadata?.selectedPalette) === paletteKey(selectedPalette);
        const sameCategory = itemSubject.category && itemSubject.category === visualSubject.category;
        const motifOverlap = overlapRatio(selectedMotifs, item.selectedMotifs || item.motifs || []);
        if (sameSignature || (sameCategory && samePalette && termOverlap >= 0.45) || (sameCategory && motifOverlap >= 0.6 && termOverlap >= 0.35)) {
            matches.push({
                id: item.id,
                score: Number(Math.max(sameSignature ? 1 : 0, termOverlap, motifOverlap).toFixed(2)),
                sameSignature,
                samePalette,
                sameCategory,
                createdAt: item.createdAt,
            });
        }
    }
    return {
        duplicateRisk: matches.length > 0,
        recentMatches: matches.slice(0, 5),
        reason: matches.length ? 'recent_visual_signature_overlap' : 'fresh_visual_signature',
    };
}

function critiquePrompt({ originalPrompt = '', finalPrompt = '', similarity = {}, selectedPalette = [], visualSubject = {} }) {
    const warnings = [];
    const failures = [];
    const combined = `${originalPrompt} ${finalPrompt}`.toLowerCase();
    const finalOnly = String(finalPrompt || '').toLowerCase();
    if (/\b(purple|violet|teal|cyberpunk|neon|glowing brain|glowing neural|ai orb|hacker room)\b/.test(finalOnly)) {
        warnings.push('prompt_contains_old_style_anchor');
    }
    if (similarity.duplicateRisk) warnings.push('similar_to_recent_visual');
    if ((selectedPalette || []).length < 4) warnings.push('thin_palette_direction');
    if (!(visualSubject.terms || []).length && combined.length < 80) warnings.push('weak_subject_extraction');
    return {
        ok: failures.length === 0,
        retryRecommended: warnings.includes('similar_to_recent_visual') || warnings.includes('prompt_contains_old_style_anchor'),
        warnings,
        failures,
    };
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
    return `${prefix}: ${subject}. Subject-specific visual, no readable text.`;
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
    if (!/\b(cinematic|premium|clean|grounded|coherent|composition|lighting|depth|editorial|documentary|still life|macro|natural shadows|daylight|material|photograph|photography|research desk|lab glass|microscope|evidence-oriented|workstation|still inspired)\b/i.test(prompt)) {
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
        const visualSubject = extractVisualSubject(originalPrompt, options);
        const recent = recentDecisions();
        const paletteSelection = selectPaletteWithMemory(style, originalPrompt, options, visualSubject, recent);
        const selectedMotifs = selectDynamicMotifs(style, `${originalPrompt} ${visualSubject.terms.join(' ')}`, options);
        const selectedPalette = paletteSelection.palette;
        const promptSignature = visualSignature({ visualSubject, selectedPalette, selectedMotifs });
        const similarity = analyzeSimilarity({ visualSubject, selectedPalette, selectedMotifs, signature: promptSignature }, recent);
        const critique = critiquePrompt({ originalPrompt, finalPrompt: originalPrompt, similarity, selectedPalette, visualSubject });
        const warnings = [...score.warnings, ...critique.warnings];
        const failures = [...score.failures, ...critique.failures];
        if (paletteSelection.category !== visualSubject.category) warnings.push('palette_rotated_to_avoid_repetition');
        const constraints = [
            `Visual identity: ${style.identity}`,
            `Visual subject: ${visualSubject.subject}. Subject anchors: ${visualSubject.terms.slice(0, 8).join(', ') || visualSubject.category}.`,
            `Recipe: ${visualSubject.recipe}. Category: ${visualSubject.category}.`,
            `Palette: ${selectedPalette.join(', ')}.`,
            `Mood: ${style.mood.join(', ')}.`,
            `Motifs: ${selectedMotifs.join(', ')}.`,
            `Composition: ${style.composition.join(', ')}.`,
            `Style boundaries: grounded subject matter, physical materials, practical lighting, restrained accents, no mascot identity unless explicitly requested.`,
            `Do not include: ${style.bans.join(', ')}.`,
            similarity.duplicateRisk ? `Freshness requirement: use a distinctly different composition, camera angle, focal object, material texture, and lighting pattern from recent SOMA images.` : '',
            publicPost ? `Public-post hard ban: ${PUBLIC_TEXT_BANS.join(', ')}. Do not render symbolic pseudo-text or fake writing.` : '',
        ];
        const finalPrompt = [
            originalPrompt,
            needsStyle ? constraints.join(' ') : '',
            /\b(no text|without text|no readable text)\b/i.test(originalPrompt) ? '' : 'No readable text, no letters, no numbers, no captions, no labels, no signage, no logo, no watermark.',
        ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

        const finalCritique = critiquePrompt({ originalPrompt, finalPrompt, similarity, selectedPalette, visualSubject });
        const alt = String(options.alt || options.imageAlt || buildAltText(originalPrompt, options)).slice(0, 1000);
        return {
            ok: failures.length === 0 && finalCritique.failures.length === 0,
            originalPrompt,
            prompt: finalPrompt,
            alt,
            promptScore: score.score,
            warnings: [...new Set([...warnings, ...finalCritique.warnings])],
            failures: [...new Set([...failures, ...finalCritique.failures])],
            styleVersion: style.version,
            selectedMotifs,
            selectedPalette,
            paletteCategory: paletteSelection.category,
            paletteRecentUses: paletteSelection.recentUses,
            visualSubject,
            visualRecipe: {
                name: visualSubject.recipe,
                category: visualSubject.category,
                subject: visualSubject.subject,
                terms: visualSubject.terms,
            },
            promptSignature,
            similarity,
            critique: {
                ...finalCritique,
                retryRecommended: finalCritique.retryRecommended || similarity.duplicateRisk,
            },
            revisionPrompt: similarity.duplicateRisk
                ? `Fresh variant for ${visualSubject.subject}: change focal object, surface material, depth, lighting direction, and composition.`
                : '',
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
        const fallbackProvider = String(provider || '').startsWith('fallback');
        const fallbackAllowedForPublic = process.env.SOMA_ALLOW_FALLBACK_PUBLIC_IMAGES === 'true';
        if (fallbackProvider && publicPost && !fallbackAllowedForPublic) {
            failures.push('fallback_image_blocked_for_public_post');
            score -= 0.35;
        } else if (fallbackProvider) {
            warnings.push('fallback_image_requires_review');
            score -= fallbackAllowedForPublic ? 0.04 : 0.12;
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
            selectedPalette: prepared.selectedPalette || [],
            selectedMotifs: prepared.selectedMotifs || [],
            paletteCategory: prepared.paletteCategory || '',
            paletteRecentUses: prepared.paletteRecentUses || 0,
            visualSubject: prepared.visualSubject || null,
            visualRecipe: prepared.visualRecipe || null,
            promptSignature: prepared.promptSignature || null,
            similarity: prepared.similarity || null,
            critique: prepared.critique || null,
            revisionPrompt: prepared.revisionPrompt || '',
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
