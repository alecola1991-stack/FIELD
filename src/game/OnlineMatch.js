const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const HELLO_INTERVAL_MS = 1000;
const RECONNECT_GRACE_MS = 15000;

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
    this.closedByUser = false;
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

  async connect(code, role, profile) {
    await this.leave(false);
    this.code = code; this.role = role; this.profile = safeProfile(profile); this.opponent = null;
    this.matched = false; this.closedByUser = false; this.matchId = null;
    this.localRematchVote = false; this.remoteRematchVote = false; this.rematchStarting = false;
    this.peerDisconnectedAt = 0; clearInterval(this.disconnectTimer); this.disconnectTimer = 0;
    this.latestInput = { x: 0, y: 0, kick: false, receivedAt: 0 };
    const channel = this.client.channel(`field-match-${code.toLowerCase()}`, {
      config: { broadcast: { self: false, ack: false }, presence: { key: this.clientId } },
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
    this.send('signal', { kind: 'hello', clientId: this.clientId, role: this.role, profile: this.profile });
  }

  handleSignal(message) {
    if (!message || message.clientId === this.clientId) return;
    if (message.kind === 'hello') {
      if (this.role === 'host' && message.role === 'guest') {
        if (this.matched) {
          if (message.clientId !== this.opponent?.clientId) this.send('signal', { kind: 'room-full', target: message.clientId });
          else { this.markPeerReconnected(); this.sendStart(); }
          return;
        }
        this.matched = true; this.opponent = { ...safeProfile(message.profile), clientId: message.clientId };
        clearInterval(this.helloTimer); this.helloTimer = 0;
        this.matchId = makeMatchId();
        this.sendStart();
        this.handlers.onMatchStart?.({ role: 'host', localSide: 'left', opponent: this.opponent, roomCode: this.code });
      } else if (this.role === 'guest' && message.role === 'host') {
        this.opponent = { ...safeProfile(message.profile), clientId: message.clientId };
        this.markPeerReconnected();
        if (!this.matched) this.handlers.onStatus?.('waiting');
      }
      return;
    }
    if (message.kind === 'start' && this.role === 'guest') {
      if (this.matched) { this.markPeerReconnected(); return; }
      this.matched = true; this.matchId = message.matchId;
      this.opponent = { ...safeProfile(message.host), clientId: message.clientId };
      clearInterval(this.helloTimer); this.helloTimer = 0;
      this.handlers.onMatchStart?.({ role: 'guest', localSide: 'right', opponent: this.opponent, roomCode: this.code });
      return;
    }
    if (message.kind === 'rematch-vote' && message.clientId === this.opponent?.clientId) {
      this.remoteRematchVote = true;
      this.handlers.onRematchRequested?.();
      this.tryStartRematch();
      return;
    }
    if (message.kind === 'rematch-start' && this.role === 'guest' && message.clientId === this.opponent?.clientId) {
      this.matchId = message.matchId; this.localRematchVote = false; this.remoteRematchVote = false; this.rematchStarting = false;
      this.handlers.onMatchStart?.({ role: 'guest', localSide: 'right', opponent: this.opponent, roomCode: this.code, rematch: true });
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
    if (this.role !== 'host' || !this.matched || message?.clientId !== this.opponent?.clientId) return;
    this.latestInput = {
      x: clampAxis(message.x), y: clampAxis(message.y), kick: message.kick === true,
      receivedAt: Date.now(),
    };
    this.handlers.onInput?.(this.getRemoteInput());
  }

  handleSnapshot(message) {
    if (this.role !== 'guest' || !this.matched || message?.clientId !== this.opponent?.clientId || !message.snapshot) return;
    this.handlers.onSnapshot?.(message.snapshot);
  }

  handlePresenceLeave(event) {
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
    if (!this.matched || this.rematchStarting) return;
    this.localRematchVote = true;
    this.send('signal', { kind: 'rematch-vote', clientId: this.clientId });
    this.tryStartRematch();
  }

  tryStartRematch() {
    if (this.role !== 'host' || !this.localRematchVote || !this.remoteRematchVote || this.rematchStarting) return;
    this.rematchStarting = true;
    this.matchId = makeMatchId();
    this.localRematchVote = false; this.remoteRematchVote = false;
    const info = { role: 'host', localSide: 'left', opponent: this.opponent, roomCode: this.code, rematch: true };
    this.send('signal', { kind: 'rematch-start', clientId: this.clientId, matchId: this.matchId });
    this.handlers.onMatchStart?.(info);
    this.rematchStarting = false;
  }

  getRemoteInput() {
    if (Date.now() - this.latestInput.receivedAt > 350) return { x: 0, y: 0, kick: false };
    return this.latestInput;
  }

  sendInput(input) {
    if (this.role !== 'guest' || !this.matched) return;
    this.send('input', { clientId: this.clientId, x: clampAxis(input.x), y: clampAxis(input.y), kick: input.kick === true });
  }

  sendSnapshot(snapshot) {
    if (this.role !== 'host' || !this.matched) return;
    this.send('snapshot', { clientId: this.clientId, snapshot });
  }

  send(event, payload) {
    if (!this.channel) return;
    this.channel.send({ type: 'broadcast', event, payload }).catch(() => {});
  }

  async leave(notifyPeer = true) {
    this.closedByUser = true;
    clearInterval(this.helloTimer); this.helloTimer = 0;
    clearInterval(this.disconnectTimer); this.disconnectTimer = 0; this.peerDisconnectedAt = 0;
    const channel = this.channel;
    this.channel = null;
    if (notifyPeer && channel && this.matched) channel.send({ type: 'broadcast', event: 'signal', payload: { kind: 'leave', clientId: this.clientId } }).catch(() => {});
    this.matched = false; this.opponent = null; this.role = null; this.code = null; this.matchId = null;
    this.localRematchVote = false; this.remoteRematchVote = false; this.rematchStarting = false;
    if (channel) await this.client.removeChannel(channel).catch(() => {});
  }
}

function safeProfile(profile = {}) {
  return {
    name: String(profile.name || 'JUGADOR').trim().slice(0, 16),
    number: Math.max(0, Math.min(99, Math.floor(Number(profile.number) || 0))),
    teamId: String(profile.teamId || '').slice(0, 60),
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
