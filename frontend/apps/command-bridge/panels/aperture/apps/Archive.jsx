import React, { useEffect, useState } from 'react';
import { Archive, Clock, Search } from 'lucide-react';
import somaBackend from '../../../somaBackend';

export default function ArchiveApp() {
  const [files, setFiles] = useState([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    somaBackend.fetch('/api/archive/list').then(response => {
      const items = response.files || [];
      setFiles(items);
      setSelected(items[0] || null);
    }).catch(err => setError(err.message));
  }, []);

  const filtered = files.filter(file => file.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="ap-archive-app">
      <header><Archive size={17} /><strong>Stored Archive</strong><label><Search size={14} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Filter archived files" /></label></header>
      <div>
        <aside>
          {filtered.map(file => <button key={file} className={selected === file ? 'selected' : ''} onClick={() => setSelected(file)}><Clock size={13} />{file}</button>)}
          {!filtered.length && <p>No stored archive entries found.</p>}
        </aside>
        <section>
          {selected ? <><h2>{selected}</h2><p>This is a persisted archive artifact in SOMA's vault. Restore actions are not exposed because no verified restore contract exists.</p><small>Use Reflections or Files to review editable material.</small></> : <div className="ap-empty">Select an archive entry.</div>}
          {error && <p className="ap-inline-error">{error}</p>}
        </section>
      </div>
    </div>
  );
}
