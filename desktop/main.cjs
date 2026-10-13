// MockupLab desktop: the same web app, served from a fixed app:// origin so
// projects saved in IndexedDB stay put from one version to the next.
const { app, BrowserWindow, protocol, net, shell, ipcMain } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

if (process.env.MOCKUPLAB_USER_DATA) app.setPath('userData', process.env.MOCKUPLAB_USER_DATA);

const WEB = path.join(__dirname, 'web');
const RELEASES = 'https://github.com/lucaleone15/MockupLab/releases/latest';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } },
]);

/** Files of the built web app; unknown paths fall back to index.html. */
async function serve(request) {
  const { pathname } = new URL(request.url);
  const rel = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.normalize(path.join(WEB, rel));
  if (!file.startsWith(WEB)) return new Response('Not found', { status: 404 });
  const res = await net.fetch(pathToFileURL(file).toString()).catch(() => null);
  if (res && res.ok) return res;
  return net.fetch(pathToFileURL(path.join(WEB, 'index.html')).toString());
}

let win = null;
/** Last update state, replayed when the page subscribes (it may load after the check). */
let lastUpdate = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'MockupLab',
    backgroundColor: '#f5f5f7',
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true },
  });
  win.once('ready-to-show', () => win.show());
  // links to other sites open in the browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith('app://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.on('page-title-updated', (e) => e.preventDefault());
  void win.loadURL('app://mockuplab/');
}

/* ------------------------------------------------------------ updates */

ipcMain.on('mockuplab:update-query', (e) => {
  if (lastUpdate) e.sender.send('mockuplab:update', lastUpdate);
});

function startUpdates() {
  // tests: pretend an update is waiting
  if (process.env.MOCKUPLAB_FAKE_UPDATE) {
    lastUpdate = { state: 'available', version: process.env.MOCKUPLAB_FAKE_UPDATE };
    ipcMain.on('mockuplab:install-update', () => win?.webContents.send('mockuplab:update-installing'));
    return;
  }
  if (!app.isPackaged || process.env.MOCKUPLAB_NO_UPDATES) return;
  if (process.platform === 'darwin') return startMacUpdates();
  const { autoUpdater } = require('electron-updater');
  // macOS installs updates only for signed apps: there we offer the download page instead
  const canInstall = process.platform !== 'darwin';
  autoUpdater.autoDownload = canInstall;
  const send = (state, info) => {
    lastUpdate = { state, version: info?.version ?? '' };
    win?.webContents.send('mockuplab:update', lastUpdate);
  };
  autoUpdater.on('update-available', (info) => !canInstall && send('available', info));
  autoUpdater.on('update-downloaded', (info) => send('downloaded', info));
  autoUpdater.on('error', () => undefined);
  ipcMain.on('mockuplab:install-update', () => {
    if (canInstall) autoUpdater.quitAndInstall();
    else void shell.openExternal(RELEASES);
  });
  const check = () => void autoUpdater.checkForUpdates().catch(() => undefined);
  check();
  setInterval(check, 6 * 60 * 60 * 1000);
}

/** macOS (unsigned): ask GitHub for a newer release and offer its download page. */
function startMacUpdates() {
  const { newerRelease } = require('./update-check.cjs');
  let page = RELEASES;
  ipcMain.on('mockuplab:install-update', () => void shell.openExternal(page));
  const check = async () => {
    const found = await newerRelease(app.getVersion(), net.fetch).catch(() => null);
    if (!found) return;
    page = found.url || RELEASES;
    lastUpdate = { state: 'available', version: found.version };
    win?.webContents.send('mockuplab:update', lastUpdate);
  };
  void check();
  setInterval(() => void check(), 6 * 60 * 60 * 1000);
}

app.whenReady().then(() => {
  protocol.handle('app', serve);
  createWindow();
  startUpdates();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
