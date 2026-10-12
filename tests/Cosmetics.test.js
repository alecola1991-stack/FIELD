import test from 'node:test';
import assert from 'node:assert/strict';
import { Renderer } from '../src/game/Renderer.js';

function context() {
  const lines = [], arcs = []; let path = [];
  const c = new Proxy({
    beginPath() { path = []; },
    moveTo(x, y) { path.push([x, y]); },
    lineTo(x, y) { path.push([x, y]); },
    stroke() { if (path.length) lines.push([...path]); },
    arc(...args) { arcs.push(args); },
  }, { get(target, key) { return key in target ? target[key] : () => {}; } });
  return { c, lines, arcs };
}

test('ball tails use the visible ball position and stay behind motion in all four directions', () => {
  for (const [vx, vy] of [[300, 0], [-300, 0], [0, 300], [0, -300]]) {
    const renderer = Object.create(Renderer.prototype), { c, lines } = context();
    const ball = { x: 200, y: 200, vx, vy };
    renderer.effectTime = 0;
    renderer.drawShotEffect(c, ball, 'neon', [100, 100]);
    renderer.effectTime = .016;
    const visible = [100 + vx * .016, 100 + vy * .016];
    renderer.drawShotEffect(c, ball, 'neon', visible);
    assert.ok(lines.length > 0);
    assert.deepEqual(lines[0][0], visible);
    for (const line of lines) for (const [x, y] of line) assert.ok((x - visible[0]) * vx + (y - visible[1]) * vy <= 1e-6);
  }
});

test('trails clear after reversing, respawning or expiring, and history stays bounded', () => {
  const renderer = Object.create(Renderer.prototype), entity = { vx: 300, vy: 0 };
  for (let i = 0; i < 50; i++) { renderer.effectTime = i * .005; renderer.trailPoints(entity, i * 2, 100); }
  assert.ok(entity._cosmeticTrail.length <= 16);
  entity.vx = -300;
  assert.equal(renderer.trailPoints(entity, 100, 100).length, 1);
  assert.equal(renderer.trailPoints(entity, 500, 100).length, 1);
  renderer.effectTime = 5;
  assert.equal(renderer.trailPoints(entity, 490, 100).length, 1);
});

test('relief changes only the player circle and animated auras evolve with time', () => {
  const renderer = Object.create(Renderer.prototype), base = context(), equipped = context();
  renderer.drawField(base.c, 'arcade', 0, {});
  renderer.drawField(equipped.c, 'arcade', 0, { circleRelief: 'gold' });
  assert.deepEqual(equipped.arcs, base.arcs);
  const ring = context(); renderer.drawPlayerRelief(ring.c, 22, 'gold');
  assert.ok(ring.arcs.length > 0);
  assert.ok(ring.arcs.every(([x, y, radius]) => x === 0 && y === 0 && radius <= 22));
  const first = context(), later = context();
  renderer.effectTime = 0; renderer.drawPlayerAura(first.c, 22, 'orbit');
  renderer.effectTime = 1; renderer.drawPlayerAura(later.c, 22, 'orbit');
  assert.notDeepEqual(first.arcs, later.arcs);
});
