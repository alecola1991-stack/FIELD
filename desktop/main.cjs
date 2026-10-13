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
    width: 1280, height: 850, minWidth: smokeTest ? 320 : 800, minHeight: smokeTest ? 480 : 600, title: 'Fútbol arcade',
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
        for (const width of [1280, 390]) {
          window.setSize(width, 850);
          await window.webContents.executeJavaScript(`(async () => {
            for (let attempt = 0; attempt < 100 && !document.querySelector('#league-competition').options.length; attempt++) await new Promise(resolve => setTimeout(resolve, 50));
            await new Promise(resolve => setTimeout(resolve, 200));
            for (const view of ['play', 'store', 'profile', 'customize', 'settings']) {
              document.querySelector('[data-view="' + view + '"]').click();
              await new Promise(resolve => setTimeout(resolve, 80));
              const screen = document.querySelector('#' + view + '-screen');
              if (screen.classList.contains('hidden')) throw new Error('Navigation failed: ' + view);
              const overflow = [...screen.querySelectorAll('button, input, select, .store-item, .setting-line')].filter(element => {
                const box = element.getBoundingClientRect();
                return box.width > 0 && !element.closest('.section-nav, .league-tabs, .country-tabs') && (box.left < -3 || box.right > innerWidth + 3);
              });
              if (overflow.length) throw new Error('Layout overflow: ' + view + ' ' + overflow.map(element => element.id || element.className).join(','));
            }
            for (let attempt = 0; attempt < 100 && document.querySelector('#quick-screen').classList.contains('hidden'); attempt++) {
              document.querySelector('[data-action="bot"]').click();
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            document.querySelector('[data-action="modifiers"]').click();
            if (document.querySelector('#modifiers-screen').classList.contains('hidden')) throw new Error('Modifiers did not open');
            document.querySelector('[data-modifier-preset="giant"]').click();
            if (JSON.parse(localStorage.getItem('field-settings')).modifiers.ballSize !== 1.8) throw new Error('Preset did not save');
            document.querySelector('#modifiers-reset').click();
            if (JSON.parse(localStorage.getItem('field-settings')).modifiers.ballSize !== 1) throw new Error('Reset failed');
            document.querySelector('[data-modifier-preset="fast"]').click();
            document.querySelector('#modifiers-done').click();
            if (document.querySelector('#quick-screen').classList.contains('hidden')) throw new Error('Modifiers return destination lost');
          })()`);
        }
        window.setSize(1280, 850);
        const passed = await window.webContents.executeJavaScript(`(async () => {
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
