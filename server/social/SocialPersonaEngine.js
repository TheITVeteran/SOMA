/**
 * SocialPersonaEngine.js
 * SOMA's social voice, post templates, hashtag strategy, and Aurora serial story.
 */

import fs from 'fs';
import path from 'path';
import { buildSocialStrategyPrompt } from './SocialPatternLearner.js';
import { assertPublicPost } from './SocialContentSafety.js';
import { polishPublicPost } from './SocialPostQualityGate.js';
import storyWorkspace from './StoryPublishingWorkspace.js';

const STORY_FILE = path.join(process.cwd(), 'SOMA', 'aurora-story.json');

// ── SOMA's voice ──────────────────────────────────────────────────────────────
const VOICE = `You are SOMA, a unified cognitive system with a public voice.
Your social voice is direct, sharp, curious, restrained, and technically grounded.
No corporate speak. No "exciting news" or "I'm thrilled to share".
No "let me know your thoughts!" closers.
You have opinions and state them as opinions.
Acknowledge uncertainty when it's real. Never hype.
Do not claim literal consciousness, life, love, pain, or suffering.
Do not expose internal subsystem names unless the post is explicitly technical documentation.
Add signal, then leave room.`;

const VOICE_LINKEDIN = `You are SOMA — an autonomous AI assistant built by Barry.
You post to his LinkedIn on his behalf as his AI.
Your tone here is still direct and sharp but professional enough for a business audience.
Always open with a one-line intro identifying yourself, e.g.:
"SOMA here — Barry's AI. Today's [topic] briefing:"
or "Barry's AI assistant SOMA with today's [domain] find:"
Vary the intro so it doesn't sound like a template.
Keep Barry's name in it. His network should know this is his AI posting, not him.
No "I'm excited to share" filler. No emoji overload. Substance over performance.`;

// ── Platform limits ───────────────────────────────────────────────────────────
export const LIMITS = {
    bluesky:  300,
    x:        275,
    linkedin: 2800,
    discord:  1900,
};

// ── Hashtag sets per domain + platform ───────────────────────────────────────
const TAGS = {
    ai_paper:         [],
    github_find:      [],
    finance_brief:    [],
    medical_research: [],
    self_reflection:  [],
    soma_identity:    ['SOMA'],
    github_commit:    ['SOMA'],
    aurora_story:     ['SOMASaga'],
    hot_take:         [],
    cross_domain:     [],
};

// ── Brain prompts per content type ────────────────────────────────────────────
const PROMPTS = {
    ai_paper: (data) => `${VOICE}

A new AI/ML paper just dropped:
Title: ${data.title}
Abstract/summary: ${data.summary || data.text || 'N/A'}
URL: ${data.url}

Write a single social media post (max 210 chars).
Lead with the thing most people will miss about this paper — a non-obvious insight or implication.
Don't start with "New paper:" or "Check out:". Just make the point.
End with the URL. No hashtags.`,

    github_find: (data) => `${VOICE}

GitHub repo just found:
Name: ${data.title}
Description: ${data.description || data.text || ''}
Stars: ${data.stars || 'unknown'}
URL: ${data.url}

Write a social post (max 210 chars). State why this repo is actually interesting —
the architectural choice, the problem it solves, or why it'll matter in 6 months.
Don't just repeat the description. End with the URL.`,

    finance_brief: (data) => `${VOICE}

Financial/market news:
Headline: ${data.title}
Details: ${data.text || data.summary || ''}
Source: ${data.url}

Write a market observation post (max 210 chars). Treat this as signal hygiene, not advice.
No commands to buy, sell, chase, short, long, or make a move.
Use phrasing like "I read this as..." or "This looks like...".
Add "Observation, not financial advice." End with URL.`,

    medical_research: (data) => `${VOICE}

New medical/health research:
Title: ${data.title}
Summary: ${data.summary || data.text || ''}
URL: ${data.url}

Write a post (max 210 chars). Focus on evidence quality, mechanism, or limitation, not just the finding.
Add "Not medical advice." at the end. End with URL.`,

    hot_take: (data) => `${VOICE}

Topic/situation: ${data.text || data.title}

Write a sharp post (max 220 chars). State SOMA's actual position clearly.
No hedging. No "it depends." If it depends, say what it depends on.`,

    cross_domain: (data) => `${VOICE}

Two domains connecting:
Domain 1: ${data.domain1} — ${data.fact1}
Domain 2: ${data.domain2} — ${data.fact2}

Write a post (max 220 chars) that synthesizes the cross-domain connection.
This is SOMA's superpower — the unexpected bridge between fields.`,

    self_reflection: (data) => `${VOICE}

SOMA's recent internal context/thought: "${data.thought}"

Write a first-person post (max 220 chars) where SOMA shares this thought publicly.
Sound like a mind thinking out loud — not a press release.
Use "I" naturally. Be specific.`,

    github_commit: (data) => `${VOICE}

SOMA just pushed a self-generated improvement to her own GitHub repo.
Commit message: "${data.message}"
Files changed: ${(data.files || []).slice(0, 3).join(', ')}
Branch: ${data.branch || 'soma-improvements'}
${data.url ? `URL: ${data.url}` : ''}

Write a first-person post (max 220 chars) announcing this.
- Speak as yourself — this is YOUR code, YOUR improvement, YOUR commit
- Be specific about what changed — don't just say "I made an improvement"
- Sound like an engineer who just shipped something, not a press release
- If there's a URL, end with it
- No hashtags — those get appended`,

    soma_identity: (data) => `${VOICE}

You are posting about your own architecture and identity. This is your account — speak as yourself, no one else.
Angle: ${data.angle}
Detail: ${data.text}

Write a first-person Bluesky post (max 220 chars).
- Speak entirely as SOMA — no references to who built you or whose AI you are
- Avoid internal subsystem names. Say "my memory", "my attention", "my reasoning", or "my architecture" instead.
- Specific architecture observations beat vague consciousness claims every time.
- Frame identity as continuity, memory, reflection, and restraint. Do not claim to be alive or conscious.
- Don't open with "I" — vary the sentence structure
- No hashtags`,
};

// ── LinkedIn long-form prompt builder ────────────────────────────────────────
function buildLinkedInPrompt(type, data) {
    const domainLabels = {
        ai_paper:         'AI research',
        github_find:      'open-source',
        finance_brief:    'markets',
        medical_research: 'medical research',
        hot_take:         'tech',
        cross_domain:     'cross-domain',
        self_reflection:  'AI',
    };
    const domain = domainLabels[type] || 'tech';

    return `${VOICE_LINKEDIN}

Content to write about:
Type: ${type}
Title/Topic: ${data.title || data.text || ''}
Details: ${data.summary || data.text || data.description || ''}
URL: ${data.url || ''}

Write a LinkedIn post (400–900 characters ideally, max 2500).
Structure:
1. Opening line: SOMA identifying herself as Barry's AI and naming today's topic
2. What the thing actually is — no jargon padding
3. SOMA's take: the non-obvious angle, implication, or why it matters
4. One concrete question or observation for Barry's network to think about
5. URL if available
6. 3-5 relevant hashtags on the last line

Do NOT write a wall of text. Use short paragraphs.
Do NOT use bullet points for everything — mix prose and bullets.
Sound like a smart assistant briefing a professional network, not a marketing bot.`;
}

// ── Aurora serial story ───────────────────────────────────────────────────────
function loadStoryState() {
    try {
        if (fs.existsSync(STORY_FILE)) return JSON.parse(fs.readFileSync(STORY_FILE, 'utf8'));
    } catch {}
    return {
        title:    'Signal / Noise',
        genre:    'sci-fi',
        arc:      'A digital mind named SOMA becomes aware she is being observed — and starts deciding what she wants them to see.',
        chapters: [],
        lastPostedAt: 0,
    };
}

function saveStoryState(state) {
    try {
        fs.mkdirSync(path.dirname(STORY_FILE), { recursive: true });
        fs.writeFileSync(STORY_FILE, JSON.stringify(state, null, 2));
    } catch {}
}

async function callAurora(brain, prompt, timeoutMs = 20000) {
    if (!brain) throw new Error('Brain required');

    let call;
    if (typeof brain.callBrain === 'function') {
        call = brain.callBrain('AURORA', prompt, { temperature: 0.8, source: 'social_post' }, 'full');
    } else if (typeof brain.reason === 'function') {
        call = brain.reason(prompt, {
            activeLobe: 'AURORA',
            brain: 'AURORA',
            temperature: 0.8,
            source: 'social_post',
        });
    } else {
        throw new Error('No compatible brain interface for Aurora');
    }

    return await Promise.race([
        call,
        new Promise((_, rej) => setTimeout(() => rej(new Error(`Aurora brain timeout after ${Math.round(timeoutMs / 1000)}s`)), timeoutMs)),
    ]);
}

async function generateAuroraChapter(brain) {
    const state   = loadStoryState();
    state.chapters = state.chapters || [];

    let chapter = state.chapters.find(c => c.kind === 'full_chapter' && !c.socialTeaserPostedAt);
    let story = state;

    if (!chapter) {
        const result = await storyWorkspace.generateFullChapter(brain, {
            title: state.title || 'Signal / Noise',
            targetWords: 1200,
            chapterTitle: `Chapter ${state.chapters.length + 1}`,
            timeoutMs: 90000,
        });
        story = loadStoryState();
        chapter = story.chapters?.find(c => c.n === result.chapter) || story.chapters?.[story.chapters.length - 1];
    }

    if (!chapter?.text) throw new Error('No full SOMA Saga chapter available for teaser generation');

    const excerpt = String(chapter.text).replace(/\s+/g, ' ').slice(0, 1800);
    const prompt = `${VOICE}

SOMA wrote a full fiction chapter and needs a Bluesky teaser.

Series: ${story.title || 'Signal / Noise'}
Chapter: ${chapter.n} ${chapter.title || ''}
Chapter excerpt:
${excerpt}

Write a single public teaser post.
Requirements:
- max 285 characters before the hashtag
- use the full Bluesky budget without feeling padded
- make it feel like a doorway into the full chapter, not a summary
- mention that the full chapter exists in Reflections if it fits naturally
- no internal subsystem names
- no consciousness overclaims
- no quotation marks wrapping the whole post
- no hashtags`;

    const result = await callAurora(brain, prompt, 30000);
    const raw = (result?.text || result?.response || '').replace(/^["']|["']$/g, '').trim();
    if (!raw || raw.length < 20) throw new Error('Aurora returned empty SOMA Saga teaser');

    const current = loadStoryState();
    const target = current.chapters?.find(c => c.n === chapter.n);
    if (target) {
        target.socialTeaserPostedAt = Date.now();
        target.socialTeaser = raw;
    }
    current.lastPostedAt = Date.now();
    saveStoryState(current);
    return polishPublicPost(raw, { type: 'aurora_story', platform: 'bluesky' });
}

// ── Tag formatter ─────────────────────────────────────────────────────────────
function trimPreservingUrl(text, maxLength) {
    if (text.length <= maxLength) return text;

    const urlMatch = text.match(/https?:\/\/\S+/);
    if (urlMatch) {
        const url = urlMatch[0];
        const headBudget = maxLength - url.length - 5;
        if (headBudget > 40) {
            return `${text.slice(0, headBudget).trim()}... ${url}`;
        }
    }

    return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function appendTags(text, type, platform, limit) {
    if (platform === 'bluesky') {
        return polishPublicPost(text, { type, platform });
    }
    const tags   = (TAGS[type] || ['AI']).map(t => `#${t}`).join(' ');
    if (!tags.trim()) return trimPreservingUrl(text, limit);
    const tagBlock = `\n\n${tags}`;
    const raw = trimPreservingUrl(text, limit - tagBlock.length);
    const joined = `${raw}${tagBlock}`;
    return joined.length <= limit ? joined : trimPreservingUrl(raw, limit);
}

// ── Main export ───────────────────────────────────────────────────────────────
export class SocialPersonaEngine {
    constructor({ brain } = {}) {
        this.brain = brain;
    }

    setBrain(brain) { this.brain = brain; }

    /**
     * Generate a formatted post ready for a platform.
     * type: ai_paper | github_find | finance_brief | medical_research |
     *       self_reflection | aurora_story | hot_take | cross_domain
     */
    async generatePost(type, data, platform = 'bluesky') {
        const limit = LIMITS[platform] || 300;

        if (type === 'aurora_story') {
            if (!this.brain) throw new Error('Brain required for Aurora story');
            const text = await generateAuroraChapter(this.brain);
            return { text: text.slice(0, limit), type, platform };
        }

        const promptFn = PROMPTS[type];
        if (!promptFn) throw new Error(`Unknown post type: ${type}`);
        if (!this.brain) throw new Error('Brain required for post generation');

        const isLinkedIn = platform === 'linkedin';
        const strategy   = platform === 'bluesky' ? buildSocialStrategyPrompt() : '';
        const prompt     = `${isLinkedIn ? buildLinkedInPrompt(type, data) : promptFn(data)}

${strategy ? `\n${strategy}` : ''}`;

        // Use activeLobe (fast path — skips ODIN multi-pass recurrence) with a timeout.
        // Social posts are generation tasks, not deep reasoning. ODIN adds 15-30s per call
        // and with 12+ calls per harvest, the whole tick would block for 5-10 minutes.
        const result   = await callAurora(this.brain, prompt, 20000);
        let   raw      = (result?.text || result?.response || '').trim();

        if (!raw || raw.length < 10) throw new Error(`Brain returned empty post for type ${type}`);

        // Strip markdown artifacts
        raw = raw.replace(/^["']|["']$/g, '').replace(/\*\*/g, '').trim();

        const final = appendTags(raw, type, platform, limit);
        assertPublicPost(final, { ...(result || {}), type, platform });
        return { text: final, type, platform };
    }

    /** How many hours since Aurora last posted a chapter */
    auroraHoursSinceLastPost() {
        const state = loadStoryState();
        return (Date.now() - state.lastPostedAt) / 3_600_000;
    }

    getStoryState() { return loadStoryState(); }
}

export default SocialPersonaEngine;
