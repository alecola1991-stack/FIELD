import { getTeamById } from '../config/teams.js';
import { crestSVG } from '../config/crests.js';
import { TROPHY_ART } from './TrophyArt.js';
import {
  CAREER_SEASONS, CAREER_POINTS, COMPETITION_NAMES, careerCountries, createStartingOffers, createCareer, nextCareerMatch,
  startNextSeason, careerScore, careerTitle, careerLeagueOf, leagueTier, leagueName, leaguesOf, continentalFor, countryOfLeague,
  nationalTournamentFor, loadCareer, saveCareer, clearCareer, loadCareerBest, saveCareerBest,
} from '../game/CareerMode.js';

// Simple flag drawings (CSS backgrounds) for the career countries.
const FLAGS = {
  spain: 'linear-gradient(#AA151B 25%,#F1BF00 25% 75%,#AA151B 75%)',
  england: 'linear-gradient(#CE1124 0 0) center/100% 20% no-repeat,linear-gradient(#CE1124 0 0) center/14% 100% no-repeat,#fff',
  italy: 'linear-gradient(90deg,#009246 33.3%,#fff 33.3% 66.6%,#CE2B37 66.6%)',
  france: 'linear-gradient(90deg,#0055A4 33.3%,#fff 33.3% 66.6%,#EF4135 66.6%)',
  germany: 'linear-gradient(#111 33.3%,#DD0000 33.3% 66.6%,#FFCE00 66.6%)',
  argentina: 'radial-gradient(circle,#F6B40E 0 11%,transparent 12%),linear-gradient(#74ACDF 33.3%,#fff 33.3% 66.6%,#74ACDF 66.6%)',
  mexico: 'radial-gradient(circle,#8C5B2B 0 10%,transparent 11%),linear-gradient(90deg,#006847 33.3%,#fff 33.3% 66.6%,#CE1126 66.6%)',
  brazil: 'radial-gradient(circle,#002776 0 17%,transparent 18%),linear-gradient(45deg,transparent 24%,#FFDF00 24% 76%,transparent 76%) center/70% 100% no-repeat,#009C3B',
  'north-america': 'linear-gradient(#3C3B6E 0 0) 0 0/42% 54% no-repeat,repeating-linear-gradient(#B22234 0 7.7%,#fff 7.7% 15.4%)',
  portugal: 'radial-gradient(circle at 40% 50%,#FFE000 0 13%,transparent 14%),linear-gradient(90deg,#006600 40%,#FF0000 40%)',
  belgium: 'linear-gradient(90deg,#111 33.3%,#FDDA24 33.3% 66.6%,#EF3340 66.6%)',
  turkey: 'radial-gradient(circle at 44% 50%,#E30A17 0 17%,transparent 18%),radial-gradient(circle at 37% 50%,#fff 0 23%,transparent 24%),#E30A17',
  netherlands: 'linear-gradient(#AE1C28 33.3%,#fff 33.3% 66.6%,#21468B 66.6%)',
  scotland: 'linear-gradient(32deg,transparent 44%,#fff 44% 56%,transparent 56%),linear-gradient(-32deg,transparent 44%,#fff 44% 56%,transparent 56%),#005EB8',
  'saudi-arabia': 'linear-gradient(transparent 62%,#fff 62% 68%,transparent 68%) center/60% 100% no-repeat,#006C35',
  colombia: 'linear-gradient(#FCD116 50%,#003893 50% 75%,#CE1126 75%)',
  chile: 'radial-gradient(circle at 19% 25%,#fff 0 9%,transparent 10%),linear-gradient(#0039A6 0 0) 0 0/38% 50% no-repeat,linear-gradient(#fff 50%,#D52B1E 50%)',
  uruguay: 'radial-gradient(circle at 18% 27%,#FCD116 0 10%,transparent 11%),linear-gradient(#fff 0 0) 0 0/36% 56% no-repeat,repeating-linear-gradient(#fff 0 11.1%,#0038A8 11.1% 22.2%)',
  austria: 'linear-gradient(#ED2939 33.3%,#fff 33.3% 66.6%,#ED2939 66.6%)',
  switzerland: 'linear-gradient(#fff 0 0) center/56% 20% no-repeat,linear-gradient(#fff 0 0) center/20% 56% no-repeat,#DA291C',
};
const PROMOTION_ART = '<svg viewBox="0 0 100 100"><path d="M50 12 82 46H62v38H38V46H18Z" fill="currentColor"/><path d="M42 54h16M42 64h16M42 74h16" stroke="#0b1d39" stroke-width="3" opacity=".35"/></svg>';
const TROPHY_COLORS = { league: '#8dc3ff', promotion: '#65e6a5', champions: '#d9e6ff', 'copa-libertadores': '#f0a35c', 'club-world-cup': '#e7c56c', 'world-cup': '#f2cf5b', euro: '#a9cdf5', 'copa-america': '#e9c76a' };
const TIER_LABELS = { 1: '1ª', 2: '2ª', 3: '3ª', 4: '4ª' };
const OUTCOMES = {
  champion: { title: '¡Campeones!', tag: 'CAMPEÓN DE LIGA', tone: 'gold' },
  'runner-up': { title: 'Subcampeones', tag: '2º PUESTO', tone: 'green' },
  'playoff-won': { title: '¡Promoción ganada!', tag: 'PROMOCIÓN', tone: 'green' },
  'playoff-lost': { title: 'Promoción perdida', tag: 'PROMOCIÓN', tone: 'blue' },
  mid: { title: 'Mitad de tabla', tag: 'TEMPORADA REGULAR', tone: 'blue' },
  low: { title: 'Temporada difícil', tag: 'PARTE BAJA', tone: 'red' },
};

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const fmt = value => Number(value || 0).toLocaleString('es-ES');
const stars = count => '★'.repeat(Math.max(1, Math.min(5, count || 3)));
const kit = (team, size = '') => `<i class="career-kit crest ${size}" aria-hidden="true">${crestSVG(team)}</i>`;
function trophyArt(kind) { return kind === 'promotion' ? PROMOTION_ART : kind === 'club-world-cup' ? TROPHY_ART['world-cup'] : TROPHY_ART[kind] || TROPHY_ART.league; }
function trophyIcon(kind, extra = '') { return `<span class="career-trophy-icon ${extra}" style="--trophy:${TROPHY_COLORS[kind] || '#8dc3ff'}">${trophyArt(kind)}</span>`; }

export class CareerScreen {
  constructor(ui) {
    this.ui = ui; this.root = document.getElementById('career-root'); this.view = 'landing'; this.draft = null;
    this.state = loadCareer();
    this.root?.addEventListener('click', event => this.onClick(event));
    window.addEventListener('keydown', event => {
      if (event.code !== 'Space' || event.repeat || event.defaultPrevented || this.ui.currentView !== 'career' || event.target?.closest?.('input,textarea,select,button')) return;
      const primary = this.root.querySelector('[data-career-space]');
      if (primary) { event.preventDefault(); primary.click(); }
    });
  }

  reload() { this.state = loadCareer(); this.renderHomeStatus(); }
  save() { if (this.state) saveCareer(this.state); this.renderHomeStatus(); }
  best() { return loadCareerBest(); }
  storeBest(score, title) { return saveCareerBest(score, title); }

  // Home tile subtitle: progress of the saved career.
  renderHomeStatus() {
    const node = document.getElementById('home-career-status'); if (!node) return;
    const state = this.state;
    if (state && state.phase !== 'finished') node.textContent = `Temporada ${state.season}/${CAREER_SEASONS} · ${getTeamById(state.clubId)?.name || ''} · ${fmt(careerScore(state))} pts`;
    else node.textContent = '10 temporadas. De las divisiones bajas a leyenda.';
  }

  open() {
    this.reload();
    this.view = this.state?.phase === 'season' ? 'hub' : this.state?.phase === 'summary' ? 'summary' : 'landing';
    this.render(); this.ui.show('career');
  }
  // After a career match: back to the hub or to the season summary.
  returnFromMatch() {
    this.reload();
    this.view = this.state?.phase === 'summary' ? 'summary' : this.state?.phase === 'finished' ? 'final' : 'hub';
    this.render(); this.ui.show('career');
  }

  setView(view) { this.view = view; this.render(); this.root.scrollTop = 0; window.scrollTo?.(0, 0); }

  onClick(event) {
    const target = event.target.closest('[data-career]'); if (!target) return;
    const action = target.dataset.career, value = target.dataset.value;
    this.ui.sound?.play('click');
    if (action === 'new') { this.draft = { country: null, offers: [], format: this.ui.soloFormat?.() || '1v1' }; this.setView('country'); }
    else if (action === 'continue') this.setView(this.state.phase === 'season' ? 'hub' : this.state.phase === 'summary' ? 'summary' : 'final');
    else if (action === 'landing') this.setView('landing');
    else if (action === 'abandon') {
      if (!this.root.querySelector('.career-confirm')) { target.insertAdjacentHTML('afterend', '<span class="career-confirm">¿Seguro? Se perderá la carrera. <button type="button" data-career="abandon-yes">Sí, empezar de cero</button></span>'); return; }
    } else if (action === 'abandon-yes') { clearCareer(); this.state = null; this.renderHomeStatus(); this.draft = { country: null, offers: [], format: this.ui.soloFormat?.() || '1v1' }; this.setView('country'); }
    else if (action === 'country') { this.draft.country = value; this.draft.offers = createStartingOffers(value); this.setView('club'); }
    else if (action === 'reroll') { this.draft.offers = createStartingOffers(this.draft.country); this.render(); }
    else if (action === 'format') { this.draft.format = value; this.render(); }
    else if (action === 'pick-club') {
      this.state = createCareer({ countryId: this.draft.country, clubId: value, format: this.draft.format });
      this.save(); this.setView('hub');
    } else if (action === 'play') this.ui.startCareerMatch();
    else if (action === 'stay' || action === 'sign') {
      startNextSeason(this.state, action === 'sign' ? value : null);
      this.save(); this.ui.trackCareer?.(this.state);
      if (this.state.phase === 'finished') this.finish(); else this.setView('hub');
    } else if (action === 'finish') { startNextSeason(this.state); this.save(); this.finish(); }
    else if (action === 'home') this.ui.show('home');
  }

  finish() {
    const score = careerScore(this.state), title = careerTitle(score);
    this.state.record = this.storeBest(score, title.label);
    this.save(); this.ui.trackCareer?.(this.state, true); this.ui.confetti?.play(); this.ui.sound?.play('win'); this.setView('final');
  }

  render() {
    if (!this.root) return;
    const views = { landing: () => this.landing(), country: () => this.countryView(), club: () => this.clubView(), hub: () => this.hub(), summary: () => this.summary(), final: () => this.finalView() };
    if (['hub', 'summary', 'final'].includes(this.view) && !this.state) this.view = 'landing';
    this.root.className = `career-root view-${this.view}`;
    this.root.innerHTML = (views[this.view] || views.landing)();
    const tag = document.getElementById('career-header-tag');
    if (tag) tag.textContent = this.state && ['hub', 'summary'].includes(this.view) ? `MODO CARRERA · TEMPORADA ${this.state.season}/${CAREER_SEASONS}` : 'MODO CARRERA';
    for (const node of this.root.querySelectorAll('[data-preview-team]')) {
      this.ui.paintPlayerPreview(node, getTeamById(node.dataset.previewTeam), { name: (this.ui.settings.name || '').slice(0, 10).toUpperCase(), number: this.ui.settings.number });
    }
    this.root.querySelector('[data-count-to]') && this.countUp(this.root.querySelector('[data-count-to]'));
  }

  countUp(node) {
    const to = Number(node.dataset.countTo) || 0, start = performance.now(), duration = 1400;
    const step = now => { const t = Math.min(1, (now - start) / duration); node.textContent = fmt(Math.round(to * (1 - (1 - t) ** 3))); if (t < 1 && node.isConnected) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  // ---- Landing ------------------------------------------------------------
  landing() {
    const state = this.state, best = this.best();
    const active = state && state.phase !== 'finished';
    const club = active ? getTeamById(state.clubId) : null;
    const scoring = [['league', 'Liga (cualquier división)', CAREER_POINTS.league], ['promotion', 'Ascenso', CAREER_POINTS.promotion], ['champions', 'Champions o Libertadores', CAREER_POINTS.champions],
      ['copa-america', 'Eurocopa o Copa América', CAREER_POINTS.euro], ['club-world-cup', 'Mundial de Clubes', CAREER_POINTS['club-world-cup']], ['world-cup', 'Mundial', CAREER_POINTS['world-cup']]];
    return `
      <div class="career-landing">
        <div class="career-intro">
          <p class="eyebrow">MODO CARRERA · ${CAREER_SEASONS} TEMPORADAS</p>
          <h2>De abajo <em>a leyenda.</em></h2>
          <p class="career-lead">Empieza en un club modesto, gana los partidos clave de cada temporada, asciende y llena tu vitrina. Al llegar a primera, tu selección te llama.</p>
          <ol class="career-steps">
            <li><b>1</b><span><strong>Elige país</strong><small>20 países con sus divisiones</small></span></li>
            <li><b>2</b><span><strong>Elige club</strong><small>5 ofertas, casi siempre de abajo</small></span></li>
            <li><b>3</b><span><strong>2 partidos por competición</strong><small>Deciden títulos y ascensos</small></span></li>
            <li><b>4</b><span><strong>Vitrina final</strong><small>Suma puntos por cada trofeo</small></span></li>
          </ol>
          <div class="career-actions">
            ${active ? `<button type="button" class="career-continue" data-career="continue" data-career-space>${kit(club, 'big')}<span><small>CONTINUAR · TEMPORADA ${state.season}/${CAREER_SEASONS}</small><strong>${esc(club?.name)}</strong><em>${fmt(careerScore(state))} puntos · ${state.trophies.length} trofeos</em></span><b>▶</b></button>` : ''}
            <button type="button" class="${active ? 'career-ghost' : 'primary-button career-start'}" data-career="${active ? 'abandon' : 'new'}" ${active ? '' : 'data-career-space'}>${active ? 'Empezar otra carrera' : 'Empezar carrera <span>ESPACIO ↗</span>'}</button>
          </div>
        </div>
        <aside class="career-scoring">
          <p class="card-kicker">ASÍ SE PUNTÚA</p>
          <ul>${scoring.map(([kind, label, points]) => `<li>${trophyIcon(kind)}<span>${label}</span><b>+${points}</b></li>`).join('')}
            <li class="loyal">${trophyIcon('league', 'loyal-icon')}<span>Terminar en tu primer club</span><b>+${CAREER_POINTS.loyalty}</b></li></ul>
          <div class="career-best">${best ? `<small>TU RÉCORD</small><strong>${fmt(best.score)}</strong><em>${esc(best.title)}</em>` : '<small>TU RÉCORD</small><strong>—</strong><em>Aún sin carreras</em>'}</div>
        </aside>
      </div>`;
  }

  // ---- New career: country, then club ------------------------------------
  countryView() {
    const countries = careerCountries(), format = this.draft?.format || '1v1';
    return `
      <div class="career-step-head"><div><p class="eyebrow">NUEVA CARRERA · PASO 1 DE 2</p><h2>¿Dónde <em>empiezas?</em></h2><p>Elige un país. Te ofrecerán 5 clubes, y cuanto más baja la división, más fácil es que salga.</p></div>
        <div class="career-format"><span class="field-label">FORMATO</span><div class="solo-format-options">${['1v1', '2v2'].map(id => `<button type="button" data-career="format" data-value="${id}" class="${format === id ? 'active' : ''}">${id === '1v1' ? '1 contra 1' : '2 contra 2 <small>con IA</small>'}</button>`).join('')}</div></div></div>
      <div class="career-country-grid">${countries.map(country => {
        const leagues = leaguesOf(country.id);
        const cup = continentalFor(country.id), regional = nationalTournamentFor(country.id, 4);
        return `<button type="button" class="career-country" data-career="country" data-value="${country.id}">
          <i class="career-flag" style="background:${FLAGS[country.id] || '#345'}"></i>
          <strong>${esc(country.label)}</strong>
          <small>${leagues.length} ${leagues.length === 1 ? 'liga' : 'ligas'} · ${country.tiers.length} ${country.tiers.length === 1 ? 'división' : 'divisiones'}</small>
          <span class="career-country-tags">${country.tiers.map(tier => `<em class="tier-${tier}">${TIER_LABELS[tier]}</em>`).join('')}</span>
          <span class="career-country-cups">${[cup, regional, 'world-cup'].filter(Boolean).map(kind => `<span>${trophyIcon(kind, 'mini')}${esc(COMPETITION_NAMES[kind])}</span>`).join('')}</span>
        </button>`;
      }).join('')}</div>
      <div class="career-footer"><button type="button" class="career-ghost" data-career="landing">← Volver</button></div>`;
  }

  clubView() {
    const country = careerCountries().find(item => item.id === this.draft.country);
    return `
      <div class="career-step-head"><div><p class="eyebrow">NUEVA CARRERA · PASO 2 DE 2 · ${esc(country?.label.toUpperCase())}</p><h2>Cinco clubes <em>te quieren.</em></h2><p>Elige uno. Jugarás con él hasta que asciendas o aceptes otra oferta.</p></div>
        <button type="button" class="career-ghost" data-career="reroll">↻ Otras ofertas</button></div>
      <div class="career-offer-grid">${this.draft.offers.map((id, index) => {
        const team = getTeamById(id), tier = leagueTier(team.league);
        return `<button type="button" class="career-offer" data-career="pick-club" data-value="${id}" style="--delay:${index * 70}ms">
          <span class="career-tier-badge tier-${tier}">${TIER_LABELS[tier] || tier} DIVISIÓN</span>
          <span class="match-team-preview career-offer-kit" data-preview-team="${id}"></span><i class="career-offer-crest" aria-hidden="true">${crestSVG(getTeamById(id))}</i>
          <strong>${esc(team.name)}</strong><small>${esc(leagueName(team.league))}</small>
          <span class="career-stars">${stars(team.stars)}</span>
          <span class="career-offer-goal">${tier === 1 ? 'Ya en primera: ¡a por la Champions!' : `${tier - 1} ${tier - 1 === 1 ? 'ascenso' : 'ascensos'} hasta primera`}</span>
          <b class="career-pick">Fichar ↗</b>
        </button>`;
      }).join('')}</div>
      <div class="career-footer"><button type="button" class="career-ghost" data-career="new">← Cambiar país</button></div>`;
  }

  // ---- Season hub ----------------------------------------------------------
  seasonTrack() {
    const state = this.state, cells = [];
    for (let season = 1; season <= CAREER_SEASONS; season++) {
      const done = state.history.find(item => item.season === season);
      const current = state.phase !== 'finished' && season === state.season && !done;
      const tier = done ? done.tier : current ? leagueTier(careerLeagueOf(state, state.clubId)) : null;
      const trophies = state.trophies.filter(item => item.season === season);
      const event = nationalTournamentFor(state.country, season);
      cells.push(`<li class="${done ? 'done' : ''} ${current ? 'current' : ''} ${tier ? `tier-${tier}` : ''}">
        <small>T${season}</small><b>${tier ? TIER_LABELS[tier] : '·'}</b>
        <span class="track-trophies">${trophies.map(item => trophyIcon(item.kind, 'mini')).join('')}</span>
        ${event ? `<em title="${esc(COMPETITION_NAMES[event])}">${event === 'world-cup' ? 'MUNDIAL' : event === 'euro' ? 'EURO' : 'COPA AM.'}</em>` : ''}
      </li>`);
    }
    return `<ol class="career-track" aria-label="Temporadas">${cells.join('')}</ol>`;
  }

  stageCard(stage, next) {
    const isNext = next?.stage === stage;
    const goal = stage.kind === 'league'
      ? (leagueTier(stage.competitionId) > 1 ? 'Gana los 2 y serás campeón. 1 victoria con mejor diferencia de goles también asciende.' : 'Gana los 2 y serás campeón de liga (+100) y jugarás la copa continental.')
      : `Semifinal y final. Gánalas y levantas la copa (+${CAREER_POINTS[stage.competitionId] || 0}).`;
    const status = stage.status === 'done' ? (stage.outcome === 'champion' ? '<em class="stage-status win">CAMPEÓN</em>' : stage.outcome === 'runner-up' ? '<em class="stage-status">SUBCAMPEÓN</em>' : stage.outcome === 'eliminated' ? '<em class="stage-status loss">ELIMINADO</em>' : '<em class="stage-status">JUGADO</em>') : isNext ? '<em class="stage-status live">EN JUEGO</em>' : '';
    const team = getTeamById(stage.teamId);
    return `<article class="career-stage ${isNext ? 'is-next' : ''} ${stage.status === 'done' ? 'is-done' : ''}">
      <header>${trophyIcon(stage.kind === 'league' ? 'league' : stage.competitionId)}<div><strong>${esc(stage.name)}</strong><small>${stage.id === 'national' ? `Con ${esc(team?.name)}` : esc(team?.name)}</small></div>${status}</header>
      <p>${goal}</p>
      <ol>${stage.matches.map(item => {
        const rival = getTeamById(item.opponentId), r = item.result, upcoming = isNext && next.match === item;
        const skipped = !r && stage.status === 'done';
        return `<li class="${r ? (r.won ? 'won' : 'lost') : ''} ${upcoming ? 'upcoming' : ''} ${skipped ? 'skipped' : ''}"><small>${esc(item.label)}</small>${kit(rival)}<span>${esc(rival?.name)}<i>${stars(rival?.stars)}</i></span><b>${r ? `${r.goalsFor}–${r.goalsAgainst}` : skipped ? '—' : upcoming ? 'PRÓXIMO' : 'vs'}</b></li>`;
      }).join('')}</ol>
    </article>`;
  }

  // Competitions not in this season, with what unlocks them.
  lockedCards(tier, nationalOn) {
    const state = this.state, ids = new Set(state.plan.stages.map(stage => stage.competitionId)), cards = [];
    const continental = continentalFor(countryOfLeague(careerLeagueOf(state, state.clubId)));
    if (continental && !ids.has(continental)) cards.push([continental, tier === 1 ? 'Gana la liga esta temporada para jugarla la próxima.' : 'Llega a primera y gana la liga.']);
    if (!ids.has('club-world-cup')) cards.push(['club-world-cup', continental ? `Gana la ${COMPETITION_NAMES[continental]} y lo juegas esa misma temporada.` : 'Gana la liga en primera para jugarlo la temporada siguiente.']);
    if (!state.plan.stages.some(stage => stage.id === 'national')) {
      const upcoming = [];
      for (let season = state.season + 1; season <= CAREER_SEASONS && upcoming.length < 1; season++) { const event = nationalTournamentFor(state.country, season); if (event) upcoming.push([event, season]); }
      if (upcoming.length) cards.push([upcoming[0][0], nationalOn ? `Con tu selección en la temporada ${upcoming[0][1]}.` : `Llega a primera antes de la temporada ${upcoming[0][1]} para ir convocado.`]);
    }
    return cards.slice(0, 3).map(([kind, text]) => `<article class="career-stage is-locked">${trophyIcon(kind)}<div><strong>${esc(COMPETITION_NAMES[kind])}</strong><small>🔒 ${esc(text)}</small></div></article>`).join('');
  }

  hub() {
    const state = this.state, next = nextCareerMatch(state), club = getTeamById(state.clubId), leagueId = careerLeagueOf(state, club.id), tier = leagueTier(leagueId);
    const national = getTeamById(state.nationalId), nationalOn = state.reachedTopFlight || tier === 1;
    const nextTeam = next ? getTeamById(next.stage.teamId) : null, rival = next ? getTeamById(next.match.opponentId) : null;
    return `
      ${this.seasonTrack()}
      <div class="career-hub">
        <aside class="career-club-card">
          <span class="career-tier-badge tier-${tier}">${TIER_LABELS[tier]} DIVISIÓN</span>
          <span class="match-team-preview career-club-kit" data-preview-team="${club.id}"></span>
          <strong>${esc(club.name)}</strong><small>${esc(leagueName(leagueId))}</small>
          <div class="career-national ${nationalOn ? 'on' : ''}">${kit(national)}<span><b>${esc(national?.name)}</b><small>${nationalOn ? 'Convocado con la selección' : 'Llega a primera para ser convocado'}</small></span></div>
          <div class="career-score-box"><small>PUNTOS</small><strong>${fmt(careerScore(state))}</strong><span>${state.trophies.length ? state.trophies.slice(-8).map(item => trophyIcon(item.kind, 'mini')).join('') : '<em>Sin trofeos todavía</em>'}</span></div>
        </aside>
        <section class="career-season">
          <div class="career-season-head"><div><p class="card-kicker">TEMPORADA ${state.season} DE ${CAREER_SEASONS}</p><h3>Partidos clave</h3></div><span>${state.plan.stages.length} ${state.plan.stages.length === 1 ? 'competición' : 'competiciones'}</span></div>
          <div class="career-stages">${state.plan.stages.map(stage => this.stageCard(stage, next)).join('')}${this.lockedCards(tier, nationalOn)}</div>
        </section>
      </div>
      ${next ? `<div class="career-next">
        <div class="career-versus">${kit(nextTeam, 'big')}<span><small>${esc(next.stage.name.toUpperCase())} · ${esc(next.match.label.toUpperCase())}</small><strong>${esc(nextTeam?.name)} <i>vs</i> ${esc(rival?.name)}</strong></span>${kit(rival, 'big')}</div>
        <button type="button" class="primary-button career-play" data-career="play" data-career-space>Jugar partido <span>ESPACIO ▶</span></button>
      </div>` : ''}
      <div class="career-footer"><button type="button" class="career-ghost" data-career="landing">← Menú de carrera</button></div>`;
  }

  // ---- Season summary + transfer market -----------------------------------
  summary() {
    const state = this.state, last = state.history.at(-1); if (!last) return this.landing();
    const outcome = OUTCOMES[last.outcome] || OUTCOMES.mid, club = getTeamById(last.clubId);
    const rows = last.table || [], at = rows.findIndex(row => row.player);
    const shown = rows.map((row, index) => ({ ...row, pos: index + 1 })).filter(row => row.pos <= 4 || Math.abs(row.pos - 1 - at) <= 1);
    let previous = 0;
    const table = shown.map(row => { const gap = row.pos - previous > 1 ? '<li class="gap">···</li>' : ''; previous = row.pos; const team = getTeamById(row.teamId);
      return `${gap}<li class="${row.player ? 'me' : ''} ${row.pos === 1 ? 'first' : ''}"><b>${row.pos}</b>${kit(team)}<span>${esc(team?.name)}</span><em>${row.points}</em></li>`; }).join('');
    const promotedText = last.promoted ? `Ascenso a ${esc(leagueName(last.nextLeague))}` : last.tier === 1 && last.outcome === 'champion' ? 'Clasificado para la copa continental' : 'Sigues en la misma división';
    const cups = last.stages.filter(stage => stage.id !== 'league');
    const lastSeason = state.season >= CAREER_SEASONS;
    const nextLeague = state.nextLeagueId || careerLeagueOf(state, state.clubId);
    const offers = state.offers || [];
    return `
      ${this.seasonTrack()}
      <div class="career-summary tone-${outcome.tone}">
        <header class="career-banner">${last.outcome === 'champion' ? trophyIcon('league', 'banner-icon') : last.promoted ? trophyIcon('promotion', 'banner-icon') : ''}
          <div><p class="eyebrow">TEMPORADA ${last.season} · ${esc(outcome.tag)}</p><h2>${outcome.title}</h2><p>${esc(club?.name)} · ${esc(leagueName(last.leagueId))} · ${last.position}º de ${last.size} · <b>${promotedText}</b></p></div>
          <div class="career-banner-points"><small>ESTA TEMPORADA</small><strong>+${fmt(last.points)}</strong><span>TOTAL ${fmt(careerScore(state))}</span></div>
        </header>
        <div class="career-summary-grid">
          <section class="career-card"><p class="card-kicker">CLASIFICACIÓN FINAL</p><ol class="career-table">${table}</ol></section>
          <section class="career-card"><p class="card-kicker">COPAS Y SELECCIÓN</p>${cups.length ? `<ul class="career-cups">${cups.map(stage => `<li>${trophyIcon(stage.competitionId)}<span><b>${esc(stage.name)}</b><small>${stage.results.filter(Boolean).map(r => `${esc(r.label)} ${r.goalsFor}–${r.goalsAgainst}`).join(' · ')}</small></span><em class="${stage.outcome === 'champion' ? 'win' : ''}">${stage.outcome === 'champion' ? 'CAMPEÓN' : stage.outcome === 'runner-up' ? 'FINALISTA' : 'FUERA'}</em></li>`).join('')}</ul>` : '<p class="career-empty">Esta temporada solo había liga. Gana tu liga en primera para jugar la copa continental.</p>'}
</section>
          <section class="career-card"><p class="card-kicker">TROFEOS DE LA TEMPORADA</p>${last.trophies.length ? `<ul class="career-won">${last.trophies.map(item => `<li>${trophyIcon(item.kind)}<span>${esc(item.label)}</span><b>+${item.points}</b></li>`).join('')}</ul>` : '<p class="career-empty">Sin trofeos esta vez.</p>'}</section>
        </div>
        ${lastSeason ? `<div class="career-next"><div class="career-versus"><span><small>FIN DE LA CARRERA</small><strong>Diez temporadas jugadas</strong></span></div><button type="button" class="primary-button career-play" data-career="finish" data-career-space>Ver vitrina final <span>ESPACIO ↗</span></button></div>`
        : `<section class="career-market"><div class="career-season-head"><div><p class="card-kicker">MERCADO DE FICHAJES · TEMPORADA ${state.season + 1}</p><h3>¿Sigues o cambias de aires?</h3></div></div>
          <div class="career-market-grid">
            <button type="button" class="career-offer stay" data-career="stay" data-career-space><span class="career-tier-badge tier-${leagueTier(nextLeague)}">${TIER_LABELS[leagueTier(nextLeague)]} DIVISIÓN</span><span class="match-team-preview career-offer-kit" data-preview-team="${state.clubId}"></span><i class="career-offer-crest" aria-hidden="true">${crestSVG(club)}</i><strong>Quedarme en ${esc(club?.name)}</strong><small>${esc(leagueName(nextLeague))}</small><span class="career-offer-goal">${state.clubId === state.startClubId ? `Fiel a tu primer club: +${CAREER_POINTS.loyalty} al final` : 'Sigues con el mismo equipo'}${state.qualified?.continental || state.qualified?.clubWorldCup ? ' · juegas la copa' : ''}</span><b class="career-pick">Seguir · ESPACIO</b></button>
            ${offers.map(offer => { const team = getTeamById(offer.teamId), tier = leagueTier(team.league), losesCup = state.qualified?.continental || state.qualified?.clubWorldCup;
              return `<button type="button" class="career-offer" data-career="sign" data-value="${team.id}"><span class="career-tier-badge tier-${tier}">${TIER_LABELS[tier]} DIVISIÓN${tier < leagueTier(nextLeague) ? ' ↑' : ''}</span><span class="match-team-preview career-offer-kit" data-preview-team="${team.id}"></span><i class="career-offer-crest" aria-hidden="true">${crestSVG(team)}</i><strong>${esc(team.name)}</strong><small>${esc(leagueName(team.league))} · ${stars(team.stars)}</small><span class="career-offer-goal">${esc(offer.reason)}${losesCup ? ' · pierdes la plaza en la copa' : ''}</span><b class="career-pick">Fichar ↗</b></button>`; }).join('')}
          </div></section>`}
      </div>`;
  }

  // ---- Final cabinet --------------------------------------------------------
  finalView() {
    const state = this.state, score = state.finalScore ?? careerScore(state), title = careerTitle(score), best = this.best();
    const trophies = state.trophies;
    const groups = Object.entries(trophies.reduce((map, item) => { (map[item.kind] ||= []).push(item); return map; }, {}));
    const order = ['world-cup', 'club-world-cup', 'champions', 'copa-libertadores', 'euro', 'copa-america', 'league', 'promotion'];
    groups.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
    const bars = state.history.map(item => { const team = getTeamById(item.clubId);
      return `<li class="tier-${item.tier}" style="--h:${(5 - item.tier) * 25}%"><span class="bar">${state.trophies.filter(t => t.season === item.season && t.kind !== 'promotion').map(t => trophyIcon(t.kind, 'mini')).join('')}</span>${kit(team)}<small>T${item.season}</small></li>`; }).join('');
    const titles = [['rookie', 'Promesa'], ['pro', 'Profesional'], ['star', 'Estrella'], ['legend', 'Leyenda']];
    return `
      <div class="career-final">
        <header class="career-final-hero">
          <div><p class="eyebrow">CARRERA TERMINADA · ${CAREER_SEASONS} TEMPORADAS</p><h2>Tu <em>vitrina.</em></h2>
            <p>${trophies.length} ${trophies.length === 1 ? 'trofeo' : 'trofeos'} · empezaste en ${esc(getTeamById(state.startClubId)?.name)} y acabaste en ${esc(getTeamById(state.clubId)?.name)}.</p></div>
          <div class="career-final-score"><small>PUNTUACIÓN FINAL</small><strong data-count-to="${score}">0</strong><span class="career-title title-${title.id}">${esc(title.label)}</span>${state.record ? '<em>¡NUEVO RÉCORD!</em>' : best ? `<em>Récord: ${fmt(best.score)}</em>` : ''}</div>
        </header>
        <ol class="career-title-scale">${titles.map(([id, label]) => `<li class="${id === title.id ? 'active' : ''}">${label}</li>`).join('')}</ol>
        <div class="career-final-grid">
          <section class="career-card career-cabinet"><p class="card-kicker">TROFEOS</p>${groups.length ? `<ul>${groups.map(([kind, items]) => `<li style="--trophy:${TROPHY_COLORS[kind]}">${trophyIcon(kind, 'big')}<strong>${items.length > 1 ? `${items.length}× ` : ''}${esc(kind === 'league' ? 'Ligas' : kind === 'promotion' ? 'Ascensos' : COMPETITION_NAMES[kind])}</strong><small>${items.map(item => `T${item.season}`).join(' · ')}</small><b>+${fmt(items.reduce((sum, item) => sum + item.points, 0))}</b></li>`).join('')}
            ${state.loyalty ? `<li style="--trophy:#65e6a5">${trophyIcon('league', 'big loyal-icon')}<strong>Fiel a tu escudo</strong><small>Toda la carrera en el mismo club</small><b>+${CAREER_POINTS.loyalty}</b></li>` : ''}</ul>` : '<p class="career-empty">La vitrina está vacía... ¡la próxima será!</p>'}</section>
          <section class="career-card"><p class="card-kicker">TU TRAYECTORIA · DIVISIÓN POR TEMPORADA</p><ol class="career-chart">${bars}</ol></section>
        </div>
        <div class="career-actions"><button type="button" class="primary-button career-start" data-career="abandon-yes" data-career-space>Nueva carrera <span>ESPACIO ↗</span></button><button type="button" class="career-ghost" data-career="home">Volver al inicio</button></div>
      </div>`;
  }
}
