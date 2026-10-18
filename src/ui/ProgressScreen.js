import { computeProgress, PROGRESS_PREFIX } from '../game/GameProgress.js';
import { TROPHY_ART } from './TrophyArt.js';
import { getTeamById } from '../config/teams.js';

// "Progreso" screen and the second page of the home menu: completion percentage, a card per
// category, the detail list of each one, the closest goals and the 100 % reward (golden name and kit).
const ICONS = {
  cup: TROPHY_ART.champions,
  league: TROPHY_ART.league,
  career: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 52h48M14 52V36h10v16M28 52V24h10v28M42 52V12h10v40"/></svg>',
  level: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M32 8 40 24l18 3-13 12 3 18-16-9-16 9 3-18L6 27l18-3Z"/></svg>',
  difficulty: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"><path d="M10 50h8V38h-8ZM24 50h8V30h-8ZM38 50h8V20h-8ZM52 50h4V10h-4Z"/></svg>',
  legends: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 46 16 18l12 14 4-20 4 20 12-14 6 28Z"/><path d="M10 54h44"/></svg>',
  achievements: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="24" r="14"/><path d="M24 36 20 56l12-7 12 7-4-20"/></svg>',
  online: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4"><circle cx="32" cy="32" r="22"/><ellipse cx="32" cy="32" rx="10" ry="22"/><path d="M10 26h44M10 38h44"/></svg>',
};
const COLORS = { cups: '#e7c56c', leagues: '#8dc3ff', career: '#f2cf5b', level: '#65e6a5', difficulty: '#f19676', legends: '#c7a2f0', achievements: '#79d3e8', online: '#83b4ff' };
const ACTION_LABEL = { competitions: 'Ir a copas y ligas', career: 'Ir al Modo Carrera', bot: 'Jugar un partido', legends: 'Ir a Leyendas', online: 'Ir al online' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const RING = 2 * Math.PI * 52;

export class ProgressScreen {
  constructor(ui) {
    this.ui = ui; this.root = document.getElementById('progress-root'); this.selected = null; this.page = 0;
    this.root?.addEventListener('click', event => this.onClick(event));
    const pager = document.getElementById('hub-pager');
    pager?.addEventListener('click', event => {
      const go = event.target.closest('[data-hub-go]'); if (go) { this.ui.sound?.play('click'); this.setPage(this.page + Number(go.dataset.hubGo)); return; }
      const next = event.target.closest('[data-progress-go]'); if (next) { this.ui.sound?.play('click'); this.goNext(); }
    });
    window.addEventListener('keydown', event => {
      if (this.ui.currentView !== 'home' || event.target?.closest?.('input,textarea,select')) return;
      if (event.key === 'ArrowRight' && this.page === 0) { event.preventDefault(); this.setPage(1); }
      else if (event.key === 'ArrowLeft' && this.page === 1) { event.preventDefault(); this.setPage(0); }
    });
    let touchX = null;
    pager?.addEventListener('touchstart', event => { touchX = event.touches[0]?.clientX ?? null; }, { passive: true });
    pager?.addEventListener('touchend', event => {
      if (touchX === null) return; const dx = (event.changedTouches[0]?.clientX ?? touchX) - touchX; touchX = null;
      if (Math.abs(dx) > 60) this.setPage(this.page + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }

  data() {
    return computeProgress({ trophyIds: this.ui.career.trophies.map(item => item.id), level: this.ui.progression.level });
  }

  setPage(page) {
    const next = Math.max(0, Math.min(1, page)); if (next === this.page) return;
    const direction = next > this.page ? 'from-right' : 'from-left'; this.page = next;
    document.querySelectorAll('[data-hub-page]').forEach(node => {
      const active = Number(node.dataset.hubPage) === next;
      node.classList.toggle('active', active); node.classList.remove('from-right', 'from-left');
      if (active) { void node.offsetWidth; node.classList.add(direction); }
    });
    document.querySelectorAll('.hub-page-dots i').forEach((dot, index) => dot.classList.toggle('active', index === next));
    document.querySelector('.hub-page-arrow.prev')?.classList.toggle('hidden-arrow', next === 0);
    document.querySelector('.hub-page-arrow.next')?.classList.toggle('hidden-arrow', next === 1);
    if (next === 1) this.renderHome(true);
  }

  // Home page 2: ring, mini bars, next goal and the closest goals.
  renderHome(animate = false) {
    const progress = this.data();
    const percent = document.getElementById('home-progress-percent'); if (!percent) return progress;
    percent.textContent = `${progress.percent} %`;
    document.getElementById('home-progress-title').textContent = progress.title.label;
    const ring = document.getElementById('home-progress-ring');
    ring.style.strokeDasharray = `${RING}`;
    if (animate) { ring.style.transition = 'none'; ring.style.strokeDashoffset = `${RING}`; void ring.getBoundingClientRect(); ring.style.transition = ''; }
    ring.style.strokeDashoffset = `${RING * (1 - progress.exact / 100)}`;
    document.getElementById('home-progress-bars').innerHTML = progress.categories.map(category => `<span style="--c:${COLORS[category.id]}"><i style="width:${Math.round(category.ratio * 100)}%"></i></span>`).join('');
    const next = progress.nearest[0];
    document.getElementById('home-next-goal').textContent = next ? next.item.label : '¡Todo completado!';
    document.getElementById('home-next-hint').textContent = next ? `${next.category.label} · ${next.item.hint}` : 'Tienes el nombre dorado.';
    document.getElementById('home-near-list').innerHTML = progress.nearest.map(goal => `<span><b style="color:${COLORS[goal.category.id]}">${esc(goal.category.label)}</b>${esc(goal.item.label)}<em>${goal.category.id === 'level' ? `${goal.left} niveles` : `faltan ${goal.left}`}</em></span>`).join('') || '<span>¡Juego completado al 100 %!</span>';
    const badge = document.querySelector('.hub-arrow-badge'); if (badge) badge.textContent = `PROGRESO ${progress.percent} %`;
    return progress;
  }

  goNext() {
    const next = this.data().nearest[0];
    if (!next) { this.open(); return; }
    this.go(next.category.action);
  }
  go(action) {
    if (action === 'online') this.ui.openOnline();
    else if (action === 'competitions' || action === 'career' || action === 'legends' || action === 'bot') this.ui.selectMode(action);
    else this.ui.show('play');
  }

  open() { this.ui.show('progress'); }

  onClick(event) {
    const target = event.target.closest('[data-progress]'); if (!target) return;
    const action = target.dataset.progress; this.ui.sound?.play('click');
    if (action === 'category') { this.selected = this.selected === target.dataset.value ? null : target.dataset.value; this.render(false); this.root.querySelector('.progress-detail')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    else if (action === 'go') this.go(target.dataset.value);
    else if (action === 'gold-kit') {
      if (!this.data().complete) return;
      this.ui.settings.goldKit = !this.ui.settings.goldKit; this.ui.persist(); this.render(false);
    }
  }

  render(animate = true) {
    if (!this.root) return;
    const progress = this.data(), selected = progress.categories.find(category => category.id === this.selected) || null;
    const gold = progress.complete, goldKit = gold && !!this.ui.settings.goldKit, team = getTeamById(this.ui.settings.teamId);
    const name = (this.ui.settings.name || 'JUGADOR').toUpperCase();
    this.root.innerHTML = `
      <header class="progress-hero">
        <div class="progress-ring-big" aria-label="${progress.percent} % completado"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" class="ring-bg"/><circle cx="60" cy="60" r="52" class="ring-fill" style="stroke-dasharray:${RING};stroke-dashoffset:${animate ? RING : RING * (1 - progress.exact / 100)}"/></svg><span><strong data-count="${progress.percent}">${animate ? 0 : progress.percent}</strong><small>%</small></span></div>
        <div class="progress-hero-copy"><p class="eyebrow">TU PROGRESO · ${esc(progress.title.label.toUpperCase())}</p><h2>${gold ? 'Juego <em>completado.</em>' : `Llevas el <em>${progress.percent} %.</em>`}</h2>
          <p>${gold ? 'Lo has conseguido todo. Tu nombre brilla en dorado en el online y en tu perfil.' : 'Gana copas y ligas, completa carreras, sube de nivel y vence a las leyendas. Al llegar al 100 % tu nombre será dorado.'}</p>
          <ol class="progress-titles">${['Novato', 'Aficionado', 'Veterano', 'Maestro', 'Completista'].map(label => `<li class="${label === progress.title.label ? 'active' : ''}">${label}</li>`).join('')}</ol></div>
        ${progress.nearest[0] ? `<button type="button" class="progress-next" data-progress="go" data-value="${progress.nearest[0].category.action}"><small>SIGUIENTE OBJETIVO</small><strong>${esc(progress.nearest[0].item.label)}</strong><span>${esc(progress.nearest[0].item.hint)}</span><b>${ACTION_LABEL[progress.nearest[0].category.action] || 'Ir'} ↗</b></button>` : ''}
      </header>
      <div class="progress-grid">${progress.categories.map((category, index) => `
        <button type="button" class="progress-card ${category.ratio >= 1 ? 'complete' : ''} ${selected?.id === category.id ? 'selected' : ''}" data-progress="category" data-value="${category.id}" style="--c:${COLORS[category.id]};--delay:${index * 45}ms">
          <span class="progress-card-icon">${ICONS[category.icon]}</span>
          <span class="progress-card-head"><strong>${esc(category.label)}</strong><small>${category.weight} % DEL TOTAL</small></span>
          <b class="progress-card-count">${category.ratio >= 1 ? '✓' : `${Math.round(category.ratio * 100)} %`}</b>
          <span class="progress-bar"><i style="width:${category.ratio * 100}%"></i></span>
          <small class="progress-card-sub">${esc(category.countLabel)}</small>
        </button>`).join('')}</div>
      ${selected ? this.detail(selected) : ''}
      <div class="progress-bottom">
        <section class="progress-near"><p class="card-kicker">TE QUEDA POCO</p>${progress.nearest.length ? `<ul>${progress.nearest.map(goal => `<li style="--c:${COLORS[goal.category.id]}"><span class="progress-card-icon mini">${ICONS[goal.category.icon]}</span><span><b>${esc(goal.item.label)}</b><small>${esc(goal.item.hint)}</small></span><em>${goal.category.id === 'level' ? `${goal.left} niveles` : `faltan ${goal.left}`}</em></li>`).join('')}</ul>` : '<p class="progress-empty">No te queda nada. ¡Eres completista!</p>'}</section>
        <section class="progress-reward ${gold ? 'unlocked' : ''}"><p class="card-kicker">RECOMPENSA DEL 100 %</p>
          <div class="progress-reward-body"><span class="match-team-preview progress-reward-kit ${goldKit || !gold ? 'gold-dorsal' : ''}" data-preview-team="${esc(team?.id || '')}"></span>
            <div><strong class="gold-name">${esc(name)}</strong><p>${gold ? 'Nombre dorado animado en el online y en tu perfil.' : 'Nombre dorado animado en el online y en tu perfil, y dorsal dorado con cualquier equipo.'}</p>
            <button type="button" class="progress-toggle ${goldKit ? 'on' : ''}" data-progress="gold-kit" ${gold ? '' : 'disabled'} aria-pressed="${goldKit}"><i></i>${gold ? 'Dorsal y nombre dorados en la equipación' : `🔒 Se desbloquea al 100 % (llevas ${progress.percent} %)`}</button></div></div>
        </section>
      </div>`;
    for (const node of this.root.querySelectorAll('[data-preview-team]')) {
      this.ui.paintPlayerPreview(node, getTeamById(node.dataset.previewTeam), { name: name.slice(0, 10), number: this.ui.settings.number });
    }
    if (animate) requestAnimationFrame(() => requestAnimationFrame(() => {
      const fill = this.root.querySelector('.progress-ring-big .ring-fill'); if (fill) fill.style.strokeDashoffset = `${RING * (1 - progress.exact / 100)}`;
      const count = this.root.querySelector('[data-count]'), to = Number(count?.dataset.count) || 0, start = performance.now();
      const step = now => { const t = Math.min(1, (now - start) / 1100); if (count) count.textContent = String(Math.round(to * (1 - (1 - t) ** 3))); if (t < 1 && count?.isConnected) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }));
  }

  detail(category) {
    const done = category.items.filter(item => item.done).length;
    const groups = category.id === 'leagues' ? category.items : null;
    return `<section class="progress-detail" style="--c:${COLORS[category.id]}">
      <header><span class="progress-card-icon">${ICONS[category.icon]}</span><div><p class="card-kicker">${esc(category.label.toUpperCase())} · ${esc(category.countLabel)}</p><h3>${category.ratio >= 1 ? '¡Categoría completada!' : `Te quedan ${category.id === 'level' ? 100 - category.done + ' niveles' : category.total - done}`}</h3>${category.id === 'leagues' ? '<small class="progress-detail-note">Gana una temporada de Liga Nacional en cada primera división.</small>' : ''}</div>
        <button type="button" class="career-ghost" data-progress="go" data-value="${category.action}">${ACTION_LABEL[category.action] || 'Ir'} ↗</button></header>
      <ul class="progress-items">${(groups || category.items).map(item => `<li class="${item.done ? 'done' : ''}"><i>${item.done ? '✓' : '○'}</i><span><b>${esc(item.label)}</b>${item.group ? `<em>${esc(item.group)}</em>` : ''}${category.id === 'leagues' ? '' : `<small>${item.done ? 'Conseguido' : esc(item.hint)}</small>`}</span></li>`).join('')}</ul>
    </section>`;
  }
}

export const isProgressTrophy = id => String(id || '').startsWith(PROGRESS_PREFIX);
