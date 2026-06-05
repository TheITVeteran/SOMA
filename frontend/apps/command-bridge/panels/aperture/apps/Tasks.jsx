import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle, Clock, Plus, Trash2 } from 'lucide-react';
import somaBackend from '../../../somaBackend';

const columns = [
  { id: 'todo', label: 'To Do', icon: Clock },
  { id: 'in_progress', label: 'In Progress', icon: AlertCircle },
  { id: 'done', label: 'Complete', icon: CheckCircle }
];

export default function TaskManager({ workspace }) {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [projectName, setProjectName] = useState('');
  const [error, setError] = useState('');

  const loadProjects = async () => {
    if (!workspace?.id) return setProjects([]);
    const response = await somaBackend.fetch(`/api/axis/projects?workspaceId=${encodeURIComponent(workspace.id)}`);
    const next = response.projects || [];
    setProjects(next);
    setProjectId(previous => next.some(item => item.id === previous) ? previous : (next[0]?.id || ''));
  };

  const loadTasks = async (activeId = projectId) => {
    if (!activeId) return setTasks([]);
    const response = await somaBackend.fetch(`/api/axis/projects/${activeId}/tasks`);
    setTasks(response.tasks || []);
  };

  useEffect(() => {
    loadProjects().catch(err => setError(err.message));
  }, [workspace?.id]);

  useEffect(() => {
    loadTasks().catch(err => setError(err.message));
  }, [projectId]);

  const createProject = async event => {
    event.preventDefault();
    if (!workspace?.id || !projectName.trim()) return;
    const response = await somaBackend.fetch('/api/axis/projects', {
      method: 'POST',
      body: JSON.stringify({ workspaceId: workspace.id, name: projectName.trim(), description: 'Created in Aperture Tasks' })
    });
    if (!response.ok) return setError(response.error || 'Unable to create project');
    setProjectName('');
    await loadProjects();
    setProjectId(response.project.id);
  };

  const createTask = async event => {
    event.preventDefault();
    if (!projectId || !title.trim()) return;
    const response = await somaBackend.fetch(`/api/axis/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ title: title.trim(), description, priority, workspaceId: workspace.id, tags: ['aperture'] })
    });
    if (!response.ok) return setError(response.error || 'Unable to create task');
    setTitle('');
    setDescription('');
    await loadTasks();
  };

  const updateStatus = async (task, status) => {
    await somaBackend.fetch(`/api/axis/projects/${projectId}/tasks/${task.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    await loadTasks();
  };

  const removeTask = async task => {
    await somaBackend.fetch(`/api/axis/projects/${projectId}/tasks/${task.id}`, { method: 'DELETE' });
    await loadTasks();
  };

  if (!workspace) return <div className="ap-empty">Select an Axis workspace to manage tasks.</div>;

  return (
    <div className="ap-task-app">
      <header>
        <div><strong>{workspace.name}</strong><span>Axis task board</span></div>
        {projects.length > 0 && <select value={projectId} onChange={event => setProjectId(event.target.value)}>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select>}
      </header>
      {error && <p className="ap-inline-error">{error}</p>}
      {!projects.length ? (
        <form className="ap-project-create" onSubmit={createProject}>
          <h3>Create the first project in {workspace.name}</h3>
          <input value={projectName} onChange={event => setProjectName(event.target.value)} placeholder="Project name" />
          <button><Plus size={14} /> Create Project</button>
        </form>
      ) : (
        <>
          <form className="ap-task-compose" onSubmit={createTask}>
            <input required value={title} onChange={event => setTitle(event.target.value)} placeholder="Add a real Axis task..." />
            <input value={description} onChange={event => setDescription(event.target.value)} placeholder="Description" />
            <select value={priority} onChange={event => setPriority(event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
            <button><Plus size={14} /> Add</button>
          </form>
          <div className="ap-kanban">
            {columns.map(column => {
              const entries = tasks.filter(task => (task.status || 'todo') === column.id);
              return (
                <section key={column.id}>
                  <h3><column.icon size={14} />{column.label}<span>{entries.length}</span></h3>
                  {entries.map(task => (
                    <article key={task.id}>
                      <div><strong>{task.title}</strong><button title="Delete" onClick={() => removeTask(task)}><Trash2 size={12} /></button></div>
                      {task.description && <p>{task.description}</p>}
                      <footer><small>{task.priority || 'medium'}</small>{column.id !== 'done' && <button onClick={() => updateStatus(task, column.id === 'todo' ? 'in_progress' : 'done')}><ArrowRight size={13} /></button>}</footer>
                    </article>
                  ))}
                  {!entries.length && <em>No tasks</em>}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
