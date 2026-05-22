import express from 'express';
import axisStore from '../axis/AxisStore.js';

export default function createProjectRoutes(system) {
    const router = express.Router();
    const bcast  = (event, data) => system?.wss?.clients?.forEach(c => c.readyState === 1 && c.send(JSON.stringify({ type: event, ...data })));

    const getUser = (req) => ({
        userId:    req.headers['x-axis-user-id']    || 'anon',
        userName:  req.headers['x-axis-user-name']  || 'Anonymous',
        userColor: req.headers['x-axis-user-color'] || 'blue',
        userAvatar: req.headers['x-axis-user-avatar'] || '',
    });

    // ── Projects ──────────────────────────────────────────────────────────────
    router.get('/', (req, res) => {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(400).json({ ok: false, error: 'workspaceId required' });
        res.json({ ok: true, projects: axisStore.getProjects(workspaceId) });
    });

    router.post('/', (req, res) => {
        try {
            const u = getUser(req);
            const { workspaceId, name, description, icon, color } = req.body || {};
            if (!workspaceId || !name?.trim()) return res.status(400).json({ ok: false, error: 'workspaceId and name required' });
            const project = axisStore.createProject({ workspaceId, name: name.trim(), description, icon, color, createdBy: u.userId, createdByName: u.userName });
            bcast('axis.project_created', { project });
            res.json({ ok: true, project });
        } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
    });

    router.get('/:id', (req, res) => {
        const project = axisStore.getProject(req.params.id);
        if (!project) return res.status(404).json({ ok: false, error: 'Not found' });
        const members  = axisStore.getProjectMembers(req.params.id);
        const channels = axisStore.getProjectChannels(req.params.id);
        res.json({ ok: true, project, members, channels });
    });

    router.patch('/:id', (req, res) => {
        try {
            const project = axisStore.updateProject(req.params.id, req.body || {});
            if (!project) return res.status(404).json({ ok: false, error: 'Not found' });
            bcast('axis.project_updated', { project });
            res.json({ ok: true, project });
        } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
    });

    router.delete('/:id', (req, res) => {
        axisStore.deleteProject(req.params.id);
        bcast('axis.project_deleted', { id: req.params.id });
        res.json({ ok: true });
    });

    // ── Project Members ───────────────────────────────────────────────────────
    router.get('/:id/members', (req, res) => {
        res.json({ ok: true, members: axisStore.getProjectMembers(req.params.id) });
    });

    router.post('/:id/members', (req, res) => {
        try {
            const { userId, userName, userAvatar, role } = req.body || {};
            if (!userId || !userName) return res.status(400).json({ ok: false, error: 'userId and userName required' });
            axisStore.addProjectMember(req.params.id, { userId, userName, userAvatar, role });
            bcast('axis.project_member_added', { projectId: req.params.id, userId, userName, role });
            res.json({ ok: true, members: axisStore.getProjectMembers(req.params.id) });
        } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
    });

    router.delete('/:id/members/:userId', (req, res) => {
        axisStore.removeProjectMember(req.params.id, req.params.userId);
        bcast('axis.project_member_removed', { projectId: req.params.id, userId: req.params.userId });
        res.json({ ok: true });
    });

    router.patch('/:id/members/:userId/role', (req, res) => {
        const { role } = req.body || {};
        if (!role) return res.status(400).json({ ok: false, error: 'role required' });
        axisStore.updateProjectMemberRole(req.params.id, req.params.userId, role);
        res.json({ ok: true });
    });

    // ── Project Channels ──────────────────────────────────────────────────────
    router.get('/:id/channels', (req, res) => {
        res.json({ ok: true, channels: axisStore.getProjectChannels(req.params.id) });
    });

    router.post('/:id/channels', (req, res) => {
        try {
            const u = getUser(req);
            const project = axisStore.getProject(req.params.id);
            if (!project) return res.status(404).json({ ok: false, error: 'Project not found' });
            const { name, type, description, isPrivate } = req.body || {};
            if (!name?.trim()) return res.status(400).json({ ok: false, error: 'name required' });
            const channel = axisStore.createProjectChannel({ projectId: req.params.id, workspaceId: project.workspace_id, name: name.trim(), type, description, isPrivate, createdBy: u.userId });
            bcast('axis.channel_created', channel);
            res.json({ ok: true, channel });
        } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
    });

    // ── Tasks ─────────────────────────────────────────────────────────────────
    router.get('/:id/tasks', (req, res) => {
        const tasks = axisStore.getTasks(req.params.id, { status: req.query.status });
        res.json({ ok: true, tasks: tasks.map(t => ({ ...t, tags: JSON.parse(t.tags || '[]') })) });
    });

    router.post('/:id/tasks', (req, res) => {
        try {
            const u = getUser(req);
            const project = axisStore.getProject(req.params.id);
            if (!project) return res.status(404).json({ ok: false, error: 'Project not found' });
            const { title, description, priority, assigneeId, assigneeName, dueDate, tags } = req.body || {};
            if (!title?.trim()) return res.status(400).json({ ok: false, error: 'title required' });
            const task = axisStore.createTask({ projectId: req.params.id, workspaceId: project.workspace_id, title: title.trim(), description, priority, assigneeId, assigneeName, createdBy: u.userId, createdByName: u.userName, dueDate, tags });
            bcast('axis.task_created', { projectId: req.params.id, task: { ...task, tags: JSON.parse(task.tags || '[]') } });
            res.json({ ok: true, task: { ...task, tags: JSON.parse(task.tags || '[]') } });
        } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
    });

    router.get('/:id/tasks/:taskId', (req, res) => {
        const task = axisStore.getTask(req.params.taskId);
        if (!task || task.project_id !== req.params.id) return res.status(404).json({ ok: false, error: 'Not found' });
        const comments = axisStore.getTaskComments(req.params.taskId);
        res.json({ ok: true, task: { ...task, tags: JSON.parse(task.tags || '[]') }, comments });
    });

    router.patch('/:id/tasks/:taskId', (req, res) => {
        try {
            const task = axisStore.updateTask(req.params.taskId, req.body || {});
            if (!task) return res.status(404).json({ ok: false, error: 'Not found' });
            bcast('axis.task_updated', { projectId: req.params.id, task: { ...task, tags: JSON.parse(task.tags || '[]') } });
            res.json({ ok: true, task: { ...task, tags: JSON.parse(task.tags || '[]') } });
        } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
    });

    router.delete('/:id/tasks/:taskId', (req, res) => {
        axisStore.deleteTask(req.params.taskId);
        bcast('axis.task_deleted', { projectId: req.params.id, taskId: req.params.taskId });
        res.json({ ok: true });
    });

    // ── Task Comments ─────────────────────────────────────────────────────────
    router.get('/:id/tasks/:taskId/comments', (req, res) => {
        res.json({ ok: true, comments: axisStore.getTaskComments(req.params.taskId) });
    });

    router.post('/:id/tasks/:taskId/comments', (req, res) => {
        try {
            const u = getUser(req);
            const { content } = req.body || {};
            if (!content?.trim()) return res.status(400).json({ ok: false, error: 'content required' });
            const comment = axisStore.addTaskComment({ taskId: req.params.taskId, authorId: u.userId, authorName: u.userName, content: content.trim() });
            bcast('axis.task_comment_added', { projectId: req.params.id, taskId: req.params.taskId, comment });
            res.json({ ok: true, comment });
        } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
    });

    return router;
}
