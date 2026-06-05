
// ── Model config ────────────────────────────────────────────────
const MODEL_TIERS = [
  {
    id:'fast', icon:'⚡', label:'Fast', color:'var(--blue)',
    desc:'Instant responses, background tasks',
    models:[
      { id:'qwen3:1.5b',  name:'Qwen 3 1.5B',   provider:'ollama', size:'1.0 GB', badge:'free'  },
      { id:'llama3.2',    name:'Llama 3.2 3B',   provider:'ollama', size:'2.0 GB', badge:'free'  },
      { id:'gemma3:4b',   name:'Gemma 3 4B',     provider:'ollama', size:'2.5 GB', badge:'free'  },
    ]
  },
  {
    id:'smart', icon:'◎', label:'Smart', color:'var(--accent2)',
    desc:'Deep reasoning, complex tasks',
    models:[
      { id:'qwen3:8b',          name:'Qwen 3 8B',        provider:'ollama',  size:'5.2 GB', badge:'free'   },
      { id:'deepseek-reasoner', name:'DeepSeek R1',       provider:'deepseek',size:null,     badge:'smart'  },
      { id:'gpt-4o-mini',       name:'GPT-4o Mini',       provider:'openai',  size:null,     badge:'fast'   },
      { id:'claude-haiku',      name:'Claude 3.5 Haiku',  provider:'anthropic',size:null,    badge:'fast'   },
    ]
  },
  {
    id:'code', icon:'◆', label:'Code', color:'var(--amber)',
    desc:'Specialized for code generation',
    models:[
      { id:'deepseek-coder-v2', name:'DeepSeek Coder V2', provider:'deepseek', size:null,    badge:'smart'  },
      { id:'gpt-4o',            name:'GPT-4o',             provider:'openai',   size:null,    badge:'smart'  },
      { id:'qwen2.5-coder:7b',  name:'Qwen 2.5 Coder 7B', provider:'ollama',   size:'4.7 GB',badge:'free'   },
    ]
  },
  {
    id:'genius', icon:'◈', label:'Genius', color:'var(--pink)',
    desc:'Maximum capability, uses most credits',
    models:[
      { id:'o3',             name:'OpenAI o3',       provider:'openai',    size:null, badge:'genius' },
      { id:'claude-opus-4',  name:'Claude Opus 4',   provider:'anthropic', size:null, badge:'genius' },
      { id:'deepseek-r1-full',name:'DeepSeek R1 Full',provider:'deepseek', size:null, badge:'genius' },
    ]
  },
];

const BADGE_CREDITS = { free:0, fast:1, smart:3, genius:10 };
const PROVIDER_COLORS = { ollama:'#10b981', deepseek:'#60a5fa', openai:'#a78bfa', anthropic:'#f472b6' };

// ── Model picker dropdown ─────────────────────────────────────
function ModelPicker({ selectedTier, selectedModel, onSelect, credits }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const tier = MODEL_TIERS.find(t => t.id === selectedTier) || MODEL_TIERS[1];
  const model = tier.models.find(m => m.id === selectedModel) || tier.models[0];
  const used = credits.used; const total = credits.total;
  const pct = Math.min(100, (used/total)*100);

  React.useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{position:'relative'}}>
      <div className="model-pill" onClick={() => setOpen(o => !o)}>
        <span className="mp-tier" style={{color:tier.color}}>{tier.icon} {tier.label}</span>
        <span className="mp-name">{model.name}</span>
        <span className="mp-caret">▾</span>
      </div>
      {open && (
        <div className="model-dropdown">
          {MODEL_TIERS.map(t => (
            <div key={t.id} className="md-section">
              <div className="md-section-label" style={{color:t.color}}>{t.icon} {t.label} — {t.desc}</div>
              {t.models.map(m => (
                <div key={m.id} className={`md-row ${selectedModel===m.id?'active':''}`}
                  onClick={() => { onSelect(t.id, m.id); setOpen(false); }}>
                  <div className="mr-icon" style={{color:PROVIDER_COLORS[m.provider]||'var(--muted)'}}>
                    {m.provider==='ollama'?'◉':m.provider==='deepseek'?'◈':m.provider==='openai'?'◎':'◆'}
                  </div>
                  <div className="mr-info">
                    <div className="mr-name">{m.name}</div>
                    <div className="mr-desc">{m.provider}{m.size?' · '+m.size:' · cloud API'}</div>
                  </div>
                  <span className={`mr-badge badge-${m.badge}`}>{m.badge==='free'?'FREE':BADGE_CREDITS[m.badge]+'cr'}</span>
                </div>
              ))}
            </div>
          ))}
          <div className="md-credits-bar">
            <div className="mcb-row">
              <span className="mcb-label">Credits this month</span>
              <span className="mcb-val">{used.toLocaleString()} / {total.toLocaleString()}</span>
            </div>
            <div className="mcb-track">
              <div className="mcb-fill" style={{width:pct+'%',background:pct>80?'var(--red)':pct>60?'var(--amber)':'var(--accent)'}}/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Settings modal ────────────────────────────────────────────
function SettingsModal({ onClose, maxUrl, setMaxUrl }) {
  const [tab, setTab] = React.useState('models');
  const [draft, setDraft] = React.useState(maxUrl);
  const [keys, setKeys] = React.useState({ deepseek:'', openai:'', anthropic:'' });
  const [pulling, setPulling] = React.useState({});
  const [installed, setInstalled] = React.useState({ 'llama3.2':true, 'qwen3:1.5b':true });
  const [fontSize, setFontSize] = React.useState(13);

  const localModels = MODEL_TIERS.flatMap(t => t.models.filter(m => m.provider==='ollama'));

  const pullModel = (id) => {
    setPulling(p => ({...p, [id]:true}));
    setTimeout(() => {
      setPulling(p => ({...p, [id]:false}));
      setInstalled(i => ({...i, [id]:true}));
    }, 2500);
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.65)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}>
      <div style={{background:'var(--s2)',border:'1px solid var(--border)',borderRadius:12,padding:'24px 28px',width:480,maxHeight:'80vh',overflow:'auto',boxShadow:'0 8px 40px rgba(0,0,0,.6)'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:700,letterSpacing:.5,display:'flex',alignItems:'center',gap:8}}>
            <span style={{display:'flex'}}>{ICONS.settings}</span> Settings
          </div>
          <button style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',display:'flex'}} onClick={onClose}>{ICONS.close}</button>
        </div>

        <div className="settings-tabs">
          {['models','api keys','usage','general'].map(t => (
            <div key={t} className={`stab ${tab===t?'active':''}`} onClick={()=>setTab(t)}
              style={{textTransform:'capitalize'}}>{t}</div>
          ))}
        </div>

        {tab === 'models' && (
          <div>
            <div className="settings-section">
              <div className="ss-label">Local Models (Ollama)</div>
              <div style={{background:'var(--s3)',border:'1px solid var(--border)',borderRadius:8,padding:'8px 12px',marginBottom:10,fontSize:11.5,color:'var(--muted)',display:'flex',alignItems:'center',gap:6}}>
                <span style={{color:'var(--green)'}}>◉</span> Ollama runs models locally — free, private, no API key needed.
              </div>
              {localModels.map(m => {
                const isInstalled = !!installed[m.id];
                const isPulling = !!pulling[m.id];
                return (
                  <div key={m.id} className="model-local-row">
                    <span className="mlr-name">{m.id}</span>
                    <span style={{color:'var(--muted)',fontSize:11}}>{m.name}</span>
                    <span className="mlr-size">{m.size}</span>
                    <button className={`mlr-pull ${isPulling?'pulling':isInstalled?'installed':'available'}`}
                      onClick={()=>!isInstalled&&!isPulling&&pullModel(m.id)}>
                      {isPulling?'Pulling…':isInstalled?'✓ Installed':'Pull'}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="settings-section">
              <div className="ss-label">MAX API URL</div>
              <div className="settings-input-row">
                <input className="settings-input" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="http://localhost:3100"/>
                <button onClick={()=>setMaxUrl(draft)} style={{padding:'5px 14px',background:'var(--accent)',border:'none',color:'#fff',borderRadius:5,fontWeight:600,fontSize:12,cursor:'pointer',flexShrink:0}}>Save</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'api keys' && (
          <div>
            {[
              {id:'deepseek',label:'DeepSeek',  url:'platform.deepseek.com', color:'#60a5fa', note:'deepseek-reasoner, deepseek-coder-v2'},
              {id:'openai',  label:'OpenAI',    url:'platform.openai.com',   color:'#a78bfa', note:'gpt-4o, o3, gpt-4o-mini'},
              {id:'anthropic',label:'Anthropic',url:'console.anthropic.com', color:'#f472b6', note:'claude-opus-4, claude-haiku'},
            ].map(p => (
              <div key={p.id} className="settings-section">
                <div className="ss-label" style={{display:'flex',alignItems:'center',gap:6}}>
                  <div className="key-status" style={{background:keys[p.id]?'var(--green)':'var(--muted2)'}}/>
                  {p.label}
                  <span style={{marginLeft:'auto',fontSize:10,color:'var(--muted2)',textTransform:'none',letterSpacing:0}}>{p.note}</span>
                </div>
                <div className="settings-input-row">
                  <input type="password" className="settings-input" value={keys[p.id]}
                    onChange={e=>setKeys(k=>({...k,[p.id]:e.target.value}))}
                    placeholder={`${p.id === 'deepseek' ? 'sk-...' : p.id === 'openai' ? 'sk-proj-...' : 'sk-ant-...'}`}
                    style={{color:keys[p.id]?'var(--green)':'var(--text)'}}
                  />
                  <button style={{padding:'5px 12px',background:'transparent',border:'1px solid var(--border)',color:'var(--muted)',borderRadius:5,fontSize:11,cursor:'pointer',flexShrink:0,transition:'all .15s'}}
                    onClick={()=>window.open('https://'+p.url,'_blank')}>Get key ↗</button>
                </div>
              </div>
            ))}
            <div style={{fontSize:11,color:'var(--muted)',lineHeight:1.7,padding:'8px 0',borderTop:'1px solid var(--border)'}}>
              Keys are stored locally and sent only to MAX running on your machine. They are never transmitted externally by this interface.
            </div>
          </div>
        )}

        {tab === 'usage' && (
          <div>
            <div className="usage-bar-wrap">
              <div className="usage-bar-label">
                <span style={{color:'var(--muted)'}}>Credits used this month</span>
                <span style={{color:'var(--text)',fontFamily:'var(--mono)',fontWeight:600}}>2,847 / 10,000</span>
              </div>
              <div className="usage-track">
                <div className="usage-fill" style={{width:'28.47%',background:'var(--accent)'}}/>
              </div>
            </div>
            <div className="settings-section">
              <div className="ss-label">Breakdown by model tier</div>
              <div className="usage-breakdown">
                {[
                  {label:'Fast (local)',  credits:0,    color:'var(--blue)',    pct:0    },
                  {label:'Smart',         credits:1240,  color:'var(--accent2)', pct:43.5 },
                  {label:'Code',          credits:890,   color:'var(--amber)',   pct:31.3 },
                  {label:'Genius',        credits:717,   color:'var(--pink)',    pct:25.2 },
                ].map(r => (
                  <div key={r.label} className="ub-row">
                    <div className="ub-dot" style={{background:r.color}}/>
                    <span className="ub-name">{r.label}</span>
                    <div style={{flex:2,height:4,background:'var(--s4)',borderRadius:2,overflow:'hidden',margin:'0 8px'}}>
                      <div style={{width:r.pct+'%',height:'100%',background:r.color,borderRadius:2}}/>
                    </div>
                    <span className="ub-val">{r.credits.toLocaleString()} cr</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="settings-section">
              <div className="ss-label">Plan</div>
              <div style={{background:'var(--aglow)',border:'1px solid rgba(124,58,237,.3)',borderRadius:8,padding:'12px 14px',display:'flex',alignItems:'center',gap:12}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,marginBottom:2}}>SOMA Pro</div>
                  <div style={{fontSize:11.5,color:'var(--muted)'}}>10,000 credits/month · Unlimited local models</div>
                </div>
                <div style={{fontSize:14,fontWeight:800,color:'var(--accent2)'}}>$20/mo</div>
              </div>
            </div>
          </div>
        )}

        {tab === 'general' && (
          <div>
            <div className="settings-section">
              <div className="ss-label">Editor</div>
              <div className="ss-row">
                <span className="ss-key">Font size</span>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <button style={{width:24,height:24,border:'1px solid var(--border)',background:'var(--s3)',color:'var(--text)',borderRadius:4,cursor:'pointer'}} onClick={()=>setFontSize(f=>Math.max(10,f-1))}>−</button>
                  <span style={{fontFamily:'var(--mono)',fontSize:12,width:24,textAlign:'center'}}>{fontSize}</span>
                  <button style={{width:24,height:24,border:'1px solid var(--border)',background:'var(--s3)',color:'var(--text)',borderRadius:4,cursor:'pointer'}} onClick={()=>setFontSize(f=>Math.min(20,f+1))}>+</button>
                </div>
              </div>
              <div className="ss-row">
                <span className="ss-key">Tab size</span>
                <select style={{background:'var(--s3)',border:'1px solid var(--border)',color:'var(--text)',padding:'3px 6px',borderRadius:4,fontSize:12,outline:'none'}}>
                  <option>2 spaces</option><option>4 spaces</option><option>Tabs</option>
                </select>
              </div>
              <div className="ss-row">
                <span className="ss-key">Word wrap</span>
                <select style={{background:'var(--s3)',border:'1px solid var(--border)',color:'var(--text)',padding:'3px 6px',borderRadius:4,fontSize:12,outline:'none'}}>
                  <option>Off</option><option>On</option><option>At 80 chars</option>
                </select>
              </div>
            </div>
            <div className="settings-section">
              <div className="ss-label">MAX Behavior</div>
              <div className="ss-row">
                <span className="ss-key">Auto-approve level</span>
                <select style={{background:'var(--s3)',border:'1px solid var(--border)',color:'var(--text)',padding:'3px 6px',borderRadius:4,fontSize:12,outline:'none'}}>
                  <option>read</option><option>write</option><option>all</option>
                </select>
              </div>
              <div className="ss-row">
                <span className="ss-key">Show tool calls</span>
                <select style={{background:'var(--s3)',border:'1px solid var(--border)',color:'var(--text)',padding:'3px 6px',borderRadius:4,fontSize:12,outline:'none'}}>
                  <option>Always</option><option>Compact</option><option>Hidden</option>
                </select>
              </div>
              <div className="ss-row">
                <span className="ss-key">Heartbeat / autonomous loop</span>
                <select style={{background:'var(--s3)',border:'1px solid var(--border)',color:'var(--text)',padding:'3px 6px',borderRadius:4,fontSize:12,outline:'none'}}>
                  <option>Enabled</option><option>Disabled</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
