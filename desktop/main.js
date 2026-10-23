const { app, BrowserWindow, session, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');

function indexPath() {
  const bundled = path.join(__dirname, 'web', 'index.html');
  return fs.existsSync(bundled) ? bundled : path.join(__dirname, '..', 'web', 'index.html');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 900,
    minWidth: 420,
    minHeight: 640,
    backgroundColor: '#0e0f12',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.loadFile(indexPath());
}

app.whenReady().then(async () => {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, permission, callback) => callback(permission === 'media'));
  ses.setPermissionCheckHandler((_wc, permission) => permission === 'media');
  if (process.platform === 'darwin') {
    try { await systemPreferences.askForMediaAccess('microphone'); } catch (e) { console.error(e); }
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
