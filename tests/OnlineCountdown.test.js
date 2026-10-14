import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/Game.js';
import { Player } from '../src/game/Player.js';
import { Ball } from '../src/game/Ball.js';
import { GameState } from '../src/game/GameState.js';

function peer(authority) {
  const game = Object.create(Game.prototype);
  Object.assign(game, {
    state: new GameState(), onlineAuthority: authority, localSide: authority ? 'left' : 'right',
    player: new Player({ x: authority ? 300 : 650, y: 350 }),
    bot: new Player({ x: authority ? 650 : 300, y: 350 }), ball: new Ball(475, 350),
    input: { axes: () => ({ x: 1, y: 0 }), consume: () => false, enabled: true, endFrame() {} },
    sound: { play() {}, bump() {} }, renderer: { burst() {}, render() {} }, hooks: {}, settings: {}, botAI: {},
    matchStats: { shotsPlayer: 0, shotsOpponent: 0, goals: [] }, goalTarget: 5,
    shotRangeTimer: 0, powerHudClock: 0, onlineSnapshotClock: 0, autosaveClock: 0,
    remoteInput: { x: -1, y: 0, kick: false }, last: 1000,
  });
  game.state.start('online'); game.beginCountdown();
  return game;
}

test('host and guest leave countdown at irregular frame rates and keep moving after a goal', () => {
  for (const dt of [1 / 60, .017, .033]) {
    const host = peer(true), guest = peer(false);
    let cleared = false;
    guest.hooks.onCountdown = value => { if (value === null) cleared = true; };
    for (let frame = 0; frame < Math.ceil(5 / dt) + 3; frame++) {
      host.update(dt);
      assert.equal(guest.applyOnlineSnapshot(host.captureSnapshot(true)), true);
    }
    assert.equal(host.countdown, 0); assert.equal(host.countdownClock, 0);
    assert.equal(guest.countdown, 0); assert.ok(cleared);
    const before = guest.player.x;
    for (let frame = 0; frame < 30; frame++) guest.predictOnlineGuest(dt);
    assert.ok(guest.player.x > before);
    host.recordGoal(1);
    for (let frame = 0; frame < Math.ceil(7 / dt); frame++) {
      host.update(dt);
      assert.equal(guest.applyOnlineSnapshot(host.captureSnapshot(true)), true);
    }
    assert.equal(host.state.goalTimer, 0); assert.equal(guest.countdown, 0);
    assert.equal(guest.state.scoreBot, 1);
  }
});

test('bounded expired timers from old hosts recover, malformed snapshots remain rejected', () => {
  const host = peer(true), guest = peer(false);
  const snapshot = { ...host.captureSnapshot(true), countdown: 0, countdownClock: -.016, goalTimer: -.01 };
  assert.equal(guest.applyOnlineSnapshot(snapshot), true);
  assert.equal(guest.countdownClock, 0); assert.equal(guest.state.goalTimer, 0);
  for (const key of ['goalTimer', 'countdownClock']) for (const value of [-1, Infinity, NaN]) {
    assert.equal(guest.applyOnlineSnapshot({ ...snapshot, [key]: value }), false);
  }
  assert.equal(guest.applyOnlineSnapshot({ ...snapshot, scorePlayer: -1 }), false);
});

test('winning goal delivers the final snapshot before host pauses network ticks', () => {
  const originalRAF = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 1;
  try {
    const host = peer(true), guest = peer(false);
    host.countdown = 0; host.countdownClock = 0;
    host.state.scorePlayer = 4; host.recordGoal(1); host.state.goalTimer = .001;
    let guestResults = 0, hostResults = 0, final;
    guest.hooks.onMatchEnd = result => { guestResults++; assert.equal(result.winner, 'opponent'); };
    host.hooks.onOnlineSnapshot = snapshot => { final = snapshot; assert.equal(guest.applyOnlineSnapshot(snapshot), true); };
    host.hooks.onMatchEnd = () => { hostResults++; assert.equal(guestResults, 1); };
    host.loop(1016);
    assert.equal(hostResults, 1); assert.equal(guestResults, 1);
    assert.equal(host.state.paused, true); assert.equal(guest.state.paused, true);
    assert.equal(final.goalTimer, 0);
    guest.applyOnlineSnapshot(final); assert.equal(guestResults, 1);
  } finally { globalThis.requestAnimationFrame = originalRAF; }
});
