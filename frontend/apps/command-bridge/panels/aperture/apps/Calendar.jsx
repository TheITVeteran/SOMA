import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock, Plus, Trash2 } from 'lucide-react';
import somaBackend from '../../../somaBackend';

export default function CalendarApp({ workspace }) {
  const [events, setEvents] = useState([]);
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState(() => new Date(Date.now() + 3600000).toISOString().slice(0, 16));
  const month = useMemo(() => new Date(), []);

  const load = async () => {
    const suffix = workspace?.id ? `?workspaceId=${encodeURIComponent(workspace.id)}` : '';
    const response = await somaBackend.fetch(`/api/aperture/calendar${suffix}`);
    setEvents(response.events || []);
  };
  useEffect(() => { load().catch(() => setEvents([])); }, [workspace?.id]);

  const add = async event => {
    event.preventDefault();
    if (!title.trim()) return;
    await somaBackend.fetch('/api/aperture/calendar', {
      method: 'POST',
      body: JSON.stringify({ title: title.trim(), startsAt, workspaceId: workspace?.id || null, workspaceName: workspace?.name || 'Personal' })
    });
    setTitle('');
    await load();
  };
  const remove = async id => {
    await somaBackend.fetch(`/api/aperture/calendar/${id}`, { method: 'DELETE' });
    await load();
  };

  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const dated = new Set(events.map(item => new Date(item.startsAt).getDate()));

  return (
    <div className="ap-calendar-app">
      <section>
        <header><CalendarDays size={18} /><strong>{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</strong></header>
        <div className="ap-calendar-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <b key={day}>{day}</b>)}
          {Array.from({ length: firstDay }, (_, index) => <i key={`blank-${index}`} />)}
          {Array.from({ length: days }, (_, index) => <span key={index + 1} className={dated.has(index + 1) ? 'has-event' : ''}>{index + 1}</span>)}
        </div>
      </section>
      <aside>
        <h3>{workspace?.name || 'Personal'} Schedule</h3>
        <form onSubmit={add}>
          <input required value={title} onChange={event => setTitle(event.target.value)} placeholder="Event title" />
          <input type="datetime-local" value={startsAt} onChange={event => setStartsAt(event.target.value)} required />
          <button><Plus size={14} /> Add event</button>
        </form>
        <div className="ap-events">
          {events.map(item => <article key={item.id}><div><strong>{item.title}</strong><span><Clock size={11} />{new Date(item.startsAt).toLocaleString()}</span></div><button onClick={() => remove(item.id)}><Trash2 size={13} /></button></article>)}
          {!events.length && <p>No scheduled events in this workspace.</p>}
        </div>
      </aside>
    </div>
  );
}
