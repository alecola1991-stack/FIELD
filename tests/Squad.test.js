import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/Game.js';
import { Player } from '../src/game/Player.js';
import { Ball } from '../src/game/Ball.js';
import { GameState } from '../src/game/GameState.js';

const DT = 1 / 60;
const SEATS = [
  { name: 'HOST', number: 1, teamId: 'laliga-athletic' }, { name: 'MATE', number: 2, teamId: 'laliga-celta' },
  { name: 'RIVA', number: 3, teamId: 'laliga-celta' }, { name: 'RIVB', number: 4, teamId: 'laliga-osasuna' },
];

// 2v2 peer without DOM: seat 0 hosts. `press()` queues a Space for the next consume.
function peer(seat, settings = {}) {
  const game = Object.create(Game.prototype);
  const keys = new Set();
  let axes = { x: 0, y: 0 };
  Object.assign(game, {
    state: new GameState(), player: new Player({ x: 0, y: 0 }), bot: new Player({ x: 0, y: 0 }), ball: new Ball(570, 350),
    input: { axes: () => axes, consume: code => keys.delete(code), enabled: true, endFrame() {} },
    sound: { play() {}, bump() {} }, renderer: { burst() {}, fireBurst() {}, render() {} }, hooks: {}, settings,
    botAI: { update: () => ({ x: 0, y: 0, speedMultiplier: 1, kick: false }) },
    matchStats: { shotsPlayer: 0, shotsOpponent: 0, goals: [] }, goalTarget: 5,
    shotRangeTimer: 0, powerHudClock: 0, onlineSnapshotClock: 0, autosaveClock: 0,
    remoteInput: { x: 0, y: 0, kick: false }, countdown: 0, countdownClock: 0,
  });
  game.state.start('online');
  game.localSide = seat < 2 ? 'left' : 'right'; game.onlineAuthority = seat === 0;
  game.setupSquad({ seats: SEATS, localSeat: seat }); game.resetReplay();
  game.press = () => keys.add('Space');
  game.steer = (x, y) => { axes = { x, y }; };
  return game;
}

// Host + three guests wired like the network: guests send inputs and skips, the host broadcasts snapshots.
function room(settings = {}) {
  const peers = [0, 1, 2, 3].map(seat => peer(seat, settings));
  const [host, ...guests] = peers;
  const inputs = { 1: { x: 0, y: 0, kick: false }, 2: { x: 0, y: 0, kick: false }, 3: { x: 0, y: 0, kick: false } };
  host.hooks.getSeatInput = seat => { const input = inputs[seat]; inputs[seat] = { ...input, kick: false }; return input; };
  guests.forEach((guest, index) => { guest.hooks.onReplaySkip = () => host.setRemoteReplaySkip(index + 1); });
  const tick = () => {
    host.update(DT); host.captureReplayFrame(DT);
    const snapshot = host.captureSnapshot(true);
    for (const guest of guests) {
      assert.equal(guest.applyOnlineSnapshot(snapshot), true);
      guest.predictOnlineGuest(DT); guest.captureReplayFrame(DT);
      const axes = guest.input.axes(); inputs[guest.squad.localSeat] = { x: axes.x, y: axes.y, kick: false };
    }
  };
  return { peers, host, guests, tick };
}

test('2v2 seats: host order, teams, kits and the local view of each peer', () => {
  const { peers } = room();
  for (const [seat, game] of peers.entries()) {
    assert.equal(game.squad.bodies.length, 4);
    assert.equal(game.player, game.squad.bodies[seat], 'player is the local seat');
    assert.equal(game.others.length, 2);
    assert.ok(![game.bot, ...game.others].includes(game.player));
    assert.equal(game.localSide, seat < 2 ? 'left' : 'right');
  }
  const [host] = peers;
  assert.equal(host.squad.bodies[0].color, '#E32636', 'left team wears the left captain kit');
  assert.equal(host.squad.bodies[1].color, '#E32636', 'teammates share the captain kit');
  assert.equal(host.squad.bodies[3].color, '#8CC7E8', 'right team wears the right captain kit');
  assert.ok(host.squad.bodies[0].x < host.squad.bodies[2].x, 'left team starts on the left');
});

test('guest inputs move their seat on the host and every peer sees the same positions', () => {
  const { host, guests, tick } = room();
  guests[2].steer(-1, 0); // seat 3 runs towards the left goal
  const before = host.squad.bodies[3].x;
  for (let i = 0; i < 40; i++) tick();
  assert.ok(host.squad.bodies[3].x < before - 50, 'seat 3 moved on the host');
  for (const guest of guests) {
    for (let seat = 0; seat < 4; seat++) {
      const local = guest.squad.bodies[seat], remote = host.squad.bodies[seat];
      assert.ok(Math.hypot(local.x - remote.x, local.y - remote.y) < 25, `seat ${seat} in sync on guest ${guest.squad.localSeat}`);
    }
  }
});

test('bodies never overlap after a collision step', () => {
  const host = peer(0);
  const [a, b, c] = host.squad.bodies;
  b.x = a.x + 3; b.y = a.y; c.x = a.x; c.y = a.y + 2;
  for (let frame = 0; frame < 2; frame++) host.update(DT);
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const p = host.squad.bodies[i], q = host.squad.bodies[j];
    assert.ok(Math.hypot(p.x - q.x, p.y - q.y) >= p.radius + q.radius - 1);
  }
});

test('a goal counts for the right team on every peer and the replay waits for all four skips', () => {
  const { host, guests, tick } = room();
  for (let i = 0; i < 120; i++) tick();
  host.recordGoal(1); // ball in the right goal: the left team scores
  for (let i = 0; i < 200 && !host.replay; i++) tick();
  tick();
  assert.equal(host.state.scorePlayer, 1); assert.equal(host.state.scoreBot, 0);
  assert.equal(guests[0].state.scorePlayer, 1, 'left teammate sees its own goal');
  assert.equal(guests[1].state.scoreBot, 1, 'right side sees the goal against');
  assert.equal(guests[2].state.scoreBot, 1);
  assert.equal(guests[1].matchStats.goals.at(-1).side, 'opponent');
  assert.equal(guests[0].matchStats.goals.at(-1).side, 'player');
  assert.ok(host.replay && guests.every(guest => guest.replay), 'everyone enters the replay');
  assert.equal(host.replayView().others.length, 2, 'the replay shows all four players');

  host.press(); guests[0].press(); guests[1].press();
  for (let i = 0; i < 5; i++) tick();
  assert.ok(host.replay, 'three skips are not enough');
  assert.equal(host.replaySkipCount(), 3);
  guests[2].press();
  for (let i = 0; i < 10 && host.replay; i++) tick();
  assert.equal(host.replay, null, 'the fourth skip ends the replay');
  tick();
  assert.ok(guests.every(guest => !guest.replay && guest.countdown > 0), 'everyone is back at kick-off');
  assert.ok(host.squad.bodies[3].x > host.squad.bodies[1].x, 'positions reset by seat');
});

test('the match ends on all four peers with each side seeing its own result', () => {
  const { host, guests, tick } = room({ goalReplays: false });
  const ends = new Map();
  for (const game of [host, ...guests]) game.hooks.onMatchEnd = result => ends.set(game.squad.localSeat, result);
  for (let i = 0; i < 30; i++) tick();
  host.state.scorePlayer = 4; host.state.scoreBot = 4;
  host.recordGoal(-1); // ball in the left goal: the right team wins 5-4
  for (let i = 0; i < 200 && ends.size < 4; i++) tick();
  assert.equal(ends.size, 4);
  assert.equal(ends.get(0).winner, 'opponent'); assert.equal(ends.get(1).winner, 'opponent');
  assert.equal(ends.get(2).winner, 'player'); assert.equal(ends.get(3).winner, 'player');
  assert.equal(ends.get(2).playerScore, 5); assert.equal(ends.get(1).playerScore, 4);
});
