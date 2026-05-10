const BLOCKED_PATTERNS = [
    /\bollama\b.*\boffline\b/i,
    /\btry running\s+`?ollama serve`?/i,
    /\blocal reasoning engine\b/i,
    /\bbrain failure\b/i,
    /\bdegraded\b.*\bfallback\b/i,
    /\bapi key\b/i,
    /\btoken\b.*\bexpired\b/i,
    /\bsession expired\b/i,
    /\bnot configured\b/i,
    /\bbackend unreachable\b/i,
    /\bserver error\b/i,
    /\bstack trace\b/i,
    /\breferenceerror\b/i,
    /\btypeerror\b/i,
];

const MIN_PUBLIC_CHARS = 20;

export function validatePublicPost(text, meta = {}) {
    const value = String(text || '').trim();
    if (meta.degraded || meta.provider === 'fallback') {
        return { ok: false, reason: 'brain returned degraded fallback text' };
    }
    if (value.length < MIN_PUBLIC_CHARS) {
        return { ok: false, reason: 'post text too short' };
    }
    for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(value)) {
            return { ok: false, reason: `blocked internal/system text: ${pattern}` };
        }
    }
    return { ok: true };
}

export function assertPublicPost(text, meta = {}) {
    const verdict = validatePublicPost(text, meta);
    if (!verdict.ok) throw new Error(`Unsafe public post blocked: ${verdict.reason}`);
    return true;
}

export default {
    validatePublicPost,
    assertPublicPost,
};
