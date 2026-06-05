
// ── Keyboard shortcut overlay ─────────────────────────────────
function ShortcutOverlay({ onClose }) {
  const sections = [
    { label:'Editor', items:[
      { desc:'Save file',         keys:['Ctrl','S']      },
      { desc:'Command palette',   keys:['Ctrl','K']      },
      { desc:'Close tab',         keys:['Ctrl','W']      },
      { desc:'Shortcuts',         keys:['?']             },
      { desc:'Find in file',      keys:['Ctrl','F']      },
      { desc:'Go to line',        keys:['Ctrl','G']      },
    ]},
    { label:'MAX Chat', items:[
      { desc:'Send message',      keys:['Enter']         },
      { desc:'New line',          keys:['Shift','Enter'] },
      { desc:'Swarm mode',        keys:['Ctrl','Shift','S']},
      { desc:'History up/down',   keys:['↑','↓']        },
      { desc:'Slash commands',    keys:['/']             },
    ]},
    { label:'Terminal', items:[
      { desc:'Run command',       keys:['Enter']         },
      { desc:'Clear terminal',    keys:['Ctrl','L']      },
      { desc:'History up',        keys:['↑']            },
      { desc:'History down',      keys:['↓']            },
    ]},
    { label:'IDE', items:[
      { desc:'Toggle sidebar',    keys:['Ctrl','B']      },
      { desc:'Toggle terminal',   keys:['Ctrl','J']      },
      { desc:'Preview mode',      keys:['Ctrl','P']      },
      { desc:'Accept all changes',keys:['Ctrl','Enter']  },
      { desc:'Reject all changes',keys:['Ctrl','Backspace']},
    ]},
  ];
  return (
    <div className="shortcut-overlay" onClick={onClose}>
      <div className="shortcut-box" onClick={e=>e.stopPropagation()}>
        <h2>{ICONS.settings} Keyboard Shortcuts <span style={{marginLeft:'auto',fontSize:11,color:'var(--muted)',fontWeight:400}}>press ? to toggle</span></h2>
        <div className="sc-grid">
          {sections.map(s=>(
            <div key={s.label} className="sc-section">
              <div className="sc-section-label">{s.label}</div>
              {s.items.map(item=>(
                <div key={item.desc} className="sc-row">
                  <span className="sc-desc">{item.desc}</span>
                  <div className="sc-keys">{item.keys.map(k=><span key={k} className="sc-key">{k}</span>)}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Diff viewer (Monaco diff editor) ─────────────────────────
function DiffViewer({ fileName, original, modified, onAccept, onReject, onClose }) {
  const containerRef = React.useRef(null);
  const diffEditorRef = React.useRef(null);

  React.useEffect(() => {
    ensureMonaco(() => {
      if (!containerRef.current) return;
      const originalModel  = window.monaco.editor.createModel(original  || '', getMonacoLanguage(fileName));
      const modifiedModel  = window.monaco.editor.createModel(modified  || '', getMonacoLanguage(fileName));
      const diffEditor = window.monaco.editor.createDiffEditor(containerRef.current, {
        theme: 'maxwell-dark',
        fontSize: 13,
        fontFamily: "'JetBrains Mono', monospace",
        readOnly: true,
        renderSideBySide: true,
        ignoreTrimWhitespace: false,
        scrollBeyondLastLine: false,
        minimap: { enabled: false },
      });
      diffEditor.setModel({ original: originalModel, modified: modifiedModel });
      diffEditorRef.current = diffEditor;
    });
    return () => { if (diffEditorRef.current) diffEditorRef.current.dispose(); };
  }, [fileName, original, modified]);

  return (
    <div className="diff-overlay" onClick={onClose}>
      <div className="diff-box" onClick={e=>e.stopPropagation()}>
        <div className="diff-header">
          <span style={{display:'flex'}}>{ICONS.diff}</span>
          <span className="diff-title">Diff — {fileName}</span>
          <div style={{fontSize:11,color:'var(--muted)',display:'flex',gap:12}}>
            <span style={{color:'var(--red)'}}>─ original</span>
            <span style={{color:'var(--green)'}}>+ proposed</span>
          </div>
          <div className="diff-actions">
            <button className="cb-accept-all" onClick={onAccept}>Accept</button>
            <button className="cb-reject-all" onClick={onReject}>Reject</button>
            <button className="sb-icon-btn" onClick={onClose} style={{display:'flex'}}>{ICONS.close}</button>
          </div>
        </div>
        <div className="diff-body" ref={containerRef}/>
      </div>
    </div>
  );
}

// ── Enhanced status bar ───────────────────────────────────────
function StatusBar({ connected, maxStatus, goals, activeTab, saveStatus, gitBranch,
                     onClickGit, onClickGoals, onClickLang, onClickShortcuts,
                     onClickMemory, onClickErrors, problemCount, persona }) {
  const lang = activeTab ? getMonacoLanguage(activeTab).toUpperCase() : '';
  const langLabel = lang === 'TYPESCRIPT' ? 'TypeScript' : lang === 'JAVASCRIPT' ? 'JavaScript' : lang || '—';
  const tension = maxStatus.tension || 0;
  const tensionColor = tension > .8 ? 'var(--red)' : tension > .5 ? 'var(--amber)' : 'var(--green)';

  return (
    <div className="statusbar" style={{padding:'0 4px'}}>
      {/* Left: git + errors */}
      <div className="sb-item" onClick={onClickGit} style={{display:'flex',alignItems:'center',gap:4,padding:'0 8px',height:22}}>
        <span style={{display:'flex'}}>{ICONS.git}</span>
        <span>{gitBranch||'main'}</span>
      </div>
      <div className="sb-sep-v"/>
      <div className="sb-item" onClick={onClickErrors} style={{display:'flex',alignItems:'center',gap:4,padding:'0 8px',height:22}}>
        <span style={{display:'flex',color:problemCount>0?'var(--red)':'var(--green)'}}>{ICONS.warning}</span>
        <span>{problemCount} problems</span>
      </div>
      <div className="sb-sep-v"/>
      {/* Goals */}
      <div className="sb-item" onClick={onClickGoals} style={{display:'flex',alignItems:'center',gap:5,padding:'0 8px',height:22}}>
        <span style={{display:'flex'}}>{ICONS.target}</span>
        <span>{goals.length} goals</span>
        {goals.length>0 && <span className="goals-badge">{goals.length}</span>}
      </div>
      <div className="sb-sep-v"/>
      {/* Tension */}
      <div className="sb-item no-click" style={{display:'flex',alignItems:'center',gap:5,padding:'0 8px',height:22}}>
        <div style={{width:42,height:4,background:'rgba(255,255,255,.15)',borderRadius:2,overflow:'hidden'}}>
          <div style={{width:(tension*100)+'%',height:'100%',background:tensionColor,borderRadius:2,transition:'width .8s'}}/>
        </div>
        <span style={{fontSize:10,color:'rgba(255,255,255,.6)'}}>tension</span>
      </div>
      {/* Save status */}
      {saveStatus && (
        <>
          <div className="sb-sep-v"/>
          <div className="sb-item no-click" style={{display:'flex',alignItems:'center',gap:4,padding:'0 8px',height:22,color:saveStatus==='saved'?'rgba(16,185,129,.9)':'rgba(245,158,11,.9)'}}>
            {saveStatus==='saving' ? <><span className="term-spinner">◌</span> saving…</> : <>✓ saved</>}
          </div>
        </>
      )}

      <div style={{flex:1}}/>

      {/* Right: memory, lang, shortcuts, connection */}
      <div className="sb-item" onClick={onClickMemory} style={{display:'flex',alignItems:'center',gap:4,padding:'0 8px',height:22}}>
        <span>🧠</span>
        <span>{maxStatus.memoryCount||0} mem</span>
      </div>
      <div className="sb-sep-v"/>
      <div className="sb-item" onClick={onClickLang} style={{display:'flex',alignItems:'center',gap:4,padding:'0 8px',height:22}}>
        <span>{activeTab ? <span style={{display:'flex'}}>{fileIcon(activeTab)}</span> : null}</span>
        <span className="sb-lang">{langLabel}</span>
      </div>
      <div className="sb-sep-v"/>
      <div className="sb-item" onClick={onClickShortcuts} style={{display:'flex',alignItems:'center',gap:4,padding:'0 8px',height:22}} title="Keyboard shortcuts (?)">
        <span style={{fontFamily:'var(--mono)',fontSize:11}}>?</span>
      </div>
      <div className="sb-sep-v"/>
      <div className="sb-item no-click" style={{display:'flex',alignItems:'center',gap:5,padding:'0 8px',height:22}}>
        <div style={{width:6,height:6,borderRadius:'50%',background:connected?'rgba(16,185,129,.9)':'rgba(107,107,130,.6)',flexShrink:0}}/>
        <span style={{fontSize:11}}>{connected?'MAX live':'MAX offline'}</span>
      </div>
    </div>
  );
}
