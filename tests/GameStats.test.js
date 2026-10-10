import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/Game.js';

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
  assert.deepEqual(game.matchSummary(), {
    shotsPlayer: 2,
    shotsOpponent: 4,
    goals: [{ side: 'player', elapsedSeconds: 73, minute: 2 }],
  });
});
