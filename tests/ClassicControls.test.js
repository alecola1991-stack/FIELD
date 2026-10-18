import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD } from '../src/config/settings.js';
import { Ball } from '../src/game/Ball.js';
import { Player } from '../src/game/Player.js';
import { goalShotAim, curvedShotAim, passAim, simulateCross, goalTarget } from '../src/game/ClassicAim.js';
import { classicPadAxes } from '../src/game/GamepadController.js';

globalThis.window ??= { addEventListener() {} }; globalThis.document ??= { addEventListener() {}, querySelectorAll: () => [] };
const { Input } = await import('../src/game/Input.js');

const setup = (px, py, bx, by) => {
  const ball = new Ball(bx, by); ball.world = WORLD;
  const shooter = new Player({ x: px, y: py }); return { ball, shooter };
};
const inMouth = y => y > WORLD.goalTop + 6 && y < WORLD.goalBottom - 6;

test('goal shot goes into the goal from many positions, also with power', () => {
  for (const [px, py] of [[600, 350], [700, 160], [760, 560], [880, 330], [650, 600]]) {
    for (const power of [1, 1.45]) {
      const { ball, shooter } = setup(px, py, px + 30, py);
      const { aim } = goalShotAim(shooter, ball, { attackRight: true, power });
      const y = simulateCross(shooter, ball, aim, power, 0, WORLD, true);
      assert.ok(y !== null && inMouth(y), `from ${px},${py} power ${power}: crosses at ${y}`);
    }
  }
});

test('goal shot avoids the rival standing in the way', () => {
  const { ball } = setup(700, 350, 730, 350);
  const keeper = { x: 1000, y: 300, radius: 21 };
  const target = goalTarget(ball, WORLD, true, [keeper]);
  assert.ok(target.y > 350, `aims away from the keeper (y ${target.y})`);
});

test('curved shot bends into the goal', () => {
  for (const [px, py] of [[650, 250], [700, 470], [800, 350], [600, 600]]) {
    const { ball, shooter } = setup(px, py, px + 30, py);
    const result = curvedShotAim(shooter, ball, { attackRight: true, opponents: [{ x: 1040, y: 350, radius: 21 }] });
    const y = simulateCross(shooter, ball, result.aim, 1, result.side, WORLD, true);
    assert.ok(y !== null && inMouth(y), `curved from ${px},${py} crosses at ${y}`);
  }
});

test('attacking left works too', () => {
  const { ball, shooter } = setup(500, 300, 470, 300);
  const { aim } = goalShotAim(shooter, ball, { attackRight: false });
  const y = simulateCross(shooter, ball, aim, 1, 0, WORLD, false);
  assert.ok(y !== null && inMouth(y));
});

test('pass goes in front of the teammate with a softer kick', () => {
  const { ball, shooter } = setup(300, 350, 330, 350);
  const mate = { x: 600, y: 200, vx: 120, vy: 0 };
  const pass = passAim(shooter, ball, mate, { attackRight: true });
  assert.ok(pass.target.x > mate.x, 'ahead of the teammate');
  assert.ok(pass.power < 1 && pass.power >= .42);
  const solo = passAim(shooter, ball, null, { attackRight: true });
  assert.ok(solo.target.x > ball.x);
});

test('classic keyboard: K shoots at goal, J + K curves, L passes, Space does not shoot', () => {
  const input = new Input(); input.setScheme('classic');
  input.press('Space'); assert.equal(input.consumeKick().kick, false);
  input.press('KeyK'); assert.deepEqual(input.consumeKick(), { kick: true, curve: false, shot: 'goal' });
  input.release('KeyK'); input.press('KeyJ'); input.press('KeyK'); assert.deepEqual(input.consumeKick(), { kick: true, curve: true, shot: 'goal' });
  input.release('KeyJ'); input.press('KeyL'); assert.deepEqual(input.consumeKick(), { kick: true, curve: false, shot: 'pass' });
  input.setScheme('arcade'); input.press('KeyK'); assert.equal(input.consumeKick().kick, false);
});

test('classic pad: the right stick moves', () => {
  const pad = { axes: [0, 0, 1, 0], buttons: [] };
  assert.equal(classicPadAxes(pad).x, 1);
  assert.equal(classicPadAxes({ axes: [-1, 0, 0, 0], buttons: [] }).x, -1);
});
