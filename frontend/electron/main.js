import { app, BrowserWindow, ipcMain, WebContentsView, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.commandLine.appendSwitch('remote-debugging-port', '9222');

let mainWindow;
let browserBounds = { x: 0, y: 0, width: 0, height: 0 };
let studyModeActive = false;

// ─── Multi-tab state ──────────────────────────────────────────────────────
let tabs = new Map();       // id -> { view, url, title }
let activeTabId = null;
let nextTabId = 1;

// ─── Study mode: blocked domains ──────────────────────────────────────────
const BLOCKED_DOMAINS = [
  'reddit.com', 'youtube.com', 'twitter.com', 'x.com',
  'instagram.com', 'tiktok.com', 'facebook.com', 'twitch.tv',
  'netflix.com', 'hulu.com', 'snapchat.com',
];

const BLOCKED_PAGE = `data:text/html,<!DOCTYPE html><html><head><style>
  body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;
  background:%230c1220;color:%23f0c050;font-family:system-ui,sans-serif;text-align:center;}
  h1{font-size:2.5rem;margin:0 0 12px}p{color:rgba(255,240,200,0.55);font-size:1rem;max-width:360px;line-height:1.6}
  .badge{background:rgba(240,180,60,0.12);border:1px solid rgba(240,180,60,0.3);border-radius:20px;padding:6px 18px;font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;margin-top:18px}
</style></head><body><h1>&#128218; Blocked</h1><p>This site is blocked while Study Mode is active. Stay focused!</p><div class="badge">Study Mode Active</div></body></html>`;


function createBrowserView() {
  const view = new WebContentsView({
    webPreferences: {
      partition: 'persist:sayam-browser',
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  view.webContents.on('dom-ready', () => {
    view.webContents.insertCSS(`
      .main-header { display: none !important; }
      .main-footer { display: none !important; }
    `);
  });

  view.webContents.setWindowOpenHandler(({ url }) => {
    view.webContents.loadURL(url);
    return { action: 'deny' };
  });

  return view;
}

function sendTabNav(tabId) {
  const tab = tabs.get(tabId);
  if (!tab || !mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('tab-nav-update', {
    tabId,
    url: tab.view.webContents.getURL(),
    title: tab.view.webContents.getTitle() || tab.view.webContents.getURL(),
    canGoBack: tab.view.webContents.navigationHistory.canGoBack(),
    canGoForward: tab.view.webContents.navigationHistory.canGoForward()
  });
}

function wireTabEvents(tabId) {
  const tab = tabs.get(tabId);
  if (!tab) return;
  const wc = tab.view.webContents;

  wc.on('did-navigate', () => sendTabNav(tabId));
  wc.on('did-navigate-in-page', () => sendTabNav(tabId));

  wc.on('did-start-loading', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tab-loading', { tabId, loading: true });
    }
  });

  wc.on('did-stop-loading', () => {
    sendTabNav(tabId);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tab-loading', { tabId, loading: false });
    }
  });

  wc.on('page-title-updated', (_, title) => {
    const t = tabs.get(tabId);
    if (t) {
      t.title = title;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('tab-title-updated', { tabId, title });
      }
    }
  });
}

function showTab(tabId) {
  const tab = tabs.get(tabId);
  if (!tab || !mainWindow || mainWindow.isDestroyed()) return;

  for (const [id, t] of tabs) {
    if (id !== tabId) {
      t.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
  }

  // Re-add view to bring it to the front in z-order
  try { mainWindow.contentView.removeChildView(tab.view); } catch (_) {}
  mainWindow.contentView.addChildView(tab.view);

  tab.view.setBounds(browserBounds);
  activeTabId = tabId;
}

function createTab(url = 'https://www.google.com') {
  const id = nextTabId++;
  const view = createBrowserView();

  mainWindow.contentView.addChildView(view);
  view.setBounds({ x: 0, y: 0, width: 0, height: 0 });

  const tab = { view, url, title: 'New Tab' };
  tabs.set(id, tab);
  wireTabEvents(id);

  view.webContents.loadURL(url);
  showTab(id);

  return id;
}

function closeTab(tabId) {
  const tab = tabs.get(tabId);
  if (!tab) return;

  try {
    mainWindow.contentView.removeChildView(tab.view);
    tab.view.webContents.close();
  } catch (_) {}
  tabs.delete(tabId);

  if (activeTabId === tabId) {
    const remaining = [...tabs.keys()];
    if (remaining.length > 0) {
      showTab(remaining[remaining.length - 1]);
      sendTabNav(activeTabId);
    } else {
      const newId = createTab();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('tab-created', { tabId: newId, url: 'https://www.google.com', title: 'New Tab' });
      }
    }
  }
}

function getTabsSnapshot() {
  const list = [];
  for (const [id, tab] of tabs) {
    let url = tab.url;
    let title = tab.title;
    try {
      url = tab.view.webContents.getURL() || url;
      title = tab.view.webContents.getTitle() || title;
    } catch (_) {}
    list.push({ id, url, title });
  }
  return { tabs: list, activeTabId };
}

// Helper: apply site-blocking to a single tab's session
function applySiteBlocking(view) {
  const session = view?.webContents?.session;
  if (!session) return;
  const urlPatterns = BLOCKED_DOMAINS.flatMap(d => [`*://*.${d}/*`, `*://${d}/*`]);
  session.webRequest.onBeforeRequest({ urls: urlPatterns }, (details, callback) => {
    if (studyModeActive) {
      callback({ cancel: true });
      view?.webContents?.loadURL(BLOCKED_PAGE);
    } else {
      callback({});
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 780,
    frame: false,
    transparent: true,
    webPreferences: {
      webviewTag: true,
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Create the first default tab
  createTab('https://www.google.com');
}

app.whenReady().then(() => {
  // ─── Register ALL IPC handlers BEFORE creating window ─────────────────
  ipcMain.on('resize-window', (_, { width, height }) => {
    mainWindow?.setSize(width, height);
    mainWindow?.center();
  });
  ipcMain.on('minimize-window', () => mainWindow?.minimize());
  ipcMain.on('close-window', () => mainWindow?.close());
  ipcMain.on('toggle-fullscreen', () => mainWindow?.setFullScreen(!mainWindow?.isFullScreen()));

  // ─── Tab sync ─────────────────────────────────────────────────────────────
  ipcMain.handle('get-tabs', () => getTabsSnapshot());

  // ─── Tab management IPC ──────────────────────────────────────────────────
  ipcMain.on('create-tab', (_, url) => {
    const tabId = createTab(url || 'https://www.google.com');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tab-created', { tabId, url: url || 'https://www.google.com', title: 'New Tab' });
    }
  });

  ipcMain.on('close-tab', (_, tabId) => {
    closeTab(tabId);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tab-closed', { tabId, activeTabId });
    }
  });

  ipcMain.on('switch-tab', (_, tabId) => {
    if (tabs.has(tabId)) {
      showTab(tabId);
      sendTabNav(tabId);
    }
  });

  // ─── Browser bounds ───────────────────────────────────────────────────────
  ipcMain.on('update-browser-bounds', (_, bounds) => {
    browserBounds = {
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height)
    };
    const activeTab = tabs.get(activeTabId);
    if (activeTab && mainWindow && !mainWindow.isDestroyed()) {
      activeTab.view.setBounds(browserBounds);
    }
  });

  // ─── Navigation IPC (operates on active tab) ─────────────────────────────
  ipcMain.on('browser-navigate', (_, url) => {
    const tab = tabs.get(activeTabId);
    tab?.view.webContents.loadURL(url);
  });

  ipcMain.on('browser-go-back', () => {
    const tab = tabs.get(activeTabId);
    tab?.view.webContents.navigationHistory.goBack();
  });

  ipcMain.on('browser-go-forward', () => {
    const tab = tabs.get(activeTabId);
    tab?.view.webContents.navigationHistory.goForward();
  });

  ipcMain.on('browser-reload', () => {
    const tab = tabs.get(activeTabId);
    tab?.view.webContents.reload();
  });

  ipcMain.on('browser-stop', () => {
    const tab = tabs.get(activeTabId);
    tab?.view.webContents.stop();
  });

  ipcMain.on('hide-browser', () => {
    for (const [, tab] of tabs) {
      tab.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
  });

  ipcMain.on('tab-navigate', (_, { tabId, url }) => {
    const tab = tabs.get(tabId);
    if (tab) tab.view.webContents.loadURL(url);
  });

  ipcMain.on('open-file', (_, filePath) => shell.openPath(filePath));

  // ─── Study mode: site blocking (applies to all tabs via shared session) ──
  ipcMain.on('enable-site-blocking', () => {
    studyModeActive = true;
    // All tabs share the same partition/session, so blocking one blocks all
    const activeTab = tabs.get(activeTabId);
    if (activeTab) applySiteBlocking(activeTab.view);
  });

  ipcMain.on('disable-site-blocking', () => {
    studyModeActive = false;
    const activeTab = tabs.get(activeTabId);
    const session = activeTab?.view?.webContents?.session;
    session?.webRequest?.onBeforeRequest(null);
  });

  // ─── Study mode: extract text from active tab ────────────────────────────
  ipcMain.handle('get-page-text', async () => {
    const tab = tabs.get(activeTabId);
    if (!tab) return '';
    try {
      const text = await tab.view.webContents.executeJavaScript(`
        (function() {
          const url = location.href;
          if (url.endsWith('.pdf') || url.includes('/pdf/') || document.contentType === 'application/pdf') {
            const spans = Array.from(document.querySelectorAll('.textLayer span'));
            if (spans.length > 5) return spans.map(s => s.textContent).join(' ').trim().substring(0, 12000);
          }
          const iframes = Array.from(document.querySelectorAll('iframe'));
          for (const f of iframes) {
            try {
              const doc = f.contentDocument;
              if (!doc) continue;
              const pdfSpans = doc.querySelectorAll('.textLayer span');
              if (pdfSpans.length > 10) return Array.from(pdfSpans).map(s => s.textContent).join(' ').trim().substring(0, 12000);
              const slideEl = doc.querySelector('.slide-content, [class*="slide"], .presentation-content');
              if (slideEl) return slideEl.innerText.trim().substring(0, 12000);
            } catch (e) {}
          }
          const canvas = document.querySelector('.user_content, .show-content, #wiki_page_show .user_content, .module-item-content, #content article');
          if (canvas) return canvas.innerText.trim().substring(0, 10000);
          const main = document.querySelector('main, [role="main"], article, .main-content, #main-content');
          if (main) return main.innerText.trim().substring(0, 10000);
          const clone = document.body.cloneNode(true);
          clone.querySelectorAll('nav, header, footer, [role="navigation"], aside, script, style').forEach(el => el.remove());
          return clone.innerText.trim().substring(0, 8000);
        })()
      `);
      return text || '';
    } catch {
      return '';
    }
  });

  // ─── Now create the window ────────────────────────────────────────────────
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
