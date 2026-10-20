import test from 'node:test';
import assert from 'node:assert/strict';
import { readRelease, RELEASE_PAGE, DesktopDownload, isDesktopApp } from '../src/ui/DesktopDownload.js';

const base = 'https://github.com/alecola1991-stack/FIELD/releases/download/windows-latest/';
const release = { assets: [
  { name: 'Futbol-Arcade-Portable-1.3.0.exe', size: 109890000, browser_download_url: base + 'Futbol-Arcade-Portable-1.3.0.exe' },
  { name: 'Futbol-Arcade-Setup-1.3.0.exe', size: 110100000, browser_download_url: base + 'Futbol-Arcade-Setup-1.3.0.exe' },
  { name: 'game-update.json', size: 1, browser_download_url: base + 'game-update.json' },
] };

test('download links come from the release: installer, Portable, version and size', () => {
  const info = readRelease(release);
  assert.equal(info.version, '1.3.0');
  assert.equal(info.setup.url, base + 'Futbol-Arcade-Setup-1.3.0.exe'); assert.equal(info.portable.url, base + 'Futbol-Arcade-Portable-1.3.0.exe');
  // Anything outside github.com is ignored.
  assert.equal(readRelease({ assets: [{ name: 'Futbol-Arcade-Setup-9.9.9.exe', browser_download_url: 'https://evil.example/x.exe' }] }).setup, null);
  assert.deepEqual(readRelease(null), { version: null, setup: null, portable: null });
});

function page() {
  const nodes = Object.fromEntries(['download-setup', 'download-portable', 'download-setup-meta', 'download-portable-meta', 'download-status'].map(id => [id, { href: '', textContent: '' }]));
  return { nodes, root: { getElementById: id => nodes[id] } };
}

test('the panel fills in direct links, and falls back to the release page', async () => {
  const ok = page();
  await new DesktopDownload({ root: ok.root, fetcher: async () => ({ ok: true, json: async () => release }) }).load();
  assert.equal(ok.nodes['download-setup'].href, base + 'Futbol-Arcade-Setup-1.3.0.exe');
  assert.equal(ok.nodes['download-setup-meta'].textContent, 'Versión 1.3.0 · 105 MB');
  assert.match(ok.nodes['download-status'].textContent, /1\.3\.0/);
  const offline = page();
  await new DesktopDownload({ root: offline.root, fetcher: async () => { throw new Error('offline'); } }).load();
  assert.equal(offline.nodes['download-portable'].href, RELEASE_PAGE);
  assert.equal(isDesktopApp({ protocol: 'arcade:' }), true); assert.equal(isDesktopApp({ protocol: 'https:' }), false);
});
