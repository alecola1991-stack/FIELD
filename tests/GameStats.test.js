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
