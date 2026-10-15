import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/Game.js';
import { Player } from '../src/game/Player.js';
import { Ball } from '../src/game/Ball.js';
import { GameState } from '../src/game/GameState.js';

const DT = 1 / 60;

// Minimal game without DOM; `keys` queues Space presses for the next consume().
function peer(mode, authority = true, settings = {}) {
  const game = Object.create(Game.prototype);
  const keys = new Set();
  Object.assign(game, {
    state: new GameState(), onlineAuthority: authority, localSide: authority ? 'left' : 'right',
    player: new Player({ x: authority ? 300 : 650, y: 350 }),
    bot: new Player({ x: authority ? 650 : 300, y: 350, isBot: mode !== 'online' }), ball: new Ball(570, 350),
    input: { axes: () => ({ x: 0, y: 0 }), consume: code => keys.delete(code), enabled: true, endFrame() {} },
    sound: { play() {}, bump() {} }, renderer: { burst() {}, fireBurst() {}, render() {} }, hooks: {}, settings,
    botAI: { update: () => ({ x: 0, y: 0, speedMultiplier: 1, kick: false }) },
    matchStats: { shotsPlayer: 0, shotsOpponent: 0, goals: [] }, goalTarget: 5,
    shotRangeTimer: 0, powerHudClock: 0, onlineSnapshotClock: 0, autosaveClock: 0,
    remoteInput: { x: 0, y: 0, kick: false }, countdown: 0, countdownClock: 0,
  });
  game.state.start(mode); game.resetReplay();
  game.press = () => keys.add('Space');
  return game;
}
// One animation frame as the real loop does it: simulate, then record.
const frame = game => { game.update(DT); game.captureReplayFrame(DT); };
function playUntilReplay(game) {
  for (let i = 0; i < 120; i++) frame(game);          // 2 s of live play to record
  game.recordGoal(1);
  for (let i = 0; i < 200 && !game.replay && game.countdown === 0; i++) frame(game); // goal celebration
}

test('offline goal shows a replay of up to 3 seconds that a single press skips', () => {
  const game = peer('bot');
  const events = [];
  game.hooks.onReplay = info => events.push(info);
  playUntilReplay(game);
  assert.ok(game.replay, 'replay starts after the goal celebration');
  assert.ok(game.replay.duration > 1.5 && game.replay.duration <= 3);
  assert.ok(game.replayView().ball, 'renders recorded frames');
  assert.equal(game.countdown, 0);
  // A snapshot taken mid-replay keeps the goal phase open, so a restored save finishes the reset.
  assert.ok(game.captureSnapshot().goalTimer > 0);
  game.press(); frame(game);
  assert.equal(game.replay, null);
  assert.equal(game.countdown, 5, 'kick-off countdown follows the skipped replay');
  assert.equal(events.at(-1), null);
});

test('an unskipped replay ends on its own and disabled replays go straight to kick-off', () => {
  const game = peer('league');
  playUntilReplay(game);
  for (let i = 0; i < 3 * 60 + 5 && game.replay; i++) frame(game);
  assert.equal(game.replay, null); assert.equal(game.countdown, 5);

  const off = peer('league', true, { goalReplays: false });
  playUntilReplay(off);
  assert.equal(off.replay, null); assert.equal(off.countdown, 5);
});

test('training goals never trigger replays', () => {
  const game = peer('training');
  playUntilReplay(game);
  assert.equal(game.replay, null);
});

test('online replay continues until both players skip; the guest skip is retried until acknowledged', () => {
  const host = peer('online', true), guest = peer('online', false);
  let sentSkips = 0, dropFirst = true;
  guest.hooks.onReplaySkip = () => { sentSkips++; if (dropFirst) { dropFirst = false; return; } host.setRemoteReplaySkip(); };
  const tick = () => {
    host.update(DT); host.captureReplayFrame(DT);
    assert.equal(guest.applyOnlineSnapshot(host.captureSnapshot(true)), true);
    guest.predictOnlineGuest(DT); guest.captureReplayFrame(DT);
  };
  for (let i = 0; i < 120; i++) tick();
  host.recordGoal(1);
  for (let i = 0; i < 200 && !host.replay; i++) tick();
  tick();
  assert.ok(host.replay && guest.replay, 'both peers enter the replay');
  assert.ok(guest.replayView(), 'guest replays its own recorded frames');

  host.press(); tick(); tick();
  assert.ok(host.replay, 'host skip alone does not end the online replay');
  assert.equal(guest.replay.remoteSkip, true, 'guest sees that the rival skipped');

  guest.press();
  for (let i = 0; i < 40 && host.replay; i++) tick();
  assert.equal(host.replay, null, 'both skips end the replay');
  assert.ok(sentSkips >= 2, 'lost skip packet was resent');
  tick();
  assert.equal(guest.replay, null);
  assert.ok(host.countdown > 0 && guest.countdown > 0, 'both peers return to the kick-off countdown');
});

test('a guest with replays disabled skips automatically so the host is not held', () => {
  const host = peer('online', true), guest = peer('online', false, { goalReplays: false });
  guest.hooks.onReplaySkip = () => host.setRemoteReplaySkip();
  const tick = () => { host.update(DT); host.captureReplayFrame(DT); guest.applyOnlineSnapshot(host.captureSnapshot(true)); guest.predictOnlineGuest(DT); guest.captureReplayFrame(DT); };
  for (let i = 0; i < 120; i++) tick();
  host.recordGoal(1);
  for (let i = 0; i < 200 && !host.replay; i++) tick();
  tick();
  assert.equal(host.replay.remoteSkip, true);
  assert.equal(guest.replayView(), null);
  host.press(); tick();
  assert.equal(host.replay, null);
});

test('the winning goal plays its replay before the match ends on both peers', () => {
  const host = peer('online', true), guest = peer('online', false);
  let hostEnded = 0, guestEnded = 0;
  host.hooks.onMatchEnd = () => hostEnded++; guest.hooks.onMatchEnd = () => guestEnded++;
  host.hooks.onOnlineSnapshot = snapshot => guest.applyOnlineSnapshot(snapshot);
  const tick = () => { host.update(DT); host.captureReplayFrame(DT); guest.applyOnlineSnapshot(host.captureSnapshot(true)); guest.predictOnlineGuest(DT); guest.captureReplayFrame(DT); };
  for (let i = 0; i < 120; i++) tick();
  host.state.scorePlayer = 4; host.recordGoal(1);
  for (let i = 0; i < 200 && !host.replay; i++) tick();
  tick();
  assert.ok(host.replay && guest.replay); assert.equal(hostEnded + guestEnded, 0, 'no result screen during the replay');
  for (let i = 0; i < 3 * 60 + 5 && host.replay; i++) tick();
  assert.equal(hostEnded, 1); assert.equal(guestEnded, 1);
});
