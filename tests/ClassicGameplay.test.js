import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD } from '../src/config/settings.js';
import { Ball, BALL_RADIUS } from '../src/game/Ball.js';
import { Player } from '../src/game/Player.js';
import { resolvePlayerBall, dribbleAssist, kickBall } from '../src/game/Physics.js';
import { Game } from '../src/game/Game.js';
import { GameState } from '../src/game/GameState.js';
import { BotAI } from '../src/game/BotAI.js';

// Runs with the ball: straight for 1 s, then turns 90° for 1 s. Returns the largest gap ball–player.
function run(classic, turn = true) {
  const player = new Player({ x: 300, y: 350 }), ball = new Ball(300 + player.radius + BALL_RADIUS + 1, 350);
  player.world = ball.world = WORLD; let maxGap = 0;
  for (let i = 0; i < 120; i++) {
    const dir = turn && i >= 60 ? { x: 0, y: 1 } : { x: 1, y: 0 };
    player.move(dir.x, dir.y, 1 / 60); ball.update(1 / 60);
    resolvePlayerBall(player, ball, () => {}, classic);
    if (classic) dribbleAssist(player, ball, 1 / 60);
    maxGap = Math.max(maxGap, Math.hypot(ball.x - player.x, ball.y - player.y) - player.radius - ball.radius);
  }
  return maxGap;
}

test('classic gameplay keeps the ball close while running and turning', () => {
  const arcade = run(false), classic = run(true);
  assert.ok(classic < 20, `classic gap ${classic.toFixed(1)}`);
  assert.ok(classic < arcade, `classic ${classic.toFixed(1)} < arcade ${arcade.toFixed(1)}`);
});

test('shots are not caught by the dribble', () => {
  const player = new Player({ x: 300, y: 350 }), ball = new Ball(300 + player.radius + BALL_RADIUS + 2, 350);
  player.vx = 200; ball.world = WORLD;
  assert.ok(kickBall(player, ball));
  const speed = Math.hypot(ball.vx, ball.vy);
  assert.equal(dribbleAssist(player, ball, 1 / 60), false);
  assert.equal(Math.hypot(ball.vx, ball.vy), speed);
});

test('classic ball is 5 % smaller and online is always arcade', () => {
  const game = Object.create(Game.prototype);
  Object.assign(game, { settings: { name: 'P', number: 10, teamId: 'laliga-barcelona', difficulty: 'easy', modifiers: {}, gameplay: 'classic' },
    state: new GameState(), botAI: new BotAI('easy'), ball: new Ball(0, 0), raf: 1,
    input: { down: new Set(), pressed: new Set(), axes: () => ({ x: 0, y: 0 }), consume: () => false },
    sound: { play() {}, bump() {} }, renderer: { burst() {}, fireBurst() {} }, hooks: {} });
  game.start('bot', 'easy', {}); assert.equal(game.gameplay, 'classic'); assert.ok(Math.abs(game.ball.radius - BALL_RADIUS * .95) < 1e-9);
  game.start('online', 'easy', {}); assert.equal(game.gameplay, 'arcade'); assert.equal(game.ball.radius, BALL_RADIUS);
  game.settings.gameplay = 'arcade'; game.start('league', 'easy', {}); assert.equal(game.gameplay, 'arcade');
});
