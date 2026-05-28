import { app, BrowserWindow, session, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
const PORTAL_PARTITION = 'persist:portal';

function isSafeExternalUrl(value = '') {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function configurePortalSession() {
  const portalSession = session.fromPartition(PORTAL_PARTITION);
  portalSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(false);
  });
  portalSession.setPermissionCheckHandler(() => false);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    backgroundColor: '#111827',
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      webviewTag: true
    },
    autoHideMenuBar: true,
    frame: true,
    titleBarStyle: 'default'
  });

  // Dev: load from Vite dev server (proxies API calls to SOMA backend)
  // Production: load from the SOMA Express server (serves frontend/dist + handles API)
  // NOTE: Never use loadFile() — it creates a file:// origin which breaks all relative API fetches
  const viteUrl = process.env.VITE_DEV_SERVER_URL;
  const somaUrl = process.env.SOMA_BACKEND_URL || 'http://localhost:3001';
  const loadUrl = viteUrl || somaUrl;

  console.log('[ELECTRON] Loading from:', loadUrl);
  mainWindow.loadURL(loadUrl);

  mainWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    if (!isSafeExternalUrl(params.src) && params.src !== 'about:blank') {
      event.preventDefault();
      return;
    }
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    webPreferences.webSecurity = true;
    webPreferences.partition = PORTAL_PARTITION;
  });

  mainWindow.webContents.on('did-attach-webview', (_event, guest) => {
    guest.setWindowOpenHandler(({ url }) => {
      if (isSafeExternalUrl(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
    guest.on('will-navigate', (event, url) => {
      if (!isSafeExternalUrl(url)) event.preventDefault();
    });
  });

  if (viteUrl) {
    mainWindow.webContents.openDevTools();
  }

  // Allow toggling DevTools with F12 or Ctrl+Shift+I
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && (input.key === 'F12' || (input.key.toLowerCase() === 'i' && input.control && input.shift))) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  configurePortalSession();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
