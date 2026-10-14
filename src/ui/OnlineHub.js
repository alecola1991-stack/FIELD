import { ONLINE_RULES, ONLINE_MODES, normalizeUsername, validUsername, assignedMatch, opponentId } from '../game/OnlineRules.js';

const element = (tag, text, className = '') => { const node = document.createElement(tag); node.textContent = text; node.className = className; return node; };
export class OnlineHub {
  constructor(ui) {
    this.ui = ui; this.identity = null; this.lobby = null; this.mode = 'ranked'; this.friends = []; this.invites = [];
    this.connectedMatchId = null; this.busy = false; this.polling = false; this.lastPoll = 0; this.nameSequence = 0;
    this.screen = document.getElementById('online-screen');
    this.screen.addEventListener('click', event => {
      const tab = event.target.closest('[data-online-tab]');
      if (tab) { this.mode = tab.dataset.onlineTab; this.render(); return; }
      const button = event.target.closest('[data-online-command]');
      if (button) this.action(button.dataset.onlineCommand, { kind: button.dataset.kind, userId: button.dataset.userId, inviteId: button.dataset.inviteId,
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
  rpc(action, payload = {}) { return this.ui.accountService.onlineAction(action, payload); }
  message(text, error = false) { const node = document.getElementById('online-hub-message'); node.textContent = text; node.classList.toggle('error', error); }
  async activate() {
    this.identity = null; this.lobby = null; this.connectedMatchId = null;
    await this.refresh();
    if (!this.identity) { this.ui.show('online'); this.message('Elige un nombre de usuario único para identificarte en el online.'); }
  }
  async open() { this.render(); if (this.ui.user) await this.refresh(); }
  async refresh() {
    if (!this.ui.user || this.polling || this.busy) return;
    this.polling = true; const userId = this.ui.user.id;
    try {
      const data = await this.rpc(this.lobby ? 'poll' : 'state', this.lobby ? { lobbyId: this.lobby.id } : {});
      if (this.ui.user?.id === userId) await this.consume(data);
      this.lastPoll = Date.now();
    } catch (error) { if (this.ui.currentView === 'online') this.message(error.message || 'No se pudo conectar.', true); }
    finally { this.polling = false; }
  }
  tick() {
    if (!this.ui.user) return;
    if (this.lobby?.state === 'playing' || this.lobby?.state === 'waiting' || this.ui.currentView === 'online' || Date.now() - this.lastPoll > 15000) this.refresh();
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
    const userId = this.ui.user.id;
    this.busy = true; this.render(); this.message('Conectando…');
    try {
      if (['queue','create','join','invite','invite_accept'].includes(command)) payload.profile = this.ui.onlinePlayer();
      if (command === 'invite') payload.kind = 'quick';
      const data = await this.rpc(command, payload);
      if (this.ui.user?.id !== userId) return;
      if (command === 'leave') {
        await this.ui.onlineMatch.leave(); this.ui.game.stop(); this.ui.currentMatchMode = null; this.connectedMatchId = null;
        this.ui.result_overlay.classList.add('hidden'); this.ui.pause_overlay.classList.add('hidden'); this.ui.show('online');
      }
      await this.consume(data);
      if (command === 'claim_username') this.message('Nombre reservado. ¡Bienvenido al online!');
      else if (command === 'friend_request') { this.message('Solicitud enviada. Tu amigo podrá aceptarla aquí.'); document.getElementById('online-friend-input').value = ''; }
      else if (command === 'invite') this.message('Invitación enviada. Esperando a que tu amigo acepte.');
      else if (command === 'invite_decline') this.message('Invitación declinada.');
      else if (!this.lobby) this.message('Listo.');
    } catch (error) { this.message(error.message || 'No se pudo completar la acción.', true); }
    finally { this.busy = false; this.render(); }
  }
  async consume(data) {
    this.identity = data?.identity || null; this.friends = data?.friends || []; this.invites = data?.invites || []; this.lobby = data?.lobby || null;
    this.render();
    if (this.lobby?.state === 'cancelled') {
      this.message('La sala se ha cancelado o el resultado no coincide. No se aplica ELO por un resultado discrepante.', true);
      if (this.ui.currentMatchMode === 'online') { this.ui.game.stop(); await this.ui.onlineMatch.leave(false); this.ui.currentMatchMode = null; this.ui.show('online'); }
      this.connectedMatchId = null; return;
    }
    const match = assignedMatch(this.lobby, this.identity?.id);
    if (match && match.id !== this.connectedMatchId && ['online'].includes(this.ui.currentView)) await this.connect(match);
    this.updateResultStatus();
  }
  async connect(match) {
    if (!this.identity || this.connectedMatchId === match.id) return;
    const other = this.lobby.players.find(player => player.id === opponentId(match, this.identity.id));
    if (!other) return;
    this.connectedMatchId = match.id;
    try {
      const opponent = { ...other.profile, userId: other.id, username: other.username, elo: other.elo, modifiers: ONLINE_RULES };
      await this.ui.onlineMatch.connectAssigned(match, this.ui.onlinePlayer(), opponent);
    } catch (error) { this.connectedMatchId = null; this.message(error.message, true); }
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
    try { const data = await this.rpc('report', this.pendingResult); this.pendingResult = null; await this.consume(data); }
    catch (error) { this.ui.result_online_status.textContent = `${error.message}. Reintentando…`; }
    finally { this.reporting = false; }
  }
  updateResultStatus() {
    if (this.pendingResult) { this.sendResult(); return; }
    const match = this.lobby?.matches.find(item => item.id === this.connectedMatchId);
    if (!match || this.ui.result_overlay.classList.contains('hidden')) return;
    this.ui.result_finish.disabled = match.state === 'playing';
    if (match.state === 'finished') {
      const won = match.winner === this.identity.id;
      this.ui.result_online_status.textContent = this.lobby.kind === 'ranked' ? `Resultado confirmado · ${this.identity.elo} ELO · ${won ? 'Victoria' : 'Derrota'}` : 'Resultado confirmado. Sin cambios de ELO.';
    } else if (match.state === 'disputed') this.ui.result_online_status.textContent = 'Los resultados no coinciden. El partido no puntúa.';
  }
  async returnToLobby() {
    this.ui.game.stop(); await this.ui.onlineMatch.leave(false); this.ui.currentMatchMode = null; this.ui.currentMatchOptions = null;
    this.ui.result_overlay.classList.add('hidden'); this.ui.goal_banner.classList.add('hidden'); this.ui.countdown_banner.classList.add('hidden'); this.ui.hideConnectionStatus();
    this.ui.show('online'); await this.refresh();
  }
  reset() { this.identity = null; this.lobby = null; this.friends = []; this.invites = []; this.connectedMatchId = null; this.pendingResult = null; this.render(); }
  render() {
    const signedIn = Boolean(this.ui.user), registered = Boolean(this.identity);
    document.getElementById('online-login-needed').classList.toggle('hidden', signedIn);
    document.getElementById('online-username-needed').classList.toggle('hidden', !signedIn || registered);
    document.getElementById('online-content').classList.toggle('hidden', !signedIn || !registered);
    document.getElementById('online-identity').textContent = registered ? `@${this.identity.username} · ${this.identity.elo} ELO` : signedIn ? 'Elige tu nombre de usuario' : 'Inicia sesión para jugar online';
    const account = document.getElementById('account-username'); if (account) account.textContent = registered ? `@${this.identity.username} · ${this.identity.elo} ELO` : 'Nombre de usuario pendiente';
    const pending = this.invites.filter(item => item.incoming && item.state === 'pending').length + this.friends.filter(item => item.incoming && !item.accepted).length;
    document.getElementById('online-friends-count').textContent = pending ? ` (${pending})` : '';
    this.screen.querySelectorAll('[data-online-tab]').forEach(button => { const active = button.dataset.onlineTab === this.mode; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); });
    this.screen.querySelectorAll('[data-online-panel]').forEach(panel => panel.classList.toggle('hidden', panel.dataset.onlinePanel !== this.mode));
    this.screen.querySelectorAll('[data-online-command], #online-find-match, #online-create-room, #online-join-room').forEach(button => { button.disabled = this.busy; });
    document.getElementById('online-ranked-elo').textContent = registered ? `${this.identity.elo} ELO` : '500 ELO iniciales';
    this.renderFriends(); this.renderLobby();
  }
  button(text, command, data = {}) {
    const button = element('button', text, 'tiny-button'); button.type = 'button'; button.dataset.onlineCommand = command;
    Object.assign(button.dataset, data); button.disabled = this.busy; return button;
  }
  renderFriends() {
    const list = document.getElementById('online-friends-list'); list.replaceChildren();
    for (const friend of this.friends) {
      const row = element('div', '', 'social-row'); const text = element('div', '', 'social-person');
      text.append(element('b', `@${friend.username}`), element('small', friend.accepted ? `${friend.elo} ELO` : friend.incoming ? 'Te ha enviado una solicitud de amistad' : 'Solicitud de amistad enviada'));
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
  renderLobby() {
    const panel = this.ui.online_room_panel; panel.classList.toggle('hidden', !this.lobby);
    const roster = document.getElementById('online-lobby-roster'); roster.replaceChildren();
    const bracket = document.getElementById('online-bracket'); bracket.replaceChildren();
    if (!this.lobby) return;
    const room = this.lobby, capacity = ONLINE_MODES[room.kind]?.capacity || 2;
    this.ui.online_room_code_wrap.classList.toggle('hidden', room.public || room.state !== 'waiting');
    this.ui.online_room_code.textContent = room.code;
    this.ui.online_cancel.textContent = room.state === 'finished' || room.state === 'cancelled' ? 'Cerrar sala' : room.state === 'playing' ? 'Salir de la sala' : 'Cancelar búsqueda / sala';
    let status = room.state === 'waiting' ? `${ONLINE_MODES[room.kind].name} · ${room.players.length}/${capacity} jugadores · Esperando participantes…` : room.state === 'finished' ? `Ganador: @${room.players.find(p => p.id === room.champion)?.username || 'jugador'}` : room.state === 'cancelled' ? 'Sala cancelada.' : room.kind === 'tournament' ? 'Torneo en curso · dos semifinales y una final' : 'Partido en curso';
    if (room.kind === 'tournament' && room.state === 'playing' && !assignedMatch(room, this.identity?.id)) status += ' · Esperando la otra semifinal o la final';
    this.ui.online_status.textContent = status; this.ui.online_status.classList.toggle('error', room.state === 'cancelled');
    room.players.forEach(player => roster.append(element('span', `@${player.username} · ${player.elo} ELO`, 'lobby-player')));
    for (const match of room.matches) {
      const first = room.players.find(player => player.id === match.p1), second = room.players.find(player => player.id === match.p2);
      const card = element('div', '', 'bracket-match'); card.append(element('small', room.kind === 'tournament' ? match.round === 2 ? 'FINAL' : `SEMIFINAL ${match.position}` : ONLINE_MODES[room.kind].name.toUpperCase()));
      card.append(element('b', `@${first?.username} vs @${second?.username}`));
      card.append(element('span', match.state === 'finished' ? `${match.score1} – ${match.score2} · Gana @${room.players.find(p => p.id === match.winner)?.username}` : match.state === 'disputed' ? 'Resultado discrepante' : match.reported1 || match.reported2 ? 'Confirmando resultado…' : 'En juego'));
      bracket.append(card);
    }
  }
}
