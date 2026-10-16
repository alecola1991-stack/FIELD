import { normalizeModifiers, modifiersAreDefault } from '../config/modifiers.js';
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const HELLO_INTERVAL_MS = 500;
const RECONNECT_GRACE_MS = 15000;
const MATCHMAKING_TOPIC = 'field-matchmaking-v3';
// 2v2: the host starts once the three guests have said hello, or after this
// wait with whoever is connected (an absent seat just stands still).
const SQUAD_START_WAIT_MS = 12000;

export class OnlineMatch {
  constructor(client) {
    this.client = client;
    this.channel = null;
    this.role = null;
    this.code = null;
    this.clientId = stableClientId();
    this.profile = null;
    this.opponent = null;
    this.handlers = {};
    this.helloTimer = 0;
    this.disconnectTimer = 0;
    this.peerDisconnectedAt = 0;
    this.matched = false;
    this.matchId = null;
    this.localRematchVote = false;
    this.remoteRematchVote = false;
    this.rematchStarting = false;
    this.latestInput = { x: 0, y: 0, kick: false, receivedAt: 0 };
    this.inputSequence = 0;
    this.lastInputSequence = 0;
    this.snapshotSequence = 0;
    this.lastSnapshotSequence = 0;
    this.closedByUser = false;
    this.searching = false;
    this.matchmakingAt = 0;
    this.matchmakingStarting = false;
  }

  setHandlers(handlers = {}) { this.handlers = handlers; }

  async createRoom(profile) {
    return this.connect(makeRoomCode(), 'host', profile);
  }

  async joinRoom(code, profile) {
    const normalized = String(code || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 8);
    if (!/^[A-Z2-9]{8}$/.test(normalized)) throw new Error('El código debe tener 8 letras o números.');
    return this.connect(normalized, 'guest', profile);
  }

  async findMatch(profile) {
    await this.leave(false);
    this.profile = safeProfile(profile);
    this.role = 'searching';
    this.searching = true;
    this.matchmakingStarting = false;
    this.matchmakingAt = Date.now();
    this.closedByUser = false;
    this.handlers.onStatus?.('searching');

    const channel = this.client.channel(MATCHMAKING_TOPIC, {
      config: { broadcast: { self: false, ack: false }, presence: { key: this.clientId } },
    });
    this.channel = channel;
    channel.on('broadcast', { event: 'match-offer' }, message => this.handleMatchOffer(message?.payload ?? message));
    channel.on('presence', { event: 'sync' }, () => this.tryMatchmake(channel));
    channel.on('presence', { event: 'join' }, () => this.tryMatchmake(channel));
    channel.subscribe(status => {
      if (this.channel !== channel || !this.searching) return;
      if (status === 'SUBSCRIBED') {
        channel.track({ clientId: this.clientId, profile: this.profile, queuedAt: this.matchmakingAt, status: 'searching' }).catch(() => {});
        this.handlers.onStatus?.('searching');
        this.tryMatchmake(channel);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.handlers.onStatus?.('error', 'No se pudo conectar con la búsqueda online. Revisa la conexión e inténtalo de nuevo.');
      }
    });
  }

  tryMatchmake(channel = this.channel) {
    if (!this.searching || this.matchmakingStarting || this.channel !== channel || !channel?.presenceState) return;
    const unique = new Map(Object.values(channel.presenceState() || {}).flat().map(player => [player?.clientId, player]));
    const players = [...unique.values()]
      .filter(presence => presence?.clientId && Number.isFinite(presence.queuedAt) && presence.status === 'searching')
      .sort((a, b) => a.queuedAt - b.queuedAt || String(a.clientId).localeCompare(String(b.clientId)));
    const ownIndex = players.findIndex(player => player.clientId === this.clientId);
    if (ownIndex < 0 || ownIndex % 2 !== 0 || !players[ownIndex + 1]) return;

    const opponent = players[ownIndex + 1];
    this.matchmakingStarting = true;
    this.searching = false;
    const code = makeRoomCode();
    channel.send({ type: 'broadcast', event: 'match-offer', payload: {
      target: opponent.clientId, clientId: this.clientId, profile: this.profile, code,
    } }).catch(() => {});
    this.handlers.onStatus?.('matching');
    // Give the targeted player time to receive the offer before leaving the shared lobby.
    setTimeout(() => {
      if (this.channel !== channel || !this.matchmakingStarting) return;
      this.connect(code, 'host', this.profile).catch(error => this.handlers.onStatus?.('error', error?.message));
    }, 180);
  }

  handleMatchOffer(message) {
    if (!this.searching || this.matchmakingStarting || message?.target !== this.clientId || !/^[A-Z2-9]{8}$/.test(message.code || '')) return;
    this.searching = false;
    this.matchmakingStarting = true;
    const profile = this.profile;
    this.handlers.onStatus?.('matching');
    this.connect(message.code, 'guest', profile).catch(error => this.handlers.onStatus?.('error', error?.message));
  }

  async connectAssigned(match, profile, opponent, squad = null) {
    if (squad) return this.connect(match.id, squad.localSeat === 0 ? 'host' : 'guest', profile, { matchId: match.id, opponent, squad });
    return this.connect(match.id, match.p1 === profile.userId ? 'host' : 'guest', profile, { matchId: match.id, opponent });
  }

  // ---- 2v2 (four peers, seat 0 hosts) ----------------------------------------
  squadSeatOf(userId) { return this.assignment?.squad?.seats.findIndex(seat => seat.userId === userId) ?? -1; }
  handleSquadSignal(message) {
    const squad = this.assignment.squad, seat = Number(message.seat);
    if (message.kind === 'leave') {
      if ([...this.squadPeers.values()].includes(message.clientId) || message.clientId === this.opponent?.clientId) { this.handlers.onStatus?.('peer-left'); this.handlers.onPeerLeft?.(); }
      return;
    }
    if (message.kind === 'replay-skip') {
      if (this.role === 'host' && this.matched && this.squadPeers.get(seat) === message.clientId && message.matchId === this.matchId) this.handlers.onReplaySkip?.(seat);
      return;
    }
    if (message.kind === 'hello') {
      const peer = message.profile;
      if (message.version !== 3 || !Number.isInteger(seat) || seat < 0 || seat > 3 || this.squadSeatOf(peer?.userId) !== seat) return;
      this.squadPeers.set(seat, message.clientId);
      if (this.role === 'host' && seat > 0) {
        if (message.resume?.matchId === this.assignment.matchId && !this.pendingResume) this.pendingResume = message.resume;
        if (this.matched) { this.sendStart(); return; }
        if ([1, 2, 3].every(index => this.squadPeers.has(index))) this.startSquad();
      } else if (this.role === 'guest' && seat === 0) {
        this.opponent = { ...safeProfile(squad.seats[0]), clientId: message.clientId };
        this.markPeerReconnected();
        if (!this.matched) this.handlers.onStatus?.('waiting');
        else this.announce(); // the host reloaded: help it resume
      }
      return;
    }
    // The start may arrive before the host's hello: identify the host by its profile.
    if (message.kind === 'start' && this.role === 'guest' && message.matchId === this.assignment.matchId && message.host?.userId === squad.seats[0].userId) {
      this.squadPeers.set(0, message.clientId);
      if (this.matched) { this.markPeerReconnected(); return; }
      this.matched = true; this.matchId = message.matchId;
      this.opponent = { ...safeProfile(squad.seats[0]), clientId: message.clientId };
      clearInterval(this.helloTimer); this.helloTimer = 0;
      this.handlers.onMatchStart?.({ role: 'guest', localSide: squad.localSeat < 2 ? 'left' : 'right', modifiers: normalizeModifiers({}), opponent: this.squadRival(), roomCode: this.code, squad });
    }
  }
  startSquad() {
    if (this.role !== 'host' || this.matched) return;
    clearTimeout(this.squadStartTimer); this.squadStartTimer = 0;
    const squad = this.assignment.squad;
    this.matched = true; this.matchId = this.assignment.matchId;
    clearInterval(this.helloTimer); this.helloTimer = 0;
    this.sendStart();
    this.handlers.onMatchStart?.({ role: 'host', localSide: 'left', modifiers: normalizeModifiers({}), opponent: this.squadRival(), roomCode: this.code, squad, resume: this.pendingResume });
    this.pendingResume = null;
  }
  squadRival() { const squad = this.assignment.squad; return { ...safeProfile(squad.seats[squad.localSeat < 2 ? 2 : 0]) }; }
  getSeatInput(seat) {
    const input = this.seatInputs.get(seat);
    if (!input || Date.now() - input.receivedAt > 350) return { x: 0, y: 0, kick: false };
    const result = { x: input.x, y: input.y, kick: input.kick }; input.kick = false;
    return result;
  }

  async connect(code, role, profile, assignment = null) {
    await this.leave(false);
    this.assignment = assignment;
    this.code = code; this.role = role; this.profile = safeProfile(profile); this.opponent = null;
    this.matched = false; this.closedByUser = false; this.matchId = null;
    this.localRematchVote = false; this.remoteRematchVote = false; this.rematchStarting = false;
    this.peerDisconnectedAt = 0; clearInterval(this.disconnectTimer); this.disconnectTimer = 0;
    this.squadPeers = new Map(); this.seatInputs = new Map(); this.seatSequences = new Map(); this.seatNonces = new Map();
    // A new nonce per connection lets the other side reset its packet counters when we reload.
    this.nonce = Math.random().toString(36).slice(2, 10); this.remoteNonce = null; this.pendingResume = null;
    clearTimeout(this.squadStartTimer); this.squadStartTimer = 0;
    this.latestInput = { x: 0, y: 0, kick: false, receivedAt: 0 };
    this.inputSequence = 0; this.lastInputSequence = 0;
    this.snapshotSequence = 0; this.lastSnapshotSequence = 0; this.lastSnapshotAt = 0;
    const channel = this.client.channel(assignment ? `field-v3-match-${code}` : `field-match-${code.toLowerCase()}`, {
      config: { private: Boolean(assignment), broadcast: { self: false, ack: false }, presence: { key: this.clientId } },
    });
    this.channel = channel;
    channel.on('broadcast', { event: 'signal' }, message => this.handleSignal(message?.payload ?? message));
    channel.on('broadcast', { event: 'input' }, message => this.handleInput(message?.payload ?? message));
    channel.on('broadcast', { event: 'snapshot' }, message => this.handleSnapshot(message?.payload ?? message));
    channel.on('presence', { event: 'leave' }, event => this.handlePresenceLeave(event));
    channel.on('presence', { event: 'join' }, event => this.handlePresenceJoin(event));
    channel.on('presence', { event: 'sync' }, () => this.handlePresenceSync(channel));
    channel.subscribe(status => {
      if (this.channel !== channel) return;
      if (status === 'SUBSCRIBED') {
        this.handlers.onStatus?.('ready');
        clearInterval(this.helloTimer);
        channel.track({ clientId: this.clientId, role: this.role }).catch(() => {});
        this.announce();
        this.helloTimer = window.setInterval(() => this.announce(), HELLO_INTERVAL_MS);
        if (this.assignment?.squad && this.role === 'host' && !this.squadStartTimer) this.squadStartTimer = setTimeout(() => { if (this.squadPeers.size) this.startSquad(); }, SQUAD_START_WAIT_MS);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (this.matched) this.markPeerDisconnected();
        else this.handlers.onStatus?.('error', 'No se pudo conectar con Supabase Realtime. Revisa la conexión e inténtalo de nuevo.');
      } else if (status === 'CLOSED' && !this.closedByUser) {
        this.markPeerDisconnected();
      }
    });
    this.handlers.onStatus?.('connecting');
    return code;
  }

  announce() {
    // A matched guest that greets a reloaded host also sends where the match was (score and time).
    const resume = this.role === 'guest' && this.matched ? this.handlers.getResume?.() || null : null;
    this.send('signal', { kind: 'hello', version: this.assignment ? 3 : 2, clientId: this.clientId, role: this.role, profile: this.profile, nonce: this.nonce, ...(resume ? { resume } : {}), ...(this.assignment?.squad ? { seat: this.assignment.squad.localSeat } : {}) });
  }

  handleSignal(message) {
    if (!message || message.clientId === this.clientId) return;
    if (this.assignment?.squad) { this.handleSquadSignal(message); return; }
    if (this.assignment && String(message.kind || '').startsWith('rematch')) return;
    // Goal replay: the guest tells the host it skipped; the host ends the replay once both have.
    if (message.kind === 'replay-skip') {
      if (this.role === 'host' && this.matched && message.clientId === this.opponent?.clientId && (!message.matchId || message.matchId === this.matchId)) this.handlers.onReplaySkip?.();
      return;
    }
    if (message.kind === 'version-mismatch' && message.target === this.clientId) { this.handlers.onStatus?.('error', 'Actualiza el juego para usar los modificadores de esta sala.'); return; }
    if (this.assignment && ['hello', 'start'].includes(message.kind)) {
      const peer = message.kind === 'hello' ? message.profile : message.host;
      if (peer?.userId !== this.assignment.opponent.userId) return;
      if (message.kind === 'hello' && message.version !== 3) return;
      if (message.kind === 'start' && message.matchId !== this.assignment.matchId) return;
    }
    if (message.kind === 'hello') {
      if (this.role === 'host' && message.role === 'guest') {
        if (message.version !== 2 && !modifiersAreDefault(this.profile?.modifiers)) {
          this.send('signal', { kind: 'version-mismatch', clientId: this.clientId, target: message.clientId });
          this.handlers.onStatus?.('error', 'El rival necesita actualizar el juego para usar estas reglas.'); return;
        }
        if (this.matched) {
          // Server-assigned matches verify the user: a reload, new tab or new device takes the seat back.
          if (message.clientId !== this.opponent?.clientId && !this.assignment) { this.send('signal', { kind: 'room-full', target: message.clientId }); return; }
          if (message.clientId !== this.opponent?.clientId) this.opponent = { ...this.opponent, clientId: message.clientId };
          this.markPeerReconnected(); this.sendStart();
          return;
        }
        const resume = this.assignment && message.resume?.matchId === this.assignment.matchId ? message.resume : null;
        this.matched = true; this.opponent = { ...safeProfile(this.assignment?.opponent || message.profile), clientId: message.clientId };
        clearInterval(this.helloTimer); this.helloTimer = 0;
        this.matchId = this.assignment?.matchId || makeMatchId();
        this.sendStart();
        this.handlers.onMatchStart?.({ role: 'host', localSide: 'left', modifiers: normalizeModifiers(this.profile?.modifiers), opponent: this.opponent, roomCode: this.code, resume });
      } else if (this.role === 'guest' && message.role === 'host') {
        this.opponent = { ...safeProfile(this.assignment?.opponent || message.profile), clientId: message.clientId };
        this.markPeerReconnected();
        if (!this.matched) this.handlers.onStatus?.('waiting');
        // The host greets again only after reloading: answer so it can resume the match.
        else this.announce();
      }
      return;
    }
    if (message.kind === 'start' && this.role === 'guest') {
      if (this.matched) { this.opponent = { ...this.opponent, clientId: message.clientId }; this.markPeerReconnected(); return; }
      this.matched = true; this.matchId = message.matchId;
      this.opponent = { ...safeProfile(this.assignment?.opponent || message.host), clientId: message.clientId };
      clearInterval(this.helloTimer); this.helloTimer = 0;
      this.handlers.onMatchStart?.({ role: 'guest', localSide: 'right', modifiers: normalizeModifiers(this.opponent?.modifiers), opponent: this.opponent, roomCode: this.code });
      return;
    }
    if (message.kind === 'rematch-vote' && (!message.matchId || message.matchId === this.matchId) && message.clientId === this.opponent?.clientId) {
      this.remoteRematchVote = true;
      this.handlers.onRematchRequested?.();
      this.tryStartRematch();
      return;
    }
    if (message.kind === 'rematch-start' && this.role === 'guest' && message.clientId === this.opponent?.clientId) {
      this.matchId = message.matchId; this.localRematchVote = false; this.remoteRematchVote = false; this.rematchStarting = false;
      this.handlers.onMatchStart?.({ role: 'guest', localSide: 'right', modifiers: normalizeModifiers(this.opponent?.modifiers), opponent: this.opponent, roomCode: this.code, rematch: true });
      return;
    }
    if (message.kind === 'room-full' && this.role === 'guest' && message.target === this.clientId) {
      this.handlers.onStatus?.('error', 'La sala ya tiene dos jugadores. Prueba otro código.');
      return;
    }
    if (message.kind === 'leave' && message.clientId === this.opponent?.clientId) {
      this.handlers.onStatus?.('peer-left'); this.handlers.onPeerLeft?.();
    }
  }

  handleInput(message) {
    if (this.assignment?.squad) {
      const seat = Number(message?.seat);
      if (this.role !== 'host' || !this.matched || this.squadPeers.get(seat) !== message?.clientId || message.matchId !== this.matchId) return;
      if (message.nonce && this.seatNonces.get(seat) !== message.nonce) { this.seatNonces.set(seat, message.nonce); this.seatSequences.set(seat, 0); }
      if (Number.isInteger(message.sequence) && message.sequence <= (this.seatSequences.get(seat) || 0)) return;
      if (Number.isInteger(message.sequence)) this.seatSequences.set(seat, message.sequence);
      const previous = this.seatInputs.get(seat);
      this.seatInputs.set(seat, { x: clampAxis(message.x), y: clampAxis(message.y), kick: (previous?.kick || false) || message.kick === true, receivedAt: Date.now() });
      return;
    }
    if (this.role !== 'host' || !this.matched || message?.clientId !== this.opponent?.clientId) return;
    if ((this.assignment || message.matchId) && message.matchId !== this.matchId) return;
    if (message.nonce && message.nonce !== this.remoteNonce) { this.remoteNonce = message.nonce; this.lastInputSequence = 0; }
    if (Number.isInteger(message.sequence) && message.sequence <= this.lastInputSequence) return;
    if (Number.isInteger(message.sequence)) this.lastInputSequence = message.sequence;
    this.latestInput = {
      x: clampAxis(message.x), y: clampAxis(message.y), kick: this.latestInput.kick || message.kick === true,
      receivedAt: Date.now(),
    };
    this.handlers.onInput?.({ ...this.latestInput });
  }

  handleSnapshot(message) {
    if (this.role !== 'guest' || !this.matched || message?.clientId !== this.opponent?.clientId || !message.snapshot) return;
    if ((this.assignment || message.matchId) && message.matchId !== this.matchId) return;
    if (message.nonce && message.nonce !== this.remoteNonce) { this.remoteNonce = message.nonce; this.lastSnapshotSequence = 0; }
    if (Number.isInteger(message.sequence) && message.sequence <= this.lastSnapshotSequence) return;
    if (Number.isInteger(message.sequence)) this.lastSnapshotSequence = message.sequence;
    this.lastSnapshotAt = Date.now();
    this.handlers.onSnapshot?.(message.snapshot);
  }

  handlePresenceLeave(event) {
    if (this.assignment?.squad && this.role === 'host') return; // a guest seat just stands still
    const left = event?.leftPresences || [];
    if (left.some(presence => presence?.clientId === this.opponent?.clientId)) {
      this.markPeerDisconnected();
    }
  }

  handlePresenceJoin(event) {
    const joined = event?.newPresences || [];
    if (joined.some(presence => presence?.clientId === this.opponent?.clientId)) this.markPeerReconnected();
  }

  handlePresenceSync(channel) {
    if (!this.opponent?.clientId || !this.peerDisconnectedAt) return;
    const found = Object.values(channel.presenceState?.() || {}).flat()
      .some(presence => presence?.clientId === this.opponent.clientId);
    if (found) this.markPeerReconnected();
  }

  markPeerDisconnected() {
    if (!this.matched || this.peerDisconnectedAt) return;
    this.peerDisconnectedAt = Date.now();
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((RECONNECT_GRACE_MS - (Date.now() - this.peerDisconnectedAt)) / 1000));
      this.handlers.onPeerReconnecting?.(remaining);
      if (remaining === 0) {
        clearInterval(this.disconnectTimer); this.disconnectTimer = 0; this.peerDisconnectedAt = 0;
        this.handlers.onPeerLeft?.();
      }
    };
    tick(); this.disconnectTimer = window.setInterval(tick, 1000);
  }

  markPeerReconnected() {
    if (!this.peerDisconnectedAt) return;
    clearInterval(this.disconnectTimer); this.disconnectTimer = 0; this.peerDisconnectedAt = 0;
    if (this.matched) { clearInterval(this.helloTimer); this.helloTimer = 0; }
    this.handlers.onPeerReconnected?.();
  }

  sendStart() {
    this.send('signal', { kind: 'start', clientId: this.clientId, host: this.profile, guest: this.opponent, matchId: this.matchId });
  }

  requestRematch() {
    if (this.assignment) return;
    if (!this.matched || this.rematchStarting) return;
    this.localRematchVote = true;
    this.send('signal', { kind: 'rematch-vote', matchId: this.matchId, clientId: this.clientId });
    this.tryStartRematch();
  }

  tryStartRematch() {
    if (this.role !== 'host' || !this.localRematchVote || !this.remoteRematchVote || this.rematchStarting) return;
    this.rematchStarting = true;
    this.matchId = this.assignment?.matchId || makeMatchId();
    this.localRematchVote = false; this.remoteRematchVote = false;
    const info = { role: 'host', localSide: 'left', modifiers: normalizeModifiers(this.profile?.modifiers), opponent: this.opponent, roomCode: this.code, rematch: true };
    this.send('signal', { kind: 'rematch-start', clientId: this.clientId, matchId: this.matchId });
    this.handlers.onMatchStart?.(info);
    this.rematchStarting = false;
  }

  getRemoteInput() {
    if (Date.now() - this.latestInput.receivedAt > 350) return { x: 0, y: 0, kick: false };
    const input = { ...this.latestInput };
    this.latestInput.kick = false;
    return input;
  }

  sendInput(input) {
    if (this.role !== 'guest' || !this.matched) return;
    this.send('input', { clientId: this.clientId, matchId: this.matchId, nonce: this.nonce, sequence: ++this.inputSequence, x: clampAxis(input.x), y: clampAxis(input.y), kick: input.kick === true, ...(this.assignment?.squad ? { seat: this.assignment.squad.localSeat } : {}) });
  }

  sendReplaySkip() {
    if (this.role !== 'guest' || !this.matched) return;
    this.send('signal', { kind: 'replay-skip', clientId: this.clientId, matchId: this.matchId, ...(this.assignment?.squad ? { seat: this.assignment.squad.localSeat } : {}) });
  }

  sendSnapshot(snapshot) {
    if (this.role !== 'host' || !this.matched) return;
    this.send('snapshot', { clientId: this.clientId, matchId: this.matchId, nonce: this.nonce, sequence: ++this.snapshotSequence, snapshot });
  }

  send(event, payload) {
    const channel = this.channel;
    if (!channel) return;
    // While the socket is down supabase-js would fall back to the REST broadcast API: at 30
    // packets/s that gets rate limited (429) and loads the database for every player. Game
    // packets are disposable, so they wait for the socket instead.
    if (channel.state !== undefined && channel.state !== 'joined') return;
    channel.send({ type: 'broadcast', event, payload }).catch(() => {});
  }

  async leave(notifyPeer = true) {
    this.closedByUser = true;
    clearInterval(this.helloTimer); this.helloTimer = 0;
    clearInterval(this.disconnectTimer); this.disconnectTimer = 0; this.peerDisconnectedAt = 0;
    clearTimeout(this.squadStartTimer); this.squadStartTimer = 0;
    const channel = this.channel;
    this.channel = null;
    if (notifyPeer && channel && this.matched) channel.send({ type: 'broadcast', event: 'signal', payload: { kind: 'leave', clientId: this.clientId } }).catch(() => {});
    this.matched = false; this.opponent = null; this.role = null; this.code = null; this.matchId = null;
    this.searching = false; this.matchmakingStarting = false; this.matchmakingAt = 0;
    this.localRematchVote = false; this.remoteRematchVote = false; this.rematchStarting = false;
    if (channel) await this.client.removeChannel(channel).catch(() => {});
  }
}

function safeProfile(profile = {}) {
  profile = profile && typeof profile === 'object' ? profile : {};
  return {
    userId: String(profile.userId || '').slice(0, 36),
    username: String(profile.username || '').slice(0, 20),
    elo: Math.max(0, Math.floor(Number.isFinite(Number(profile.elo)) ? Number(profile.elo) : 500)),
    name: String(profile.name || 'JUGADOR').trim().slice(0, 16),
    number: Math.max(0, Math.min(99, Math.floor(Number(profile.number) || 0))),
    teamId: String(profile.teamId || '').slice(0, 60),
    modifiers: normalizeModifiers({}),
    level: Math.max(1, Math.min(100, Math.floor(Number(profile.level) || 1))),
  };
}

function clampAxis(value) { return Math.max(-1, Math.min(1, Number(value) || 0)); }

function makeRoomCode() {
  const bytes = new Uint8Array(8);
  globalThis.crypto?.getRandomValues?.(bytes);
  return [...bytes].map((value, index) => ROOM_ALPHABET[(globalThis.crypto?.getRandomValues ? value : Math.floor(Math.random() * 256)) % ROOM_ALPHABET.length]).join('');
}

function makeMatchId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function stableClientId() {
  try {
    let id = sessionStorage.getItem('field-online-client-id');
    if (!id) { id = globalThis.crypto?.randomUUID?.() || `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; sessionStorage.setItem('field-online-client-id', id); }
    return id;
  } catch { return globalThis.crypto?.randomUUID?.() || `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }
}
