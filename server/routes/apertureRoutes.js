import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import axisStore from '../axis/AxisStore.js';

const statePath = path.resolve(process.cwd(), 'data', 'aperture', 'state.json');
const portalIndexPath = path.resolve(process.cwd(), 'data', 'aperture', 'portal-index.json');
const reflectionsPath = path.resolve(process.cwd(), 'data', 'vault', 'reflections');

const defaultState = {
    settings: {
        theme: 'graphite',
        wallpaper: 'alpine',
        wallpaperUrl: '',
        activeWorkspaceId: null,
        autonomyLevel: 2,
        permissions: {
            fileRead: true,
            networkAccess: true,
            memoryWrite: true,
            somaReasoning: true
        },
        notificationsEnabled: true
    },
    calendar: []
};

async function readState() {
    try {
        const value = JSON.parse(await fs.readFile(statePath, 'utf8'));
        return {
            settings: {
                ...defaultState.settings,
                ...(value.settings || {}),
                permissions: {
                    ...defaultState.settings.permissions,
                    ...(value.settings?.permissions || {})
                }
            },
            calendar: Array.isArray(value.calendar) ? value.calendar : []
        };
    } catch {
        return structuredClone(defaultState);
    }
}

async function writeState(state) {
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf8');
    return state;
}

async function readPortalIndex() {
    try {
        const value = JSON.parse(await fs.readFile(portalIndexPath, 'utf8'));
        return Array.isArray(value.pages) ? value.pages : [];
    } catch {
        return [];
    }
}

async function writePortalIndex(pages) {
    await fs.mkdir(path.dirname(portalIndexPath), { recursive: true });
    await fs.writeFile(portalIndexPath, JSON.stringify({ version: 1, pages }, null, 2), 'utf8');
    return pages;
}

function indexTerms(value = '') {
    return [...new Set(String(value).toLowerCase().match(/[a-z0-9]{2,}/g) || [])];
}

function portalSearchScore(page, queryTerms) {
    const title = String(page.title || '').toLowerCase();
    const url = String(page.url || '').toLowerCase();
    const content = String(page.content || '').toLowerCase();
    let score = 0;
    for (const term of queryTerms) {
        if (title.includes(term)) score += 8;
        if (url.includes(term)) score += 4;
        const matches = content.split(term).length - 1;
        score += Math.min(matches, 8);
    }
    return score;
}

function snippetForPage(page, queryTerms) {
    const content = String(page.content || '').replace(/\s+/g, ' ').trim();
    const lower = content.toLowerCase();
    const location = queryTerms.map(term => lower.indexOf(term)).find(index => index >= 0) ?? 0;
    const start = Math.max(0, location - 45);
    const snippet = content.slice(start, start + 235);
    return start > 0 ? `...${snippet}` : snippet;
}

function safeSettingsPatch(body = {}) {
    const allowedThemes = ['daylight', 'graphite', 'slate'];
    const allowedWallpapers = ['alpine', 'mist', 'graphite', 'custom'];
    const permissions = body.permissions || {};
    const patch = {};
    if (allowedThemes.includes(body.theme)) patch.theme = body.theme;
    if (allowedWallpapers.includes(body.wallpaper)) patch.wallpaper = body.wallpaper;
    if (typeof body.wallpaperUrl === 'string') patch.wallpaperUrl = body.wallpaperUrl.slice(0, 2000000);
    if (body.activeWorkspaceId === null || typeof body.activeWorkspaceId === 'string') patch.activeWorkspaceId = body.activeWorkspaceId;
    if (Number.isInteger(body.autonomyLevel)) patch.autonomyLevel = Math.max(1, Math.min(3, body.autonomyLevel));
    if (typeof body.notificationsEnabled === 'boolean') patch.notificationsEnabled = body.notificationsEnabled;
    patch.permissions = {};
    for (const key of Object.keys(defaultState.settings.permissions)) {
        if (typeof permissions[key] === 'boolean') patch.permissions[key] = permissions[key];
    }
    return patch;
}

async function searchReflections(query) {
    const q = query.toLowerCase();
    try {
        const files = (await fs.readdir(reflectionsPath)).filter(name => name.endsWith('.md')).slice(0, 350);
        const results = [];
        for (const name of files) {
            const content = await fs.readFile(path.join(reflectionsPath, name), 'utf8').catch(() => '');
            if (!content.toLowerCase().includes(q) && !name.toLowerCase().includes(q)) continue;
            const title = content.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1] || name.replace(/\.md$/, '');
            results.push({ id: name, type: 'reflection', appId: 'notes', title, detail: 'Reflections note' });
            if (results.length >= 8) break;
        }
        return results;
    } catch {
        return [];
    }
}

export default function createApertureRoutes() {
    const router = express.Router();

    router.get('/settings', async (_req, res) => {
        const state = await readState();
        res.json({ success: true, settings: state.settings });
    });

    router.put('/settings', async (req, res) => {
        const state = await readState();
        const patch = safeSettingsPatch(req.body || {});
        state.settings = {
            ...state.settings,
            ...patch,
            permissions: { ...state.settings.permissions, ...patch.permissions }
        };
        await writeState(state);
        res.json({ success: true, settings: state.settings });
    });

    router.get('/calendar', async (req, res) => {
        const state = await readState();
        const workspaceId = String(req.query.workspaceId || '').trim();
        const events = workspaceId
            ? state.calendar.filter(event => event.workspaceId === workspaceId)
            : state.calendar;
        res.json({ success: true, events });
    });

    router.post('/calendar', async (req, res) => {
        const { title, startsAt, workspaceId = null, workspaceName = 'Personal', notes = '' } = req.body || {};
        if (!title?.trim() || !startsAt) return res.status(400).json({ success: false, error: 'title and startsAt required' });
        const state = await readState();
        const event = {
            id: `event-${Date.now()}`,
            title: title.trim(),
            startsAt: new Date(startsAt).toISOString(),
            workspaceId,
            workspaceName,
            notes: String(notes).slice(0, 1000),
            createdAt: new Date().toISOString()
        };
        state.calendar.push(event);
        await writeState(state);
        res.json({ success: true, event });
    });

    router.delete('/calendar/:id', async (req, res) => {
        const state = await readState();
        state.calendar = state.calendar.filter(event => event.id !== req.params.id);
        await writeState(state);
        res.json({ success: true });
    });

    router.get('/portal/index', async (_req, res) => {
        const pages = await readPortalIndex();
        res.json({
            success: true,
            count: pages.length,
            pages: pages.slice().sort((a, b) => b.indexedAt.localeCompare(a.indexedAt)).slice(0, 100)
                .map(({ content, ...page }) => ({ ...page, contentLength: content.length }))
        });
    });

    router.post('/portal/index', async (req, res) => {
        const { url, title, content, source = 'reader' } = req.body || {};
        if (!/^https?:\/\//i.test(String(url || '')) || !String(content || '').trim()) {
            return res.status(400).json({ success: false, error: 'A public URL and extracted content are required.' });
        }
        const normalizedUrl = String(url).trim().slice(0, 2048);
        const page = {
            id: Buffer.from(normalizedUrl).toString('base64url').slice(0, 80),
            url: normalizedUrl,
            title: String(title || normalizedUrl).trim().slice(0, 250),
            content: String(content).trim().slice(0, 120000),
            source: String(source).slice(0, 40),
            indexedAt: new Date().toISOString()
        };
        const current = await readPortalIndex();
        const pages = [page, ...current.filter(item => item.url !== page.url)].slice(0, 10000);
        await writePortalIndex(pages);
        res.json({ success: true, page: { ...page, contentLength: page.content.length }, count: pages.length });
    });

    router.delete('/portal/index/:id', async (req, res) => {
        const pages = await readPortalIndex();
        const remaining = pages.filter(page => page.id !== req.params.id);
        await writePortalIndex(remaining);
        res.json({ success: true, removed: pages.length !== remaining.length, count: remaining.length });
    });

    router.get('/portal/search', async (req, res) => {
        const query = String(req.query.q || '').trim();
        if (query.length < 2) return res.json({ success: true, provider: 'portal-index', results: [], count: 0 });
        const terms = indexTerms(query);
        const pages = await readPortalIndex();
        const results = pages.map(page => ({ page, score: portalSearchScore(page, terms) }))
            .filter(result => result.score > 0)
            .sort((a, b) => b.score - a.score || b.page.indexedAt.localeCompare(a.page.indexedAt))
            .slice(0, 15)
            .map(({ page, score }) => ({
                id: page.id,
                title: page.title,
                url: page.url,
                snippet: snippetForPage(page, terms),
                score,
                indexedAt: page.indexedAt,
                source: page.source
            }));
        res.json({ success: true, provider: 'portal-index', results, indexedPages: pages.length, count: results.length });
    });

    router.get('/search', async (req, res) => {
        const query = String(req.query.q || '').trim();
        if (query.length < 2) return res.json({ success: true, results: [] });
        const q = query.toLowerCase();
        const workspaceId = String(req.query.workspaceId || '').trim();
        const results = await searchReflections(query);
        const workspaces = axisStore.getWorkspaces();
        for (const workspace of workspaces) {
            if (workspaceId && workspace.id !== workspaceId) continue;
            const projects = axisStore.getProjects(workspace.id);
            for (const project of projects) {
                if (`${project.name} ${project.description || ''}`.toLowerCase().includes(q)) {
                    results.push({ id: project.id, type: 'project', appId: 'tasks', title: project.name, detail: workspace.name });
                }
                for (const task of axisStore.getTasks(project.id)) {
                    if (`${task.title} ${task.description || ''}`.toLowerCase().includes(q)) {
                        results.push({ id: task.id, type: 'task', appId: 'tasks', title: task.title, detail: `${workspace.name} / ${project.name}` });
                    }
                }
            }
        }
        const state = await readState();
        for (const event of state.calendar) {
            if (workspaceId && event.workspaceId !== workspaceId) continue;
            if (`${event.title} ${event.notes}`.toLowerCase().includes(q)) {
                results.push({ id: event.id, type: 'event', appId: 'calendar', title: event.title, detail: event.workspaceName });
            }
        }
        res.json({ success: true, results: results.slice(0, 25) });
    });

    return router;
}
