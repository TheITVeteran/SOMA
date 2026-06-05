import React, { useEffect, useState } from 'react';
import { FileText, Link2, Plus, Save, Trash2 } from 'lucide-react';
import somaBackend from '../../../somaBackend';

export default function NotesApp() {
  const [notes, setNotes] = useState([]);
  const [active, setActive] = useState(null);
  const [content, setContent] = useState('');
  const [links, setLinks] = useState({ backlinks: [], outgoing: [] });
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');

  const loadNotes = async selectedName => {
    const response = await somaBackend.fetch('/api/reflections/list');
    const list = response.notes || [];
    setNotes(list);
    const selected = list.find(note => note.name === selectedName) || list[0] || null;
    if (selected) await selectNote(selected);
    else { setActive(null); setContent(''); }
  };

  const selectNote = async note => {
    try {
      const [body, graph] = await Promise.all([
        somaBackend.fetch(`/api/reflections/note/${encodeURIComponent(note.name)}`),
        somaBackend.fetch(`/api/reflections/links/${encodeURIComponent(note.name)}`).catch(() => ({ backlinks: [], outgoing: [] }))
      ]);
      setActive(note);
      setContent(body.content || '');
      setLinks({ backlinks: graph.backlinks || [], outgoing: graph.outgoing || [] });
      setDirty(false);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { loadNotes().catch(err => setError(err.message)); }, []);

  const createNote = async () => {
    const name = `aperture-note-${Date.now()}.md`;
    const title = `New note ${new Date().toLocaleDateString()}`;
    const initial = `---\ntitle: "${title}"\ntype: note\nstatus: inbox\n---\n\n# ${title}\n\n`;
    await somaBackend.fetch('/api/reflections/note', { method: 'PUT', body: JSON.stringify({ name, content: initial }) });
    await loadNotes(name);
  };
  const save = async () => {
    if (!active) return;
    await somaBackend.fetch('/api/reflections/note', { method: 'PUT', body: JSON.stringify({ name: active.name, content }) });
    setDirty(false);
    await loadNotes(active.name);
  };
  const remove = async () => {
    if (!active) return;
    await somaBackend.fetch(`/api/reflections/note/${encodeURIComponent(active.name)}`, { method: 'DELETE' });
    await loadNotes();
  };

  return (
    <div className="ap-notes-app">
      <aside>
        <header><span>Reflections</span><button onClick={createNote}><Plus size={14} /></button></header>
        {notes.map(note => <button key={note.name} className={active?.name === note.name ? 'selected' : ''} onClick={() => selectNote(note)}><FileText size={14} /><span>{note.title}</span></button>)}
        {!notes.length && <p>No reflection notes yet.</p>}
      </aside>
      <section>
        {active ? (
          <>
            <header><div><strong>{active.title}</strong><small>{active.type || 'note'}{dirty ? ' - Unsaved' : ''}</small></div><button onClick={remove} className="quiet"><Trash2 size={14} /></button><button onClick={save}><Save size={14} />Save</button></header>
            <textarea value={content} onChange={event => { setContent(event.target.value); setDirty(true); }} />
          </>
        ) : <div className="ap-empty">Create a note to begin writing in Reflections.</div>}
      </section>
      <aside className="links">
        <h3><Link2 size={13} />Connections</h3>
        <label>Backlinks</label>
        {links.backlinks.map(link => { const label = typeof link === 'string' ? link : (link.title || link.name); return <p key={label}>{label}</p>; })}
        {!links.backlinks.length && <em>None yet</em>}
        <label>Outgoing</label>
        {links.outgoing.map(link => { const label = typeof link === 'string' ? link : (link.title || link.name); return <p key={label}>{label}</p>; })}
        {!links.outgoing.length && <em>None yet</em>}
      </aside>
      {error && <div className="ap-inline-error">{error}</div>}
    </div>
  );
}
