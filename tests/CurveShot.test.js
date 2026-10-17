import test from 'node:test';
import assert from 'node:assert/strict';
import { Ball } from '../src/game/Ball.js';
import { kickBall, curveSide, resolveBallWalls, resolvePlayerBall } from '../src/game/Physics.js';
import { Input } from '../src/game/Input.js';

globalThis.window ??= { addEventListener() {} };
globalThis.document ??= { addEventListener() {}, querySelectorAll: () => [] };

const shooter = (vy = 0) => ({ x: 600, y: 350, vx: 120, vy, radius: 22, faceX: 1, faceY: 0, shotCooldown: 0, shotPower: 1 });
const flight = (side, vy = 0) => {
  const ball = new Ball(636, 350), player = shooter(vy);
  assert.ok(kickBall(player, ball, () => {}, null, 1, side));
  for (let i = 0; i < 30; i++) ball.update(1 / 60);
  return ball;
};

test('holding the curve key, down bends the shot up and up bends it down; no up/down direction shoots straight', () => {
  assert.equal(curveSide(true, 1), -1, 'pressing down: bends up');
  assert.equal(curveSide(true, -1), 1, 'pressing up: bends down');
  assert.equal(curveSide(true, 0), 0, 'no direction: normal shot');
  assert.equal(curveSide(true, .1), 0, 'a tiny stick tilt is not a direction');
  assert.equal(curveSide(false, 1), 0, 'without Shift / C: normal shot');
  const straight = flight(0);
  assert.equal(straight.curl, 0);
  assert.ok(Math.abs(straight.y - 350) < 1, 'straight shot keeps its line');
  assert.ok(flight(1).y > 350 + 25, 'side +1 bends down the screen');
  assert.ok(flight(-1).y < 350 - 25, 'side -1 bends up the screen');
});

test('the curve fades, flips on a wall bounce and stops when a player touches the ball', () => {
  const ball = new Ball(600, 75); ball.vx = 500; ball.vy = -300; ball.curl = 1;
  resolveBallWalls(ball);
  assert.equal(ball.curl, -.5);
  for (let i = 0; i < 200; i++) ball.update(1 / 60);
  assert.equal(ball.curl, 0);
  const touched = new Ball(620, 350); touched.vx = -400; touched.curl = 1;
  resolvePlayerBall({ x: 600, y: 350, vx: 0, vy: 0, radius: 22, faceX: 1, faceY: 0 }, touched);
  assert.equal(touched.curl, 0);
});

test('Shift or C never shoot by themselves: Space shoots, curved only while one of them is held', () => {
  const input = new Input();
  input.press('KeyC'); assert.deepEqual(input.consumeKick(), { kick: false, curve: false }, 'C alone does not shoot');
  assert.equal(input.curveHeld(), true, 'but it shows the curved path');
  input.press('Space'); assert.deepEqual(input.consumeKick(), { kick: true, curve: true }); input.release('Space'); input.release('KeyC'); input.endFrame();
  input.press('Space'); assert.deepEqual(input.consumeKick(), { kick: true, curve: false }, 'Space alone shoots straight'); input.release('Space'); input.endFrame();
  input.press('ShiftLeft'); assert.deepEqual(input.consumeKick(), { kick: false, curve: false }); input.endFrame();
  input.press('Space'); assert.deepEqual(input.consumeKick(), { kick: true, curve: true });
  assert.deepEqual(input.consumeKick(), { kick: false, curve: false });
});
