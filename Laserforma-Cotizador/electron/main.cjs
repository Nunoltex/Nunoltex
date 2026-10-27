const { app, BrowserWindow, protocol, session, shell, dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

protocol.registerSchemesAsPrivileged([
  { scheme: 'laserforma', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: false } },
]);

app.setName('Laserforma Cotizador');
app.setAppUserModelId('cl.laserforma.cotizador');
let mainWindow;
let mainProcessPrinted = false;
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

async function serveApp(request) {
  const url = new URL(request.url);
  if (url.hostname !== 'app') return new Response('Not found', { status: 404 });
  let relative;
  try { relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html'; }
  catch { return new Response('Bad request', { status: 400 }); }
  const root = path.resolve(app.getAppPath(), 'dist');
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep) && target !== path.join(root, 'index.html')) return new Response('Forbidden', { status: 403 });
  try {
    const body = await fs.readFile(target);
    return new Response(body, { headers: { 'Content-Type': contentTypes[path.extname(target)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" } });
  } catch { return new Response('Not found', { status: 404 }); }
}
function isTrustedFrame(frame) { return frame?.url?.startsWith('laserforma://app/') === true; }

async function createWindow() {
  const window = new BrowserWindow({
    width: 1420, height: 960, minWidth: 760, minHeight: 620, show: false,
    title: 'Laserforma Cotizador', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true },
  });
  mainWindow = window;
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('laserforma://app/')) event.preventDefault();
  });
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && ((input.control && input.shift && ['i','j','c'].includes(input.key.toLowerCase())) || input.key === 'F12')) event.preventDefault();
  });
  window.on('closed', () => { if (mainWindow === window) mainWindow = null; });
  await window.loadURL('laserforma://app/index.html');
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
  app.whenReady().then(async () => {
    protocol.handle('laserforma', serveApp);
    const contents = session.defaultSession;
    contents.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    await createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}

