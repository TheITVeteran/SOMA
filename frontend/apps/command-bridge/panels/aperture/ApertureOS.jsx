import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, Bell, CalendarDays, ClipboardCheck, Globe2, Library,
  MonitorCog, NotebookPen, Folder, Search, Shield, SlidersHorizontal,
  Sparkles, TerminalSquare, Wifi, X, CheckCircle, AlertTriangle, Info,
  Zap, Moon, Sun, Layers, ChevronRight, Lock, RefreshCw, FileText,
  Plus, Trash2, Edit3
} from 'lucide-react';
import somaBackend from '../../somaBackend';
import kernel from './kernel/ApertureKernel';
import LockScreen, { loadSavedPin, PIN_KEY } from './LockScreen';
import './ApertureOS.css';

const FileManager   = lazy(() => import('./apps/Files'));
const PortalBrowser = lazy(() => import('./apps/Portal'));
const SettingsApp   = lazy(() => import('./apps/Settings'));
const SystemStatus  = lazy(() => import('./apps/SystemStatus'));
const TaskManager   = lazy(() => import('./apps/Tasks'));
const CalendarApp   = lazy(() => import('./apps/Calendar'));
const NotesApp      = lazy(() => import('./apps/Notes'));
const ArchiveApp    = lazy(() => import('./apps/Archive'));
const TerminalApp   = lazy(() => import('./apps/Terminal'));
const ProcessViewer = lazy(() => import('./apps/ProcessViewer'));

const APPS = {
  files:     { name: 'Files',       icon: Folder,           accent: 'blue',   component: FileManager },
  portal:    { name: 'Portal',      icon: Globe2,           accent: 'cyan',   component: PortalBrowser },
  tasks:     { name: 'Tasks',       icon: ClipboardCheck,   accent: 'green',  component: TaskManager },
  notes:     { name: 'Notes',       icon: NotebookPen,      accent: 'amber',  component: NotesApp },
  calendar:  { name: 'Calendar',    icon: CalendarDays,     accent: 'rose',   component: CalendarApp },
  status:    { name: 'System Info', icon: MonitorCog,       accent: 'violet', component: SystemStatus },
  archive:   { name: 'Archive',     icon: Library,          accent: 'indigo', component: ArchiveApp },
  settings:  { name: 'Settings',    icon: SlidersHorizontal,accent: 'slate',  component: SettingsApp },
  terminal:  { name: 'Terminal',    icon: TerminalSquare,   accent: 'green',  component: TerminalApp },
  processes: { name: 'Processes',   icon: Activity,         accent: 'violet', component: ProcessViewer },
};

const APP_ICONS = {
  files: '/assets/aperture/icons/files.png',
  portal: '/assets/aperture/icons/portal.png',
  tasks: '/assets/aperture/icons/tasks.png',
  notes: '/assets/aperture/icons/notes.png',
  calendar: '/assets/aperture/icons/calendar.png',
  status: '/assets/aperture/icons/status.png',
  archive: '/assets/aperture/icons/archive.png',
  settings: '/assets/aperture/icons/settings.png',
  terminal: '/assets/aperture/icons/terminal.png',
  processes: '/assets/aperture/icons/processes.png',
};

const defaultSettings = {
  theme: 'graphite', wallpaper: 'alpine', wallpaperUrl: '',
  activeWorkspaceId: null, autonomyLevel: 2,
  permissions: { fileRead: true, networkAccess: true, memoryWrite: true, somaReasoning: true },
  notificationsEnabled: true,
};

const SESSION_KEY  = 'aperture.session.windows.v2';
const ICONS_KEY    = 'aperture.desktop.icons.v2';
const WIDGETS_KEY  = 'aperture.widgets.v1';
const IDLE_MS      = 5 * 60 * 1000;

const DEFAULT_WIDGETS = [
  { id: 'w-clock',  type: 'clock',  x: 16, y: 16,  visible: true  },
  { id: 'w-system', type: 'system', x: 16, y: 160, visible: true  },
  { id: 'w-soma',   type: 'soma',   x: 16, y: 312, visible: false },
];
function loadWidgets() { try { return JSON.parse(localStorage.getItem(WIDGETS_KEY) || 'null') || DEFAULT_WIDGETS; } catch { return DEFAULT_WIDGETS; } }
function saveWidgets(w) { try { localStorage.setItem(WIDGETS_KEY, JSON.stringify(w)); } catch {} }

// ─── Snap logic ─────────────────────────────────────────────────────────────

const SNAP_EDGE = 24;
function getSnapZone(cx, cy, desktop) {
  if (!desktop) return null;
  const r = desktop.getBoundingClientRect();
  const nearL = cx - r.left   < SNAP_EDGE;
  const nearR = r.right - cx  < SNAP_EDGE;
  const nearT = cy - r.top    < SNAP_EDGE;
  if (nearT && nearL) return 'tl';
  if (nearT && nearR) return 'tr';
  if (nearT)          return 'max';
  if (nearL)          return 'left';
  if (nearR)          return 'right';
  return null;
}
function snapDimensions(zone, desktop) {
  if (!desktop) return null;
  const r = desktop.getBoundingClientRect();
  const W = r.width, H = r.height, hw = Math.floor(W / 2), hh = Math.floor(H / 2);
  return ({ left: { x:0,y:0,width:hw,height:H }, right: { x:hw,y:0,width:W-hw,height:H }, max: { x:0,y:0,width:W,height:H,maximized:true }, tl: { x:0,y:0,width:hw,height:hh }, tr: { x:hw,y:0,width:W-hw,height:hh } })[zone] || null;
}

// ─── localStorage helpers ────────────────────────────────────────────────────

function loadIcons() {
  try { return JSON.parse(localStorage.getItem(ICONS_KEY) || '[]'); } catch { return []; }
}
function saveIcons(icons) {
  localStorage.setItem(ICONS_KEY, JSON.stringify(icons));
}

// ─── Context Menu ────────────────────────────────────────────────────────────

function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x, y });

  useEffect(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({
      x: Math.min(x, window.innerWidth  - r.width  - 6),
      y: Math.min(y, window.innerHeight - r.height - 6),
    });
  }, []); // eslint-disable-line

  useEffect(() => {
    const close = () => onClose();
    document.addEventListener('mousedown', close, true);
    document.addEventListener('contextmenu', close, true);
    return () => {
      document.removeEventListener('mousedown', close, true);
      document.removeEventListener('contextmenu', close, true);
    };
  }, [onClose]);

  return (
    <div className="ap-ctx-menu" ref={ref} style={{ left: pos.x, top: pos.y }}>
      {items.map((item, i) =>
        item.separator ? <div key={i} className="ap-ctx-sep" /> :
        item.header    ? <div key={i} className="ap-ctx-header">{item.label}</div> :
        <button
          key={i}
          className={item.danger ? 'danger' : ''}
          disabled={item.disabled}
          onMouseDown={e => { e.stopPropagation(); item.action(); onClose(); }}
        >
          {item.icon && <item.icon size={13} />}
          <span>{item.label}</span>
          {item.shortcut && <kbd>{item.shortcut}</kbd>}
        </button>
      )}
    </div>
  );
}

// ─── Desktop Icon ─────────────────────────────────────────────────────────────

function DesktopIcon({ icon, onOpen, onMove, onContextMenu }) {
  const drag = useRef(null);
  const AppIcon = APPS[icon.appId]?.icon || FileText;
  const accent  = APPS[icon.appId]?.accent || 'blue';

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    drag.current = { startX: e.clientX, startY: e.clientY, x: icon.x, y: icon.y, moved: false };
  };

  useEffect(() => {
    const move = (e) => {
      if (!drag.current) return;
      const dx = e.clientX - drag.current.startX;
      const dy = e.clientY - drag.current.startY;
      if (Math.abs(dx) + Math.abs(dy) > 5) drag.current.moved = true;
      if (drag.current.moved) onMove(icon.id, Math.max(0, drag.current.x + dx), Math.max(0, drag.current.y + dy));
    };
    const up = () => { drag.current = null; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [icon.id, icon.x, icon.y, onMove]);

  return (
    <div
      className={`ap-desktop-icon ap-di-${accent}`}
      style={{ left: icon.x, top: icon.y }}
      onMouseDown={handleMouseDown}
      onDoubleClick={() => onOpen(icon)}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, icon); }}
      title={icon.label}
    >
      {APP_ICONS[icon.appId] ? (
        <div className="ap-di-icon-wrap-custom">
          <img src={APP_ICONS[icon.appId]} alt="" style={{ width: 56, height: 56, objectFit: 'contain' }} />
        </div>
      ) : (
        <div className="ap-di-icon-wrap">
          <AppIcon size={24} />
        </div>
      )}
      <span className="ap-di-label">{icon.label}</span>
    </div>
  );
}

// ─── Notification Toast ───────────────────────────────────────────────────────

const NOTIF_ICON = { success: CheckCircle, warning: AlertTriangle, error: AlertTriangle, ai: Sparkles, info: Info };

function Toast({ notif, onDismiss }) {
  useEffect(() => { const t = setTimeout(onDismiss, 4500); return () => clearTimeout(t); }, [onDismiss]);
  const Icon = NOTIF_ICON[notif.type] || Info;
  return (
    <div className={`ap-toast ap-toast-${notif.type}`} onClick={onDismiss}>
      <Icon size={14} className="ap-toast-icon" />
      <div className="ap-toast-body">
        <strong>{notif.title}</strong>
        {notif.body && <span>{notif.body}</span>}
      </div>
      <button className="ap-toast-close" onClick={e => { e.stopPropagation(); onDismiss(); }}><X size={12} /></button>
      <div className="ap-toast-bar" />
    </div>
  );
}

// ─── Notification Panel ───────────────────────────────────────────────────────

function NotificationPanel({ notifications, onClose, onClear, onMarkRead }) {
  const Icon = (t) => { const I = NOTIF_ICON[t] || Info; return <I size={13} />; };
  return (
    <div className="ap-notif-panel">
      <header>
        <strong>Notifications</strong>
        <div className="ap-notif-header-actions">
          {notifications.length > 0 && <button onClick={onClear}>Clear all</button>}
          <button onClick={onClose}><X size={14} /></button>
        </div>
      </header>
      <div className="ap-notif-list">
        {!notifications.length && <div className="ap-notif-empty"><Bell size={20} /><span>No notifications</span></div>}
        {notifications.map(n => (
          <div key={n.id} className={`ap-notif-item ap-notif-${n.type} ${n.read ? 'read' : ''}`} onClick={() => onMarkRead(n.id)}>
            <span className="ap-notif-dot" />
            <div className="ap-notif-content">
              <strong>{n.title}</strong>
              {n.body && <p>{n.body}</p>}
              <time>{new Date(n.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
            </div>
            <span className="ap-notif-type-icon">{Icon(n.type)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Quick Settings Panel ─────────────────────────────────────────────────────

function QuickSettings({ settings, snapshot, pin, onUpdate, onClose, onLaunchApp, onLock }) {
  const perms = settings.permissions || {};
  const THEMES     = [['graphite','Graphite'], ['daylight','Daylight'], ['slate','Slate']];
  const WALLPAPERS = [['alpine','Alpine'], ['mist','Mist'], ['graphite','Dark']];
  const LABELS     = ['Observe', 'Assisted', 'Autonomous'];
  return (
    <div className="ap-quickset">
      <div className="ap-quickset-header"><strong>Quick Settings</strong><button onClick={onClose}><X size={14} /></button></div>
      <div className="ap-qs-soma-status">
        <Sparkles size={14} className={snapshot?.ready ? 'online' : ''} />
        <span>SOMA Brain</span>
        <strong className={snapshot?.ready ? 'ap-qs-online' : 'ap-qs-offline'}>{snapshot?.ready ? 'Online' : 'Offline'}</strong>
        {snapshot?.ready && <span className="ap-qs-model">DeepSeek</span>}
      </div>
      <div className="ap-qs-section">
        <label>Theme</label>
        <div className="ap-qs-pills">
          {THEMES.map(([id, name]) => (
            <button key={id} className={settings.theme === id ? 'active' : ''} onClick={() => onUpdate({ theme: id })}>
              {id === 'daylight' ? <Sun size={11} /> : <Moon size={11} />} {name}
            </button>
          ))}
        </div>
      </div>
      <div className="ap-qs-section">
        <label>Wallpaper</label>
        <div className="ap-qs-pills">
          {WALLPAPERS.map(([id, name]) => (
            <button key={id} className={settings.wallpaper === id ? 'active' : ''} onClick={() => onUpdate({ wallpaper: id, wallpaperUrl: '' })}>{name}</button>
          ))}
        </div>
      </div>
      <div className="ap-qs-section">
        <label>AI Autonomy — <strong>{LABELS[settings.autonomyLevel - 1]}</strong></label>
        <input type="range" min="1" max="3" value={settings.autonomyLevel} onChange={e => onUpdate({ autonomyLevel: Number(e.target.value) })} className="ap-qs-slider" />
        <div className="ap-qs-autonomy-labels"><span>Observe</span><span>Assisted</span><span>Autonomous</span></div>
      </div>
      <div className="ap-qs-section">
        <label>Permissions</label>
        <div className="ap-qs-toggles">
          {[['networkAccess',Wifi,'Network'],['somaReasoning',Sparkles,'Reasoning'],['memoryWrite',Layers,'Memory'],['fileRead',Folder,'Files']].map(([key, Icon, label]) => (
            <button key={key} className={`ap-qs-toggle ${perms[key] ? 'on' : 'off'}`} onClick={() => onUpdate({ permissions: { [key]: !perms[key] } })}>
              <Icon size={12} /><span>{label}</span>
            </button>
          ))}
        </div>
      </div>
      {snapshot && (
        <div className="ap-qs-stats">
          <div><span>CPU</span><strong>{snapshot.cpu ?? '--'}%</strong></div>
          <div><span>RAM</span><strong>{snapshot.ram ?? '--'}%</strong></div>
          <div><span>Uptime</span><strong>{snapshot.uptime ? `${Math.floor(snapshot.uptime/60)}m` : '--'}</strong></div>
        </div>
      )}
      <div className="ap-qs-shortcuts">
        <button onClick={() => { onLock(); onClose(); }}>
          <Lock size={12} /> {pin ? 'Lock Screen' : 'Set up PIN Lock'} <ChevronRight size={11} />
        </button>
        <button onClick={() => { onLaunchApp('settings'); onClose(); }}>
          <SlidersHorizontal size={12} /> All Settings <ChevronRight size={11} />
        </button>
        <button onClick={() => { onLaunchApp('terminal'); onClose(); }}>
          <TerminalSquare size={12} /> Open Terminal <ChevronRight size={11} />
        </button>
        <button onClick={() => { onLaunchApp('processes'); onClose(); }}>
          <Activity size={12} /> Process Viewer <ChevronRight size={11} />
        </button>
      </div>
    </div>
  );
}

// ─── Snap Preview ─────────────────────────────────────────────────────────────

function SnapPreview({ zone, desktop }) {
  if (!zone || !desktop) return null;
  const d = snapDimensions(zone, desktop);
  if (!d) return null;
  return <div className="ap-snap-preview" style={{ left: d.x, top: d.y, width: d.maximized ? '100%' : d.width, height: d.maximized ? '100%' : d.height }} />;
}

// ─── Boot Screen ──────────────────────────────────────────────────────────────

function BootScreen({ lines }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [lines]);
  return (
    <div className="ap-boot-screen">
      <div className="ap-boot-header"><Sparkles size={18} className="ap-boot-logo" /><span>ApertureOS</span></div>
      <div className="ap-boot-log">
        {lines.map((line, i) => (
          <div key={i} className={`ap-boot-line${!line.trim() ? ' blank' : line.startsWith('  [OK]') ? ' ok' : line.startsWith('  [WARN]') ? ' warn' : ''}`}>{line || ' '}</div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="ap-boot-status"><span className="ap-boot-blink">▋</span><span>Initializing kernel...</span></div>
    </div>
  );
}

// ─── Desktop Widgets ──────────────────────────────────────────────────────────

function DesktopWidget({ widget, snapshot, clock, onClose, onDragStart }) {
  const { type, x, y } = widget;
  return (
    <div
      className={`ap-widget ap-widget-${type}`}
      style={{ left: x, top: y }}
      onMouseDown={e => onDragStart(e, widget.id)}
    >
      <button className="ap-widget-close" onClick={e => { e.stopPropagation(); onClose(widget.id); }}><X size={9} /></button>
      {type === 'clock' && (
        <>
          <div className="ap-widget-time">{clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          <div className="ap-widget-date">{clock.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</div>
        </>
      )}
      {type === 'system' && (
        <>
          <div className="ap-widget-title">System</div>
          <div className="ap-widget-bar-row"><span>CPU</span><div className="ap-widget-bar"><div style={{ width: `${snapshot?.cpu || 0}%`, background: '#2898b4' }} /></div><em>{snapshot?.cpu ?? '--'}%</em></div>
          <div className="ap-widget-bar-row"><span>RAM</span><div className="ap-widget-bar"><div style={{ width: `${snapshot?.ram || 0}%`, background: '#5c71dd' }} /></div><em>{snapshot?.ram ?? '--'}%</em></div>
          {snapshot?.uptime != null && <div className="ap-widget-sub">Up {Math.floor(snapshot.uptime / 60)}m</div>}
        </>
      )}
      {type === 'soma' && (
        <>
          <div className="ap-widget-title"><Sparkles size={11} style={{ marginRight: 5 }} />SOMA</div>
          <div className={`ap-widget-soma-row ${snapshot?.ready ? 'online' : 'offline'}`}>
            <span className="ap-widget-dot" />{snapshot?.ready ? 'Brain Online' : 'Brain Offline'}
          </div>
          {snapshot?.ready && <div className="ap-widget-sub">DeepSeek · {snapshot.cpu ?? '--'}% cpu</div>}
        </>
      )}
    </div>
  );
}

function AppFallback() { return <div className="ap-loading">Opening application...</div>; }

// ─── Main OS ──────────────────────────────────────────────────────────────────

export default function ApertureOS() {
  const [settings, setSettings]               = useState(defaultSettings);
  const [workspaces, setWorkspaces]           = useState([]);
  const [snapshot, setSnapshot]               = useState(null);
  const [openWindows, setOpenWindows]         = useState([]);
  const [activeWindowId, setActiveWindowId]   = useState(null);
  const [launcher, setLauncher]               = useState(false);
  const [spotlight, setSpotlight]             = useState(false);
  const [query, setQuery]                     = useState('');
  const [results, setResults]                 = useState([]);
  const [clock, setClock]                     = useState(new Date());
  const [booting, setBooting]                 = useState(kernel.state !== 'running');
  const [bootLines, setBootLines]             = useState(() => kernel.bootLog.map(e => e.message));

  // Notifications
  const [toasts, setToasts]                   = useState([]);
  const [notifications, setNotifications]     = useState(() => [...kernel.notifications]);
  const [showNotifPanel, setShowNotifPanel]   = useState(false);
  const [showQuickSettings, setShowQuickSettings] = useState(false);

  // Lock screen
  const [locked, setLocked]   = useState(() => !!loadSavedPin());
  const [pin, setPin]         = useState(() => loadSavedPin());
  const lastActivity          = useRef(Date.now());

  // Context menu
  const [contextMenu, setContextMenu] = useState(null); // { x, y, items }

  // Desktop icons
  const [desktopIcons, setDesktopIcons] = useState(() => loadIcons());

  // Widgets
  const [widgets, setWidgets]   = useState(loadWidgets);
  const widgetDrag              = useRef(null);

  // Snap
  const [snapZone, setSnapZone] = useState(null);
  const desktopRef              = useRef(null);
  const nextZ                   = useRef(20);
  const drag                    = useRef(null);

  const activeWorkspace = workspaces.find(w => w.id === settings.activeWorkspaceId) || workspaces[0] || null;
  const unreadCount     = notifications.filter(n => !n.read).length;

  const closeAllOverlays = () => {
    setShowNotifPanel(false);
    setShowQuickSettings(false);
    setLauncher(false);
    setContextMenu(null);
  };

  // ─── Kernel boot ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (kernel.state === 'running') { setBooting(false); return; }
    const u1 = kernel.on('boot-log', ({ message }) => setBootLines(p => [...p, message]));
    const u2 = kernel.on('boot-complete', () => setTimeout(() => setBooting(false), 500));
    const u3 = kernel.on('exec-request', ({ appId }) => { if (APPS[appId]) launchApp(appId); });
    kernel.boot();
    return () => { u1(); u2(); u3(); };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (booting) return;
    const u1 = kernel.on('exec-request', ({ appId }) => { if (APPS[appId]) launchApp(appId); });
    const u2 = kernel.on('process-kill', ({ windowId }) => {
      if (windowId) setOpenWindows(p => p.filter(w => w.id !== windowId));
    });
    return () => { u1(); u2(); };
  }, [booting]); // eslint-disable-line

  // ─── Idle lock ────────────────────────────────────────────────────────────

  useEffect(() => {
    const resetIdle = () => { lastActivity.current = Date.now(); };
    document.addEventListener('mousemove', resetIdle, { passive: true });
    document.addEventListener('keydown', resetIdle, { passive: true });
    document.addEventListener('mousedown', resetIdle, { passive: true });
    const check = setInterval(() => {
      if (pin && !locked && Date.now() - lastActivity.current > IDLE_MS) setLocked(true);
    }, 30000);
    return () => {
      document.removeEventListener('mousemove', resetIdle);
      document.removeEventListener('keydown', resetIdle);
      document.removeEventListener('mousedown', resetIdle);
      clearInterval(check);
    };
  }, [pin, locked]);

  // ─── Notifications ────────────────────────────────────────────────────────

  useEffect(() => {
    const u1 = kernel.on('notification', n => {
      setNotifications(p => [n, ...p].slice(0, 100));
      setToasts(p => [...p, n]);
    });
    const u2 = kernel.on('notifications-cleared', () => setNotifications([]));
    return () => { u1(); u2(); };
  }, []);

  const dismissToast  = useCallback((id) => { setToasts(p => p.filter(t => t.id !== id)); kernel.markRead(id); }, []);
  const handleMarkRead = useCallback((id) => { kernel.markRead(id); setNotifications([...kernel.notifications]); }, []);
  const handleClearAll = useCallback(() => { kernel.clearNotifications(); }, []);

  // ─── Settings ─────────────────────────────────────────────────────────────

  const updateSettings = useCallback(async (patch) => {
    setSettings(p => ({ ...p, ...patch, permissions: { ...p.permissions, ...(patch.permissions || {}) } }));
    try {
      const r = await somaBackend.fetch('/api/aperture/settings', { method: 'PUT', body: JSON.stringify(patch) });
      if (r.success) setSettings(r.settings);
    } catch {}
  }, []);

  // ─── Desktop icons ────────────────────────────────────────────────────────

  const addDesktopIcon = useCallback((appId) => {
    setDesktopIcons(prev => {
      if (prev.some(ic => ic.appId === appId && ic.type === 'app')) return prev;
      const row = Math.floor(prev.length / 2);
      const col = prev.length % 2;
      const next = [...prev, { id: `di-${appId}-${Date.now()}`, type: 'app', appId, label: APPS[appId]?.name || appId, x: 18 + col * 84, y: 18 + row * 84 }];
      saveIcons(next);
      return next;
    });
  }, []);

  const moveIcon = useCallback((id, x, y) => {
    setDesktopIcons(prev => {
      const next = prev.map(ic => ic.id === id ? { ...ic, x, y } : ic);
      saveIcons(next);
      return next;
    });
  }, []);

  const removeIcon = useCallback((id) => {
    setDesktopIcons(prev => { const next = prev.filter(ic => ic.id !== id); saveIcons(next); return next; });
  }, []);

  const renameIcon = useCallback((id, label) => {
    const lbl = window.prompt('Rename shortcut:', label);
    if (lbl && lbl.trim()) {
      setDesktopIcons(prev => { const next = prev.map(ic => ic.id === id ? { ...ic, label: lbl.trim() } : ic); saveIcons(next); return next; });
    }
  }, []);

  // ─── Widget management ────────────────────────────────────────────────────

  const moveWidget = useCallback((id, x, y) => {
    setWidgets(prev => { const next = prev.map(w => w.id === id ? { ...w, x: Math.max(0, x), y: Math.max(0, y) } : w); saveWidgets(next); return next; });
  }, []);
  const hideWidget = useCallback((id) => {
    setWidgets(prev => { const next = prev.map(w => w.id === id ? { ...w, visible: false } : w); saveWidgets(next); return next; });
  }, []);
  const showWidget = useCallback((id) => {
    setWidgets(prev => { const next = prev.map(w => w.id === id ? { ...w, visible: true } : w); saveWidgets(next); return next; });
  }, []);
  const beginWidgetDrag = useCallback((e, id) => {
    const w = widgets.find(wg => wg.id === id);
    if (!w) return;
    widgetDrag.current = { id, startX: e.clientX, startY: e.clientY, x: w.x, y: w.y };
    e.preventDefault();
    e.stopPropagation();
  }, [widgets]);

  useEffect(() => {
    const move = e => {
      if (!widgetDrag.current) return;
      const dx = e.clientX - widgetDrag.current.startX;
      const dy = e.clientY - widgetDrag.current.startY;
      moveWidget(widgetDrag.current.id, widgetDrag.current.x + dx, widgetDrag.current.y + dy);
    };
    const up = () => { widgetDrag.current = null; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [moveWidget]);

  // ─── Window / process management ─────────────────────────────────────────

  const launchApp = useCallback((appId) => {
    if (!APPS[appId]) return;
    setOpenWindows(prev => {
      const existing = prev.find(w => w.appId === appId);
      if (existing) {
        nextZ.current += 1;
        setActiveWindowId(existing.id);
        if (existing.pid) kernel.resume(existing.pid);
        return prev.map(w => w.id === existing.id ? { ...w, minimized: false, zIndex: nextZ.current } : w);
      }
      const seq  = prev.length % 4;
      const id   = `${appId}-${Date.now()}`;
      const pid  = kernel.state === 'running' ? kernel.spawn(appId, APPS[appId].name, { ppid: 1, windowId: id }) : null;
      if (pid) kernel.attachWindow(pid, id);
      const avail = Math.max(760, window.innerWidth - 56);
      const preset = { files: { x:34,y:64,width:Math.min(600,avail-30),height:520 }, status: { x:Math.min(620,Math.max(310,avail-730)),y:72,width:Math.min(720,avail-26),height:570 }, terminal: { x:60,y:70,width:720,height:480 }, processes: { x:90,y:80,width:760,height:540 } }[appId];
      nextZ.current += 1;
      setActiveWindowId(id);
      return [...prev, { id, appId, pid, x: preset?.x ?? 115+seq*32, y: preset?.y ?? 62+seq*27, width: preset?.width ?? (appId==='settings'?860:900), height: preset?.height ?? 575, maximized: false, minimized: false, zIndex: nextZ.current }];
    });
    setLauncher(false);
  }, []);

  // ─── SOMA Agency Bridge ───────────────────────────────────────────────────
  // SOMA (backend) drives the OS through aperture_command WS broadcasts.
  // Every action she takes is attributed via a kernel notification so the
  // desktop never changes "mysteriously". Verbs are a small allow-list.
  useEffect(() => {
    const handler = (cmd) => {
      const { verb, arg } = cmd || {};
      const credit = (action) => kernel.notify('SOMA', action, { appId: 'system', type: 'info' });
      switch (verb) {
        case 'open_app':
          if (APPS[arg]) { launchApp(arg); credit(`I opened ${APPS[arg].name} for you.`); }
          break;
        case 'close_app':
          setOpenWindows(p => {
            const win = p.find(w => w.appId === arg);
            if (!win) return p;
            if (win.pid) kernel.kill(win.pid, 'SIGTERM');
            credit(`I closed ${APPS[arg]?.name || arg}.`);
            return p.filter(w => w.appId !== arg);
          });
          break;
        case 'notify':
          kernel.notify('SOMA', String(arg || ''), { appId: 'system', type: 'info' });
          break;
        case 'portal_navigate':
          launchApp('portal');
          // Give Portal a beat to mount before handing it the destination
          setTimeout(() => window.dispatchEvent(new CustomEvent('aperture:portal-navigate', { detail: { query: String(arg || '') } })), 700);
          credit(`I'm pulling up "${arg}" in Portal.`);
          break;
        default:
          break;
      }
    };
    somaBackend.on('aperture_command', handler);
    return () => somaBackend.off('aperture_command', handler);
  }, [launchApp]);

  const focusWindow  = id => { nextZ.current += 1; setActiveWindowId(id); setOpenWindows(p => p.map(w => w.id === id ? { ...w, zIndex: nextZ.current } : w)); };
  const mutateWindow = (id, patch) => setOpenWindows(p => p.map(w => {
    if (w.id !== id) return w;
    if (patch.minimized === true  && w.pid) kernel.suspend(w.pid);
    if (patch.minimized === false && w.pid) kernel.resume(w.pid);
    return { ...w, ...patch };
  }));
  const closeWindow  = id => setOpenWindows(p => { const win = p.find(w => w.id === id); if (win?.pid) kernel.kill(win.pid,'SIGTERM'); return p.filter(w => w.id !== id); });

  // ─── Session persistence ──────────────────────────────────────────────────

  // Save on change (debounced)
  useEffect(() => {
    if (booting) return;
    const t = setTimeout(() => {
      const session = openWindows.map(w => ({ appId:w.appId, x:w.x, y:w.y, width:w.width, height:w.height, maximized:w.maximized, minimized:w.minimized }));
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }, 800);
    return () => clearTimeout(t);
  }, [openWindows, booting]);

  // Restore on boot
  useEffect(() => {
    if (booting) return;
    let restored = false;
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        const session = JSON.parse(saved);
        if (Array.isArray(session) && session.length > 0) {
          const seen = new Set();
          const windows = session
            .filter(w => APPS[w.appId] && !seen.has(w.appId) && seen.add(w.appId))
            .map(w => {
              const id  = `${w.appId}-${Date.now()}-${Math.floor(Math.random()*9999)}`;
              const pid = kernel.state === 'running' ? kernel.spawn(w.appId, APPS[w.appId].name, { ppid: 1, windowId: id }) : null;
              if (pid) kernel.attachWindow(pid, id);
              nextZ.current += 1;
              return { id, pid, appId:w.appId, x:w.x??100, y:w.y??60, width:w.width??900, height:w.height??575, maximized:w.maximized??false, minimized:w.minimized??false, zIndex: nextZ.current };
            });
          if (windows.length > 0) {
            setOpenWindows(windows);
            setActiveWindowId(windows[windows.length - 1].id);
            restored = true;
          }
        }
      }
    } catch {}
    if (!restored) { launchApp('files'); launchApp('status'); }
  }, [booting]); // eslint-disable-line

  // ─── Init shell data ──────────────────────────────────────────────────────

  useEffect(() => {
    if (booting) return;
    let alive = true;
    (async () => {
      try {
        const [saved, axis] = await Promise.all([
          somaBackend.fetch('/api/aperture/settings'),
          somaBackend.fetch('/api/axis/workspaces'),
        ]);
        if (!alive) return;
        if (saved.success) setSettings(saved.settings);
        const list = axis.workspaces || [];
        setWorkspaces(list);
        if (!saved.settings?.activeWorkspaceId && list[0]?.id) updateSettings({ activeWorkspaceId: list[0].id });
      } catch {}
    })();
    return () => { alive = false; };
  }, [booting]); // eslint-disable-line

  useEffect(() => {
    let alive = true;
    const refresh = async () => { try { const s = await somaBackend.fetch('/api/system/state'); if (alive && s.success) setSnapshot(s.snapshot); } catch { if (alive) setSnapshot(null); } };
    refresh();
    const st = setInterval(refresh, 5000);
    const ct = setInterval(() => setClock(new Date()), 1000);
    return () => { alive = false; clearInterval(st); clearInterval(ct); };
  }, []);

  // ─── Spotlight ────────────────────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(async () => {
      if (query.trim().length < 2) return setResults([]);
      try {
        const ws = activeWorkspace?.id ? `&workspaceId=${encodeURIComponent(activeWorkspace.id)}` : '';
        const r  = await somaBackend.fetch(`/api/aperture/search?q=${encodeURIComponent(query.trim())}${ws}`);
        setResults(r.results || []);
      } catch { setResults([]); }
    }, 180);
    return () => clearTimeout(t);
  }, [activeWorkspace?.id, query]);

  // ─── Global keyboard + SOMA actions ──────────────────────────────────────

  useEffect(() => {
    const onKey = e => {
      if (locked) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSpotlight(v => !v); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') { e.preventDefault(); setLocked(true); }
      if (e.key === 'Escape') { setSpotlight(false); setLauncher(false); setShowNotifPanel(false); setShowQuickSettings(false); setContextMenu(null); }
    };
    const onAction = data => {
      const { action, payload = {} } = data || {};
      if (settings.autonomyLevel === 1 && ['open_app','select_workspace','change_theme','change_wallpaper'].includes(action)) return;
      if (settings.autonomyLevel === 2 && ['select_workspace','change_theme','change_wallpaper'].includes(action)) return;
      if (action === 'open_app')        launchApp(payload.appId);
      if (action === 'search_universal') { setSpotlight(true); setQuery(payload.query || ''); }
      if (action === 'select_workspace') { const sel = workspaces.find(w => w.id === payload.workspace || w.name === payload.workspace); if (sel) updateSettings({ activeWorkspaceId: sel.id }); }
      if (action === 'change_theme')    updateSettings({ theme: payload.theme });
      if (action === 'change_wallpaper') updateSettings({ wallpaper: payload.wallpaper, wallpaperUrl: payload.wallpaperUrl || '' });
      if (action === 'notify')          kernel.notify(payload.title, payload.body, payload);
    };
    const onLocal = e => updateSettings(e.detail?.payload || {});
    window.addEventListener('keydown', onKey);
    window.addEventListener('aperture-system-message', onLocal);
    somaBackend.on('aperture_action', onAction);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('aperture-system-message', onLocal); somaBackend.off('aperture_action', onAction); };
  }, [launchApp, locked, settings.autonomyLevel, updateSettings, workspaces]);

  // ─── Context menu builders ────────────────────────────────────────────────

  const showDesktopCtx = useCallback((e) => {
    e.preventDefault();
    const widgetItems = DEFAULT_WIDGETS.map(def => {
      const w = widgets.find(wg => wg.id === def.id);
      const label = `${def.type.charAt(0).toUpperCase() + def.type.slice(1)} Widget`;
      return { label: w?.visible ? `Hide ${label}` : `Show ${label}`, icon: Layers, action: () => w?.visible ? hideWidget(def.id) : showWidget(def.id) };
    });
    setContextMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { label: 'New Note', icon: NotebookPen, action: () => launchApp('notes') },
        { label: 'Open Files', icon: Folder, action: () => launchApp('files') },
        { label: 'Open Terminal', icon: TerminalSquare, action: () => launchApp('terminal') },
        { separator: true },
        { label: 'Search (Ctrl+K)', icon: Search, action: () => setSpotlight(true) },
        { separator: true },
        { header: true, label: 'Widgets' },
        ...widgetItems,
        { separator: true },
        { label: 'Lock Screen (Ctrl+L)', icon: Lock, action: () => setLocked(true) },
        { label: 'Refresh SOMA', icon: RefreshCw, action: () => somaBackend.fetch('/api/system/state') },
      ],
    });
  }, [launchApp, widgets, hideWidget, showWidget]);

  const showDockCtx = useCallback((e, appId) => {
    e.preventDefault();
    e.stopPropagation();
    const isOpen = openWindows.some(w => w.appId === appId && !w.minimized);
    setContextMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { header: true, label: APPS[appId]?.name },
        { separator: true },
        { label: isOpen ? 'Focus' : 'Open', icon: APPS[appId]?.icon, action: () => launchApp(appId) },
        { label: 'Add to Desktop', icon: Plus, action: () => addDesktopIcon(appId) },
        ...(isOpen ? [
          { separator: true },
          { label: 'Quit', icon: X, danger: true, action: () => { const win = openWindows.find(w => w.appId === appId); if (win) closeWindow(win.id); } },
        ] : []),
      ],
    });
  }, [addDesktopIcon, closeWindow, launchApp, openWindows]);

  const showIconCtx = useCallback((e, icon) => {
    setContextMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { label: icon.label, header: true },
        { separator: true },
        { label: 'Open', icon: APPS[icon.appId]?.icon, action: () => launchApp(icon.appId) },
        { label: 'Rename', icon: Edit3, action: () => renameIcon(icon.id, icon.label) },
        { separator: true },
        { label: 'Remove Shortcut', icon: Trash2, danger: true, action: () => removeIcon(icon.id) },
      ],
    });
  }, [launchApp, removeIcon, renameIcon]);

  // ─── Drag / resize / snap ────────────────────────────────────────────────

  const beginDrag = (e, win, resize = false) => {
    if (e.target.closest('button') || win.maximized) return;
    focusWindow(win.id);
    drag.current = { id: win.id, resize, startX: e.clientX, startY: e.clientY, x: win.x, y: win.y, width: win.width, height: win.height };
    e.preventDefault();
  };

  useEffect(() => {
    const move = e => {
      if (!drag.current) return;
      const dx = e.clientX - drag.current.startX, dy = e.clientY - drag.current.startY;
      if (drag.current.resize) { mutateWindow(drag.current.id, { width: Math.max(480, drag.current.width+dx), height: Math.max(320, drag.current.height+dy) }); setSnapZone(null); }
      else { mutateWindow(drag.current.id, { x: Math.max(0, drag.current.x+dx), y: Math.max(0, drag.current.y+dy) }); setSnapZone(getSnapZone(e.clientX, e.clientY, desktopRef.current)); }
    };
    const up = () => {
      if (drag.current && snapZone) {
        const d = snapDimensions(snapZone, desktopRef.current);
        if (d) { if (d.maximized) mutateWindow(drag.current.id, { maximized: true }); else mutateWindow(drag.current.id, { x:d.x, y:d.y, width:d.width, height:d.height, maximized:false }); }
      }
      drag.current = null; setSnapZone(null);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [snapZone]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const wallStyle = settings.wallpaper === 'custom' && settings.wallpaperUrl ? { backgroundImage: `url("${settings.wallpaperUrl}")` } : undefined;
  const appProps  = { workspace: activeWorkspace, policy: settings.permissions, settings, onSettingsUpdate: updateSettings, onLaunchApp: launchApp, kernel };
  const localApps = Object.entries(APPS).filter(([, m]) => m.name.toLowerCase().includes(query.toLowerCase()));

  if (booting) return (
    <div className={`aperture-os ap-theme-${settings.theme} ap-wallpaper-${settings.wallpaper}`}>
      <BootScreen lines={bootLines} />
    </div>
  );

  if (locked) return (
    <div className={`aperture-os ap-theme-${settings.theme} ap-wallpaper-${settings.wallpaper}`} style={wallStyle}>
      <LockScreen
        wallpaper={settings.wallpaper}
        wallpaperUrl={settings.wallpaperUrl}
        onUnlock={() => { setLocked(false); lastActivity.current = Date.now(); }}
        onSetPin={(p) => setPin(p)}
      />
    </div>
  );

  return (
    <div
      className={`aperture-os ap-theme-${settings.theme} ap-wallpaper-${settings.wallpaper}`}
      style={wallStyle}
      onClick={closeAllOverlays}
      onContextMenu={showDesktopCtx}
    >
      {/* System bar */}
      <header className="ap-systembar">
        <button className="ap-brand" onClick={e => { e.stopPropagation(); setLauncher(v => !v); }}>
          <Sparkles size={15} /> Aperture
        </button>
        <div className="ap-soma-badge">
          <span className={`ap-soma-dot ${snapshot?.ready ? 'online' : 'offline'}`} />
          <span>SOMA {snapshot?.ready ? 'Online' : 'Offline'}</span>
          {snapshot?.cpu != null && <span className="ap-soma-cpu">{snapshot.cpu}% cpu</span>}
        </div>
        <div className="ap-bar-actions">
          <button title="Search (Ctrl+K)" onClick={e => { e.stopPropagation(); setSpotlight(true); }}><Search size={15} /></button>
          <button title="Notifications" className={`ap-notif-bell ${unreadCount > 0 ? 'has-unread' : ''}`} onClick={e => { e.stopPropagation(); setShowNotifPanel(v => !v); setShowQuickSettings(false); }}>
            <Bell size={14} />
            {unreadCount > 0 && <span className="ap-notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          <button className="ap-qs-trigger" title="Quick Settings" onClick={e => { e.stopPropagation(); setShowQuickSettings(v => !v); setShowNotifPanel(false); }}>
            <Wifi size={14} className={snapshot?.ready ? 'online' : ''} />
            <Shield size={12} />
            <span className="ap-time">{clock.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'})}&nbsp;&nbsp;{clock.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</span>
          </button>
        </div>
      </header>

      {/* Notification panel */}
      {showNotifPanel && (
        <div className="ap-notif-panel-wrap" onClick={e => e.stopPropagation()}>
          <NotificationPanel notifications={notifications} onClose={() => setShowNotifPanel(false)} onClear={handleClearAll} onMarkRead={handleMarkRead} />
        </div>
      )}

      {/* Quick settings */}
      {showQuickSettings && (
        <div className="ap-quickset-wrap" onClick={e => e.stopPropagation()}>
          <QuickSettings settings={settings} snapshot={snapshot} pin={pin} onUpdate={updateSettings} onClose={() => setShowQuickSettings(false)} onLaunchApp={launchApp} onLock={() => setLocked(true)} />
        </div>
      )}

      {/* Desktop */}
      <main className="ap-desktop" ref={desktopRef}>
        <SnapPreview zone={snapZone} desktop={desktopRef.current} />

        {/* Widgets layer (behind icons and windows) */}
        {widgets.filter(w => w.visible).map(widget => (
          <DesktopWidget
            key={widget.id}
            widget={widget}
            snapshot={snapshot}
            clock={clock}
            onClose={hideWidget}
            onDragStart={beginWidgetDrag}
          />
        ))}

        {/* Desktop icons (below windows) */}
        {desktopIcons.map(icon => (
          <DesktopIcon
            key={icon.id}
            icon={icon}
            onOpen={ic => launchApp(ic.appId)}
            onMove={moveIcon}
            onContextMenu={showIconCtx}
          />
        ))}

        {/* Windows */}
        {openWindows.map(win => {
          if (win.minimized) return null;
          const meta = APPS[win.appId];
          const Component = meta.component;
          return (
            <section
              key={win.id}
              className={`ap-window ${activeWindowId === win.id ? 'active' : ''} ${win.maximized ? 'maximized' : ''}`}
              style={win.maximized ? { zIndex: win.zIndex } : { left: win.x, top: win.y, width: win.width, height: win.height, zIndex: win.zIndex }}
              onMouseDown={() => focusWindow(win.id)}
            >
              <div className="ap-windowbar" onMouseDown={e => beginDrag(e, win)}>
                <div className="ap-window-controls ap-window-controls-left">
                  <button onClick={() => mutateWindow(win.id, { maximized: !win.maximized })} className="maximize" title={win.maximized ? 'Restore' : 'Maximize'}><span className="square" /></button>
                </div>
                <div className="ap-window-title">
                  {APP_ICONS[win.appId] ? (
                    <img src={APP_ICONS[win.appId]} alt="" style={{ width: 16, height: 16, objectFit: 'contain', marginRight: 6 }} />
                  ) : (
                    <meta.icon size={13} />
                  )}
                  {meta.name}
                  {win.pid && <span className="ap-win-pid">pid:{win.pid}</span>}
                </div>
                <div className="ap-window-controls ap-window-controls-right">
                  <button onClick={() => mutateWindow(win.id, { minimized: true })} className="minimize" title="Minimize"><span className="vee">V</span></button>
                  <button onClick={() => closeWindow(win.id)} className="close" title="Close"><span className="circle">O</span></button>
                </div>
              </div>
              <div className="ap-window-content">
                <Suspense fallback={<AppFallback />}><Component {...appProps} /></Suspense>
              </div>
              {!win.maximized && <div className="ap-resize" onMouseDown={e => beginDrag(e, win, true)} />}
            </section>
          );
        })}
      </main>

      {/* Toast tray */}
      <div className="ap-toast-tray">
        {toasts.slice(-4).map(t => <Toast key={t.id} notif={t} onDismiss={() => dismissToast(t.id)} />)}
      </div>

      {/* Dock */}
      <div className="ap-dock">
        {Object.entries(APPS).map(([id, meta]) => (
          <button
            key={id}
            title={meta.name}
            className={`ap-dock-app ${meta.accent} ${openWindows.some(w => w.appId === id && !w.minimized) ? 'open' : ''}`}
            onClick={() => launchApp(id)}
            onContextMenu={e => showDockCtx(e, id)}
          >
            {APP_ICONS[id] ? (
              <img src={APP_ICONS[id]} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} />
            ) : (
              <meta.icon size={21} />
            )}
          </button>
        ))}
      </div>

      {/* App launcher */}
      {launcher && (
        <div className="ap-launcher" onClick={e => e.stopPropagation()}>
          <h3>Applications</h3>
          {Object.entries(APPS).map(([id, meta]) => (
            <button key={id} onClick={() => launchApp(id)}>
              {APP_ICONS[id] ? (
                <img src={APP_ICONS[id]} alt="" style={{ width: 24, height: 24, objectFit: 'contain', marginRight: 8 }} />
              ) : (
                <meta.icon size={17} style={{ marginRight: 8 }} />
              )}
              {meta.name}
            </button>
          ))}
        </div>
      )}

      {/* Spotlight */}
      {spotlight && (
        <div className="ap-spotlight-backdrop" onClick={() => setSpotlight(false)}>
          <div className="ap-spotlight" onClick={e => e.stopPropagation()}>
            <label>
              <Search size={18} />
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tasks, notes, projects, apps, kernel..." />
              <button onClick={() => setSpotlight(false)}><X size={16} /></button>
            </label>
            <div className="ap-search-results">
              {localApps.map(([id, meta]) => (
                <button key={id} onClick={() => { launchApp(id); setSpotlight(false); }}>
                  {APP_ICONS[id] ? (
                    <img src={APP_ICONS[id]} alt="" style={{ width: 20, height: 20, objectFit: 'contain', marginRight: 8 }} />
                  ) : (
                    <meta.icon size={15} style={{ marginRight: 8 }} />
                  )}
                  <div><strong>{meta.name}</strong><small>Application</small></div>
                </button>
              ))}
              {results.map(r => (
                <button key={`${r.type}-${r.id}`} onClick={() => { launchApp(r.appId); setSpotlight(false); }}>
                  {APP_ICONS[r.appId] ? (
                    <img src={APP_ICONS[r.appId]} alt="" style={{ width: 20, height: 20, objectFit: 'contain', marginRight: 8 }} />
                  ) : (
                    <Search size={15} style={{ marginRight: 8 }} />
                  )}
                  <div><strong>{r.title}</strong><small>{r.type} — {r.detail}</small></div>
                </button>
              ))}
              {query.length > 1 && !localApps.length && !results.length && <p>No matches in this workspace.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
