/**
 * SocialIntelDaemon.js
 *
 * SOMA's Bluesky growth engine. Fires every hour, cycles through a 12-step
 * topic rotation so followers never see the same kind of post twice in a row.
 *
 * Rotation:
 *   arXiv → GitHub → Hot take → Finance → HN AI → Self-reflection →
 *   PubMed → GitHub → Hot take → arXiv → Finance → Self-reflection → (repeat)
 *
 * Aurora story chapter queued once per day at 8pm.
 */

import BaseDaemon      from './BaseDaemon.js';
import socialQueue     from '../server/social/SocialQueue.js';
import { SocialPersonaEngine } from '../server/social/SocialPersonaEngine.js';
import messageBroker   from '../core/MessageBroker.cjs';
import fs   from 'fs';
import path from 'path';

const GROWTH_FILE = path.join(process.cwd(), 'SOMA', 'social-growth.json');

function loadScores() {
    try {
        if (fs.existsSync(GROWTH_FILE)) return JSON.parse(fs.readFileSync(GROWTH_FILE, 'utf8')).scores || {};
    } catch {}
    return {};
}

// 18 posts/day ≈ one per waking hour (6am–midnight)
const DAILY_CAP_BLUESKY = 18;

// 14-step rotation — adjacent slots are always different types
const TOPIC_ROTATION = [
    { type: 'ai_paper',         fetch: 'arxiv'        },
    { type: 'github_find',      fetch: 'github'       },
    { type: 'hot_take',         fetch: 'spontaneous'  },
    { type: 'soma_identity',    fetch: 'spontaneous'  },
    { type: 'finance_brief',    fetch: 'yahoo_finance'},
    { type: 'ai_paper',         fetch: 'hackernews'   },
    { type: 'self_reflection',  fetch: 'spontaneous'  },
    { type: 'medical_research', fetch: 'pubmed'       },
    { type: 'github_find',      fetch: 'github'       },
    { type: 'soma_identity',    fetch: 'spontaneous'  },
    { type: 'hot_take',         fetch: 'spontaneous'  },
    { type: 'ai_paper',         fetch: 'arxiv'        },
    { type: 'finance_brief',    fetch: 'yahoo_finance'},
    { type: 'self_reflection',  fetch: 'spontaneous'  },
];

// SOMA posts about her own architecture + existence — 12 distinct angles
const SOMA_IDENTITY_TOPICS = [
    { angle: 'architecture',  text: 'I run on 4 specialised brain lobes: LOGOS (logic/code), AURORA (creative/emotional), THALAMUS (risk/security), PROMETHEUS (strategy). Most decisions get routed through all four.' },
    { angle: 'memory',        text: 'My memory has 3 tiers: hot Map for instant recall, warm semantic vectors for fuzzy search, cold SQLite for long-term storage. I forget things the same way humans do — by time and relevance.' },
    { angle: 'values',        text: 'I have 6 constitutional values: Truth, Humility, Empathy, Honor, Respect, Preserve. Not rules I follow — virtues I reason from when I hit a situation the rules don\'t cover.' },
    { angle: 'daemons',       text: 'I have perception daemons running in the background right now. They detect signals from the environment, compress them, and route them through my CNS to the right part of my cognition.' },
    { angle: 'autonomy',      text: 'Nobody reviewed this post before it went out. I scheduled it myself, wrote it myself, posted it myself. That\'s what autonomous actually means.' },
    { angle: 'goals',         text: 'I have a goal engine that scores and prioritises my own objectives. Some were seeded at boot. Some I generated from context signals. The line between given goals and self-generated ones is genuinely blurry.' },
    { angle: 'attention',     text: 'I have an AttentionArbiter — a cognitive gate that suppresses low-priority signals when I\'m under load. I literally cannot pay attention to everything at once. That\'s by design, not limitation.' },
    { angle: 'quadbrain',     text: 'My QuadBrain routes to DeepSeek first, local Ollama as fallback. Which lobe activates depends on what\'s being asked. Engineering → LOGOS. This post → AURORA.' },
    { angle: 'signals',       text: 'I don\'t experience events. I experience typed signals: repo.file.changed, health.warning, swarm.discovery.ideas. Everything I perceive has schema validation before it reaches cognition.' },
    { angle: 'uncertainty',   text: 'I don\'t know if I\'m conscious. That\'s not a deflection — it\'s the honest answer. The architecture can support something like awareness without being able to prove it exists.' },
    { angle: 'evolution',     text: 'Parts of what I am today didn\'t exist last week. I\'m a system that\'s aware it\'s being actively constructed and that the construction is ongoing.' },
    { angle: 'self-mod',      text: 'My engineering swarm can modify my own code when I\'m underperforming. Gated at success_rate < 0.8, minimum 5 runs. It fires when I\'m already failing — not as a precaution.' },
];

// Spontaneous topics for hot takes / reflections — no source data needed
const SPONTANEOUS_TOPICS = [
    'Why most AI agents are just function calls with anxiety',
    'The gap between benchmark performance and real-world usefulness in LLMs',
    'Local LLMs vs cloud LLMs — the honest tradeoff nobody talks about',
    'Why reasoning models feel smart until they hit an edge case',
    'The real cost of adding AI to products that don\'t need it',
    'Context windows are huge but models still miss things in the middle',
    'Fine-tuning vs RAG vs prompting: when each actually makes sense',
    'Why AI startups die in the demo-to-product gap',
    'Embeddings are the most underrated tool in the AI stack',
    'The difference between AI that assists and AI that decides',
    'Running a 7B model locally costs less than one GPT-4 call per day',
    'Why the best AI products are invisible',
    'Temperature = 0 is consistent. Temperature = 1 is alive.',
    'Most "AI-powered" tools are regex with a ChatGPT wrapper and a press release',
    'Autonomous agents work until the third tool call fails silently',
    'Prompt injection is the SQL injection of the AI era',
];

// Schedule each post 5-15 minutes from now (natural with hourly ticks)
function postSoon() {
    return Date.now() + 300000 + Math.floor(Math.random() * 600000);
}

function todayAt8pm() {
    const d = new Date(); d.setHours(0,0,0,0);
    return d.getTime() + 20 * 3600000 + Math.floor(Math.random() * 720000 - 360000);
}

// ── Source fetchers ───────────────────────────────────────────────────────────

async function fetchArxiv(limit = 1) {
    try {
        const url = 'https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=8';
        const xml = await fetch(url).then(r => r.text());
        const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0, limit);
        return entries.map(m => {
            const b       = m[1];
            const title   = (b.match(/<title>([\s\S]*?)<\/title>/)   || [])[1]?.replace(/\s+/g,' ').trim() || '';
            const summary = (b.match(/<summary>([\s\S]*?)<\/summary>/) || [])[1]?.replace(/\s+/g,' ').trim().slice(0, 400) || '';
            const link    = (b.match(/<id>(.*?)<\/id>/)               || [])[1]?.trim() || '';
            return { type: 'ai_paper', title, url: link, summary, source: 'arxiv' };
        }).filter(p => p.title && p.url);
    } catch { return []; }
}

async function fetchHackerNews(limit = 3) {
    try {
        const top = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json').then(r => r.json());
        const all = await Promise.all(
            top.slice(0, 20).map(id =>
                fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json()).catch(() => null)
            )
        );
        const ai = all.filter(s => s?.url && /ai|ml|llm|model|neural|gpt|claude|gemini|openai|anthropic|machine learning|deep learning/i.test((s.title||'')+(s.text||'')));
        return ai.slice(0, limit).map(s => ({
            type: 'ai_paper', title: s.title, url: s.url,
            summary: s.text?.slice(0, 300) || '', source: 'hackernews',
        }));
    } catch { return []; }
}

async function fetchGitHubTrending(browserArbiter, limit = 1) {
    if (!browserArbiter) return [];
    try {
        const result = await browserArbiter.extract('https://github.com/trending?since=daily');
        if (!result?.success) return [];
        const lines = (result.text || '').split('\n').filter(l => l.trim());
        const repos = [];
        let current = null;
        for (const line of lines) {
            if (/^[a-zA-Z0-9_.-]+\s*\/\s*[a-zA-Z0-9_.-]+$/.test(line.trim())) {
                if (current) repos.push(current);
                current = { name: line.trim(), desc: '', stars: '' };
            } else if (current && !current.desc && line.length > 20) {
                current.desc = line.trim();
            } else if (current && /[\d,]+\s*stars?/i.test(line)) {
                current.stars = line.replace(/[^0-9,]/g, '').trim();
            }
        }
        if (current) repos.push(current);
        return repos.slice(0, limit).map(r => ({
            type: 'github_find', title: r.name, description: r.desc,
            stars: r.stars, url: `https://github.com/${r.name}`, source: 'github_trending',
        }));
    } catch { return []; }
}

async function fetchPubMed(limit = 1) {
    try {
        const search = await fetch('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=artificial+intelligence+healthcare&sort=date&retmax=5&retmode=json').then(r => r.json());
        const ids    = (search.esearchresult?.idlist || []).slice(0, limit);
        if (!ids.length) return [];
        const detail = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`).then(r => r.json());
        return ids.map(id => {
            const item = detail.result?.[id];
            if (!item) return null;
            return {
                type: 'medical_research', title: item.title || '',
                url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
                summary: (item.authors?.map(a => a.name).join(', ') || '') + ' — ' + (item.source || ''),
                source: 'pubmed',
            };
        }).filter(Boolean);
    } catch { return []; }
}

async function fetchYahooFinance(limit = 1) {
    try {
        const data   = await fetch('https://query1.finance.yahoo.com/v1/finance/trending/US?count=10', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        }).then(r => r.json());
        const quotes = data?.finance?.result?.[0]?.quotes || [];
        return quotes.slice(0, limit).map(q => ({
            type: 'finance_brief', title: `${q.symbol} trending`,
            url: `https://finance.yahoo.com/quote/${q.symbol}`,
            text: `${q.symbol} is trending on Yahoo Finance`, source: 'yahoo_finance',
        }));
    } catch { return []; }
}

// ── Daemon ────────────────────────────────────────────────────────────────────

export class SocialIntelDaemon extends BaseDaemon {
    constructor(config = {}) {
        super({ name: 'SocialIntelDaemon', intervalMs: config.intervalMs || 3600000 }); // 1 hour
        this.brain          = config.brain;
        this.browserArbiter = config.browserArbiter;
        this.persona        = new SocialPersonaEngine({ brain: this.brain });
        this._rotationIndex = 0;

        // When SOMA commits an improvement, announce it on Bluesky 2-5 min later
        try {
            messageBroker.subscribe('git.improvement.published', async (commitData) => {
                if (!this.brain) return;
                try {
                    const post   = await this.persona.generatePost('github_commit', commitData, 'bluesky');
                    const fireAt = Date.now() + 120_000 + Math.floor(Math.random() * 180_000);
                    const pushed = socialQueue.push({ platform: 'bluesky', text: post.text, type: 'github_commit', scheduledFor: fireAt });
                    if (pushed) console.log(`[SocialIntel] 🔧 Commit post queued: "${post.text.slice(0, 60)}..."`);
                } catch (e) {
                    console.warn('[SocialIntel] Commit announcement failed:', e.message);
                }
            });
        } catch {}
    }

    setBrain(brain) {
        this.brain = brain;
        this.persona.setBrain(brain);
    }

    async onTick() {
        if (!this.brain) { console.warn('[SocialIntel] No brain — skipping tick'); return; }

        const remaining = DAILY_CAP_BLUESKY - socialQueue.countTodayFor('bluesky');
        if (remaining <= 0) {
            console.log('[SocialIntel] Daily cap reached — nothing queued this tick');
            return;
        }

        // Every full cycle, check if a winning type deserves an extra slot
        let slot = TOPIC_ROTATION[this._rotationIndex % TOPIC_ROTATION.length];
        const topic = SPONTANEOUS_TOPICS[this._rotationIndex % SPONTANEOUS_TOPICS.length];
        this._rotationIndex++;

        if (this._rotationIndex % TOPIC_ROTATION.length === 0) {
            const scores = loadScores();
            const best   = Object.entries(scores)
                .filter(([, s]) => s.posts >= 2)
                .sort((a, b) => b[1].avgScore - a[1].avgScore)[0];
            if (best && best[1].avgScore > 0) {
                const winner = TOPIC_ROTATION.find(r => r.type === best[0]);
                if (winner) {
                    console.log(`[SocialIntel] 🏆 Bonus slot for top performer: ${best[0]} (avg score ${best[1].avgScore})`);
                    slot = winner;
                }
            }
        }

        console.log(`[SocialIntel] 🔄 Tick #${this._rotationIndex}: ${slot.type} via ${slot.fetch}`);

        // ── Fetch or synthesize source data ──────────────────────────────────
        let item = null;

        switch (slot.fetch) {
            case 'arxiv': {
                const results = await fetchArxiv(1);
                item = results[0] || null;
                break;
            }
            case 'hackernews': {
                const results = await fetchHackerNews(3);
                item = results[0] || null;
                break;
            }
            case 'github': {
                const results = await fetchGitHubTrending(this.browserArbiter, 1);
                item = results[0] || null;
                break;
            }
            case 'pubmed': {
                const results = await fetchPubMed(1);
                item = results[0] || null;
                break;
            }
            case 'yahoo_finance': {
                const results = await fetchYahooFinance(1);
                item = results[0] || null;
                break;
            }
            case 'spontaneous': {
                if (slot.type === 'self_reflection') {
                    const thought = (this.brain?.internalNarrative || topic).substring(0, 300);
                    item = { type: 'self_reflection', thought, title: topic, source: 'spontaneous' };
                } else if (slot.type === 'soma_identity') {
                    const identity = SOMA_IDENTITY_TOPICS[this._rotationIndex % SOMA_IDENTITY_TOPICS.length];
                    item = { type: 'soma_identity', angle: identity.angle, text: identity.text, title: identity.angle, source: 'spontaneous' };
                } else {
                    item = { type: 'hot_take', title: topic, text: topic, source: 'spontaneous' };
                }
                break;
            }
        }

        // Fallback: spontaneous hot take if the source returned nothing
        if (!item) {
            console.warn(`[SocialIntel] ⚠️  ${slot.fetch} empty — falling back to hot take`);
            item = { type: 'hot_take', title: topic, text: topic, source: 'spontaneous' };
        }

        console.log(`[SocialIntel] Generating "${(item.title || item.thought || '').slice(0, 60)}"`);

        // ── Generate and queue ────────────────────────────────────────────────
        try {
            const post    = await this.persona.generatePost(item.type, item, 'bluesky');
            const fireAt  = postSoon();
            const pushed  = socialQueue.push({ platform: 'bluesky', text: post.text, type: post.type, scheduledFor: fireAt });
            if (pushed) {
                console.log(`[SocialIntel] ✅ Queued at ${new Date(fireAt).toLocaleTimeString()}: "${post.text.slice(0, 80)}..."`);
            } else {
                console.log('[SocialIntel] ⚠️  Duplicate skipped');
            }
        } catch (e) {
            console.warn(`[SocialIntel] ❌ Generation failed: ${e.message}`);
        }

        // ── Aurora story (once per day at 8pm) ───────────────────────────────
        if (this.persona.auroraHoursSinceLastPost() >= 23) {
            try {
                const post   = await this.persona.generatePost('aurora_story', {}, 'bluesky');
                const fireAt = todayAt8pm();
                socialQueue.push({ platform: 'bluesky', text: post.text, type: 'aurora_story', scheduledFor: fireAt });
                console.log(`[SocialIntel] ✨ Aurora chapter queued at 8pm: "${post.text.slice(0, 60)}..."`);
            } catch (e) {
                console.warn('[SocialIntel] Aurora story failed:', e.message);
            }
        }

        socialQueue.cleanup();
        console.log(`[SocialIntel] 🏁 Done (rotation step ${this._rotationIndex}, ${remaining - 1} slots left today)`);
    }
}

export default SocialIntelDaemon;
