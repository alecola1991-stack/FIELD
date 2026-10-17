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

test('2v2: el anfitrión arranca con los tres invitados, recibe entradas por asiento y rechaza suplantaciones', async () => {
  const ids = ['u-host', 'u-mate', 'u-riva', 'u-rivb'];
  const seats = ids.map((userId, index) => ({ userId, username: `p${index}`, name: `P${index}`, number: index + 1, teamId: 'laliga-celta' }));
  const match = { id: '0b5c1d2e-1111-4222-8333-944455556666', p1: ids[0], p2: ids[2], p3: ids[1], p4: ids[3] };
  const peers = [], starts = [], skips = [], left = [];
  for (let seat = 0; seat < 4; seat++) {
    sessionValues = new Map();
    const peer = new OnlineMatch(client);
    peer.setHandlers({ onMatchStart: info => starts.push([seat, info]), onReplaySkip: index => skips.push(index), onPeerLeft: () => left.push(seat) });
    peers.push(peer);
  }
  // Guests connect first; the host starts only when all three have said hello.
  for (let seat = 1; seat < 4; seat++) await peers[seat].connectAssigned(match, seats[seat], seats[seat < 2 ? 2 : 0], { seats, localSeat: seat });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(starts.length, 0);
  await peers[0].connectAssigned(match, seats[0], seats[2], { seats, localSeat: 0 });
  await new Promise(resolve => setTimeout(resolve, 700));
  assert.deepEqual(starts.map(([seat]) => seat).sort(), [0, 1, 2, 3], 'all four peers start');
  const info = new Map(starts);
  assert.equal(info.get(0).role, 'host'); assert.equal(info.get(1).localSide, 'left'); assert.equal(info.get(3).localSide, 'right');
  assert.equal(info.get(1).squad.localSeat, 1);

  peers[3].sendInput({ x: 1, y: -1, kick: true });
  assert.deepEqual(peers[0].getSeatInput(3), { x: 1, y: -1, kick: true, curve: false });
  assert.equal(peers[0].getSeatInput(3).kick, false, 'a kick is consumed once');
  assert.deepEqual(peers[0].getSeatInput(2), { x: 0, y: 0, kick: false });
  // Seat 2 claiming to be seat 1 is ignored.
  peers[2].send('input', { clientId: peers[2].clientId, matchId: match.id, sequence: 99, x: -1, y: 0, kick: false, seat: 1 });
  assert.deepEqual(peers[0].getSeatInput(1), { x: 0, y: 0, kick: false });

  let snapshots = 0; peers[1].handlers.onSnapshot = () => snapshots++;
  peers[0].sendSnapshot({ mode: 'online' });
  assert.equal(snapshots, 1, 'guests receive the host snapshot');
  peers[2].sendReplaySkip();
  assert.deepEqual(skips, [2]);

  await peers[3].leave();
  assert.deepEqual(left.sort(), [0, 1, 2], 'a player leaving ends the match for everyone');
  for (const peer of peers) await peer.leave(false);
});

test('game packets wait for the socket instead of falling back to REST broadcasts', () => {
  const sent = [];
  const match = new OnlineMatch(client);
  match.channel = { state: 'joining', send: message => { sent.push(message); return Promise.resolve('ok'); } };
  match.send('snapshot', { a: 1 });
  assert.equal(sent.length, 0, 'nothing is sent while the channel is not joined');
  match.channel.state = 'joined'; match.send('snapshot', { a: 1 });
  assert.equal(sent.length, 1);
});

test('a reloaded host resumes the assigned match with the score the guest sends, and accepts new packet counters', async () => {
  const host = { userId: 'u-host', username: 'h', name: 'H', number: 1, teamId: 'laliga-celta' };
  const guest = { userId: 'u-guest', username: 'g', name: 'G', number: 2, teamId: 'laliga-celta' };
  const match = { id: '1f2e3d4c-1111-4222-8333-944455556666', p1: host.userId, p2: guest.userId };
  sessionValues = new Map(); const guestPeer = new OnlineMatch(client);
  sessionValues = new Map(); let hostPeer = new OnlineMatch(client);
  const starts = [];
  guestPeer.setHandlers({ onMatchStart: info => starts.push(['guest', info]), getResume: () => ({ matchId: match.id, left: 3, right: 1, elapsed: 75, goals: [] }) });
  hostPeer.setHandlers({ onMatchStart: info => starts.push(['host', info]) });
  await guestPeer.connectAssigned(match, guest, host);
  await hostPeer.connectAssigned(match, host, guest);
  await new Promise(resolve => setTimeout(resolve, 650));
  assert.equal(starts.length, 2);
  assert.equal(starts.find(([who]) => who === 'host')[1].resume, null, 'a first start has nothing to resume');
  for (let i = 0; i < 5; i++) guestPeer.sendInput({ x: 1, y: 0 });
  // The host reloads: a new instance with fresh counters.
  await hostPeer.leave(false);
  sessionValues = new Map(); hostPeer = new OnlineMatch(client);
  let inputs = 0, snapshots = 0;
  hostPeer.setHandlers({ onMatchStart: info => starts.push(['host-again', info]), onInput: () => inputs++ });
  guestPeer.handlers.onSnapshot = () => snapshots++;
  await hostPeer.connectAssigned(match, host, guest);
  await new Promise(resolve => setTimeout(resolve, 650));
  const again = starts.find(([who]) => who === 'host-again');
  assert.ok(again, 'the reloaded host starts again');
  assert.deepEqual(again[1].resume, { matchId: match.id, left: 3, right: 1, elapsed: 75, goals: [] });
  guestPeer.sendInput({ x: -1, y: 0 });
  assert.equal(inputs, 1, 'guest inputs are accepted by the new host despite the old sequence');
  hostPeer.sendSnapshot({ mode: 'online' });
  assert.equal(snapshots, 1, 'snapshots of the new host are accepted by the guest');
  await hostPeer.leave(false); await guestPeer.leave(false);
});
