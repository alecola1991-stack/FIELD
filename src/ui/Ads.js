// Google AdSense slots: a banner on the home screen and two vertical rails beside the pitch during matches.
// Only the public web build shows ads (the desktop build does not load AdSense). A slot is filled the first
// time it is visible with a real size; slots that AdSense leaves unfilled (or that an ad blocker removes) hide.
const CLIENT = 'ca-pub-8681886004807247';
export const AD_SLOTS = Object.freeze({ home: '1179611412', match: '2319187280' });
const RAIL_MIN_WIDTH = 120, RAIL_MAX_WIDTH = 300, RAIL_GAP = 8; // vertical ads need at least 120 px

export function adsEnabled() {
  if (typeof window === 'undefined' || typeof document?.querySelector !== 'function' || typeof document.createElement !== 'function') return false;
  if (import.meta.env?.MODE === 'desktop' || /electron/i.test(navigator.userAgent || '')) return false;
  return !!document.querySelector('script[src*="adsbygoogle.js"]');
}

function createSlot(slot, className, format) {
  const box = document.createElement('aside');
  box.className = `ad-slot ${className}`; box.setAttribute('aria-label', 'Publicidad'); box.hidden = true;
  const label = document.createElement('span'); label.className = 'ad-label'; label.textContent = 'PUBLICIDAD';
  const ins = document.createElement('ins');
  ins.className = 'adsbygoogle'; ins.style.display = 'block';
  ins.dataset.adClient = CLIENT; ins.dataset.adSlot = slot; ins.dataset.adFormat = format; ins.dataset.fullWidthResponsive = 'false';
  box.append(label, ins);
  return box;
}

function fill(box) {
  const ins = box?.querySelector('ins.adsbygoogle');
  if (!ins || ins.dataset.requested || !ins.offsetWidth) return;
  ins.dataset.requested = '1';
  try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* AdSense not ready or blocked: the slot stays empty. */ }
}

export class Ads {
  constructor() {
    this.enabled = adsEnabled();
    if (!this.enabled) return;
    const home = document.querySelector('#home-screen .home-content');
    this.home = createSlot(AD_SLOTS.home, 'home-ad', 'horizontal');
    home?.after(this.home);
    const wrap = document.querySelector('#game-screen .field-wrap') || document.querySelector('.field-wrap');
    this.rails = ['left', 'right'].map(side => { const rail = createSlot(AD_SLOTS.match, `match-rail ${side}`, 'vertical'); wrap?.append(rail); return rail; });
    window.addEventListener('resize', () => { clearTimeout(this.resizeTimer); this.resizeTimer = setTimeout(() => this.refresh(), 120); });
  }

  // Called on every view change and resize.
  update(view, renderer) {
    this.view = view; this.renderer = renderer; this.refresh();
    // The pitch canvas gets its real size a moment after the game screen appears.
    clearTimeout(this.viewTimer); this.viewTimer = setTimeout(() => this.refresh(), 150);
  }

  refresh() {
    if (!this.enabled) return;
    this.home.hidden = this.view !== 'home';
    if (!this.home.hidden) requestAnimationFrame(() => {
      // Never make the home screen scroll: without room for the banner, it is not shown.
      const root = document.documentElement;
      if (window.innerWidth > 900 && root.scrollHeight > window.innerHeight + 1 && !this.home.querySelector('ins[data-ad-status="filled"]')) { this.home.hidden = true; return; }
      fill(this.home);
    });
    const margin = this.railMargin();
    const width = Math.min(RAIL_MAX_WIDTH, Math.floor(margin - RAIL_GAP * 2));
    const show = this.view === 'game' && width >= RAIL_MIN_WIDTH;
    for (const rail of this.rails) {
      rail.hidden = !show; if (!show) continue;
      rail.style.setProperty('--rail-width', `${width}px`);
      rail.style.setProperty('--rail-gap', `${Math.max(RAIL_GAP, (margin - width) / 2)}px`);
      requestAnimationFrame(() => fill(rail));
    }
  }

  // Free space (css px) between the canvas edge and the drawn pitch; only on landscape layouts.
  railMargin() {
    const r = this.renderer;
    if (!r || r.rotated || !r.canvas) return 0;
    if (window.matchMedia?.('(pointer:coarse)').matches) return 0;
    return (r.ox || 0) / (r.dpr || 1);
  }
}
