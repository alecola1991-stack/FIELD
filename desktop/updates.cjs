const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const RELEASE_URL = 'https://api.github.com/repos/alecola1991-stack/FIELD/releases/tags/windows-latest';
const ASSET_NAME = 'game-update.json';
const MAX_DOWNLOAD = 16 * 1024 * 1024;
const MAX_CONTENT = 12 * 1024 * 1024;
const hash = data => crypto.createHash('sha256').update(data).digest('hex');

function validateBundle(bundle) {
  if (bundle?.format !== 1 || bundle.minLauncher !== 1 || !/^[a-f0-9]{40}$/.test(bundle.build || '') ||
      !Number.isFinite(bundle.builtAt) || bundle.builtAt <= 0 || !Array.isArray(bundle.files) || !bundle.files.length || bundle.files.length > 500) {
    throw new Error('Paquete de actualización incompatible.');
  }
  const names = new Set(); let size = 0;
  const files = bundle.files.map(file => {
    const name = file?.path;
    if (typeof name !== 'string' || !/^[a-zA-Z0-9_./-]+$/.test(name) || name.split('/').some(part => !part || part === '.' || part === '..') ||
        !/\.(html|css|js|json|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|mp3|ogg|wav)$/i.test(name) || names.has(name.toLowerCase()) ||
        typeof file.data !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.data) || !/^[a-f0-9]{64}$/.test(file.sha256 || '')) {
      throw new Error('Archivo de actualización inválido.');
    }
    names.add(name.toLowerCase());
    const data = Buffer.from(file.data, 'base64'); size += data.length;
    if (size > MAX_CONTENT || hash(data) !== file.sha256) throw new Error('La actualización no supera la verificación de integridad.');
    return { path: name, data, sha256: file.sha256 };
  });
  if (!names.has('index.html')) throw new Error('Falta la pantalla de inicio.');
  return files;
}

function readCached(base) {
  try {
    const state = JSON.parse(fs.readFileSync(path.join(base, 'active.json'), 'utf8'));
    if (!/^[a-f0-9]{40}$/.test(state.build || '')) return null;
    const directory = path.join(base, state.build);
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
    if (manifest.build !== state.build || !Number.isFinite(manifest.builtAt) || !Array.isArray(manifest.files)) return null;
    if (manifest.files.some(file => typeof file?.path !== 'string' || !/^[a-zA-Z0-9_./-]+$/.test(file.path) || file.path.split('/').some(part => !part || part === '.' || part === '..'))) return null;
    // Reuse the same validation for cached paths and bytes before serving any local update.
    const bundle = { ...manifest, files: manifest.files.map(file => ({ ...file, data: fs.readFileSync(path.join(directory, 'game', file.path)).toString('base64') })) };
    validateBundle(bundle);
    return { ...manifest, root: path.join(directory, 'game') };
  } catch { return null; }
}

function stageBundle(base, bundle) {
  const files = validateBundle(bundle);
  fs.mkdirSync(base, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(base, 'download-'));
  try {
    for (const file of files) {
      const destination = path.join(temporary, 'game', file.path);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, file.data);
    }
    const manifest = { format: bundle.format, minLauncher: bundle.minLauncher, build: bundle.build, builtAt: bundle.builtAt,
      files: files.map(file => ({ path: file.path, sha256: file.sha256 })) };
    fs.writeFileSync(path.join(temporary, 'manifest.json'), JSON.stringify(manifest));
    const destination = path.join(base, bundle.build);
    if (fs.existsSync(destination)) fs.rmSync(destination, { recursive: true, force: true });
    fs.renameSync(temporary, destination);
    fs.writeFileSync(path.join(base, 'active.tmp'), JSON.stringify({ build: bundle.build }));
    fs.renameSync(path.join(base, 'active.tmp'), path.join(base, 'active.json'));
    return { ...manifest, root: path.join(destination, 'game') };
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}

async function limitedBody(response, limit) {
  if (!response.ok) throw new Error(`GitHub ha respondido con ${response.status}.`);
  if (Number(response.headers.get('content-length')) > limit) throw new Error('La actualización es demasiado grande.');
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error('La actualización es demasiado grande.');
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  } finally { await reader.cancel().catch(() => {}); }
}

async function checkForUpdate({ fetch, current, base, onStatus = () => {}, timeout = 30000 }) {
  const options = { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Futbol-Arcade-Updates' }, cache: 'no-store', signal: AbortSignal.timeout(timeout) };
  const release = JSON.parse((await limitedBody(await fetch(RELEASE_URL, options), 2 * 1024 * 1024)).toString('utf8'));
  const asset = release.assets?.find(item => item.name === ASSET_NAME);
  if (!asset || !/^sha256:[a-f0-9]{64}$/.test(asset.digest || '')) throw new Error('GitHub todavía no tiene un paquete de juego verificado.');
  const url = new URL(asset.browser_download_url);
  if (url.origin !== 'https://github.com' || !url.pathname.startsWith('/alecola1991-stack/FIELD/releases/download/')) throw new Error('Origen de actualización inválido.');
  onStatus('Descargando actualización', 'Descargando y comprobando el paquete de juego de GitHub…');
  const bytes = await limitedBody(await fetch(url.href, { cache: 'no-store', signal: AbortSignal.timeout(timeout) }), MAX_DOWNLOAD);
  if (`sha256:${hash(bytes)}` !== asset.digest) throw new Error('La descarga no coincide con la publicada en GitHub.');
  const bundle = JSON.parse(bytes.toString('utf8'));
  validateBundle(bundle);
  if (bundle.build === current.build || bundle.builtAt <= current.builtAt) return null;
  onStatus('Aplicando actualización', 'La descarga está verificada. Preparando la última versión…');
  return stageBundle(base, bundle);
}

module.exports = { ASSET_NAME, hash, validateBundle, readCached, stageBundle, limitedBody, checkForUpdate };
