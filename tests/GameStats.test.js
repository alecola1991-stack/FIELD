import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/Game.js';
import { Renderer } from '../src/game/Renderer.js';
import { WORLD } from '../src/config/settings.js';

test('competition match summary tracks shots and records scorer and goal minute', () => {
  const game = Object.create(Game.prototype);
  game.state = { mode: 'tournament', elapsed: 73, scorePlayer: 0, scoreBot: 0, goalTimer: 0, matchOver: false };
  game.goalTarget = 3;
  game.ball = { vx: 100, vy: -40 };
  game.matchStats = { shotsPlayer: 2, shotsOpponent: 4, goals: [] };
  game.sound = { play() {} };
  game.renderer = { burst() {} };
  game.hooks = { onScore() {}, onGoal() {} };
  game.recordGoal(1);
  assert.equal(game.state.scorePlayer, 1);
  assert.equal(game.state.goalSide, 1);
  assert.deepEqual(game.matchSummary(), {
    shotsPlayer: 2,
    shotsOpponent: 4,
    goals: [{ side: 'player', elapsedSeconds: 73, minute: 2 }],
  });
});

test('goal celebration draws its wave at the goal that was scored', () => {
  for (const [side, expectedX] of [[-1, WORLD.left + 24], [1, WORLD.right - 24]]) {
    const arcXs = [];
    const context = { save() {}, restore() {}, beginPath() {}, stroke() {}, arc(x) { arcXs.push(x); } };
    Renderer.prototype.drawGoalEffect.call({}, context, 1, 'shockwave', side);
    assert.deepEqual(arcXs, [expectedX]);
  }
});
