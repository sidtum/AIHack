import { app, BrowserWindow, ipcMain, WebContentsView, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.commandLine.appendSwitch('remote-debugging-port', '9222');

let mainWindow;
let browserView;
let browserBounds = { x: 0, y: 0, width: 0, height: 0 };
let studyModeActive = false;

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
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  browserView = new WebContentsView({
    webPreferences: {
      partition: 'persist:sayam-browser',
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  browserView.webContents.on('dom-ready', () => {
    // Hide Lever's massive white native header and footer to prevent the "white box" gap
    browserView.webContents.insertCSS(`
      .main-header { display: none !important; }
      .main-footer { display: none !important; }
    `);
  });

  mainWindow.contentView.addChildView(browserView);
  browserView.setBounds(browserBounds);
  browserView.webContents.loadURL('https://www.google.com');

  // Prevent popups from spawning full-screen windows
  browserView.webContents.setWindowOpenHandler(({ url }) => {
    browserView.webContents.loadURL(url);
    return { action: 'deny' };
  });

  // Relay navigation events back to the React UI
  const sendNavUpdate = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('browser-nav-update', {
        url: browserView.webContents.getURL(),
        canGoBack: browserView.webContents.navigationHistory.canGoBack(),
        canGoForward: browserView.webContents.navigationHistory.canGoForward()
      });
    }
  };

  browserView.webContents.on('did-navigate', sendNavUpdate);
  browserView.webContents.on('did-navigate-in-page', sendNavUpdate);
  browserView.webContents.on('did-start-loading', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('browser-loading-start');
  });
  browserView.webContents.on('did-stop-loading', () => {
    sendNavUpdate();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('browser-loading-stop');
  });
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.on('resize-window', (_, { width, height }) => {
    mainWindow?.setSize(width, height);
    mainWindow?.center();
  });
  ipcMain.on('minimize-window', () => mainWindow?.minimize());
  ipcMain.on('close-window', () => mainWindow?.close());
  ipcMain.on('toggle-fullscreen', () => mainWindow?.setFullScreen(!mainWindow?.isFullScreen()));

  // WebContentsView IPC Handlers
  ipcMain.on('update-browser-bounds', (_, bounds) => {
    browserBounds = bounds;
    if (browserView && mainWindow && !mainWindow.isDestroyed()) {
      browserBounds = {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height)
      };
      browserView.setBounds(browserBounds);
    }
  });

  ipcMain.on('browser-navigate', (_, url) => browserView?.webContents.loadURL(url));
  ipcMain.on('browser-go-back', () => browserView?.webContents.navigationHistory.goBack());
  ipcMain.on('browser-go-forward', () => browserView?.webContents.navigationHistory.goForward());
  ipcMain.on('browser-reload', () => browserView?.webContents.reload());
  ipcMain.on('browser-stop', () => browserView?.webContents.stop());

  ipcMain.on('hide-browser', () => {
    browserView?.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  });

  ipcMain.on('open-file', (_, filePath) => shell.openPath(filePath));

  // ── Study mode: site blocking ──────────────────────────────────────────────
  ipcMain.on('enable-site-blocking', () => {
    studyModeActive = true;
    const session = browserView?.webContents?.session;
    if (!session) return;

    const urlPatterns = BLOCKED_DOMAINS.flatMap(d => [
      `*://*.${d}/*`,
      `*://${d}/*`,
    ]);

    session.webRequest.onBeforeRequest({ urls: urlPatterns }, (details, callback) => {
      if (studyModeActive) {
        callback({ cancel: true });
        browserView?.webContents?.loadURL(BLOCKED_PAGE);
      } else {
        callback({});
      }
    });
  });

  ipcMain.on('disable-site-blocking', () => {
    studyModeActive = false;
    const session = browserView?.webContents?.session;
    session?.webRequest?.onBeforeRequest(null);
  });

  // ── Study mode: extract slide / PDF text from embedded browser ─────────────
  ipcMain.handle('get-page-text', async () => {
    try {
      const text = await browserView?.webContents?.executeJavaScript(`
        (function() {
          const url = location.href;

          // 1. Raw PDF in Chromium PDF viewer
          if (url.endsWith('.pdf') || url.includes('/pdf/') || document.contentType === 'application/pdf') {
            const spans = Array.from(document.querySelectorAll('.textLayer span'));
            if (spans.length > 5) return spans.map(s => s.textContent).join(' ').trim().substring(0, 12000);
          }

          // 2. Canvas page with embedded PDF iframe
          const iframes = Array.from(document.querySelectorAll('iframe'));
          for (const f of iframes) {
            try {
              const doc = f.contentDocument;
              if (!doc) continue;
              const pdfSpans = doc.querySelectorAll('.textLayer span');
              if (pdfSpans.length > 10) return Array.from(pdfSpans).map(s => s.textContent).join(' ').trim().substring(0, 12000);
              const slideEl = doc.querySelector('.slide-content, [class*="slide"], .presentation-content');
              if (slideEl) return slideEl.innerText.trim().substring(0, 12000);
            } catch (e) { /* cross-origin */ }
          }

          // 3. Canvas module / page content area
          const canvas = document.querySelector('.user_content, .show-content, #wiki_page_show .user_content, .module-item-content, #content article');
          if (canvas) return canvas.innerText.trim().substring(0, 10000);

          // 4. Generic main content (avoid nav/sidebar noise)
          const main = document.querySelector('main, [role="main"], article, .main-content, #main-content');
          if (main) return main.innerText.trim().substring(0, 10000);

          // 5. Fallback: body minus nav/header/footer
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


  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
