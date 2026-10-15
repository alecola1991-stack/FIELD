import test from 'node:test';
import assert from 'node:assert/strict';
import { OnlineHub } from '../src/ui/OnlineHub.js';
import { assignedMatch, normalizeUsername, validUsername } from '../src/game/OnlineRules.js';
const user = 'one';
function fixture() {
  const hub = Object.create(OnlineHub.prototype);
  const statuses = { classList: { contains: () => false, add() {}, remove() {} }, textContent: '' };
  const ui = { user: { id: user }, currentView: 'online', currentMatchMode: null, profileComplete: () => true, onlinePlayer: () => ({ userId: user }),
    result_overlay: statuses, result_online_status: statuses, result_rematch: statuses, result_finish: {}, game: { stop() {} }, onlineMatch: { leave: async () => {} }, show(view) { this.currentView = view; } };
  Object.assign(hub, { ui, identity: { id: user, username: 'first', elo: 500 }, lobby: null, friends: [], invites: [], connectedMatchId: null, render() {}, message() {} });
  return hub;
}
const semifinal = { id: 'semi-one', p1: user, p2: 'two', state: 'playing', round: 1 };
const lobby = { id: 'room', kind: 'tournament', state: 'playing', players: [{ id: user }, { id: 'two' }, { id: 'three' }, { id: 'four' }], matches: [semifinal, { id: 'semi-two', p1: 'three', p2: 'four', state: 'playing' }] };

test('usernames normalize case and only accept safe names between 3 and 20 characters', () => {
  assert.equal(normalizeUsername('  First_User  '), 'first_user');
  for (const name of ['abc', 'first_user', 'user123', 'x'.repeat(20)]) assert.equal(validUsername(name), true);
  for (const name of ['ab', 'x'.repeat(21), 'two words', '<script>', 'málaga']) assert.equal(validUsername(name), false);
});

test('tournament assignment selects only the logged-in player semifinal or final', () => {
  assert.equal(assignedMatch(lobby, user).id, 'semi-one'); assert.equal(assignedMatch(lobby, 'four').id, 'semi-two');
  assert.equal(assignedMatch(lobby, 'outsider'), null);
  const next = { ...lobby, matches: [{ ...semifinal, state: 'finished' }, { id: 'final', p1: user, p2: 'four', state: 'playing' }] };
  assert.equal(assignedMatch(next, user).id, 'final'); assert.equal(assignedMatch(next, 'two'), null);
});

test('new assignments start from the lobby, not while a previous result is displayed', async () => {
  const hub = fixture(); let connections = 0; hub.connect = async match => { connections++; hub.connectedMatchId = match.id; };
  await hub.consume({ identity: hub.identity, lobby }); assert.equal(connections, 1);
  await hub.consume({ identity: hub.identity, lobby }); assert.equal(connections, 1);
  hub.ui.currentView = 'game';
  const final = { ...lobby, matches: [{ id: 'final', p1: user, p2: 'four', state: 'playing' }] };
  await hub.consume({ identity: hub.identity, lobby: final }); assert.equal(connections, 1);
  hub.ui.currentView = 'online'; await hub.consume({ identity: hub.identity, lobby: final }); assert.equal(connections, 2);
});

test('confirmation gates the result exit and shows the server ELO after settlement', () => {
  const hub = fixture(); hub.connectedMatchId = 'ranked'; hub.lobby = { kind: 'ranked', matches: [{ id: 'ranked', state: 'playing' }] };
  hub.updateResultStatus(); assert.equal(hub.ui.result_finish.disabled, true);
  hub.identity.elo = 516; hub.lobby.matches[0] = { id: 'ranked', state: 'finished', winner: user };
  hub.updateResultStatus(); assert.equal(hub.ui.result_finish.disabled, false); assert.match(hub.ui.result_online_status.textContent, /516 ELO/);
});

test('failed result reports remain queued and are retried without duplicating the result', async () => {
  const hub = fixture(); hub.lobby = lobby; hub.connectedMatchId = 'semi-one'; let attempts = 0;
  hub.rpc = async () => { if (++attempts === 1) throw new Error('offline'); return { identity: hub.identity, lobby }; };
  hub.consume = async () => {};
  await hub.record({ playerScore: 5, botScore: 2 }); assert.ok(hub.pendingResult);
  await hub.sendResult(); assert.equal(attempts, 2); assert.equal(hub.pendingResult, null);
  await hub.sendResult(); assert.equal(attempts, 2);
});


test('an old polling response cannot restore a room after cancellation or an account change', async () => {
  const hub = fixture(); let resolve, applied = 0;
  hub.rpc = () => new Promise(done => { resolve = done; }); hub.consume = async () => applied++;
  const refresh = hub.refresh(); hub.revision = 1;
  resolve({ identity: hub.identity, lobby }); await refresh;
  assert.equal(applied, 0); assert.equal(hub.lobby, null);
});

function element() {
  const classes = new Set(['hidden']);
  return { disabled: false, innerHTML: '', textContent: '', classList: { contains: name => classes.has(name), add: name => classes.add(name), remove: name => classes.delete(name), toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)) } };
}
function rematchFixture(room) {
  const hub = fixture();
  Object.assign(hub.ui, { currentView: 'game', currentMatchMode: 'online', result_rematch: element(), result_rematch_status: element() });
  hub.lobby = room; return hub;
}
const finishedRoom = (votes = [], extra = {}) => ({ id: 'old', kind: 'quick', state: 'finished', rematch: { votes, next: null },
  players: [{ id: user, username: 'first', active: true }, { id: 'two', username: 'second', active: true }], matches: [{ id: 'm1', p1: user, p2: 'two', state: 'finished' }], ...extra });

test('rematch button follows both votes, the rival leaving and unsupported rooms', () => {
  let hub = rematchFixture(finishedRoom()); hub.updateRematch();
  assert.equal(hub.ui.result_rematch.classList.contains('hidden'), false); assert.equal(hub.ui.result_rematch.disabled, false);
  assert.match(hub.ui.result_rematch.innerHTML, /Pedir revancha/);
  hub.lobby = finishedRoom(['two']); hub.updateRematch();
  assert.match(hub.ui.result_rematch.innerHTML, /Aceptar revancha/); assert.match(hub.ui.result_rematch_status.textContent, /@second quiere la revancha/);
  hub.lobby = finishedRoom([user]); hub.updateRematch();
  assert.equal(hub.ui.result_rematch.disabled, true); assert.match(hub.ui.result_rematch.innerHTML, /Esperando/);
  hub.lobby = finishedRoom([], { players: [{ id: user, username: 'first', active: true }, { id: 'two', username: 'second', active: false }] }); hub.updateRematch();
  assert.equal(hub.ui.result_rematch.disabled, true); assert.match(hub.ui.result_rematch_status.textContent, /ha salido/);
  hub.lobby = finishedRoom([], { state: 'playing' }); hub.updateRematch(); assert.equal(hub.ui.result_rematch.disabled, true);
  hub.lobby = finishedRoom([], { kind: 'tournament' }); hub.updateRematch(); assert.equal(hub.ui.result_rematch.classList.contains('hidden'), true);
  const { rematch, ...legacy } = finishedRoom(); hub.lobby = legacy; hub.updateRematch();
  assert.equal(hub.ui.result_rematch.classList.contains('hidden'), true, 'hidden until the database supports rematches');
});

test('accepting a rematch connects to the new room straight from the result screen', async () => {
  const hub = rematchFixture(finishedRoom(['two']));
  let connected = null; hub.connect = async match => { connected = match.id; hub.connectedMatchId = match.id; hub.rematchRequested = false; };
  const next = { id: 'new', kind: 'quick', state: 'playing', rematch: { votes: [], next: null }, players: finishedRoom().players, matches: [{ id: 'm2', p1: user, p2: 'two', state: 'playing' }] };
  hub.rpc = async (command, payload) => { assert.equal(command, 'rematch'); assert.equal(payload.lobbyId, 'old'); return { identity: hub.identity, lobby: next }; };
  await hub.requestRematch();
  assert.equal(connected, 'm2'); assert.equal(hub.lobby.id, 'new');
  // Without a rematch request, a new assignment still waits for the online screen.
  const idle = rematchFixture(finishedRoom()); let idleConnected = false; idle.connect = async () => { idleConnected = true; };
  await idle.consume({ identity: idle.identity, lobby: next }); assert.equal(idleConnected, false);
});
