import test from 'node:test';
import assert from 'node:assert/strict';
import { OnlineMatch } from '../src/game/OnlineMatch.js';

globalThis.window = { setInterval, clearInterval };
let sessionValues = new Map();
globalThis.sessionStorage = {
  getItem: key => sessionValues.get(key) || null,
  setItem: (key, value) => sessionValues.set(key, value),
  removeItem: key => sessionValues.delete(key),
};

const rooms = new Map();
const presences = new Map();
function emitPresence(topic, event, payload = {}) {
  for (const channel of rooms.get(topic) || []) channel.handlers.get(`presence:${event}`)?.(payload);
}
class FakeChannel {
  constructor(topic) {
    this.topic = topic; this.handlers = new Map();
    if (!rooms.has(topic)) rooms.set(topic, new Set());
    rooms.get(topic).add(this);
  }
  on(type, options, callback) { this.handlers.set(`${type}:${options.event || ''}`, callback); return this; }
  subscribe(callback) { queueMicrotask(() => { callback('SUBSCRIBED'); emitPresence(this.topic, 'sync'); }); return this; }
  track(state) {
    this.clientId = state.clientId;
    if (!presences.has(this.topic)) presences.set(this.topic, new Map());
    const topicPresences = presences.get(this.topic);
    topicPresences.set(state.clientId, state);
    emitPresence(this.topic, 'join', { newPresences: [state] });
    emitPresence(this.topic, 'sync');
    return Promise.resolve('ok');
  }
  presenceState() { return Object.fromEntries([...(presences.get(this.topic) || new Map())].map(([key, value]) => [key, [value]])); }
  send(message) {
    for (const peer of rooms.get(this.topic) || []) {
      if (peer !== this) peer.handlers.get(`broadcast:${message.event}`)?.({ payload: message.payload });
    }
    return Promise.resolve('ok');
  }
}

const client = {
  channel: topic => new FakeChannel(topic),
  removeChannel: async channel => {
    rooms.get(channel.topic)?.delete(channel);
    const topicPresences = presences.get(channel.topic);
    const left = topicPresences?.get(channel.clientId);
    if (left) { topicPresences.delete(channel.clientId); emitPresence(channel.topic, 'leave', { leftPresences: [left] }); }
  },
};

test('empareja dos jugadores, transmite entradas y estado, y espera el voto mutuo para la revancha', async () => {
  sessionValues = new Map();
  const host = new OnlineMatch(client);
  sessionValues = new Map();
  const guest = new OnlineMatch(client);
  let hostStarts = 0, guestStarts = 0, receivedInput = null, receivedSnapshot = null, rematchRequested = false;
  host.setHandlers({ onMatchStart: () => hostStarts++, onInput: input => { receivedInput = input; }, onRematchRequested: () => { rematchRequested = true; } });
  guest.setHandlers({ onMatchStart: () => guestStarts++, onSnapshot: snapshot => { receivedSnapshot = snapshot; } });

  const code = await host.createRoom({ name: 'Ana' });
  await guest.joinRoom(code, { name: 'Luis' });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(hostStarts, 1);
  assert.equal(guestStarts, 1);
  assert.equal(host.matchId, guest.matchId);

  guest.sendInput({ x: 0.75, y: -1, kick: true });
  assert.equal(receivedInput.kick, true);
  const snapshot = { mode: 'online', scorePlayer: 2, scoreBot: 1 };
  host.sendSnapshot(snapshot);
  assert.deepEqual(receivedSnapshot, snapshot);
  host.send('snapshot', { clientId: host.clientId, sequence: 99, snapshot: { ...snapshot, scorePlayer: 9 } });
  host.send('snapshot', { clientId: host.clientId, sequence: 98, snapshot: { ...snapshot, scorePlayer: 1 } });
  assert.equal(receivedSnapshot.scorePlayer, 9);

  const finishedMatchId = host.matchId;
  guest.requestRematch();
  assert.equal(rematchRequested, true);
  host.requestRematch();
  assert.equal(hostStarts, 2);
  assert.equal(guestStarts, 2);
  assert.notEqual(host.matchId, finishedMatchId);
  assert.equal(host.matchId, guest.matchId);

  await guest.leave();
  await host.leave();
});

test('muestra la pérdida temporal y cancela el margen al volver el rival', async () => {
  sessionValues = new Map();
  const host = new OnlineMatch(client);
  sessionValues = new Map();
  const guest = new OnlineMatch(client);
  let reconnectSeconds = null, recovered = false;
  host.setHandlers({});
  guest.setHandlers({ onPeerReconnecting: seconds => { reconnectSeconds = seconds; }, onPeerReconnected: () => { recovered = true; } });
  const code = await host.createRoom({ name: 'Ana' });
  await guest.joinRoom(code, { name: 'Luis' });
  await new Promise(resolve => setTimeout(resolve, 10));

  guest.handlePresenceLeave({ leftPresences: [{ clientId: host.clientId }] });
  assert.equal(reconnectSeconds, 15);
  guest.handlePresenceJoin({ newPresences: [{ clientId: host.clientId }] });
  assert.equal(recovered, true);

  await guest.leave();
  await host.leave();
});

test('empareja automáticamente a dos jugadores que buscan partida', async () => {
  sessionValues = new Map();
  const first = new OnlineMatch(client);
  sessionValues = new Map();
  const second = new OnlineMatch(client);
  let firstStarts = 0, secondStarts = 0;
  first.setHandlers({ onMatchStart: () => firstStarts++ });
  second.setHandlers({ onMatchStart: () => secondStarts++ });

  await first.findMatch({ name: 'Ana' });
  await second.findMatch({ name: 'Luis' });
  await new Promise(resolve => setTimeout(resolve, 850));
  assert.equal(firstStarts, 1);
  assert.equal(secondStarts, 1);
  assert.equal(first.matchId, second.matchId);
  assert.equal(first.code, second.code);

  await second.leave();
  await first.leave();
});
