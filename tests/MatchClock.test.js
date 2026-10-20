import test from 'node:test';
import assert from 'node:assert/strict';
import { Ball } from '../src/game/Ball.js';
import { Game } from '../src/game/Game.js';
import { GameState } from '../src/game/GameState.js';
import { BotAI } from '../src/game/BotAI.js';

function fixture(mode = 'bot', options = {}, gameplay = 'arcade') {
  const game = Object.create(Game.prototype);
  Object.assign(game, { settings: { name: 'P', number: 10, teamId: 'laliga-barcelona', difficulty: 'hard', modifiers: {}, gameplay, goalReplays: false },
    state: new GameState(), botAI: new BotAI('hard'), ball: new Ball(0, 0), raf: 1,
    input: { enabled: true, down: new Set(), pressed: new Set(), axes: () => ({ x: 0, y: 0 }), consume: () => false, consumeKick: () => ({ kick: false }), curveHeld: () => false, endFrame() {}, setScheme() {} },
    sound: { play() {}, bump() {}, updateAmbience() {} }, renderer: { burst() {}, fireBurst() {} }, hooks: {} });
  game.start(mode, 'hard', { opponentTeam: { id: 'x', stars: 4 }, opponentName: 'RIVAL', ...options });
  game.countdown = 0;
  return game;
}

test('match length: 2 min 1v1, 3 min 2v2 and 3v3, 4 min 7v7, no clock in training', () => {
  assert.equal(fixture().matchDuration, 120);
  assert.equal(fixture('bot', { duo: true }).matchDuration, 180);
  assert.equal(fixture('bot', { trio: true }, 'tactical').matchDuration, 180);
  assert.equal(fixture('bot', { seven: true }, 'tactical').matchDuration, 240);
  assert.equal(fixture('training').matchDuration, null);
  assert.equal(fixture('online').matchDuration, 120);
  assert.equal(fixture('online', { matchDuration: null }).matchDuration, null);
  const game = fixture();
  assert.equal(game.clockText(), '02:00');
  game.state.elapsed = 75.2; assert.equal(game.clockText(), '00:45');
});

test('full time: the side ahead wins', () => {
  const game = fixture(); let ended = null;
  game.hooks.onMatchEnd = result => { ended = result; };
  game.state.scorePlayer = 2; game.state.scoreBot = 1; game.state.elapsed = 119.99;
  game.update(1 / 30);
  assert.equal(game.state.matchOver, true);
  assert.equal(ended.winner, 'player'); assert.equal(ended.playerScore, 2);
});

test('a draw at full time goes to extra time; the next goal wins', () => {
  const game = fixture(); let overtime = 0, ended = null;
  game.hooks.onOvertime = () => overtime++; game.hooks.onMatchEnd = result => { ended = result; };
  game.state.scorePlayer = 1; game.state.scoreBot = 1; game.state.elapsed = 119.99;
  game.update(1 / 30); game.update(1 / 30);
  assert.equal(game.overtime, true); assert.equal(overtime, 1); assert.equal(game.state.matchOver, false);
  assert.equal(game.clockInfo().overtime, true); assert.match(game.clockText(), /^\+0:0\d$/);
  game.state.elapsed = 200; game.update(1 / 30);
  assert.equal(game.state.matchOver, false, 'extra time has no limit');
});

test('golden goal ends the match in extra time', () => {
  const game = fixture(); let ended = null;
  game.hooks.onMatchEnd = result => { ended = result; };
  game.state.scorePlayer = 0; game.state.scoreBot = 0; game.state.elapsed = 121;
  game.update(1 / 30); assert.equal(game.overtime, true);
  game.recordGoal(-1); assert.equal(game.state.scoreBot, 1);
  assert.equal(game.state.matchOver, true);
});

test('time running out during the goal celebration settles the match', () => {
  const game = fixture();
  game.state.scorePlayer = 1; game.state.scoreBot = 0; game.state.elapsed = 125;
  game.finishGoalSequence();
  assert.equal(game.state.matchOver, true);
  const draw = fixture(); draw.state.elapsed = 125; draw.finishGoalSequence();
  assert.equal(draw.state.matchOver, false); assert.equal(draw.overtime, true);
});

test('online snapshots carry the clock to the guest', () => {
  const host = fixture('online', { localSide: 'left' });
  host.state.elapsed = 130; host.overtime = true;
  const snap = host.captureSnapshot(true);
  assert.equal(snap.duration, 120); assert.equal(snap.overtime, true);
  const guest = fixture('online', { localSide: 'right', matchDuration: null }); let banner = 0;
  guest.hooks.onOvertime = () => banner++;
  guest.restoreSnapshot(snap);
  assert.equal(guest.matchDuration, 120); assert.equal(guest.overtime, true); assert.equal(banner, 1);
});
