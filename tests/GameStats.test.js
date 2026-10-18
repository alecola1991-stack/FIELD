import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/Game.js';
import { Renderer } from '../src/game/Renderer.js';
import { Ball } from '../src/game/Ball.js';
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

test('player name and larger dorsal are drawn inside the circle in the team color', () => {
  const texts = []; let clipped = false;
  const context = new Proxy({
    createRadialGradient() { return { addColorStop() {} }; },
    clip() { clipped = true; },
    fillText(text, x, y, width) { texts.push({ text, x, y, width, font: this.font, color: this.fillStyle, clipped }); },
  }, { get(target, key) { return key in target ? target[key] : () => {}; } });
  const player = { x: 100, y: 100, radius: 22, name: 'Lamine', number: 10, numberColor: '#f6d65c' };
  const renderer = Object.create(Renderer.prototype);
  renderer.drawPlayer(context, player, '#a50044');
  assert.deepEqual(texts.map(item => item.text), ['LAMINE', '10']);
  assert.ok(texts.every(item => item.clipped && item.x === 0 && Math.abs(item.y) < player.radius && item.width < player.radius * 2 && item.color === player.numberColor));
  assert.match(texts[1].font, /25px/);
});

test('shots reach the entire ball circle at the visible zone edge in every direction', async () => {
  const { canKickBall, kickBall, shotRangeRadius } = await import('../src/game/Physics.js');
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4]) {
    const player = { x: 200, y: 200, vx: 0, vy: 0, radius: 22, faceX: 1, faceY: 0, shotCooldown: 0 };
    const distance = shotRangeRadius(player) + 12;
    const ball = { x: 200 + Math.cos(angle) * distance, y: 200 + Math.sin(angle) * distance, radius: 12, vx: 0, vy: 0 };
    assert.equal(canKickBall(player, ball), true);
    assert.equal(kickBall(player, ball), true);
    assert.ok(Math.hypot(ball.vx, ball.vy) > 0);
    player.shotCooldown = 0;
    ball.x += Math.cos(angle) * .01; ball.y += Math.sin(angle) * .01;
    assert.equal(canKickBall(player, ball), false);
    assert.equal(kickBall(player, ball), false);
  }
});

test('shot preview matches real normal and fire shots with momentum without changing state', async () => {
  const { predictShot, kickBall } = await import('../src/game/Physics.js');
  for (const power of [1, 1.45]) for (const velocity of [0, 300]) {
    const player = { x: 200, y: 200, vx: velocity, vy: -40, radius: 22, faceX: 0, faceY: 1, shotCooldown: 0 };
    const ball = { x: 250, y: 220, radius: 12, vx: 100, vy: 25 };
    const before = JSON.stringify({ player, ball });
    const shot = predictShot(player, ball, null, power);
    assert.equal(JSON.stringify({ player, ball }), before);
    assert.equal(kickBall(player, ball, () => {}, null, power), true);
    assert.deepEqual({ vx: ball.vx, vy: ball.vy }, shot);
    assert.ok(Math.hypot(shot.vx, shot.vy) <= Ball.MAX_SPEED + .000001);
    assert.equal(predictShot(player, ball), null, 'cooldown disables the preview');
  }
});


test('proximity adds up to 25% to normal shots and 30% to fire shots inside the smaller reach', async () => {
  const { predictShot, SHOT_REACH, shotRangeRadius } = await import('../src/game/Physics.js');
  assert.equal(SHOT_REACH, 42);
  const player = { x: 200, y: 200, vx: 0, vy: 0, radius: 22, faceX: 1, faceY: 0, shotCooldown: 0 };
  for (const [power, bonus] of [[1, .25], [1.45, .30]]) {
    const ball = { x: 234, y: 200, radius: 12, vx: 0, vy: 0 };
    const close = predictShot(player, ball, null, power);
    assert.ok(Math.abs(close.vx - 365.5 * power * (1 + bonus)) < 1e-6);
    ball.x += SHOT_REACH / 2;
    const middle = predictShot(player, ball, null, power);
    assert.ok(Math.abs(middle.vx - 365.5 * power * (1 + bonus / 2)) < 1e-6);
    ball.x = player.x + shotRangeRadius(player) + ball.radius;
    const edge = predictShot(player, ball, null, power);
    assert.ok(Math.abs(edge.vx - 365.5 * power) < 1e-6);
    assert.ok(close.vx > middle.vx && middle.vx > edge.vx);
    ball.x += 1; assert.equal(predictShot(player, ball, null, power), null);
  }
});

test('ball update keeps the extra fire-shot speed instead of clipping it to the old cap', () => {
  const ball = new Ball(200, 200); ball.vx = 800;
  ball.update(1 / 60);
  assert.ok(ball.vx > 663);
  assert.ok(ball.vx < 800);
});

test('default match renders players and ball without a cosmetic inventory', async () => {
  const { Player } = await import('../src/game/Player.js');
  const circles = [];
  const ctx = new Proxy({
    createRadialGradient() { return { addColorStop() {} }; },
    arc(x, y, radius) { assert.ok(Number.isFinite(radius)); circles.push(radius); },
  }, { get(target, key) { return key in target ? target[key] : () => {}; } });
  const renderer = Object.create(Renderer.prototype);
  Object.assign(renderer, { ctx, canvas: { width: 1140, height: 700 }, scale: 1, ox: 0, oy: 0, particles: [] });
  renderer.render({ player: new Player({ x: 300, y: 350, color: '#123456' }),
    bot: new Player({ x: 700, y: 350, color: '#abcdef' }), ball: new Ball(570, 350), fieldTheme: 'arcade', goalTimer: 1 }, 1 / 60);
  const { BALL_RADIUS } = await import('../src/game/Ball.js'), { PLAYER_RADIUS } = await import('../src/game/Player.js');
  assert.ok(circles.includes(BALL_RADIUS)); assert.ok(circles.includes(PLAYER_RADIUS));
});
