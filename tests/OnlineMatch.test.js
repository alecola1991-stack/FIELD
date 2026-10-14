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
  channel: (topic, options) => { const channel = new FakeChannel(topic); channel.options = options; return channel; },
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

  const code = await host.createRoom({ name: 'Ana', number: 9, level: 17, teamId: 'laliga-barcelona' });
  await guest.joinRoom(code, { name: 'Luis' });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(hostStarts, 1);
  assert.equal(guestStarts, 1);
  assert.equal(host.matchId, guest.matchId);
  assert.equal(guest.opponent.level, 17);
  assert.equal(guest.opponent.number, 9);
  assert.equal(guest.opponent.teamId, 'laliga-barcelona');

  guest.sendInput({ x: 0.75, y: -1, kick: true });
  assert.equal(receivedInput.kick, true);
  guest.sendInput({ x: 1, y: 0, kick: false });
  assert.equal(host.getRemoteInput().kick, true, 'a following movement packet cannot erase a pending shot');
  assert.equal(host.getRemoteInput().kick, false, 'a shot is consumed once');
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


test('online ignores host and guest modifiers and rejects old match packets', async () => {
  sessionValues = new Map(); const host = new OnlineMatch(client);
  sessionValues = new Map(); const guest = new OnlineMatch(client);
  let hostInfo, guestInfo, snapshots = 0;
  host.setHandlers({ onMatchStart: info => { hostInfo = info; } });
  guest.setHandlers({ onMatchStart: info => { guestInfo = info; }, onSnapshot: () => snapshots++ });
  const code = await host.createRoom({ name: 'Ana', modifiers: { ballSize: 1.7, goalSize: 1.4, playerSpeed: 1.3, powerCooldown: 8 } });
  await guest.joinRoom(code, { name: 'Luis', modifiers: { ballSize: .5, playerSpeed: .6 } });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.deepEqual(hostInfo.modifiers, guestInfo.modifiers);
  assert.equal(guestInfo.modifiers.ballSize, 1);
  assert.equal(guestInfo.modifiers.powerCooldown, 20);
  const oldMatch = host.matchId;
  guest.requestRematch(); host.requestRematch();
  assert.notEqual(host.matchId, oldMatch);
  assert.deepEqual(hostInfo.modifiers, guestInfo.modifiers);
  host.send('snapshot', { clientId: host.clientId, matchId: oldMatch, sequence: 999, snapshot: { mode: 'online' } });
  assert.equal(snapshots, 0);
  guest.send('input', { clientId: guest.clientId, matchId: oldMatch, sequence: 999, x: -1 });
  guest.sendInput({ x: .4, y: 0, kick: false });
  assert.equal(host.getRemoteInput().x, .4);
  host.sendSnapshot({ mode: 'online' }); assert.equal(snapshots, 1);
  await guest.leave(); await host.leave();
});


test('server-assigned matches use authorized private topics, authenticated peer ids and fixed match ids', async () => {
  sessionValues = new Map(); const host = new OnlineMatch(client);
  sessionValues = new Map(); const guest = new OnlineMatch(client);
  const match = { id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', p1: '11111111-1111-4111-8111-111111111111', p2: '22222222-2222-4222-8222-222222222222' };
  const first = { userId: match.p1, username: 'first', name: 'Ana', modifiers: { ballSize: 2 } };
  const second = { userId: match.p2, username: 'second', name: 'Luis' };
  let started = 0, received = 0;
  host.setHandlers({ onMatchStart: () => started++ }); guest.setHandlers({ onMatchStart: () => started++, onSnapshot: () => received++ });
  try {
    await host.connectAssigned(match, first, second);
    host.handleSignal({ kind: 'hello', role: 'guest', version: 3, clientId: 'outsider', profile: { userId: 'uninvited' } });
    assert.equal(host.matched, false);
    await guest.connectAssigned(match, second, first); await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(started, 2); assert.equal(host.matchId, match.id); assert.equal(guest.matchId, match.id);
    assert.equal(host.channel.topic, `field-v3-match-${match.id}`); assert.equal(host.channel.options.config.private, true);
    host.send('snapshot', { clientId: host.clientId, snapshot: { mode: 'online' } }); assert.equal(received, 0);
    host.sendSnapshot({ mode: 'online' }); assert.equal(received, 1);
    guest.requestRematch(); host.requestRematch(); assert.equal(started, 2);
    assert.equal(host.profile.modifiers.ballSize, 1);
  } finally { await guest.leave(false); await host.leave(false); }
});
