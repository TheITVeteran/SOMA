import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';
import socialImageLibrary from '../social/SocialImageLibrary.js';
import axisProfileStore from '../axis/AxisProfileStore.js';

const SOMA_DIR = path.join(process.cwd(), 'SOMA');
const USER_MD = path.join(SOMA_DIR, 'user.md');
const USER_REGISTRY_FILE = path.join(SOMA_DIR, 'studio-users.json');
const STUDIO_UPLOAD_DIR = path.join(SOMA_DIR, '.tmp', 'studio-uploads');
const require = createRequire(import.meta.url);
const multer = require('multer');
const RESERVED_USERNAMES = new Set([
    'admin', 'administrator', 'root', 'system', 'support', 'staff', 'moderator', 'mod',
    'soma', 'axis', 'studio', 'commandbridge', 'command_bridge', 'bridge', 'official',
    'api', 'bot', 'null', 'undefined', 'deleted', 'anonymous', 'anon', 'user',
]);

const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => {
            fs.mkdirSync(STUDIO_UPLOAD_DIR, { recursive: true });
            cb(null, STUDIO_UPLOAD_DIR);
        },
        filename: (_req, file, cb) => {
            const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
            const safeBase = path.basename(file.originalname || 'studio-image', ext)
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .slice(0, 60) || 'studio-image';
            cb(null, `${Date.now()}-${safeBase}${ext}`);
        },
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
});

const DEFAULT_PROFILE = {
    name: 'Barry',
        role: 'Builder / Operator',
        location: '',
        timezone: 'America/New_York',
        avatar: '',
        coverImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=1000&auto=format&fit=crop',
    bio: 'Building SOMA as an AI-first command bridge, trading lab, creative engine, and personal operating layer.',
    manifesto: 'Build useful systems. Help people. Make the work real.',
    goals: [
        'Make SOMA economically useful.',
        'Build Command Bridge into a serious operator console.',
        'Keep social, reflections, mission control, and Axis connected to one user identity.',
    ],
    preferences: {
        tone: 'Direct, honest, pragmatic, high-agency.',
        communication: 'Move fast, explain tradeoffs, avoid fluff.',
        autonomy: 'Prefer implementation over endless planning when risk is low.',
    },
    projects: [
        { name: 'SOMA Command Bridge', status: 'active', description: 'AI-first operating console for autonomy, trading, research, reflection, and communication.' },
        { name: 'Axis', status: 'planned', description: 'Directs, friends, workspaces, channels, and social coordination layer.' },
        { name: 'Studio', status: 'active', description: 'User profile and identity control layer powered by user.md.' },
    ],
    axis: {
        handle: 'barry',
        displayName: 'Barry',
        status: 'building',
        friends: [],
        spaces: [],
    },
    publicIdentity: {
        tagline: 'Building SOMA in public.',
        topics: ['AI systems', 'trading simulation', 'creative tools', 'medical discovery process', 'autonomous agents'],
    },
    widgets: ['profile', 'goals', 'projects', 'axis', 'portfolio', 'preferences'],
    studio: {
        widgets: null,
        navTheme: { style: 'ISLAND', color: '#ffffff', scale: 1 },
        portfolio: [],
        chats: [],
        identityChip: {
            accentColor: '#8b5cf6',
            badge: 'Builder',
            cardStyle: 'glass',
            visibleFields: { handle: true, role: true, location: true, activity: true, spaces: true },
        },
    },
};

const DEFAULT_AXIS_CHATS = [
    { id: 'axis-erin', title: 'Erin', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', members: '', messagesCount: '4+ new messages', status: 'active', online: true },
    { id: 'axis-jon', title: 'Jon Doliveira', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', members: '', messagesCount: '4 new messages', status: 'active', online: false },
    { id: 'axis-damon', title: 'Damon Robinson', image: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150', members: '', messagesCount: '4+ new messages', status: 'active', online: false },
    { id: 'axis-sunflower', title: 'Sunflower Samurai', image: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=150', members: '', messagesCount: '4+ new messages', status: 'active', online: true },
    { id: 'axis-garrett', title: 'Garrett', image: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150', members: '', messagesCount: '2 new messages', status: 'active', online: false },
    { id: 'axis-sarah', title: 'Sarah_V', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', members: '', messagesCount: 'Sent', status: 'active', online: true },
    { id: 'axis-kaito', title: 'Kaito', image: 'https://images.unsplash.com/photo-1528892952291-009c663ce843?w=150', members: '', messagesCount: 'Seen', status: 'active', online: false },
    { id: 'axis-neo', title: 'Neo_Tokyo', image: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=150', members: '', messagesCount: 'Typing...', status: 'active', online: true },
];

function seedAxisMessages(chat, profile) {
    const userAvatar = profile.avatar || DEFAULT_PROFILE.avatar;
    return [
        {
            id: `${chat.id}-m1`,
            sender: 'other',
            text: 'Hey, checking in through Axis.',
            timestamp: '10:30 AM',
            avatar: chat.image,
            createdAt: Date.now() - 600000,
        },
        {
            id: `${chat.id}-m2`,
            sender: 'user',
            text: 'Studio is wired as the temporary Axis hub now.',
            timestamp: '10:32 AM',
            avatar: userAvatar,
            createdAt: Date.now() - 500000,
        },
    ];
}

function ensureDir() {
    fs.mkdirSync(SOMA_DIR, { recursive: true });
}

function readFileSafe(file, fallback = '') {
    try {
        if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
    } catch {}
    return fallback;
}

function readJsonSafe(file, fallback) {
    try {
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {}
    return fallback;
}

function writeJsonSafe(file, data) {
    ensureDir();
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function normalizeUsername(value = '') {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/^@+/, '')
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 24);
}

function hashSecret(secret = '') {
    return crypto.createHash('sha256').update(String(secret || ''), 'utf8').digest('hex');
}

function usernameRegistry() {
    const registry = readJsonSafe(USER_REGISTRY_FILE, { users: {} });
    if (!registry.users || typeof registry.users !== 'object') registry.users = {};
    return registry;
}

function collectReservedHandles(currentUserId = '') {
    const reserved = new Map();
    try {
        const profile = loadProfile();
        const handle = normalizeUsername(profile.axis?.handle || profile.publicIdentity?.handle || profile.name);
        const userId = profile.axis?.userId || profile.studio?.identity?.userId || '';
        if (handle && userId && userId !== currentUserId) reserved.set(handle, userId);
    } catch {}
    return reserved;
}

function usernameStatus(username, currentUserId = '') {
    const handle = normalizeUsername(username);
    if (handle.length < 3) return { ok: true, available: false, handle, reason: 'Username must be at least 3 characters.' };
    if (!/^[a-z][a-z0-9_]{2,23}$/.test(handle)) {
        return { ok: true, available: false, handle, reason: 'Use 3-24 characters: letters, numbers, underscore. Start with a letter.' };
    }
    if (RESERVED_USERNAMES.has(handle)) return { ok: true, available: false, handle, reason: 'That username is reserved.' };
    const registry = usernameRegistry();
    const takenBy = registry.users[handle]?.userId;
    if (takenBy && takenBy !== currentUserId) return { ok: true, available: false, handle, takenBy, reason: 'Username is taken.' };
    const reserved = collectReservedHandles(currentUserId);
    if (reserved.has(handle)) return { ok: true, available: false, handle, takenBy: reserved.get(handle), reason: 'Username is taken.' };
    return { ok: true, available: true, handle };
}

function section(markdown, title) {
    const escaped = String(title).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?:^|\\n)##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, 'i');
    return (markdown.match(re)?.[1] || '').trim();
}

function lines(value) {
    return String(value || '')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => line.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean);
}

function keyValues(value) {
    const out = {};
    for (const line of lines(value)) {
        const match = line.match(/^([^:]+):\s*(.*)$/);
        if (match) out[match[1].trim().toLowerCase().replace(/\s+/g, '')] = match[2].trim();
    }
    return out;
}

function parseProjects(value) {
    return lines(value).map(line => {
        const [namePart, ...rest] = line.split(' - ');
        const name = namePart.replace(/^\[[^\]]+\]\s*/, '').trim();
        const status = (namePart.match(/^\[([^\]]+)\]/)?.[1] || 'active').trim();
        return { name, status, description: rest.join(' - ').trim() };
    }).filter(item => item.name);
}

function parseMarkdown(markdown) {
    if (!markdown.trim()) return { ...DEFAULT_PROFILE, rawMarkdown: renderMarkdown(DEFAULT_PROFILE), source: USER_MD };

    const identity = keyValues(section(markdown, 'Identity'));
    const prefs = keyValues(section(markdown, 'Preferences'));
    const axis = keyValues(section(markdown, 'Axis'));
    const publicIdentity = keyValues(section(markdown, 'Public Identity'));
    let studioState = DEFAULT_PROFILE.studio;
    try {
        const rawStudio = section(markdown, 'Studio State')
            .replace(/^```(?:json)?/i, '')
            .replace(/```$/i, '')
            .trim();
        if (rawStudio) studioState = { ...DEFAULT_PROFILE.studio, ...JSON.parse(rawStudio) };
    } catch {}

    return {
        ...DEFAULT_PROFILE,
        name: identity.name || DEFAULT_PROFILE.name,
        role: identity.role || DEFAULT_PROFILE.role,
        location: identity.location || DEFAULT_PROFILE.location,
        timezone: identity.timezone || DEFAULT_PROFILE.timezone,
        avatar: identity.avatar || DEFAULT_PROFILE.avatar,
        coverImage: identity.coverimage || identity.coverImage || DEFAULT_PROFILE.coverImage,
        bio: section(markdown, 'Bio') || DEFAULT_PROFILE.bio,
        manifesto: section(markdown, 'Manifesto') || DEFAULT_PROFILE.manifesto,
        goals: lines(section(markdown, 'Goals')).length ? lines(section(markdown, 'Goals')) : DEFAULT_PROFILE.goals,
        preferences: {
            ...DEFAULT_PROFILE.preferences,
            tone: prefs.tone || DEFAULT_PROFILE.preferences.tone,
            communication: prefs.communication || DEFAULT_PROFILE.preferences.communication,
            autonomy: prefs.autonomy || DEFAULT_PROFILE.preferences.autonomy,
        },
        projects: parseProjects(section(markdown, 'Projects')).length ? parseProjects(section(markdown, 'Projects')) : DEFAULT_PROFILE.projects,
        axis: {
            ...DEFAULT_PROFILE.axis,
            handle: axis.handle || DEFAULT_PROFILE.axis.handle,
            displayName: axis.displayname || axis.displayName || DEFAULT_PROFILE.axis.displayName,
            status: axis.status || DEFAULT_PROFILE.axis.status,
            userId: axis.userid || undefined,
            color: axis.color || undefined,
            friends: lines(section(markdown, 'Axis Friends')).filter(f => !f.startsWith('#')),
            spaces: lines(section(markdown, 'Axis Spaces')).filter(s => !s.startsWith('#')),
        },
        publicIdentity: {
            ...DEFAULT_PROFILE.publicIdentity,
            tagline: publicIdentity.tagline || DEFAULT_PROFILE.publicIdentity.tagline,
            topics: lines(section(markdown, 'Public Topics')).length ? lines(section(markdown, 'Public Topics')) : DEFAULT_PROFILE.publicIdentity.topics,
        },
        widgets: lines(section(markdown, 'Studio Widgets')).length ? lines(section(markdown, 'Studio Widgets')) : DEFAULT_PROFILE.widgets,
        studio: studioState,
        rawMarkdown: markdown,
        source: USER_MD,
    };
}

function bullet(items = []) {
    return (items || []).map(item => `- ${item}`).join('\n');
}

function renderMarkdown(profile = DEFAULT_PROFILE) {
    const p = { ...DEFAULT_PROFILE, ...(profile || {}) };
    return [
        '# User Profile',
        '',
        '## Identity',
        `Name: ${p.name || ''}`,
        `Role: ${p.role || ''}`,
        `Location: ${p.location || ''}`,
        `Timezone: ${p.timezone || ''}`,
        `Avatar: ${p.avatar || ''}`,
        `Cover Image: ${p.coverImage || ''}`,
        '',
        '## Bio',
        p.bio || '',
        '',
        '## Manifesto',
        p.manifesto || '',
        '',
        '## Goals',
        bullet(p.goals || []),
        '',
        '## Preferences',
        `Tone: ${p.preferences?.tone || ''}`,
        `Communication: ${p.preferences?.communication || ''}`,
        `Autonomy: ${p.preferences?.autonomy || ''}`,
        '',
        '## Projects',
        (p.projects || []).map(project => `- [${project.status || 'active'}] ${project.name || 'Project'} - ${project.description || ''}`).join('\n'),
        '',
        '## Axis',
        `Handle: ${p.axis?.handle || ''}`,
        `Display Name: ${p.axis?.displayName || p.name || ''}`,
        `Status: ${p.axis?.status || ''}`,
        `UserId: ${p.axis?.userId || ''}`,
        `Color: ${p.axis?.color || ''}`,
        '',
        '## Axis Friends',
        bullet(p.axis?.friends || []),
        '',
        '## Axis Spaces',
        bullet(p.axis?.spaces || []),
        '',
        '## Public Identity',
        `Tagline: ${p.publicIdentity?.tagline || ''}`,
        '',
        '## Public Topics',
        bullet(p.publicIdentity?.topics || []),
        '',
        '## Studio Widgets',
        bullet(p.widgets || DEFAULT_PROFILE.widgets),
        '',
        '## Studio State',
        '```json',
        JSON.stringify({
            ...(DEFAULT_PROFILE.studio || {}),
            ...(p.studio || {}),
        }, null, 2),
        '```',
        '',
    ].join('\n');
}

function loadProfile() {
    ensureDir();
    if (!fs.existsSync(USER_MD)) fs.writeFileSync(USER_MD, renderMarkdown(DEFAULT_PROFILE));
    return parseMarkdown(readFileSafe(USER_MD));
}

function saveProfile(profile) {
    ensureDir();
    const markdown = renderMarkdown(profile);
    fs.writeFileSync(USER_MD, markdown);
    return parseMarkdown(markdown);
}

function titleFromFilename(filename = 'Featured Work') {
    return path.basename(filename, path.extname(filename))
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, char => char.toUpperCase()) || 'Featured Work';
}

function portfolioItemFromSocialImage(image, overrides = {}) {
    const title = String(overrides.title || image.title || titleFromFilename(image.filename)).trim();
    const category = String(overrides.category || 'SOMA Social Images').trim();
    const description = String(overrides.description || image.alt || 'Managed image available for SOMA social posts.').trim();
    const tags = Array.isArray(overrides.tags)
        ? overrides.tags
        : Array.isArray(image.tags) && image.tags.length
            ? image.tags
            : ['Social', 'Featured Work'];

    return {
        id: `social-${image.id}`,
        title,
        category,
        description,
        image: `/api/studio/featured/images/${image.id}/file`,
        year: new Date(image.createdAt || Date.now()).getFullYear().toString(),
        tags,
        stats: { views: 0, likes: 0 },
        socialImageId: image.id,
        socialPath: image.path,
        socialFilename: image.filename,
        useForSocial: true,
        source: 'soma-social-image-library',
    };
}

function mergePortfolioWithSocialImages(profile, socialImages) {
    const saved = Array.isArray(profile?.studio?.portfolio) ? profile.studio.portfolio : [];
    const seen = new Set(saved.map(item => item?.socialImageId || item?.socialPath || item?.id).filter(Boolean));
    const socialItems = socialImages
        .filter(image => !seen.has(image.id) && !seen.has(image.path) && !seen.has(`social-${image.id}`))
        .map(image => portfolioItemFromSocialImage(image));
    return [...saved, ...socialItems];
}

function normalizeAxisState(profile) {
    const studioAxis = profile?.studio?.axis || {};
    const now = Date.now();
    const chats = Array.isArray(studioAxis.chats) && studioAxis.chats.length
        ? studioAxis.chats
        : DEFAULT_AXIS_CHATS.map((chat, index) => ({
            ...chat,
            axisId: chat.id,
            updatedAt: now - index * 3600000,
        }));

    const messages = { ...(studioAxis.messages || {}) };
    for (const chat of chats) {
        if (!Array.isArray(messages[chat.id])) messages[chat.id] = seedAxisMessages(chat, profile);
    }

    const richFriends = Array.isArray(studioAxis.friends) && studioAxis.friends.length
        ? studioAxis.friends
        : chats.map(chat => ({
            id: chat.id,
            username: String(chat.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
            handle: String(chat.title || '').toLowerCase().replace(/\s+/g, '_'),
            avatar: chat.image,
            online: Boolean(chat.online),
            chatId: chat.id,
            status: 'friend',
        }));

    return {
        friends: richFriends,
        chats,
        messages,
        spaces: Array.isArray(studioAxis.spaces) ? studioAxis.spaces : [],
        updatedAt: studioAxis.updatedAt || now,
        source: 'studio-user-md-axis-hook',
    };
}

function saveAxisState(axisState) {
    const profile = loadProfile();
    return saveProfile({
        ...profile,
        studio: {
            ...(profile.studio || {}),
            axis: {
                ...axisState,
                updatedAt: Date.now(),
            },
        },
    });
}

function chatSummary(chat, messages = []) {
    const last = messages[messages.length - 1];
    return {
        ...chat,
        lastMessage: last?.text || chat.lastMessage || '',
        messagesCount: last?.text ? `${last.sender === 'user' ? 'Sent' : 'New'} - ${last.timestamp || ''}`.trim() : chat.messagesCount,
        updatedAt: last?.createdAt || chat.updatedAt || Date.now(),
    };
}

function profileContext(profile) {
    return [
        `User: ${profile.name} (${profile.role})`,
        `Bio: ${profile.bio}`,
        `Manifesto: ${profile.manifesto}`,
        `Goals: ${(profile.goals || []).join('; ')}`,
        `Tone: ${profile.preferences?.tone}`,
        `Communication: ${profile.preferences?.communication}`,
        `Autonomy: ${profile.preferences?.autonomy}`,
        `Projects: ${(profile.projects || []).map(p => `${p.name} [${p.status}]`).join('; ')}`,
        `Axis: @${profile.axis?.handle} / ${profile.axis?.status}`,
        `Public topics: ${(profile.publicIdentity?.topics || []).join(', ')}`,
    ].filter(Boolean).join('\n');
}

function resultText(result) {
    if (typeof result === 'string') return result;
    if (!result || typeof result !== 'object') return '';
    return result.response || result.message || result.text || result.content || result.answer || '';
}

const DEFAULT_COMMUNITIES = [
    { id: 'c-ai',       name: 'AI Builders',         icon: '🤖', description: 'Building with LLMs, agents, and neural nets.',               membersCount: 2100, image: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=600', isJoined: false, category: 'Code',   tags: ['LLM', 'Agents', 'ML']       },
    { id: 'c-webgl',    name: 'WebGL Shaders',        icon: '🎨', description: 'Fragment shaders, raymarching, and generative art.',          membersCount: 1240, image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600', isJoined: false, category: 'Code',   tags: ['GLSL', 'ThreeJS', 'Art']    },
    { id: 'c-photo',    name: 'Analog Photography',   icon: '📷', description: 'Film is not dead. Grain, process, darkroom secrets.',         membersCount: 8540, image: 'https://images.unsplash.com/photo-1493863641943-9b68992a8d07?w=600', isJoined: false, category: 'Art',    tags: ['35mm', 'Darkroom']          },
    { id: 'c-cyber',    name: 'Cyberdeck Builders',   icon: '⚡', description: 'Custom hardware builds, deck aesthetics, portable computing.', membersCount: 3200, image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600', isJoined: false, category: 'Tech',   tags: ['Hardware', 'Cyberpunk']     },
    { id: 'c-tokyo',    name: 'Tokyo Urbanists',      icon: '🌃', description: 'Mapping the neon streets and hidden alleys of the megacity.',  membersCount: 450,  image: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=600', isJoined: false, category: 'Travel', tags: ['Urban', 'Exploration']      },
    { id: 'c-music',    name: 'Music Production',     icon: '🎵', description: 'DAWs, synthesis, sampling, and sound design.',                membersCount: 1800, image: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600', isJoined: false, category: 'Music',  tags: ['DAW', 'Synthesis', 'Audio'] },
    { id: 'c-design',   name: 'Interface Design',     icon: '✦',  description: 'Typography, motion, interaction design, and tooling.',         membersCount: 960,  image: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=600', isJoined: false, category: 'Design', tags: ['UI', 'Motion', 'Systems']   },
    { id: 'c-security', name: 'Offensive Security',   icon: '🔐', description: 'CTFs, red team, and security research.',                      membersCount: 670,  image: 'https://images.unsplash.com/photo-1614850523060-8da1d56ae167?w=600', isJoined: false, category: 'Tech',   tags: ['CTF', 'RedTeam', 'Exploit'] },
];

export default function createStudioRoutes(system = {}) {
    const router = express.Router();

    router.get('/profile', (_req, res) => {
        try {
            res.json({ ok: true, profile: loadProfile() });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    router.get('/identity/check', (req, res) => {
        try {
            res.json(usernameStatus(req.query.username, req.query.currentUserId || ''));
        } catch (e) {
            res.status(500).json({ ok: false, available: false, error: e.message });
        }
    });

    router.post('/identity/register', (req, res) => {
        try {
            const profile = loadProfile();
            const currentUserId = String(req.body?.currentUserId || profile.axis?.userId || profile.studio?.identity?.userId || '');
            const status = usernameStatus(req.body?.username, currentUserId);
            if (!status.available) return res.status(409).json(status);
            const passcode = String(req.body?.passcode || '').trim();
            if (passcode.length < 4) return res.status(400).json({ ok: false, reason: 'Use a passcode with at least 4 characters.' });

            const handle = status.handle;
            const userId = currentUserId || `studio-${handle}-${Date.now().toString(36)}`;
            const displayName = String(req.body?.displayName || profile.name || handle).trim() || handle;
            const registry = usernameRegistry();
            registry.users[handle] = {
                userId,
                handle,
                displayName,
                passcodeHash: hashSecret(passcode),
                createdAt: registry.users[handle]?.createdAt || Date.now(),
                updatedAt: Date.now(),
            };
            writeJsonSafe(USER_REGISTRY_FILE, registry);

            const savedProfile = saveProfile({
                ...profile,
                name: displayName,
                axis: {
                    ...(profile.axis || {}),
                    handle,
                    displayName,
                    userId,
                    color: profile.axis?.color || req.body?.color || 'violet',
                    status: profile.axis?.status || 'online',
                },
                publicIdentity: {
                    ...(profile.publicIdentity || {}),
                    handle,
                },
                studio: {
                    ...(profile.studio || {}),
                    identity: {
                        ...(profile.studio?.identity || {}),
                        registered: true,
                        userId,
                        handle,
                        displayName,
                        registeredAt: profile.studio?.identity?.registeredAt || Date.now(),
                    },
                },
            });

            axisProfileStore.recordActivity({
                type: 'studio_identity_registered',
                title: 'Studio identity registered',
                summary: `@${handle} registered as the portable Studio identity.`,
                source: 'studio-identity',
                metadata: { userId, handle },
            }, savedProfile);

            res.json({ ok: true, user: { userId, handle, displayName, color: savedProfile.axis?.color || 'violet' }, profile: savedProfile });
        } catch (e) {
            res.status(400).json({ ok: false, error: e.message });
        }
    });

    router.post('/identity/login', (req, res) => {
        try {
            const handle = normalizeUsername(req.body?.username);
            const passcode = String(req.body?.passcode || '').trim();
            const profile = loadProfile();
            const registry = usernameRegistry();
            const registered = registry.users[handle];
            const profileHandle = normalizeUsername(profile.axis?.handle || profile.publicIdentity?.handle || profile.name);
            const profileUserId = profile.axis?.userId || profile.studio?.identity?.userId || '';
            const matchesProfile = handle && handle === profileHandle;

            if (!registered && !matchesProfile) {
                return res.status(404).json({ ok: false, reason: 'No Studio identity found for that username.' });
            }
            if (registered?.passcodeHash && registered.passcodeHash !== hashSecret(passcode)) {
                return res.status(401).json({ ok: false, reason: 'Passcode does not match.' });
            }
            if (!registered?.passcodeHash && passcode.length < 4) {
                return res.status(400).json({ ok: false, reason: 'Enter a passcode to protect this local identity.' });
            }

            const userId = registered?.userId || profileUserId || `studio-${handle}-${Date.now().toString(36)}`;
            const displayName = registered?.displayName || profile.axis?.displayName || profile.name || handle;
            registry.users[handle] = {
                ...(registered || {}),
                userId,
                handle,
                displayName,
                passcodeHash: registered?.passcodeHash || hashSecret(passcode),
                createdAt: registered?.createdAt || Date.now(),
                updatedAt: Date.now(),
            };
            writeJsonSafe(USER_REGISTRY_FILE, registry);

            const savedProfile = saveProfile({
                ...profile,
                name: displayName,
                axis: {
                    ...(profile.axis || {}),
                    handle,
                    displayName,
                    userId,
                    color: profile.axis?.color || 'violet',
                    status: profile.axis?.status || 'online',
                },
                publicIdentity: {
                    ...(profile.publicIdentity || {}),
                    handle,
                },
                studio: {
                    ...(profile.studio || {}),
                    identity: {
                        ...(profile.studio?.identity || {}),
                        registered: true,
                        userId,
                        handle,
                        displayName,
                    },
                },
            });

            res.json({ ok: true, user: { userId, handle, displayName, color: savedProfile.axis?.color || 'violet' }, profile: savedProfile });
        } catch (e) {
            res.status(400).json({ ok: false, error: e.message });
        }
    });

    router.put('/profile', (req, res) => {
        try {
            ensureDir();
            const body = req.body || {};
            const markdown = typeof body.rawMarkdown === 'string'
                ? body.rawMarkdown
                : renderMarkdown(body.profile || body);
            fs.writeFileSync(USER_MD, markdown);
            const profile = parseMarkdown(markdown);
            axisProfileStore.recordActivity({
                type: 'studio_profile_saved',
                title: 'Studio profile saved',
                summary: 'Profile, widgets, or Studio settings were updated.',
                source: 'studio-profile',
            }, profile);
            res.json({ ok: true, profile });
        } catch (e) {
            res.status(400).json({ ok: false, error: e.message });
        }
    });

    router.get('/context', (_req, res) => {
        try {
            const profile = loadProfile();
            res.json({
                ok: true,
                context: profileContext(profile),
                profile,
            });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    router.get('/featured', (_req, res) => {
        try {
            const profile = loadProfile();
            const social = socialImageLibrary.list();
            const items = mergePortfolioWithSocialImages(profile, social.images || []);
            res.json({
                ok: true,
                imageDir: social.imageDir,
                items,
                socialImages: social.images || [],
                profile,
            });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    router.get('/featured/images/:id/file', (req, res) => {
        try {
            const social = socialImageLibrary.list();
            const image = (social.images || []).find(item => item.id === req.params.id);
            if (!image?.path || !fs.existsSync(image.path)) {
                return res.status(404).json({ ok: false, error: 'Image not found' });
            }
            res.sendFile(path.resolve(image.path));
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    router.post('/featured/upload', upload.single('image'), (req, res) => {
        let tempPath = req.file?.path;
        try {
            if (!tempPath) return res.status(400).json({ ok: false, error: 'Image file is required' });
            const title = String(req.body?.title || titleFromFilename(req.file.originalname)).trim();
            const category = String(req.body?.category || 'SOMA Social Images').trim();
            const description = String(req.body?.description || `Featured image imported from Studio: ${req.file.originalname}`).trim();
            const tags = String(req.body?.tags || 'studio, featured-work, social-image')
                .split(',')
                .map(tag => tag.trim())
                .filter(Boolean);

            const imported = socialImageLibrary.import({
                path: tempPath,
                alt: description,
                source: 'studio-featured-work',
                tags,
            });
            const item = portfolioItemFromSocialImage(imported.image, { title, category, description, tags });
            const profile = loadProfile();
            const existing = Array.isArray(profile.studio?.portfolio) ? profile.studio.portfolio : [];
            const withoutDuplicate = existing.filter(saved =>
                saved?.socialImageId !== item.socialImageId &&
                saved?.socialPath !== item.socialPath &&
                saved?.id !== item.id
            );
            const savedProfile = saveProfile({
                ...profile,
                studio: {
                    ...(profile.studio || {}),
                    portfolio: [item, ...withoutDuplicate],
                },
            });
            axisProfileStore.recordActivity({
                type: 'studio_featured_image',
                title: 'Featured image added',
                summary: `${title} was imported into SOMA/social-media/images.`,
                source: 'studio-featured-work',
                metadata: { socialImageId: item.socialImageId, path: item.socialPath },
            }, savedProfile);

            res.json({
                ok: true,
                item,
                image: imported.image,
                imageDir: imported.imageDir,
                profile: savedProfile,
            });
        } catch (e) {
            res.status(400).json({ ok: false, error: e.message });
        } finally {
            if (tempPath) {
                try { fs.unlinkSync(tempPath); } catch {}
            }
        }
    });

    router.get('/axis', (_req, res) => {
        try {
            const profile = loadProfile();
            const axis = axisProfileStore.getState(profile);
            res.json({
                ok: true,
                axis,
                profile,
            });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    router.put('/axis', (req, res) => {
        try {
            const profile = loadProfile();
            const current = axisProfileStore.getState(profile);
            const incoming = req.body?.axis || req.body || {};
            const saved = axisProfileStore.saveState({
                ...current,
                ...incoming,
                friends: Array.isArray(incoming.friends) ? incoming.friends : current.friends,
                chats: Array.isArray(incoming.chats) ? incoming.chats : current.chats,
                messages: incoming.messages && typeof incoming.messages === 'object' ? incoming.messages : current.messages,
                spaces: Array.isArray(incoming.spaces) ? incoming.spaces : current.spaces,
            }, profile);
            res.json({ ok: true, axis: saved, profile });
        } catch (e) {
            res.status(400).json({ ok: false, error: e.message });
        }
    });

    router.post('/axis/friends', (req, res) => {
        try {
            const profile = loadProfile();
            const result = axisProfileStore.addFriend(req.body || {}, profile);
            res.json({ ok: true, ...result, profile });
        } catch (e) {
            res.status(400).json({ ok: false, error: e.message });
        }
    });

    router.patch('/axis/friends/:id', (req, res) => {
        try {
            const profile = loadProfile();
            const result = axisProfileStore.updateFriend(req.params.id, req.body || {}, profile);
            res.json({ ok: true, ...result, profile });
        } catch (e) {
            res.status(400).json({ ok: false, error: e.message });
        }
    });

    router.delete('/axis/friends/:id', (req, res) => {
        try {
            const profile = loadProfile();
            const result = axisProfileStore.removeFriend(req.params.id, profile);
            res.json({ ok: true, ...result, profile });
        } catch (e) {
            res.status(400).json({ ok: false, error: e.message });
        }
    });

    router.patch('/axis/chats/:id', (req, res) => {
        try {
            const profile = loadProfile();
            const chat = axisProfileStore.updateChat(req.params.id, req.body || {}, profile);
            res.json({ ok: true, chat, axis: axisProfileStore.getState(profile) });
        } catch (e) {
            res.status(400).json({ ok: false, error: e.message });
        }
    });

    router.get('/axis/chats/:id/messages', (req, res) => {
        try {
            const profile = loadProfile();
            res.json({ ok: true, ...axisProfileStore.getMessages(req.params.id, profile) });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    router.post('/axis/chats/:id/messages', (req, res) => {
        try {
            const profile = loadProfile();
            const result = axisProfileStore.addMessage(req.params.id, req.body || {}, profile);
            res.json({ ok: true, ...result });
        } catch (e) {
            res.status(400).json({ ok: false, error: e.message });
        }
    });

    // ── Communities ────────────────────────────────────────────────────────────
    router.get('/communities', (_req, res) => {
        try {
            const profile = loadProfile();
            let communities = Array.isArray(profile.studio?.communities) && profile.studio.communities.length
                ? profile.studio.communities
                : null;
            if (!communities) {
                communities = DEFAULT_COMMUNITIES;
                saveProfile({ ...profile, studio: { ...(profile.studio || {}), communities } });
            }
            res.json({ ok: true, communities });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    router.post('/communities', (req, res) => {
        try {
            const profile = loadProfile();
            const existing = Array.isArray(profile.studio?.communities) && profile.studio.communities.length
                ? profile.studio.communities : [...DEFAULT_COMMUNITIES];
            const { name, description, category, icon, image, tags } = req.body || {};
            if (!name?.trim()) return res.status(400).json({ ok: false, error: 'name required' });
            const community = {
                id: `c-${Date.now()}`,
                name: name.trim(),
                description: description?.trim() || '',
                icon: icon || '💬',
                image: image || 'https://images.unsplash.com/photo-1614850523060-8da1d56ae167?w=600',
                membersCount: 1,
                isJoined: true,
                category: category || 'Custom',
                tags: Array.isArray(tags) ? tags : ['New'],
            };
            const updated = [...existing, community];
            saveProfile({ ...profile, studio: { ...(profile.studio || {}), communities: updated } });
            res.json({ ok: true, community, communities: updated });
        } catch (e) {
            res.status(400).json({ ok: false, error: e.message });
        }
    });

    router.patch('/communities/:id', (req, res) => {
        try {
            const profile = loadProfile();
            const existing = Array.isArray(profile.studio?.communities) && profile.studio.communities.length
                ? profile.studio.communities : [...DEFAULT_COMMUNITIES];
            const updated = existing.map(c => c.id === req.params.id ? { ...c, ...req.body } : c);
            saveProfile({ ...profile, studio: { ...(profile.studio || {}), communities: updated } });
            const community = updated.find(c => c.id === req.params.id);
            res.json({ ok: true, community, communities: updated });
        } catch (e) {
            res.status(400).json({ ok: false, error: e.message });
        }
    });

    router.delete('/communities/:id', (req, res) => {
        try {
            const profile = loadProfile();
            const existing = Array.isArray(profile.studio?.communities) && profile.studio.communities.length
                ? profile.studio.communities : [...DEFAULT_COMMUNITIES];
            const updated = existing.filter(c => c.id !== req.params.id);
            saveProfile({ ...profile, studio: { ...(profile.studio || {}), communities: updated } });
            res.json({ ok: true, communities: updated });
        } catch (e) {
            res.status(400).json({ ok: false, error: e.message });
        }
    });

    // ── Top 8 ──────────────────────────────────────────────────────────────────
    router.get('/top8', (_req, res) => {
        try {
            const profile = loadProfile();
            const axis = axisProfileStore.getState(profile);
            const top8Ids = Array.isArray(axis.top8) ? axis.top8 : [];
            const friends = axis.friends || [];
            const ordered = top8Ids.map(id => friends.find(f => f.id === id)).filter(Boolean);
            res.json({ ok: true, top8: ordered, top8Ids, friends });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    router.put('/top8', (req, res) => {
        try {
            const profile = loadProfile();
            const current = axisProfileStore.getState(profile);
            const ids = Array.isArray(req.body?.ids) ? req.body.ids.slice(0, 8) : [];
            const saved = axisProfileStore.saveState({ ...current, top8: ids }, profile);
            const friends = saved.friends || [];
            const ordered = ids.map(id => friends.find(f => f.id === id)).filter(Boolean);
            res.json({ ok: true, top8: ordered, top8Ids: ids });
        } catch (e) {
            res.status(400).json({ ok: false, error: e.message });
        }
    });

    router.post('/assistant', async (req, res) => {
        try {
            const message = String(req.body?.message || '').trim();
            if (!message) return res.status(400).json({ ok: false, error: 'Message is required' });

            const profile = loadProfile();
            const history = Array.isArray(req.body?.history) ? req.body.history.slice(-8) : [];
            const historyText = history
                .map(item => `${item.role === 'user' ? 'Barry' : 'SOMA'}: ${item.text || item.content || ''}`)
                .filter(Boolean)
                .join('\n');

            const prompt = [
                'You are SOMA inside Studio, the user profile and identity control layer for Command Bridge.',
                'Speak as SOMA, not as Gemini, a generic assistant, or a separate bot.',
                'Use the profile context below to help Barry shape Studio, Axis identity, projects, public voice, and communication workflows.',
                'Be concise, practical, honest, and high-agency. If a request needs implementation work, suggest the smallest concrete next step.',
                '',
                '[STUDIO PROFILE CONTEXT]',
                profileContext(profile),
                '',
                historyText ? '[RECENT STUDIO CHAT]\n' + historyText + '\n' : '',
                `[BARRY]\n${message}`,
            ].join('\n');

            const brain = system.quadBrain || system.somArbiter || system.brain || system.superintelligence;
            if (!brain?.reason) {
                return res.json({
                    ok: true,
                    reply: "Studio is wired to SOMA, but my reasoning core is still waking up. I can see your profile context once the backend brain is online.",
                    metadata: { brain: 'offline' },
                });
            }

            const result = await brain.reason(prompt, {
                source: 'studio-assistant',
                quickResponse: true,
                preferredBrain: 'AURORA',
                profilePath: USER_MD,
            });

            res.json({
                ok: true,
                reply: resultText(result) || 'I received that, but my response came back empty.',
                metadata: {
                    brain: result?.metadata?.brain || result?.brain || 'SOMA',
                    confidence: result?.metadata?.confidence ?? result?.confidence ?? null,
                },
            });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    return router;
}
