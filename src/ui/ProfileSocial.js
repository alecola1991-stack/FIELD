import { rankBadge, rankIconSvg } from './RankIcon.js';
import { rankProgress } from '../config/ranks.js';
import { getTeamById } from '../config/teams.js';
import { normalizeUsername, validUsername } from '../game/OnlineRules.js';

const el = (tag, className = '', text = '') => { const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node; };
const MODE_NAMES = { quick: 'Rápido', ranked: 'Ranked', tournament: 'Torneo' };

// Social part of the profile: tabs, friends (requests, list, invite), player search
// and the public profile card of any player. Talks to the server through the
// online hub (same RPC and friend commands as the online screen).
export class ProfileSocial {
  constructor(ui) {
    this.ui = ui; this.tab = 'summary'; this.searchToken = 0; this.busy = false;
    this.screen = document.getElementById('profile-screen');
    this.screen.querySelectorAll('[data-profile-tab]').forEach(button => button.addEventListener('click', () => this.setTab(button.dataset.profileTab)));
    document.getElementById('profile-friend-form').addEventListener('submit', event => {
      event.preventDefault();
      const input = document.getElementById('profile-friend-input');
      this.command('friend_request', { username: input.value }, 'Solicitud enviada.').then(ok => { if (ok) input.value = ''; });
    });
    const search = document.getElementById('profile-search-input');
    search.addEventListener('input', () => { clearTimeout(this.searchTimer); this.searchTimer = setTimeout(() => this.search(search.value), 280); });
    // The card lives next to the other overlays: inside the animated screen a fixed overlay would not cover the page.
    const overlay = document.getElementById('player-card-overlay'), close = () => this.closePlayer();
    document.getElementById('ranks-overlay')?.before(overlay);
    const onClick = event => {
      const target = event.target.closest('[data-social]'); if (!target) return;
      const { social, userId, username } = target.dataset;
      if (social === 'profile') this.openPlayer({ userId, username });
      else if (social === 'invite') this.invite(userId);
      else if (social === 'remove' && confirm(`¿Eliminar a @${username} de tus amigos?`)) this.command('friend_remove', { userId }, 'Amigo eliminado.');
      else if (social === 'accept') this.command('friend_accept', { userId }, `Ahora eres amigo de @${username}.`);
      else if (social === 'decline') this.command('friend_decline', { userId }, 'Solicitud rechazada.');
      else if (social === 'add') this.command('friend_request', { username }, `Solicitud enviada a @${username}.`);
    };
    this.screen.addEventListener('click', onClick); overlay.addEventListener('click', onClick);
    document.getElementById('player-card-close').addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    overlay.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  }
  get hub() { return this.ui.hub; }
  get online() { return Boolean(this.ui.user && this.hub?.identity); }
  get profilesSupported() { return Boolean(this.hub?.supportsProfiles); }

  setTab(tab) {
    this.tab = tab;
    this.screen.querySelectorAll('[data-profile-tab]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.profileTab === tab)));
    this.screen.querySelectorAll('[data-profile-panel]').forEach(panel => panel.classList.toggle('hidden', panel.dataset.profilePanel !== tab));
    this.render();
    if ((tab === 'friends' || tab === 'search') && this.ui.user) this.hub?.refresh().then(() => this.render());
    if (tab === 'search') setTimeout(() => document.getElementById('profile-search-input').focus({ preventScroll: true }), 50);
  }

  message(text, error = false) { const node = document.getElementById('profile-social-message'); node.textContent = text; node.classList.toggle('error', error); }

  // Without an account or a username the social tabs explain how to get them.
  gate(node, body) {
    const needsLogin = !this.ui.user, needsName = this.ui.user && !this.hub?.identity;
    node.classList.toggle('hidden', !needsLogin && !needsName); body.classList.toggle('hidden', needsLogin || needsName);
    if (!needsLogin && !needsName) return false;
    node.replaceChildren(el('h3', '', needsLogin ? 'Inicia sesión para tener amigos' : 'Elige tu nombre de usuario'),
      el('p', '', needsLogin ? 'Con una cuenta puedes añadir amigos, buscar jugadores y jugar online.' : 'Tu usuario es tu identidad pública: con él te encuentran y te añaden.'));
    const button = el('button', 'primary-button', needsLogin ? 'Iniciar sesión / Crear cuenta ' : 'Elegir usuario ');
    button.type = 'button'; button.append(el('span', '', '↗'));
    button.addEventListener('click', () => (needsLogin ? (this.ui.renderAccount(), this.ui.show('account')) : this.ui.openOnline()));
    node.append(button); return true;
  }

  render() {
    const friends = this.hub?.friends || [];
    const incoming = friends.filter(friend => friend.incoming && !friend.accepted).length;
    document.getElementById('profile-friends-count').textContent = incoming ? String(incoming) : '';
    if (this.tab === 'friends') this.renderFriends();
    if (this.tab === 'search') this.gate(document.getElementById('profile-search-gate'), document.getElementById('profile-search-body')) || this.renderSearchSupport();
  }

  renderSearchSupport() {
    if (this.profilesSupported) return;
    document.getElementById('profile-search-hint').textContent = 'La búsqueda de jugadores se activará en cuanto el servidor se actualice.';
  }

  personRow(person, actions) {
    const row = el('div', 'person-row');
    const open = el('button', 'person-main'); open.type = 'button';
    if (this.profilesSupported) Object.assign(open.dataset, { social: 'profile', userId: person.id, username: person.username }); else open.disabled = true;
    const name = el('b', '', `@${person.username}`); name.prepend(rankBadge(person.elo, { size: 22 }));
    const detail = el('small', '', `${rankProgress(person.elo).rank.name} · ${person.elo} ELO${Number.isFinite(person.played) && person.played ? ` · ${person.wins}V ${person.played - person.wins}D` : ''}`);
    open.append(name, detail);
    const side = el('div', 'person-actions'); side.append(...actions);
    row.append(open, side); return row;
  }
  action(text, social, person, kind = 'tiny-button') {
    const button = el('button', kind, text); button.type = 'button';
    Object.assign(button.dataset, { social, userId: person.id, username: person.username }); button.disabled = this.busy; return button;
  }

  renderFriends() {
    if (this.gate(document.getElementById('profile-friends-gate'), document.getElementById('profile-friends-body'))) return;
    const friends = this.hub.friends || [];
    const accepted = friends.filter(friend => friend.accepted).sort((a, b) => b.elo - a.elo);
    const pending = friends.filter(friend => !friend.accepted);
    const requests = document.getElementById('profile-requests-list'); requests.replaceChildren();
    document.getElementById('profile-requests').classList.toggle('hidden', !pending.length);
    for (const friend of pending) {
      requests.append(this.personRow(friend, friend.incoming
        ? [this.action('Aceptar', 'accept', friend, 'tiny-button accept'), this.action('Rechazar', 'decline', friend)]
        : [el('em', 'person-state', 'ENVIADA')]));
    }
    document.getElementById('profile-friends-total').textContent = accepted.length ? `· ${accepted.length}` : '';
    const list = document.getElementById('profile-friends-list'); list.replaceChildren();
    for (const friend of accepted) list.append(this.personRow(friend, [this.action('Invitar a jugar', 'invite', friend, 'tiny-button accept'), this.action('Eliminar', 'remove', friend)]));
    if (!accepted.length) list.append(el('p', 'online-match-hint', 'Aún no tienes amigos. Añádelos por su usuario o búscalos en «Buscar jugadores».'));
  }

  async command(command, payload, success) {
    if (this.busy || !this.online) return false;
    this.busy = true; this.render();
    try {
      const data = await this.hub.rpc(command, payload);
      await this.hub.consume(data);
      this.message(success); return true;
    } catch (error) { this.message(error.message || 'No se pudo completar.', true); return false; }
    finally {
      this.busy = false; this.render();
      if (this.playerOpen) this.openPlayer({ userId: this.playerOpen }, true);
      const query = document.getElementById('profile-search-input').value; if (this.tab === 'search' && query) this.search(query);
    }
  }

  // Invites go to a private 1v1: the online screen shows the waiting room.
  async invite(userId) {
    if (this.hub.lobby) { this.message('Sal de tu sala actual en el online antes de invitar.', true); return; }
    if (!this.ui.profileComplete()) { this.ui.pendingMode = 'online'; this.ui.openProfile?.(); return; }
    const ok = await this.command('invite', { kind: 'quick', userId, profile: this.ui.onlinePlayer() }, 'Invitación enviada.');
    if (ok) { this.closePlayer(); this.ui.openOnline(); this.hub.message('Invitación enviada. Esperando a que tu amigo acepte.'); }
  }

  async search(value) {
    const token = ++this.searchToken, query = normalizeUsername(value).replace(/[^a-z0-9_]/g, '');
    const results = document.getElementById('profile-search-results');
    if (!this.online || !this.profilesSupported) return;
    if (query.length < 2) { results.replaceChildren(); return; }
    results.replaceChildren(el('p', 'online-match-hint', 'Buscando…'));
    try {
      const rows = await this.hub.rpc('search', { query });
      if (token !== this.searchToken) return;
      results.replaceChildren();
      for (const row of rows) {
        const state = row.friend === 'friend' ? el('em', 'person-state ok', 'AMIGO') : row.friend === 'sent' ? el('em', 'person-state', 'ENVIADA')
          : row.friend === 'received' ? this.action('Aceptar', 'accept', row, 'tiny-button accept') : this.action('Añadir', 'add', row, 'tiny-button accept');
        results.append(this.personRow(row, [state]));
      }
      if (!rows.length) results.append(el('p', 'online-match-hint', validUsername(query) ? `No hay jugadores que empiecen por «${query}».` : 'Sin resultados.'));
    } catch (error) { if (token === this.searchToken) results.replaceChildren(el('p', 'online-match-hint', error.message || 'No se pudo buscar.')); }
  }

  closePlayer() { this.playerOpen = null; document.getElementById('player-card-overlay').classList.add('hidden'); }

  async openPlayer({ userId, username }, silent = false) {
    if (!this.profilesSupported) return;
    const overlay = document.getElementById('player-card-overlay'), body = document.getElementById('player-card-body');
    if (!silent) { body.replaceChildren(el('p', 'online-match-hint', 'Cargando perfil…')); overlay.classList.remove('hidden'); }
    try {
      const data = await this.hub.rpc('profile', userId ? { userId } : { username });
      this.playerOpen = data.id; this.renderPlayer(data);
      if (!silent) document.getElementById('player-card-close').focus({ preventScroll: true });
    } catch (error) { body.replaceChildren(el('p', 'online-status error', error.message || 'No se pudo cargar el perfil.')); }
  }

  renderPlayer(data) {
    const body = document.getElementById('player-card-body'); body.replaceChildren();
    const progress = rankProgress(data.elo), profile = data.profile || {}, team = getTeamById(profile.teamId);
    const head = el('div', 'player-card-head');
    const kit = el('span', 'match-team-preview player-card-kit');
    this.ui.paintPlayerPreview(kit, team, { name: String(profile.name || data.username).slice(0, 10), number: profile.number ?? '' });
    const who = el('div', 'player-card-who');
    const title = el('h2', profile.gold ? 'gold-name' : '', `@${data.username}`); title.id = 'player-card-name';
    const rank = el('p', 'player-card-rank'); rank.innerHTML = rankIconSvg(progress.rank, 30); rank.append(` ${progress.rank.name} · ${data.elo} ELO`);
    who.append(title, rank, el('small', '', [team?.name, profile.level ? `Nivel ${profile.level}` : '', `${data.friends || 0} amigos`].filter(Boolean).join(' · ')));
    head.append(kit, who);
    const rankedLosses = Math.max(0, data.played - data.wins), online = data.online || { played: 0, wins: 0 };
    const tiles = el('div', 'player-card-tiles');
    for (const [label, value, detail] of [
      ['RANKED', `${data.wins}V · ${rankedLosses}D`, data.played ? `${Math.round(data.wins / data.played * 100)} % de victorias` : 'Sin partidos Ranked'],
      ['ONLINE', String(online.played), `${online.wins} victorias`],
      ['SIGUIENTE RANGO', progress.next ? progress.next.name : '—', progress.next ? `faltan ${progress.to - data.elo} ELO` : 'Rango máximo'],
    ]) { const tile = el('div', 'player-card-tile'); tile.append(el('span', '', label), el('b', '', value), el('small', '', detail)); tiles.append(tile); }
    const bar = el('div', 'rank-bar player-card-bar'); const fill = el('i'); fill.style.width = `${progress.ratio * 100}%`; bar.append(fill);
    bar.dataset.rank = progress.rank.id;
    const recent = el('div', 'player-card-recent'); recent.append(el('p', 'card-kicker', 'ÚLTIMOS PARTIDOS'));
    const strip = el('div', 'result-strip');
    for (const game of data.recent || []) {
      const chip = el('span', `result-chip ${game.won ? 'won' : 'lost'}`);
      chip.title = `${MODE_NAMES[game.kind] || 'Online'}${game.size === 4 && game.kind !== 'tournament' ? ' 2v2' : ''} · ${game.for}-${game.against}${Number.isFinite(game.elo) && game.elo !== null ? ` · ${game.elo > 0 ? '+' : ''}${game.elo} ELO` : ''}`;
      chip.append(el('b', '', game.won ? 'V' : 'D'), el('small', '', `${game.for}-${game.against}`));
      strip.append(chip);
    }
    if (!(data.recent || []).length) strip.append(el('p', 'online-match-hint', 'Todavía no ha jugado online.'));
    recent.append(strip);
    const actions = el('div', 'player-card-actions');
    if (data.me) actions.append(el('p', 'online-match-hint', 'Este es tu perfil público: así te ven los demás.'));
    else if (data.friend === 'friend') actions.append(this.action('Invitar a jugar', 'invite', data, 'primary-button'), this.action('Eliminar amigo', 'remove', data));
    else if (data.friend === 'sent') actions.append(el('em', 'person-state', 'SOLICITUD ENVIADA'));
    else if (data.friend === 'received') actions.append(this.action('Aceptar solicitud', 'accept', data, 'primary-button'), this.action('Rechazar', 'decline', data));
    else actions.append(this.action('Añadir amigo', 'add', data, 'primary-button'));
    body.append(head, tiles, bar, recent, actions);
  }
}
