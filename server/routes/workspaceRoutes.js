/**
 * server/routes/workspaceRoutes.js
 * Tie workspace — projects, tasks, and file attachments.
 * Stores data in data/workspace/ as JSON (no new deps).
 */

import express from 'express';
import fs      from 'fs/promises';
import path    from 'path';
import { createRequire } from 'module';

const require   = createRequire(import.meta.url);
const multer    = require('multer');
const DATA_DIR  = path.join(process.cwd(), 'data', 'workspace');
const FILES_DIR = path.join(DATA_DIR, 'uploads');

const storage = multer.diskStorage({
    destination: async (_req, _file, cb) => {
        await fs.mkdir(FILES_DIR, { recursive: true });
        cb(null, FILES_DIR);
    },
    filename: (_req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname.replace(/[^a-z0-9.\-_]/gi, '_')}`);
    },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// ── JSON file helpers ─────────────────────────────────────────────────────────

async function readJSON(file, fallback = []) {
    try {
        const raw = await fs.readFile(path.join(DATA_DIR, file), 'utf8');
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

async function writeJSON(file, data) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

// ── Router ────────────────────────────────────────────────────────────────────

export default function createWorkspaceRoutes(_system) {
    const router = express.Router();

    // ── Projects ──────────────────────────────────────────────────────────────

    router.get('/projects', async (_req, res) => {
        const projects = await readJSON('projects.json');
        res.json({ ok: true, projects });
    });

    router.post('/projects', async (req, res) => {
        const { name, description, status = 'active', color = '#00aaff', icon = '◈' } = req.body;
        if (!name?.trim()) return res.status(400).json({ ok: false, error: 'name required' });
        const projects = await readJSON('projects.json');
        const project = {
            id:          `proj-${Date.now()}`,
            name:        name.trim(),
            description: description?.trim() || '',
            status,
            color,
            icon,
            createdAt:   Date.now(),
            updatedAt:   Date.now(),
        };
        projects.push(project);
        await writeJSON('projects.json', projects);
        res.json({ ok: true, project });
    });

    router.get('/projects/:id', async (req, res) => {
        const projects = await readJSON('projects.json');
        const project  = projects.find(p => p.id === req.params.id);
        if (!project) return res.status(404).json({ ok: false, error: 'not found' });
        res.json({ ok: true, project });
    });

    router.put('/projects/:id', async (req, res) => {
        const projects = await readJSON('projects.json');
        const idx      = projects.findIndex(p => p.id === req.params.id);
        if (idx === -1) return res.status(404).json({ ok: false, error: 'not found' });
        projects[idx]  = { ...projects[idx], ...req.body, id: req.params.id, updatedAt: Date.now() };
        await writeJSON('projects.json', projects);
        res.json({ ok: true, project: projects[idx] });
    });

    router.delete('/projects/:id', async (req, res) => {
        const projects = await readJSON('projects.json');
        await writeJSON('projects.json', projects.filter(p => p.id !== req.params.id));
        // Clean up tasks and files
        const tasks = await readJSON('tasks.json');
        await writeJSON('tasks.json', tasks.filter(t => t.projectId !== req.params.id));
        const files = await readJSON('files.json');
        const removed = files.filter(f => f.projectId === req.params.id);
        await writeJSON('files.json', files.filter(f => f.projectId !== req.params.id));
        for (const f of removed) {
            try { await fs.unlink(path.join(FILES_DIR, f.storedName)); } catch {}
        }
        res.json({ ok: true });
    });

    // ── Tasks ─────────────────────────────────────────────────────────────────

    router.get('/projects/:id/tasks', async (req, res) => {
        const tasks = await readJSON('tasks.json');
        res.json({ ok: true, tasks: tasks.filter(t => t.projectId === req.params.id) });
    });

    router.post('/projects/:id/tasks', async (req, res) => {
        const { title, assignee = '', priority = 'medium', dueDate = null } = req.body;
        if (!title?.trim()) return res.status(400).json({ ok: false, error: 'title required' });
        const tasks = await readJSON('tasks.json');
        const task  = {
            id:        `task-${Date.now()}`,
            projectId: req.params.id,
            title:     title.trim(),
            assignee,
            priority,
            dueDate,
            done:      false,
            createdAt: Date.now(),
        };
        tasks.push(task);
        await writeJSON('tasks.json', tasks);
        res.json({ ok: true, task });
    });

    router.put('/tasks/:id', async (req, res) => {
        const tasks = await readJSON('tasks.json');
        const idx   = tasks.findIndex(t => t.id === req.params.id);
        if (idx === -1) return res.status(404).json({ ok: false, error: 'not found' });
        tasks[idx]  = { ...tasks[idx], ...req.body, id: req.params.id };
        await writeJSON('tasks.json', tasks);
        res.json({ ok: true, task: tasks[idx] });
    });

    router.delete('/tasks/:id', async (req, res) => {
        const tasks = await readJSON('tasks.json');
        await writeJSON('tasks.json', tasks.filter(t => t.id !== req.params.id));
        res.json({ ok: true });
    });

    // ── Files ─────────────────────────────────────────────────────────────────

    router.get('/projects/:id/files', async (req, res) => {
        const files = await readJSON('files.json');
        res.json({ ok: true, files: files.filter(f => f.projectId === req.params.id) });
    });

    router.post('/projects/:id/files', upload.single('file'), async (req, res) => {
        if (!req.file) return res.status(400).json({ ok: false, error: 'file required' });
        const files = await readJSON('files.json');
        const entry = {
            id:           `file-${Date.now()}`,
            projectId:    req.params.id,
            originalName: req.file.originalname,
            storedName:   req.file.filename,
            size:         req.file.size,
            mimetype:     req.file.mimetype,
            uploadedAt:   Date.now(),
            uploadedBy:   req.headers['x-tie-user-name'] || 'Unknown',
        };
        files.push(entry);
        await writeJSON('files.json', files);
        res.json({ ok: true, file: entry });
    });

    router.get('/files/:id/download', async (req, res) => {
        const files = await readJSON('files.json');
        const file  = files.find(f => f.id === req.params.id);
        if (!file) return res.status(404).json({ ok: false, error: 'not found' });
        const filePath = path.join(FILES_DIR, file.storedName);
        res.download(filePath, file.originalName);
    });

    router.delete('/files/:id', async (req, res) => {
        const files = await readJSON('files.json');
        const file  = files.find(f => f.id === req.params.id);
        if (!file) return res.status(404).json({ ok: false, error: 'not found' });
        try { await fs.unlink(path.join(FILES_DIR, file.storedName)); } catch {}
        await writeJSON('files.json', files.filter(f => f.id !== req.params.id));
        res.json({ ok: true });
    });

    return router;
}
