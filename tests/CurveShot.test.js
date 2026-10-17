import test from 'node:test';
import assert from 'node:assert/strict';
import { Ball } from '../src/game/Ball.js';
import { kickBall, resolveBallWalls, resolvePlayerBall } from '../src/game/Physics.js';
import { Input } from '../src/game/Input.js';

globalThis.window ??= { addEventListener() {} };
globalThis.document ??= { addEventListener() {}, querySelectorAll: () => [] };

const shooter = (vy = 0) => ({ x: 600, y: 350, vx: 120, vy, radius: 22, faceX: 1, faceY: 0, shotCooldown: 0, shotPower: 1 });
const flight = (curve, vy) => {
  const ball = new Ball(636, 350), player = shooter(vy);
  assert.ok(kickBall(player, ball, () => {}, null, 1, curve));
  for (let i = 0; i < 30; i++) ball.update(1 / 60);
  return ball;
};

test('a curved shot bends down when the player runs down, up when running up; a normal shot goes straight', () => {
  const straight = flight(false, 0);
  assert.equal(straight.curl, 0);
  assert.ok(Math.abs(straight.y - 350) < 1, 'straight shot keeps its line');
  const down = flight(true, 200), up = flight(true, -200);
  // The kick itself adds part of the player's run; compare with an uncurved shot of the same run.
  assert.ok(down.y > flight(false, 200).y + 25, `curves down (y=${down.y.toFixed(0)})`);
  assert.ok(up.y < flight(false, -200).y - 25, `curves up (y=${up.y.toFixed(0)})`);
});

test('without a vertical run the curve goes towards the middle of the pitch', () => {
  const ball = new Ball(636, 200), player = { ...shooter(0), y: 200 };
  kickBall(player, ball, () => {}, null, 1, true);
  assert.ok(ball.curl > 0, 'upper half: bends down towards the middle');
  const low = new Ball(636, 520), lowPlayer = { ...shooter(0), y: 520 };
  kickBall(lowPlayer, low, () => {}, null, 1, true);
  assert.ok(low.curl < 0, 'lower half: bends up towards the middle');
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

test('Shift or C shoots with curve; held while pressing Space it also curves', () => {
  const input = new Input();
  input.press('KeyC'); assert.deepEqual(input.consumeKick(), { kick: true, curve: true }); input.release('KeyC'); input.endFrame();
  input.press('Space'); assert.deepEqual(input.consumeKick(), { kick: true, curve: false }); input.release('Space'); input.endFrame();
  input.press('ShiftLeft'); input.endFrame();
  assert.equal(input.curveHeld(), true);
  input.press('Space'); assert.deepEqual(input.consumeKick(), { kick: true, curve: true });
  assert.deepEqual(input.consumeKick(), { kick: false, curve: false });
});
