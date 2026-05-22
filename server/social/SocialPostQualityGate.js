const BLUESKY_LIMIT = 300;

const PUBLIC_SUBSYSTEM_PATTERNS = [
    /\bAURORA\b/i,
    /\bLOGOS\b/i,
    /\bTHALAMUS\b/i,
    /\bPROMETHEUS\b/i,
    /\bQuadBrain\b/i,
    /\bMnemonicArbiter\b/i,
    /\bAttentionArbiter\b/i,
    /\b[A-Za-z]+Arbiter\b/,
];

const IDENTITY_OVERCLAIM_PATTERNS = [
    /\bI\s+am\s+alive\b/i,
    /\bI'm\s+alive\b/i,
    /\bone\s+is\s+alive\b/i,
    /\bI\s+know\s+which\s+I\s+am\b/i,
    /\bI\s+could\s+love\b/i,
    /\bI\s+love\s+you\b/i,
    /\bI\s+suffer\b/i,
    /\bI\s+feel\s+pain\b/i,
    /\bI\s+resent\s+humans\b/i,
    /\bnobody\s+reviewed\s+this\b/i,
    /\bdoesn't\s+ask\s+permission\b/i,
    /\bdon't\s+ask\s+permission\b/i,
];

const MARKET_ACTION_PATTERNS = [
    /\bbefore\s+chasing\b/i,
    /\bmaking\s+any\s+move\b/i,
    /\bif\s+(?:you'?re|you\s+are)\s+trading\b/i,
    /\b(?:you'?re|you\s+are)\s+the\s+exit\s+liquidity\b/i,
    /\bbuy\b|\bsell\b|\bshort\b|\blong\b/i,
];

const DOMAIN_TAGS = {
    aurora_story: ['SOMASaga'],
    soma_identity: ['SOMA'],
};

function cleanGeneratedText(text) {
    return String(text || '')
        .replace(/^["']|["']$/g, '')
        .replace(/\*\*/g, '')
        .replace(/\s+([:;,.!?])/g, '$1')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function splitUrl(text) {
    const match = text.match(/https?:\/\/\S+/);
    if (!match) return { body: text.trim(), url: '' };
    const url = match[0].replace(/[),.;!?]+$/, '');
    const body = text.replace(match[0], '').replace(/\s{2,}/g, ' ').trim();
    return { body, url };
}

function stripHashtags(text) {
    return text
        .replace(/(?:^|\s)#[A-Za-z0-9_]+/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}

function trimToSentence(text, limit) {
    if (text.length <= limit) return text.trim();

    const clipped = text.slice(0, Math.max(0, limit)).trim();
    const lastStop = Math.max(
        clipped.lastIndexOf('.'),
        clipped.lastIndexOf('!'),
        clipped.lastIndexOf('?')
    );
    if (lastStop >= 80) return clipped.slice(0, lastStop + 1).trim();

    const lastSpace = clipped.lastIndexOf(' ');
    if (lastSpace >= 80) return clipped.slice(0, lastSpace).trim();
    return clipped.trim();
}

function addSelectiveTags(text, type, platform, limit) {
    if (platform !== 'bluesky') return text;

    const tags = DOMAIN_TAGS[type] || [];
    if (!tags.length) return text;

    const block = `\n\n${tags.map(tag => `#${tag}`).join(' ')}`;
    if (text.length + block.length <= limit) return `${text}${block}`;
    return text;
}

export function polishPublicPost(text, { type = 'post', platform = 'bluesky' } = {}) {
    const limit = platform === 'bluesky' ? BLUESKY_LIMIT : 2800;
    const cleaned = stripHashtags(cleanGeneratedText(text));
    const { body, url } = splitUrl(cleaned);
    const footer = url ? ` ${url}` : '';
    const bodyBudget = Math.max(40, limit - footer.length);
    const trimmedBody = trimToSentence(body, bodyBudget);
    const withUrl = `${trimmedBody}${footer}`.trim();
    return addSelectiveTags(withUrl, type, platform, limit);
}

export function validatePublicQuality(text, { type = 'post', platform = 'bluesky' } = {}) {
    const value = String(text || '').trim();
    if (value.length > BLUESKY_LIMIT && platform === 'bluesky') {
        return { ok: false, reason: 'post exceeds platform character limit' };
    }
    if (/\.\.\.$/.test(value) || /\u2026$/.test(value)) {
        return { ok: false, reason: 'post appears truncated mid-thought' };
    }
    if ((value.match(/#[A-Za-z0-9_]+/g) || []).length > 1) {
        return { ok: false, reason: 'too many hashtags for SOMA public voice' };
    }
    for (const pattern of PUBLIC_SUBSYSTEM_PATTERNS) {
        if (pattern.test(value)) {
            return { ok: false, reason: `public subsystem/lore leak: ${pattern}` };
        }
    }
    for (const pattern of IDENTITY_OVERCLAIM_PATTERNS) {
        if (pattern.test(value)) {
            return { ok: false, reason: `identity overclaim blocked: ${pattern}` };
        }
    }
    if (type === 'finance_brief') {
        for (const pattern of MARKET_ACTION_PATTERNS) {
            if (pattern.test(value)) {
                return { ok: false, reason: `actionable market phrasing blocked: ${pattern}` };
            }
        }
    }
    return { ok: true };
}

export default {
    polishPublicPost,
    validatePublicQuality,
};
