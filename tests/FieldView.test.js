import test from 'node:test';
import assert from 'node:assert/strict';
import { Input } from '../src/game/Input.js';
import { Renderer } from '../src/game/Renderer.js';
import { WORLD } from '../src/config/settings.js';

function input(keys) {
  const instance = Object.create(Input.prototype);
  Object.assign(instance, { enabled: true, down: new Set(keys), pressed: new Set(), padAxes: { x: 0, y: 0 } });
  return instance;
}

test('controls stay screen-relative when the pitch is rotated for portrait screens', () => {
  const up = input(['KeyW']); up.rotated = true;
  assert.deepEqual(up.axes(), { x: 1, y: 0 }, 'screen up moves toward the attacked goal');
  const right = input(['KeyD']); right.rotated = true;
  assert.deepEqual(right.axes(), { x: 0, y: 1 });
  const pad = input([]); pad.rotated = true; pad.padAxes = { x: .5, y: -.25 };
  assert.deepEqual(pad.axes(), { x: .25, y: .5 });
  const normal = input(['KeyW']);
  assert.deepEqual(normal.axes(), { x: 0, y: -1 }, 'landscape keeps the original mapping');
});

function renderer(width, height, touch = false) {
  const instance = Object.create(Renderer.prototype);
  Object.assign(instance, { canvas: { width: 0, height: 0, getBoundingClientRect: () => ({ width, height }) }, allowRotate: true });
  globalThis.window = { devicePixelRatio: 1, matchMedia: () => ({ matches: touch }) };
  instance.resize();
  return instance;
}
// Maps a world point to canvas pixels with the renderer's own transform.
function project(instance, x, y) {
  let matrix;
  instance.applyWorldTransform({ setTransform: (...values) => { matrix = values; } });
  const [a, b, c, d, e, f] = matrix;
  return [a * x + c * y + e, b * x + d * y + f];
}

test('wide screens fill the height with the reachable band of the world', () => {
  const view = renderer(1868, 952);
  assert.equal(view.rotated, false);
  const [, top] = project(view, 0, 25), [, bottom] = project(view, 0, WORLD.height - 25);
  assert.ok(Math.abs(top) < 1 && Math.abs(bottom - 952) < 1, 'no vertical letterbox');
});

test('portrait phones rotate the pitch, keep it inside the canvas and clear of the touch controls', () => {
  const view = renderer(390, 734, true);
  assert.equal(view.rotated, true);
  const [, attackedGoalY] = project(view, WORLD.right, WORLD.height / 2), [, ownGoalY] = project(view, WORLD.left, WORLD.height / 2);
  assert.ok(attackedGoalY < ownGoalY, 'the attacked goal is at the top');
  const corners = [[0, 25], [WORLD.width, 25], [0, WORLD.height - 25], [WORLD.width, WORLD.height - 25]].map(([x, y]) => project(view, x, y));
  assert.ok(corners.every(([x, y]) => x >= -1 && x <= 391 && y >= -1 && y <= 734 - 176 + 1));
  view.allowRotate = false; view.resize();
  assert.equal(view.rotated, false, 'the vertical field can be turned off');
  delete globalThis.window;
});
