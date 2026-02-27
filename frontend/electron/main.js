import { app, BrowserWindow, ipcMain, WebContentsView, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.commandLine.appendSwitch('remote-debugging-port', '9222');

let mainWindow;
let browserView;
let browserBounds = { x: 0, y: 0, width: 0, height: 0 };

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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
