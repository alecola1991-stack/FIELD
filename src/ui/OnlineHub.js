import { ONLINE_RULES, ONLINE_MODES, ONLINE_SIZES, normalizeUsername, validUsername, assignedMatch, opponentId, roomSize, isTeamRoom, matchSeats, matchPlayers, onLeftTeam, wonMatch, roundName } from '../game/OnlineRules.js';
import { getTeamById, getKitBackground } from '../config/teams.js';
import { teamAbbreviation } from './TeamSelection.js';
import { rankBadge } from './RankIcon.js';

const element = (tag, text, className = '') => { const node = document.createElement(tag); node.textContent = text; node.className = className; return node; };
const FORMATS_KEY = 'field-online-formats';
// Chosen room size per mode (1v1/2v2, 4/6/8 players), remembered per browser.
function loadFormats() {
  const formats = { ranked: 2, quick: 2, tournament: 4 };
  try { const saved = JSON.parse(localStorage.getItem(FORMATS_KEY) || '{}'); for (const kind of Object.keys(formats)) if (ONLINE_SIZES[kind].includes(saved[kind])) formats[kind] = saved[kind]; } catch { /* storage unavailable */ }
  return formats;
}
export class OnlineHub {
  constructor(ui) {
    this.ui = ui; this.identity = null; this.lobby = null; this.mode = 'ranked'; this.friends = []; this.invites = [];
    this.revision = 0; this.connectedMatchId = null; this.busy = false; this.polling = false; this.lastPoll = 0; this.nameSequence = 0; this.rematchRequested = false;
    this.formats = loadFormats(); this.supportsTeams = false;
    this.screen = document.getElementById('online-screen');
    this.screen.addEventListener('click', event => {
      const tab = event.target.closest('[data-online-tab]');
      if (tab) { this.mode = tab.dataset.onlineTab; this.render(); return; }
      const format = event.target.closest('[data-format-group]');
      if (format) { this.setFormat(format.dataset.formatGroup, Number(format.dataset.size)); return; }
      const button = event.target.closest('[data-online-command]');
      if (button) this.action(button.dataset.onlineCommand, { kind: button.dataset.kind, userId: button.dataset.userId, inviteId: button.dataset.inviteId, team: button.dataset.team ? Number(button.dataset.team) : undefined, swapWith: button.dataset.swapWith,
        size: button.dataset.sizeFrom ? this.formats[button.dataset.sizeFrom] : undefined,
        code: button.dataset.codeInput ? document.getElementById(button.dataset.codeInput).value : undefined });
    });
    document.getElementById('online-username-form').addEventListener('submit', event => { event.preventDefault(); this.action('claim_username', { username: document.getElementById('online-username-input').value }); });
    document.getElementById('online-friend-form').addEventListener('submit', event => {
      event.preventDefault(); this.action('friend_request', { username: document.getElementById('online-friend-input').value });
    });
    document.getElementById('online-username-input').addEventListener('input', () => {
      const token = ++this.nameSequence; clearTimeout(this.nameTimer);
      const name = normalizeUsername(document.getElementById('online-username-input').value);
      document.getElementById('online-username-check').textContent = validUsername(name) ? 'Comprobando disponibilidad…' : 'Entre 3 y 20 letras, números o guiones bajos.';
      if (validUsername(name) && ui.user) this.nameTimer = setTimeout(async () => {
        try { const result = await this.rpc('username_available', { username: name });
          if (token === this.nameSequence) document.getElementById('online-username-check').textContent = result.available ? 'Disponible. Puedes reservarlo.' : 'Ese nombre ya está ocupado.';
        } catch { if (token === this.nameSequence) document.getElementById('online-username-check').textContent = 'No se pudo comprobar. Inténtalo de nuevo.'; }
      }, 350);
    });
    this.timer = setInterval(() => this.tick(), 3000);
    this.render();
  }
  setFormat(kind, size) {
    if (!ONLINE_SIZES[kind]?.includes(size)) return;
    this.formats[kind] = size;
    try { localStorage.setItem(FORMATS_KEY, JSON.stringify(this.formats)); } catch { /* storage unavailable */ }
    this.render();
  }
  // Room size to request: only once the database supports team rooms (online-teams.sql).
  requestedSize(kind) { return this.supportsTeams ? this.formats[kind] : undefined; }
  rpc(action, payload = {}) { return this.ui.accountService.onlineAction(action, payload); }
  message(text, error = false) { const node = document.getElementById('online-hub-message'); node.textContent = text; node.classList.toggle('error', error); }
  async activate() {
    this.identity = null; this.lobby = null; this.connectedMatchId = null;
    await this.refresh();
    if (!this.identity) { this.ui.show('online'); this.message('Elige un nombre de usuario único para identificarte en el online.'); return; }
    // Back after a reload or a closed app with a match still being played: go straight to it.
    const match = assignedMatch(this.lobby, this.identity.id);
    if (match && this.ui.currentView !== 'game') { this.ui.show('online'); this.message('Tienes un partido en curso. Volviendo a él…'); await this.connect(match); }
  }
  async open() { this.render(); if (this.ui.user) await this.refresh(); }
  async refresh() {
    if (!this.ui.user || this.polling || this.busy) return;
    this.polling = true; const userId = this.ui.user.id, revision = this.revision || 0;
    try {
      const data = await this.rpc(this.lobby ? 'poll' : 'state', this.lobby ? { lobbyId: this.lobby.id } : {});
      if (this.ui.user?.id === userId && (this.revision || 0) === revision) await this.consume(data);
      this.lastPoll = Date.now();
    } catch (error) {
      // Removed from a waiting room (inactive) or the room vanished: stop polling it instead of looping on the error.
      if (/No perteneces a esta sala/.test(error?.message || '') && this.lobby) { this.dropLobby('Ya no estás en esa sala (por inactividad o porque se cerró). Puedes buscar otra.'); return; }
      if (this.ui.currentView === 'online') this.message(error.message || 'No se pudo conectar.', true);
    }
    finally { this.polling = false; }
  }
  dropLobby(text) {
    this.lobby = null; this.connectedMatchId = null; this.pendingResult = null; this.render();
    if (text) this.message(text, true);
    setTimeout(() => this.refresh(), 0); // after the current poll has released the lock
  }
  tick() {
    if (!this.ui.user) return;
    const onResult = !this.ui.result_overlay.classList.contains('hidden') && this.ui.currentMatchMode === 'online';
    if (this.lobby?.state === 'playing' || this.lobby?.state === 'waiting' || this.ui.currentView === 'online' || onResult || Date.now() - this.lastPoll > 15000) this.refresh();
  }
  async action(command, payload = {}) {
    if (this.busy) return;
    if (command === 'edit_profile') { this.ui.pendingMode = 'online'; this.ui.pendingTeamType = 'all'; this.ui.pendingLeagueId = ''; this.ui.openProfile(); return; }
    if (!this.ui.user) { this.ui.renderAccount(); this.ui.show('account'); return; }
    if (command !== 'claim_username' && !this.identity) { this.render(); this.message('Primero reserva tu nombre de usuario.', true); return; }
    if (['queue','create','join','invite','invite_accept'].includes(command) && !this.ui.profileComplete()) {
      this.ui.pendingMode = 'online'; this.ui.openProfile(); return;
    }
    if (['queue','create','join','invite','invite_accept'].includes(command) && this.lobby) {
      this.message('Sal de la sala actual antes de buscar otra partida.', true); return;
    }
    if (command === 'leave') {
      if (!this.lobby) return;
      if (this.lobby.state === 'playing' && assignedMatch(this.lobby, this.identity.id) && !confirm('Salir de un partido en curso cuenta como derrota por abandono. ¿Salir?')) return;
      payload.lobbyId = this.lobby.id;
    }
    if (command === 'friend_remove' && !confirm('¿Eliminar a este amigo?')) return;
    if (['team', 'start'].includes(command)) { if (!this.lobby) return; payload.lobbyId = this.lobby.id; }
    if (!this.supportsTeams || !['queue', 'create'].includes(command)) delete payload.size;
    const userId = this.ui.user.id;
    this.revision = (this.revision || 0) + 1;
    this.busy = true; this.render(); this.message('Conectando…');
    try {
      if (['queue','create','join','invite','invite_accept'].includes(command)) payload.profile = this.ui.onlinePlayer();
      if (command === 'invite') payload.kind = 'quick';
      const data = await this.rpc(command, payload);
      if (this.ui.user?.id !== userId) return;
      if (command === 'leave') {
        this.pendingResult = null;
        await this.ui.onlineMatch.leave(); this.ui.game.stop(); this.ui.currentMatchMode = null; this.connectedMatchId = null;
        this.ui.result_overlay.classList.add('hidden'); this.ui.pause_overlay.classList.add('hidden'); this.ui.show('online');
      }
      await this.consume(data);
      if (command === 'claim_username') this.message('Nombre reservado. ¡Bienvenido al online!');
      else if (command === 'friend_request') { this.message('Solicitud enviada. Tu amigo podrá aceptarla aquí.'); document.getElementById('online-friend-input').value = ''; }
      else if (command === 'invite') this.message('Invitación enviada. Esperando a que tu amigo acepte.');
      else if (command === 'invite_decline') this.message('Invitación declinada.');
      else if (command === 'team') this.message('Equipo cambiado.');
      else if (!this.lobby) this.message('Listo.');
    } catch (error) {
      if (command === 'leave' && /No perteneces a esta sala/.test(error?.message || '')) {
        await this.ui.onlineMatch.leave(false); this.ui.game.stop(); this.ui.currentMatchMode = null; this.ui.show('online');
        this.busy = false; this.dropLobby(''); this.message('Has salido de la sala.'); return;
      }
      this.message(error.message || 'No se pudo completar la acción.', true);
    }
    finally { this.busy = false; this.render(); }
  }
  async consume(data) {
    this.identity = data?.identity || null; this.friends = data?.friends || []; this.invites = data?.invites || []; this.lobby = data?.lobby || null;
    if (data) { this.supportsTeams = Number(data.version) >= 2; this.supportsSwap = Number(data.version) >= 3; this.supportsProfiles = Number(data.version) >= 4; }
    if (this.ui.currentView === 'profile') { this.ui.social?.render(); this.ui.renderProfileOnline?.(); }
    this.render();
    if (this.lobby?.state === 'cancelled') {
      this.message('La sala se ha cancelado o el resultado no coincide. No se aplica ELO por un resultado discrepante.', true);
      if (this.ui.currentMatchMode === 'online') { this.ui.game.stop(); await this.ui.onlineMatch.leave(false); this.ui.currentMatchMode = null; this.ui.show('online'); }
      this.connectedMatchId = null; return;
    }
    // The server settled our match while we were still playing it (a rival left or timed out).
    const current = this.lobby?.matches.find(item => item.id === this.connectedMatchId);
    if (current && current.state !== 'playing') {
      const game = this.ui.game, playing = this.ui.currentMatchMode === 'online' && game?.state.running && !game.state.matchOver && this.ui.result_overlay.classList.contains('hidden');
      if (playing) {
        game.stop(); await this.ui.onlineMatch.leave(false); this.ui.currentMatchMode = null; this.ui.hideConnectionStatus(); this.ui.show('online');
        if (this.lobby.kind === 'ranked' && current.state === 'finished' && Number.isFinite(current.eloDelta) && this.rankShownFor !== current.id) {
          this.rankShownFor = current.id;
          const mine = onLeftTeam(current, this.identity.id) ? current.eloDelta : -current.eloDelta;
          this.ui.showRankProgress?.(Number(this.identity.elo) - mine, Number(this.identity.elo));
        }
        this.message(current.state === 'disputed' ? 'El partido no se ha podido confirmar.' : wonMatch(current, this.identity?.id) ? 'El partido ha terminado: el rival ha abandonado o se ha desconectado. ¡Victoria!' : 'El partido ha terminado por abandono o desconexión.', current.state !== 'finished' || !wonMatch(current, this.identity?.id));
      } else if (!this.ui.currentMatchMode && this.ui.onlineMatch?.assignment?.matchId === current.id) await this.ui.onlineMatch.leave(false);
    }
    const match = assignedMatch(this.lobby, this.identity?.id);
    // A rematch starts straight from the result screen; otherwise matches start from the online screen.
    if (match && match.id !== this.connectedMatchId && (this.ui.currentView === 'online' || this.rematchRequested)) await this.connect(match);
    this.updateResultStatus();
  }
  async connect(match) {
    if (!this.identity || this.connectedMatchId === match.id) return;
    const other = this.lobby.players.find(player => player.id === opponentId(match, this.identity.id));
    if (!other) return;
    const profileOf = player => ({ ...player.profile, userId: player.id, username: player.username, elo: player.elo, modifiers: ONLINE_RULES });
    // 2v2: four seats in host order (p1, p3, p2, p4); seat 0 hosts the match.
    let squad = null;
    if (match.p3 && match.p4) {
      const seats = matchSeats(match).map(id => this.lobby.players.find(player => player.id === id));
      if (seats.some(seat => !seat)) return;
      squad = { seats: seats.map(seat => seat.id === this.identity.id ? { ...profileOf(seat), ...this.ui.onlinePlayer() } : profileOf(seat)), localSeat: seats.findIndex(seat => seat.id === this.identity.id) };
    }
    this.connectedMatchId = match.id; this.rematchRequested = false;
    try { await this.ui.onlineMatch.connectAssigned(match, this.ui.onlinePlayer(), profileOf(other), squad); }
    catch (error) { this.connectedMatchId = null; this.message(error.message, true); }
  }
  async record(result) {
    const matchId = this.connectedMatchId;
    this.ui.result_rematch.classList.add('hidden');
    this.ui.result_finish.disabled = true;
    this.ui.result_finish.textContent = this.lobby?.kind === 'tournament' ? 'Ver cuadro del torneo' : 'Volver al online';
    this.ui.result_online_status.classList.remove('hidden'); this.ui.result_online_status.textContent = 'Confirmando el resultado con el rival…';
    this.pendingResult = { lobbyId: this.lobby.id, matchId, playerScore: result.playerScore, opponentScore: result.botScore };
    await this.sendResult();
  }
  async sendResult() {
    if (!this.pendingResult || this.reporting) return;
    this.reporting = true;
    const userId = this.ui.user?.id, revision = this.revision = (this.revision || 0) + 1;
    try { const data = await this.rpc('report', this.pendingResult);
      if (this.ui.user?.id !== userId || this.revision !== revision) return;
      this.pendingResult = null; await this.consume(data); }
    catch (error) { this.ui.result_online_status.textContent = `${error.message}. Reintentando…`; }
    finally { this.reporting = false; }
  }
  updateResultStatus() {
    if (this.pendingResult) { this.sendResult(); return; }
    const match = this.lobby?.matches.find(item => item.id === this.connectedMatchId);
    if (!match || this.ui.result_overlay.classList.contains('hidden')) return;
    this.ui.result_finish.disabled = match.state === 'playing';
    if (match.state === 'finished') {
      const won = wonMatch(match, this.identity.id);
      // Ranked: animate the rank bar once per match (old ELO = new ELO minus our side's change).
      if (this.lobby.kind === 'ranked' && Number.isFinite(match.eloDelta) && this.rankShownFor !== match.id) {
        this.rankShownFor = match.id;
        const mine = onLeftTeam(match, this.identity.id) ? match.eloDelta : -match.eloDelta, after = Number(this.identity.elo);
        setTimeout(() => this.ui.showRankProgress?.(after - mine, after), 700);
      }
      this.ui.result_online_status.textContent = this.lobby.kind === 'ranked' ? `Resultado confirmado · ${this.identity.elo} ELO · ${won ? 'Victoria' : 'Derrota'}` : 'Resultado confirmado. Sin cambios de ELO.';
    } else if (match.state === 'disputed') this.ui.result_online_status.textContent = 'Los resultados no coinciden. El partido no puntúa.';
    this.updateRematch();
  }
  // Rematch on the result screen (quick and ranked rooms). Shown only when the
  // database supports it (`lobby.rematch`, from supabase/online-rematch.sql).
  updateRematch() {
    const button = this.ui.result_rematch, status = this.ui.result_rematch_status, room = this.lobby;
    if (typeof button?.classList?.toggle !== 'function' || !status?.classList) return;
    const supported = room?.rematch && ['quick', 'ranked'].includes(room.kind) && this.ui.currentMatchMode === 'online';
    button.classList.toggle('hidden', !supported); status.classList.toggle('hidden', !supported);
    if (!supported) return;
    const me = this.identity?.id, votes = room.rematch.votes || [], others = room.players.filter(player => player.id !== me), team = others.length > 1;
    const rival = others[0], name = team ? 'los demás' : rival ? `@${rival.username}` : 'tu rival', gone = others.find(player => player.active === false);
    const count = team ? ` (${votes.length}/${room.players.length})` : '';
    let label = 'Pedir revancha', icon = '↻', disabled = false, text = room.kind === 'ranked' ? 'La revancha Ranked también cuenta ELO.' : team ? 'Jugad otra vez con los mismos equipos.' : 'Juega otra vez contra el mismo rival.';
    if (room.state !== 'finished') { disabled = true; text = 'Disponible cuando se confirme el resultado.'; }
    else if (gone) { disabled = true; label = 'Revancha no disponible'; icon = '✕'; text = `@${gone.username} ha salido de la sala.`; }
    else if (votes.includes(me)) { disabled = true; label = `Esperando${team ? ' a los demás' : ' al rival'}…${count}`; icon = '⌛'; text = `Revancha pedida. Empezará en cuanto ${name} ${team ? 'acepten' : 'acepte'}.`; }
    else if (others.some(player => votes.includes(player.id))) { label = `Aceptar revancha${count}`; text = team ? `${votes.length} ${votes.length === 1 ? 'jugador quiere' : 'jugadores quieren'} la revancha.` : `${name} quiere la revancha.`; }
    button.disabled = Boolean(disabled || this.busy); button.innerHTML = `${label} <span>${icon}</span>`; status.textContent = text;
  }
  async requestRematch() {
    if (!this.lobby || this.busy) return;
    const userId = this.ui.user?.id; this.rematchRequested = true; this.busy = true; this.updateRematch();
    try {
      const data = await this.rpc('rematch', { lobbyId: this.lobby.id });
      if (this.ui.user?.id === userId) await this.consume(data);
    } catch (error) { this.rematchRequested = false; this.ui.result_rematch_status.textContent = error.message || 'No se pudo pedir la revancha.'; }
    finally { this.busy = false; this.updateRematch(); }
  }
  async returnToLobby() {
    this.rematchRequested = false;
    this.ui.game.stop(); await this.ui.onlineMatch.leave(false); this.ui.currentMatchMode = null; this.ui.currentMatchOptions = null;
    this.ui.result_overlay.classList.add('hidden'); this.ui.goal_banner.classList.add('hidden'); this.ui.countdown_banner.classList.add('hidden'); this.ui.hideConnectionStatus();
    this.ui.show('online'); await this.refresh();
  }
  reset() { this.revision = (this.revision || 0) + 1; this.identity = null; this.lobby = null; this.friends = []; this.invites = []; this.connectedMatchId = null; this.pendingResult = null; this.render(); }
  render() {
    const signedIn = Boolean(this.ui.user), registered = Boolean(this.identity);
    document.getElementById('online-login-needed').classList.toggle('hidden', signedIn);
    document.getElementById('online-username-needed').classList.toggle('hidden', !signedIn || registered);
    document.getElementById('online-content').classList.toggle('hidden', !signedIn || !registered);
    const identityNode = document.getElementById('online-identity');
    identityNode.textContent = registered ? `@${this.identity.username} · ${this.identity.elo} ELO` : signedIn ? 'Elige tu nombre de usuario' : 'Inicia sesión para jugar online';
    if (registered) identityNode.prepend(rankBadge(this.identity.elo, { size: 26, withName: true }));
    const account = document.getElementById('account-username');
    if (account) { account.textContent = registered ? `@${this.identity.username} · ${this.identity.elo} ELO` : 'Nombre de usuario pendiente'; if (registered) account.prepend(rankBadge(this.identity.elo, { size: 22 })); }
    const pending = this.invites.filter(item => item.incoming && item.state === 'pending').length + this.friends.filter(item => item.incoming && !item.accepted).length;
    document.getElementById('online-friends-count').textContent = pending ? String(pending) : '';
    document.getElementById('online-content').classList.toggle('in-room', Boolean(this.lobby));
    this.screen.querySelectorAll('[data-online-tab]').forEach(button => { const active = button.dataset.onlineTab === this.mode; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); });
    this.screen.querySelectorAll('[data-online-panel]').forEach(panel => panel.classList.toggle('hidden', panel.dataset.onlinePanel !== this.mode));
    this.screen.querySelectorAll('[data-online-command], #online-find-match, #online-create-room, #online-join-room').forEach(button => { button.disabled = this.busy; });
    document.getElementById('online-ranked-elo').textContent = registered ? `${this.identity.elo} ELO` : '500 ELO iniciales';
    this.renderFormats();
    this.renderFriends(); this.renderLobby();
  }
  // Format pickers (1v1/2v2 and tournament size) appear once the database supports them.
  renderFormats() {
    this.screen.querySelectorAll('[data-format-picker]').forEach(picker => picker.classList.toggle('hidden', !this.supportsTeams));
    this.screen.querySelectorAll('[data-format-group]').forEach(button => {
      const active = this.formats[button.dataset.formatGroup] === Number(button.dataset.size);
      button.classList.toggle('active', active); button.setAttribute('aria-checked', String(active));
    });
    const size = kind => this.supportsTeams ? this.formats[kind] : ONLINE_MODES[kind].capacity;
    const set = (id, text) => { const node = document.getElementById(id); if (node) node.textContent = text; };
    set('online-ranked-kicker', `COMPETICIÓN · ${size('ranked') === 4 ? '2 CONTRA 2' : '1 CONTRA 1'}`);
    set('online-ranked-search', size('ranked') === 4 ? 'Buscar Ranked 2v2 →' : 'Buscar partida Ranked →');
    set('online-quick-kicker', `AMISTOSO · ${size('quick') === 4 ? '2 CONTRA 2' : '1 CONTRA 1'} · SIN CAMBIOS DE ELO`);
    set('online-find-match', size('quick') === 4 ? 'Partida pública 2v2 · Buscar jugadores →' : 'Partida pública · Buscar rival →');
    set('online-create-room', size('quick') === 4 ? 'Crear partida privada 2v2 →' : 'Crear partida privada →');
    const players = size('tournament');
    set('online-tournament-kicker', `${players} JUGADORES · ${players === 4 ? 'SEMIFINALES Y FINAL' : players === 6 ? 'CUARTOS, SEMIFINALES Y FINAL' : 'CUARTOS, SEMIFINALES Y FINAL'}`);
    set('online-tournament-copy', players === 4 ? 'Dos semifinales simultáneas. Los ganadores disputan la final.' : players === 6 ? 'Dos cuartos de final; dos jugadores, sorteados, pasan directos a semifinales.' : 'Cuatro cuartos de final simultáneos, semifinales y final.');
    set('online-tournament-search', `Torneo público · Buscar ${players} jugadores →`);
  }
  button(text, command, data = {}) {
    const button = element('button', text, 'tiny-button'); button.type = 'button'; button.dataset.onlineCommand = command;
    Object.assign(button.dataset, data); button.disabled = this.busy; return button;
  }
  renderFriends() {
    const list = document.getElementById('online-friends-list'); list.replaceChildren();
    for (const friend of this.friends) {
      const row = element('div', '', 'social-row'); const text = element('div', '', 'social-person');
      const friendName = element('b', `@${friend.username}`); friendName.prepend(rankBadge(friend.elo));
      text.append(friendName, element('small', friend.accepted ? `${friend.elo} ELO` : friend.incoming ? 'Te ha enviado una solicitud de amistad' : 'Solicitud de amistad enviada'));
      const actions = element('div', '', 'social-actions');
      if (friend.accepted) actions.append(this.button('Invitar a jugar', 'invite', { userId: friend.id }), this.button('Eliminar', 'friend_remove', { userId: friend.id }));
      else if (friend.incoming) actions.append(this.button('Aceptar', 'friend_accept', { userId: friend.id }), this.button('Declinar', 'friend_decline', { userId: friend.id }));
      row.append(text, actions); list.append(row);
    }
    if (!this.friends.length) list.append(element('p', 'Añade a tus amigos usando su nombre de usuario.', 'online-match-hint'));
    const invites = document.getElementById('online-invites-list'); invites.replaceChildren();
    for (const invite of this.invites) {
      const row = element('div', '', 'social-row');
      row.append(element('p', `${invite.incoming ? 'Invitación de' : 'Invitación a'} @${invite.username} · ${({ pending:'Pendiente', accepted:'Aceptada', declined:'Declinada', expired:'Caducada' })[invite.state]}`));
      if (invite.incoming && invite.state === 'pending') {
        const actions = element('div', '', 'social-actions'); actions.append(this.button('Aceptar partido', 'invite_accept', { inviteId: invite.id }), this.button('Declinar', 'invite_decline', { inviteId: invite.id })); row.append(actions);
      }
      invites.append(row);
    }
    if (!this.invites.length) invites.append(element('p', 'Aquí aparecerán las invitaciones para jugar.', 'online-match-hint'));
  }
  // Room panel: mode, privacy, state and waiting time; one card per seat (kit
  // colours, @user, ELO, level) with animated empty seats. 1v1 shows VS, 2v2
  // two team columns (pick a side and start in private rooms) and tournaments
  // a seat grid plus every match grouped by round.
  renderLobby() {
    const panel = this.ui.online_room_panel; panel.classList.toggle('hidden', !this.lobby);
    const roster = document.getElementById('online-lobby-roster'); roster.replaceChildren();
    const bracket = document.getElementById('online-bracket'); bracket.replaceChildren();
    if (!this.lobby) { clearInterval(this.roomTimer); this.roomTimer = 0; this.waitingRoom = null; return; }
    const room = this.lobby, capacity = roomSize(room), teams = isTeamRoom(room), me = this.identity?.id;
    const mode = `${ONLINE_MODES[room.kind]?.name || 'Sala'}${room.kind === 'tournament' ? ` de ${capacity}` : teams ? ' 2v2' : ''}`;
    this.ui.online_room_code_wrap.classList.toggle('hidden', room.public || room.state !== 'waiting');
    this.ui.online_room_code.textContent = room.code;
    this.ui.online_cancel.textContent = room.state === 'finished' || room.state === 'cancelled' ? 'Cerrar sala' : room.state === 'playing' ? 'Salir de la sala' : 'Cancelar búsqueda / sala';
    document.getElementById('online-room-mode').textContent = `${mode.toUpperCase()} · ${room.public ? 'PÚBLICA' : 'PRIVADA'}`;
    const stateLabel = { waiting: `ESPERANDO · ${room.players.length}/${capacity}`, playing: 'EN JUEGO', finished: 'TERMINADA', cancelled: 'CANCELADA' }[room.state] || '';
    const stateNode = document.getElementById('online-room-state'); stateNode.textContent = stateLabel; stateNode.dataset.state = room.state;
    // Waiting timer for the current room.
    if (room.state === 'waiting') {
      if (this.waitingRoom !== room.id) { this.waitingRoom = room.id; this.waitingSince = Date.now(); }
      const tickTimer = () => { const seconds = Math.floor((Date.now() - this.waitingSince) / 1000); document.getElementById('online-room-timer').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; };
      tickTimer(); if (!this.roomTimer) this.roomTimer = setInterval(tickTimer, 1000);
    } else { clearInterval(this.roomTimer); this.roomTimer = 0; document.getElementById('online-room-timer').textContent = ''; }
    const host = room.players.find(player => player.id === room.host);
    const lastMatch = room.matches.at(-1), names = ids => ids.map(id => `@${room.players.find(p => p.id === id)?.username || 'jugador'}`).join(' y ');
    let status = room.state === 'waiting' ? (room.public ? (teams ? 'Buscando jugadores… los equipos se sortean al completar la sala.' : 'Buscando rivales… te emparejaremos en cuanto haya alguien disponible.')
      : teams ? (room.players.length < 4 ? 'Comparte el código: hacen falta cuatro jugadores.' : room.host === me ? 'Elegid equipos y pulsa Empezar.' : `Elegid equipos. @${host?.username || 'el anfitrión'} empezará el partido.`) : 'Comparte el código para que tu rival entre.')
      : room.state === 'finished' ? (teams && lastMatch ? `Ganan ${names(onLeftTeam(lastMatch, lastMatch.winner) ? [lastMatch.p1, lastMatch.p3] : [lastMatch.p2, lastMatch.p4])}` : `Ganador: @${room.players.find(p => p.id === room.champion)?.username || 'jugador'}`)
        : room.state === 'cancelled' ? 'Sala cancelada.' : room.kind === 'tournament' ? `Torneo en curso · ${capacity} jugadores` : 'Partido en curso';
    if (room.kind === 'tournament' && room.state === 'playing' && !assignedMatch(room, me)) {
      const out = room.matches.some(match => match.state === 'finished' && matchPlayers(match).includes(me) && match.winner !== me);
      status += out ? ' · Has quedado eliminado; puedes seguir el cuadro.' : ' · Esperando a que termine la ronda.';
    }
    this.ui.online_status.textContent = status; this.ui.online_status.classList.toggle('error', room.state === 'cancelled');
    roster.classList.toggle('duel', capacity === 2); roster.classList.toggle('quad', capacity === 4 && !teams);
    roster.classList.toggle('teams', teams); roster.classList.toggle('grid', capacity > 4);
    if (teams) roster.append(...this.renderTeams(room));
    else {
      const seats = [];
      for (let slot = 1; slot <= capacity; slot++) {
        const player = room.players.find(item => item.slot === slot) || (room.players[slot - 1] && room.players[slot - 1].slot === undefined ? room.players[slot - 1] : null);
        seats.push(player ? this.seatCard(player) : this.emptySeat());
        if (capacity === 2 && slot === 1) seats.push(element('b', 'VS', 'room-versus'));
      }
      roster.append(...seats);
    }
    // Byes in 6-player tournaments: players without a first-round match.
    if (room.kind === 'tournament' && capacity === 6 && room.state !== 'waiting') {
      const firstRound = room.matches.filter(match => match.round === 1).flatMap(matchPlayers);
      const byes = room.players.filter(player => !firstRound.includes(player.id));
      if (byes.length) bracket.append(element('p', `Pasan directos a semifinales: ${byes.map(player => '@' + player.username).join(' y ')}`, 'room-byes'));
    }
    const counters = {};
    for (const match of room.matches) {
      const card = element('div', '', 'room-match'); card.dataset.state = match.state;
      let label = (ONLINE_MODES[room.kind]?.name || '').toUpperCase() + (teams ? ' · 2V2' : '');
      if (room.kind === 'tournament') {
        const name = roundName(capacity, match.round), count = room.matches.filter(item => item.round === match.round).length;
        counters[match.round] = (counters[match.round] || 0) + 1;
        label = count > 1 ? `${name} ${counters[match.round]}` : name;
      }
      card.append(element('small', label));
      const sides = match.p3 ? [[[match.p1, match.p3], match.score1, match.p1], [[match.p2, match.p4], match.score2, match.p2]] : [[[match.p1], match.score1, match.p1], [[match.p2], match.score2, match.p2]];
      for (const [ids, score, captain] of sides) {
        const line = element('div', '', 'room-match-line');
        line.classList.toggle('winner', match.state === 'finished' && match.winner === captain);
        line.classList.toggle('you', ids.includes(me));
        line.append(this.playerNames(room, ids), element('b', match.state === 'finished' ? String(score ?? '') : ''));
        card.append(line);
      }
      card.append(element('em', match.state === 'finished' ? (room.kind === 'ranked' && match.eloDelta ? `±${Math.abs(match.eloDelta)} ELO` : 'Final') : match.state === 'disputed' ? 'Resultado discrepante' : match.reported1 || match.reported2 ? 'Confirmando resultado…' : 'En juego'));
      bracket.append(card);
    }
  }
  // 2v2 roster: team A (left) and team B (right). Public rooms are drawn when
  // full; in private rooms players switch sides and the creator starts.
  renderTeams(room) {
    const me = this.identity?.id, mine = room.players.find(player => player.id === me);
    const match = room.matches.at(-1), privateWaiting = room.state === 'waiting' && !room.public;
    // Public rooms have no teams until they fill: show the seats split in two, labelled as a draw.
    const drawPending = !match && room.public;
    const teamOf = player => match ? (onLeftTeam(match, player.id) ? 1 : 2) : drawPending ? (room.players.indexOf(player) < 2 ? 1 : 2) : player.team;
    const columns = [1, 2].map(team => {
      const column = element('div', '', 'room-team'); column.dataset.team = String(team);
      const members = room.players.filter(player => teamOf(player) === team);
      const head = element('div', '', 'room-team-head'); head.append(element('b', drawPending ? 'SORTEO' : team === 1 ? 'EQUIPO A' : 'EQUIPO B'), element('small', drawPending ? 'AL COMPLETAR' : `${members.length}/2`));
      column.append(head, ...members.map(player => {
        const card = this.seatCard(player);
        // Full private room: swap sides with a player of the other team (server version 3+).
        if (privateWaiting && this.supportsSwap && mine && teamOf(mine) !== team && members.length >= 2) {
          const swap = this.button(`Cambiar con @${player.username}`, 'team', { swapWith: player.id }); swap.classList.add('room-swap'); card.append(swap);
        }
        return card;
      }));
      for (let index = members.length; index < 2; index++) column.append(this.emptySeat());
      if (privateWaiting && mine && teamOf(mine) !== team && members.length < 2) column.append(this.button(`Unirme al equipo ${team === 1 ? 'A' : 'B'}`, 'team', { team: String(team) }));
      return column;
    });
    const nodes = [columns[0], element('b', 'VS', 'room-versus'), columns[1]];
    if (privateWaiting && room.host === me) {
      const ready = room.players.length === 4 && room.players.filter(player => player.team === 1).length === 2;
      const start = this.button(ready ? 'Empezar partido 2v2 →' : 'Empezar (faltan jugadores o equipos)', 'start'); start.classList.add('room-start'); start.disabled = this.busy || !ready;
      nodes.push(start);
    }
    return nodes;
  }
  // "@a y @b" with each player's rank badge.
  playerNames(room, ids) {
    const node = element('span', '', 'room-names');
    ids.forEach((id, index) => {
      const player = room.players.find(item => item.id === id);
      if (index) node.append(' y ');
      const name = element('span', `@${player?.username || 'jugador'}`, 'room-name'); if (player) name.prepend(rankBadge(player.elo, { size: 15 }));
      node.append(name);
    });
    return node;
  }
  seatCard(player) {
    const profile = player.profile || {}, team = getTeamById(profile.teamId), mine = player.id === this.identity?.id;
    const card = element('div', '', 'room-seat'); card.classList.toggle('you', mine); card.classList.toggle('left', player.active === false);
    const crest = element('span', team ? teamAbbreviation(team.name) : '?', 'room-crest'); crest.style.background = team ? getKitBackground(team) : '#1b2b48';
    const info = element('div', '', 'room-seat-info');
    const name = element('b', `@${player.username}`); name.prepend(rankBadge(player.elo)); if (mine) name.append(element('i', 'TÚ', 'room-you'));
    info.append(name, element('small', `${player.elo} ELO · NIVEL ${profile.level || 1}`), element('small', player.active === false ? 'Ha salido de la sala' : team?.name || 'Equipo sin elegir'));
    card.append(crest, info); return card;
  }
  emptySeat() {
    const card = element('div', '', 'room-seat empty');
    card.append(element('span', '', 'room-crest pulse'), element('div', 'Esperando jugador…', 'room-seat-info'));
    return card;
  }

}
