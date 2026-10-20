// Settings → Descargar: the Windows version (installer and Portable) from the GitHub release.
// File names carry the version, so the links come from the release itself; until it answers
// (or if it cannot), both buttons open the release page.
export const RELEASE_PAGE = 'https://github.com/alecola1991-stack/FIELD/releases/tag/windows-latest';
const RELEASE_API = 'https://api.github.com/repos/alecola1991-stack/FIELD/releases/tags/windows-latest';

const megabytes = bytes => `${Math.round(bytes / 1048576)} MB`;

// { version, setup: {url, size}, portable: {url, size} } from the GitHub release data.
export function readRelease(data) {
  const assets = Array.isArray(data?.assets) ? data.assets : [];
  const find = kind => {
    const asset = assets.find(item => new RegExp(`^Futbol-Arcade-${kind}-(\\d+\\.\\d+\\.\\d+)\\.exe$`).test(item?.name || ''));
    return asset && /^https:\/\/github\.com\//.test(asset.browser_download_url || '') ? { url: asset.browser_download_url, size: Number(asset.size) || 0, version: asset.name.match(/(\d+\.\d+\.\d+)/)[1] } : null;
  };
  const setup = find('Setup'), portable = find('Portable');
  return { version: setup?.version || portable?.version || null, setup, portable };
}

export function isDesktopApp(location = globalThis.location) { return location?.protocol === 'arcade:'; }

export class DesktopDownload {
  constructor({ fetcher = (...args) => fetch(...args), root = document } = {}) {
    this.fetcher = fetcher; this.root = root; this.loaded = null;
  }
  // Fills in versions, sizes and direct links once per page load.
  load() {
    if (!this.loaded) this.loaded = this.fetchRelease().then(release => { this.render(release); return release; }).catch(() => { this.render(null); return null; });
    return this.loaded;
  }
  async fetchRelease() {
    const response = await this.fetcher(RELEASE_API, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('release');
    return readRelease(await response.json());
  }
  render(release) {
    const get = id => this.root.getElementById?.(id) || this.root.querySelector?.(`#${id}`);
    for (const [kind, label] of [['setup', 'Descargar instalador'], ['portable', 'Descargar Portable']]) {
      const link = get(`download-${kind}`), meta = get(`download-${kind}-meta`), file = release?.[kind];
      if (link) { link.href = file?.url || RELEASE_PAGE; link.textContent = label; }
      if (meta) meta.textContent = file ? `Versión ${file.version} · ${megabytes(file.size)}` : 'Se abrirá la página de descargas';
    }
    const status = get('download-status');
    if (status) status.textContent = release?.version ? `Última versión: ${release.version}` : 'Consulta la última versión en la página de descargas.';
  }
}
