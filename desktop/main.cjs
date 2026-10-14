const { app, BrowserWindow, Menu, protocol, net, shell, session, dialog } = require('electron');
const { join, resolve, sep } = require('node:path');
const { pathToFileURL } = require('node:url');
const { mkdtempSync, readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { readCached, checkForUpdate, stageBundle } = require('./updates.cjs');
const bundledBuild = require('./build-info.json');

const updateCheckTest = process.argv.includes('--update-check-test');
const smokeTest = updateCheckTest || process.argv.includes('--smoke-test');
protocol.registerSchemesAsPrivileged([{ scheme: 'arcade', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
if (smokeTest) app.setPath('userData', mkdtempSync(join(tmpdir(), 'futbol-arcade-test-')));
app.setAppUserModelId('com.futbolarcade.desktop');
if (!smokeTest && !app.requestSingleInstanceLock()) app.quit();

let window;
function external(url) {
  try { if (new URL(url).protocol === 'https:') shell.openExternal(url); } catch { /* Invalid links remain closed. */ }
}

app.whenReady().then(async () => {
  const updateBase = join(app.getPath('userData'), 'game-updates');
  if (updateCheckTest) {
    try {
      const updated = await checkForUpdate({ fetch: (...args) => net.fetch(...args), current: { build: '0'.repeat(40), builtAt: 0 }, base: updateBase });
      const passed = updated?.build === bundledBuild.build && readCached(updateBase)?.build === bundledBuild.build;
      console.log('Published GitHub update test:', passed ? 'PASS' : 'FAIL'); app.exit(passed ? 0 : 1);
    } catch (error) { console.error(error); app.exit(1); }
    return;
  }
  const updatePackage = smokeTest && process.argv.find(argument => argument.startsWith('--update-package='));
  if (updatePackage) stageBundle(updateBase, JSON.parse(readFileSync(updatePackage.slice('--update-package='.length), 'utf8')));
  const cached = smokeTest && !updatePackage ? null : readCached(updateBase);
  let current = cached && (updatePackage || cached.builtAt > bundledBuild.builtAt) ? cached : { ...bundledBuild, root: resolve(__dirname, 'game') };
  let root = current.root;
  let checking = false, pending = null;
  async function updates(manual = false) {
    if (checking || smokeTest) return;
    checking = true;
    try {
      if (!pending) pending = await checkForUpdate({ fetch: (...args) => net.fetch(...args), current, base: updateBase });
      if (pending) {
        updateItem.label = 'Actualización lista · reiniciar juego';
        if (manual) {
          const { response } = await dialog.showMessageBox(window, { type: 'info', title: 'Actualización preparada',
            message: 'La última versión del juego está descargada.', detail: 'Se aplicará al próximo inicio. Reiniciar cierra el partido actual; las competiciones se guardan y tu progreso se conserva.',
            buttons: ['Más tarde', 'Reiniciar ahora'], defaultId: 0, cancelId: 0 });
          if (response === 1) {
            await window.webContents.executeJavaScript("window.dispatchEvent(new Event('pagehide'))");
            app.relaunch({ execPath: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath, args: process.argv.slice(1) }); app.quit();
          }
        }
      } else if (manual) await dialog.showMessageBox(window, { type: 'info', title: 'Fútbol arcade', message: 'Ya tienes la última versión publicada del juego.' });
    } catch (error) {
      console.warn('Game update:', error.message);
      if (manual) await dialog.showMessageBox(window, { type: 'info', title: 'Actualizaciones',
        message: 'No se pudo comprobar la actualización.', detail: 'Puedes seguir jugando con tu copia local y volver a intentarlo cuando tengas conexión.' });
    } finally { checking = false; }
  }
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
    { label: 'Juego', submenu: [{ id: 'game-update', label: 'Buscar actualizaciones', click: () => updates(true) }, { label: 'Salir', role: 'quit' }] },
    { label: 'Vista', submenu: [{ label: 'Pantalla completa', role: 'togglefullscreen' }, { label: 'Restablecer zoom', role: 'resetZoom' }] },
  ]));
  const updateItem = Menu.getApplicationMenu().getMenuItemById('game-update');
  window.webContents.setWindowOpenHandler(({ url }) => { external(url); return { action: 'deny' }; });
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('arcade://game/')) { event.preventDefault(); external(url); }
  });
  window.webContents.on('render-process-gone', (_event, details) => { console.error(details.reason); if (smokeTest) app.exit(1); });
  updateItem.enabled = false;
  await window.loadFile(join(__dirname, 'startup.html'));
  const startupStatus = (title, detail) => {
    if (window.isDestroyed()) return;
    window.webContents.executeJavaScript(`document.getElementById('startup-status').textContent = ${JSON.stringify(title)}; document.getElementById('startup-detail').textContent = ${JSON.stringify(detail)};`).catch(() => {});
  };
  if (smokeTest) {
    const visible = await window.webContents.executeJavaScript("document.getElementById('startup-status')?.textContent === 'Buscando actualizaciones' && !document.getElementById('game-canvas')");
    if (!visible) { console.error('Startup update screen failed'); app.exit(1); return; }
  }
  const started = Date.now();
  try {
    if (!smokeTest) {
      const latest = await checkForUpdate({ fetch: (...args) => net.fetch(...args), current, base: updateBase, onStatus: startupStatus, timeout: 10000 });
      if (latest) { current = latest; root = latest.root; }
    }
    await new Promise(resolve => setTimeout(resolve, Math.max(0, 700 - (Date.now() - started))));
    startupStatus('Iniciando juego', 'Versión local preparada. ¡A jugar!');
  } catch (error) {
    console.warn('Startup update:', error.message);
    startupStatus('No se pudo comprobar la actualización', 'Abriremos tu copia local. Puedes volver a comprobarlo desde Juego → Buscar actualizaciones.');
    await new Promise(resolve => setTimeout(resolve, 1400));
  }
  if (window.isDestroyed()) return;
  updateItem.enabled = true;
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
            for (const view of ['play', 'store', 'profile', 'customize', 'settings', 'online']) {
              document.querySelector('[data-view="' + view + '"]').click();
              await new Promise(resolve => setTimeout(resolve, 80));
              const screen = document.querySelector('#' + view + '-screen');
              if (screen.classList.contains('hidden')) throw new Error('Navigation failed: ' + view);
              const overflow = [...screen.querySelectorAll('button, input, select, .store-item, .setting-line')].filter(element => {
                const box = element.getBoundingClientRect();
                return box.width > 0 && !element.closest('.section-nav, .league-tabs, .country-tabs') && (box.left < -3 || box.right > innerWidth + 3);
              });
              if (overflow.length) throw new Error('Layout overflow: ' + view + ' ' + overflow.map(element => element.id || element.className).join(','));
              if (view === 'settings') {
                for (const id of ['music-volume', 'ambience-volume', 'effects-volume']) {
                  const slider = document.getElementById(id); slider.value = '25'; slider.dispatchEvent(new Event('input', { bubbles: true }));
                  if (document.getElementById(id + '-value').textContent !== '25%') throw new Error('Audio slider failed: ' + id);
                }
                const track = document.getElementById('music-track-name').textContent;
                document.getElementById('music-next').click();
                if (document.getElementById('music-track-name').textContent === track) throw new Error('Playlist did not advance');
                const recording = document.getElementById('menu-recording-audio');
                if (!recording) throw new Error('Recorded music player was not created');
                for (let attempt = 0; attempt < 100 && recording.readyState < 1; attempt++) await new Promise(resolve => setTimeout(resolve, 50));
                if (recording.readyState < 1 || !Number.isFinite(recording.duration) || recording.duration < 20 || recording.error) throw new Error('Bundled MP3 did not decode offline');
                document.getElementById('controller-reset').click();
                const saved = JSON.parse(localStorage.getItem('field-settings'));
                if (saved.musicVolume !== 25 || saved.ambienceVolume !== 25 || saved.effectsVolume !== 25 || saved.controllerMap.shoot !== 0) throw new Error('Audio/controller preferences did not save');
              }
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
