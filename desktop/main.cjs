const { app, BrowserWindow, Menu, protocol, net, shell, session } = require('electron');
const { join, resolve, sep } = require('node:path');
const { pathToFileURL } = require('node:url');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');

const smokeTest = process.argv.includes('--smoke-test');
protocol.registerSchemesAsPrivileged([{ scheme: 'arcade', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
if (smokeTest) app.setPath('userData', mkdtempSync(join(tmpdir(), 'futbol-arcade-test-')));
app.setAppUserModelId('com.futbolarcade.desktop');
if (!smokeTest && !app.requestSingleInstanceLock()) app.quit();

let window;
function external(url) {
  try { if (new URL(url).protocol === 'https:') shell.openExternal(url); } catch { /* Invalid links remain closed. */ }
}

app.whenReady().then(() => {
  const root = resolve(__dirname, 'game');
  protocol.handle('arcade', request => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== 'game') return new Response('Not found', { status: 404 });
      const file = resolve(root, '.' + decodeURIComponent(url.pathname));
      if (!file.startsWith(root + sep)) return new Response('Forbidden', { status: 403 });
      return net.fetch(pathToFileURL(file).toString());
    } catch { return new Response('Bad request', { status: 400 }); }
  });
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => {
    callback(contents.getURL().startsWith('arcade://game/') && permission === 'clipboard-sanitized-write');
  });
  if (smokeTest) {
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['https://*/*', 'http://*/*', 'wss://*/*'] }, (_details, callback) => callback({ cancel: true }));
    setTimeout(() => { console.error('Offline smoke test timed out'); app.exit(1); }, 45000).unref();
  }
  window = new BrowserWindow({
    width: 1280, height: 850, minWidth: 800, minHeight: 600, title: 'Fútbol arcade',
    backgroundColor: '#0b1115', icon: join(__dirname, 'icon.png'), show: !smokeTest,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Juego', submenu: [{ label: 'Salir', role: 'quit' }] },
    { label: 'Vista', submenu: [{ label: 'Pantalla completa', role: 'togglefullscreen' }, { label: 'Restablecer zoom', role: 'resetZoom' }] },
  ]));
  window.webContents.setWindowOpenHandler(({ url }) => { external(url); return { action: 'deny' }; });
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('arcade://game/')) { event.preventDefault(); external(url); }
  });
  window.webContents.on('render-process-gone', (_event, details) => { console.error(details.reason); if (smokeTest) app.exit(1); });
  if (smokeTest) {
    let seeded = false;
    window.webContents.on('did-fail-load', (_event, code, description) => { console.error(code, description); app.exit(1); });
    window.webContents.on('did-finish-load', async () => {
      try {
        if (!seeded) {
          seeded = true;
          await window.webContents.executeJavaScript(`localStorage.setItem('field-settings', JSON.stringify({ name: 'PRUEBA', number: 10, teamId: 'laliga-barcelona', profileReady: true, difficulty: 'easy', sound: false }));`);
          window.reload(); return;
        }
        const passed = await window.webContents.executeJavaScript(`(async () => {
          for (let attempt = 0; attempt < 100 && document.querySelector('#quick-screen').classList.contains('hidden'); attempt++) {
            document.querySelector('[data-action="bot"]').click();
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          if (document.querySelector('#quick-screen').classList.contains('hidden')) throw new Error('Quick match did not open');
          document.querySelector('#quick-start').click();
          await new Promise(resolve => setTimeout(resolve, 1500));
          const canvas = document.querySelector('#game-canvas');
          return !document.querySelector('#game-screen').classList.contains('hidden') && canvas.width > 0 && canvas.height > 0 && document.querySelector('#hud-player-name').textContent === 'PRUEBA';
        })()`);
        console.log('Offline packaged game smoke test:', passed ? 'PASS' : 'FAIL'); app.exit(passed ? 0 : 1);
      } catch (error) { console.error(error); app.exit(1); }
    });
  }
  window.loadURL('arcade://game/index.html');
});
app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
app.on('window-all-closed', () => app.quit());
