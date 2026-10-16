import test from 'node:test';
import assert from 'node:assert/strict';
import { BotAI } from '../src/game/BotAI.js';
import { Player } from '../src/game/Player.js';
import { Ball } from '../src/game/Ball.js';
import { kickBall, resolveBallWalls, resolvePlayerBall, resolvePlayerPlayers, resolvePlayerWalls, isGoal } from '../src/game/Physics.js';
import { WORLD, DIFFICULTIES, BOT_LEVELS, difficultyLabel } from '../src/config/settings.js';

const DT = 1 / 60;
function setup(level, { ballX = 760, playerX = 300, playerY = WORLD.height / 2, random = () => 0 } = {}) {
  const ai = new BotAI(level); ai.random = random; ai.mode = 'attack'; ai.thinkTimer = 99;
  const bot = new Player({ x: ballX + 34, y: WORLD.height / 2, isBot: true, speed: 280 });
  const ball = new Ball(ballX, WORLD.height / 2);
  const player = new Player({ x: playerX, y: playerY });
  return { ai, bot, ball, player };
}

test('five difficulties with the new names, increasing strength and level unlocks', () => {
  assert.deepEqual(DIFFICULTIES.map(item => item.label), ['Principiante', 'Avanzado', 'Experto', 'Profesional', 'Champions']);
  assert.deepEqual(DIFFICULTIES.map(item => item.unlock), [1, 1, 5, 10, 15]);
  const speeds = DIFFICULTIES.map(item => BOT_LEVELS[item.id].speed);
  assert.deepEqual([...speeds].sort((a, b) => a - b), speeds);
  assert.equal(difficultyLabel('legend'), 'Leyenda');
  for (const id of ['easy', 'normal', 'hard']) assert.equal(BOT_LEVELS[id].skills, undefined, `${id} keeps the classic behaviour`);
});

test('classic levels still shoot as soon as the ball is in reach', () => {
  const { ai, bot, ball, player } = setup('hard');
  const decision = ai.update(bot, ball, player, DT);
  assert.equal(decision.kick, true);
});

test('Profesional carries the ball far from goal instead of shooting', () => {
  const { ai, bot, ball, player } = setup('pro');
  const decision = ai.update(bot, ball, player, DT);
  assert.equal(decision.kick, false);
  assert.equal(decision.behavior, 'dribble');
  assert.ok(decision.x < -.9, 'pushes towards the goal');
  assert.ok(decision.speedMultiplier < BOT_LEVELS.pro.speed / 280, 'at a controlled pace');
});

test('Champions shoots from range with a clear lane', () => {
  const { ai, bot, ball, player } = setup('champions', { ballX: 300, playerX: 700 });
  const decision = ai.update(bot, ball, player, DT);
  assert.equal(decision.kick, true); assert.equal(decision.behavior, 'shoot');
  assert.ok(decision.kickDirection.x < 0);
});

test('near the goal line and blocked, the bot banks the ball off the wall into the goal', () => {
  const { ai, bot, ball, player } = setup('champions');
  ball.x = 170; ball.y = 110; bot.x = 202; bot.y = 104; player.x = 145; player.y = 165; // defender on the line to goal
  const decision = ai.update(bot, ball, player, DT);
  assert.equal(decision.behavior, 'wall'); assert.equal(decision.kick, true);
  assert.ok(decision.kickDirection.y < 0, 'uses the top wall, away from the defender');
  kickBall(bot, ball, () => {}, decision.kickDirection);
  let bounced = false, side = 0;
  for (let i = 0; i < 240 && !side; i++) { ball.update(DT); const vy = ball.vy; resolveBallWalls(ball); if (vy < 0 && ball.vy > 0) bounced = true; side = isGoal(ball); }
  assert.ok(bounced, 'the ball comes off the wall');
  assert.equal(side, -1, 'and goes in');
});

test('blocked far from goal, the bot plays a one-two off the wall past the defender', () => {
  const { ai, bot, ball, player } = setup('champions', { ballX: 560, playerX: 470, playerY: WORLD.height / 2 + 15 });
  const decision = ai.update(bot, ball, player, DT);
  assert.equal(decision.behavior, 'wall');
  assert.ok(decision.kickDirection.x < 0 && decision.kickDirection.y < 0, 'forward and towards the top wall');
});

test('a feint shows one side and then cuts to the other', () => {
  const { ai, bot, ball, player } = setup('champions', { ballX: 700, playerX: 640, playerY: WORLD.height / 2 + 12 });
  ai.wallCooldown = 99; // isolate the feint
  bot.shotCooldown = 9; // in contact but not kicking
  const first = ai.update(bot, ball, player, DT);
  assert.equal(first.behavior, 'feint');
  const show = Math.sign(ai.feint ? first.y : 0);
  let cut = null;
  for (let i = 0; i < 40; i++) { const decision = ai.update(bot, ball, player, DT); if (ai.feint?.phase === 'cut') { cut = decision; break; } }
  assert.ok(cut, 'the cut phase follows');
  assert.ok(show !== 0 && Math.sign(cut.y) === -show, `cuts the other way (${show} → ${Math.sign(cut.y)})`);
});

function duel(level, seconds = 60, start = 7) {
  let seed = start; const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ai = new BotAI(level); ai.random = random;
  const bot = new Player({ x: WORLD.width * .69, y: WORLD.height / 2, isBot: true, speed: 280 });
  const keeper = new Player({ x: WORLD.width * .25, y: WORLD.height / 2 });
  const ball = new Ball(WORLD.width / 2, WORLD.height / 2);
  let goals = 0, close = 0, carrying = 0;
  for (let frame = 0; frame < seconds * 60; frame++) {
    const d = ai.update(bot, ball, keeper, DT);
    if (d.behavior === 'dribble') { carrying++; if (Math.hypot(ball.x - bot.x, ball.y - bot.y) < bot.radius + ball.radius + 24) close++; }
    bot.move(d.x, d.y, DT, d.speedMultiplier); resolvePlayerWalls(bot);
    if (d.kick) kickBall(bot, ball, () => {}, d.kickDirection);
    // A defender that blocks the lane to its goal and goes for the ball when it comes close (it never clears).
    const gx = WORLD.left + 70, gy = WORLD.height / 2, near = Math.hypot(ball.x - keeper.x, ball.y - keeper.y) < 110;
    const tx = near ? ball.x : gx + (ball.x - gx) * .55, ty = near ? ball.y : gy + (ball.y - gy) * .7;
    const dx = tx - keeper.x, dy = ty - keeper.y, len = Math.hypot(dx, dy);
    keeper.move(len > 6 ? dx / len : 0, len > 6 ? dy / len : 0, DT, .62);
    resolvePlayerWalls(keeper); resolvePlayerPlayers(bot, keeper); resolvePlayerWalls(bot); resolvePlayerWalls(keeper);
    ball.update(DT); resolvePlayerBall(bot, ball); resolvePlayerBall(keeper, ball);
    if (isGoal(ball) === -1) { goals++; ball.reset(WORLD.width / 2, WORLD.height / 2); bot.x = WORLD.width * .69; bot.y = WORLD.height / 2; bot.stop(); keeper.x = WORLD.width * .25; keeper.y = WORLD.height / 2; keeper.stop(); ai.feint = null; }
    resolveBallWalls(ball);
  }
  return { goals, closeRate: carrying ? close / carrying : 0 };
}

test('against a defender that blocks the lane, the skilled levels score and keep the ball at their feet', () => {
  const total = level => [1, 2, 3, 4].map(seed => duel(level, 60, seed)).reduce((sum, run) => ({ goals: sum.goals + run.goals, closeRate: sum.closeRate + run.closeRate / 4 }), { goals: 0, closeRate: 0 });
  const hard = total('hard'), pro = total('pro'), champions = total('champions');
  assert.ok(champions.goals > hard.goals && pro.goals > hard.goals, `scores: experto ${hard.goals}, profesional ${pro.goals}, champions ${champions.goals}`);
  assert.ok(champions.closeRate > .5 && pro.closeRate > .5, `ball close while dribbling (${pro.closeRate.toFixed(2)}, ${champions.closeRate.toFixed(2)})`);
});
