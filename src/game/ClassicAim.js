import { Ball } from './Ball.js';
import { predictShot, curveFor } from './Physics.js';
import { WORLD } from '../config/settings.js';

// "Clásico" controls: the game picks the direction of shots and passes.
//  - goal shot: towards the most open part of the goal (away from the rivals in the way);
//  - curved goal shot: aims outside the post and bends the ball in (found by simulating the ball);
//  - pass: to the teammate, in front of them (where they are running / towards goal).
// Every function returns the direction to kick (`aim`, unit-free) plus extras; kickBall does the rest.

const unit = (x, y) => { const length = Math.hypot(x, y) || 1; return { x: x / length, y: y / length }; };
export const PASS_POWER = { min: .42, max: .95 };

// A kick adds the ball's current velocity and part of the kicker's. Aim so the result follows `aim`.
export function compensateAim(body, ball, aim, power = 1) {
  const d = unit(aim.x, aim.y);
  const gap = Math.max(0, Math.hypot(body.x - ball.x, body.y - ball.y) - body.radius - ball.radius), proximity = Math.max(0, Math.min(1, 1 - gap / 42));
  const move = Math.hypot(body.vx || 0, body.vy || 0);
  const strength = (365.5 + Math.min(76.5, move * .17)) * power * (1 + (power > 1 ? .30 : .25) * proximity) * (body.shotPower || 1);
  const wx = (ball.vx || 0) + (body.vx || 0) * .187, wy = (ball.vy || 0) + (body.vy || 0) * .187;
  const along = d.x * wx + d.y * wy, disc = along * along - (wx * wx + wy * wy) + strength * strength;
  if (disc <= 0) return d;
  const k = along + Math.sqrt(disc);
  return { x: (k * d.x - wx) / strength, y: (k * d.y - wy) / strength };
}

function goalLine(world, attackRight) { return attackRight ? world.right : world.left; }

// Free space around the line ball → (gx, gy): smallest gap to a rival standing between the ball and the goal.
function clearance(ball, gx, gy, opponents) {
  const dx = gx - ball.x, dy = gy - ball.y, length = Math.hypot(dx, dy) || 1, ux = dx / length, uy = dy / length;
  let best = Infinity;
  for (const rival of opponents) {
    if (!rival) continue;
    const along = (rival.x - ball.x) * ux + (rival.y - ball.y) * uy;
    if (along < 0 || along > length + 20) continue;
    const side = Math.abs((rival.x - ball.x) * uy - (rival.y - ball.y) * ux) - (rival.radius || 21);
    best = Math.min(best, side);
  }
  return best;
}

// Target height in the goal: the open spot (five candidates from post to post).
export function goalTarget(ball, world = ball.world || WORLD, attackRight = true, opponents = []) {
  const margin = ball.radius + (world.goalPostRadius || 6) + 8;
  const top = world.goalTop + margin, bottom = world.goalBottom - margin, center = (world.goalTop + world.goalBottom) / 2;
  const gx = goalLine(world, attackRight) + (attackRight ? 10 : -10);
  const heights = top < bottom ? [top, top + (bottom - top) * .25, center, top + (bottom - top) * .75, bottom] : [center];
  let best = { y: center, score: -Infinity };
  for (const y of heights) {
    const free = clearance(ball, gx, y, opponents);
    // Ties (no rival in the way): prefer the corner farther from the nearest rival, then the centre.
    const nearest = opponents.length ? Math.min(...opponents.filter(Boolean).map(rival => Math.abs(rival.y - y))) : 0;
    const score = Math.min(free, 400) + nearest * .05 - Math.abs(y - center) * .01;
    if (score > best.score) best = { y, score };
  }
  return { x: gx, y: best.y, center };
}

export function goalShotAim(shooter, ball, { world = ball.world || WORLD, attackRight = true, opponents = [], power = 1 } = {}) {
  const target = goalTarget(ball, world, attackRight, opponents);
  return { aim: compensateAim(shooter, ball, { x: target.x - ball.x, y: target.y - ball.y }, power), target };
}

// Where a kick along `aim` with this curve crosses the goal line (null if it never gets there).
export function simulateCross(shooter, ball, aim, power, side, world, attackRight) {
  const shot = predictShot({ ...shooter, shotCooldown: 0, x: shooter.x, y: shooter.y }, ball, aim, power);
  if (!shot) return null;
  const sim = new Ball(ball.x, ball.y); sim.radius = ball.radius; sim.maxSpeed = ball.maxSpeed; sim.world = world;
  sim.vx = shot.vx; sim.vy = shot.vy; sim.curl = curveFor(side, shot);
  const line = goalLine(world, attackRight), dt = 1 / 120;
  for (let i = 0; i < 480; i++) {
    sim.update(dt);
    if (sim.y < world.top + sim.radius || sim.y > world.bottom - sim.radius) return null; // would hit a touchline
    if (attackRight ? sim.x >= line : sim.x <= line) return sim.y;
    if (Math.hypot(sim.vx, sim.vy) < 40) return null;
  }
  return null;
}

// Curved goal shot: try both spins and a fan of starting angles; keep the one that lands nearest the open
// spot, preferring the spin that bends the ball in from outside the post.
export function curvedShotAim(shooter, ball, { world = ball.world || WORLD, attackRight = true, opponents = [], power = 1 } = {}) {
  const target = goalTarget(ball, world, attackRight, opponents);
  const base = Math.atan2(target.y - ball.y, target.x - ball.x);
  const margin = ball.radius + (world.goalPostRadius || 6) + 4;
  const inward = target.y < target.center ? 1 : target.y > target.center ? -1 : (ball.y < target.center ? 1 : -1);
  let best = null;
  for (const side of [inward, -inward]) {
    for (let step = -14; step <= 14; step++) {
      const angle = base + step * .035, aim = { x: Math.cos(angle), y: Math.sin(angle) };
      const y = simulateCross(shooter, ball, aim, power, side, world, attackRight);
      if (y === null || y < world.goalTop + margin || y > world.goalBottom - margin) continue;
      const score = Math.abs(y - target.y) + (side === inward ? 0 : 18) + (step === 0 ? 6 : 0);
      if (!best || score < best.score) best = { aim, side, score, y };
    }
  }
  // No curved path reaches the goal from here (e.g. too tight an angle): shoot straight instead.
  if (!best) { const straight = goalShotAim(shooter, ball, { world, attackRight, opponents, power }); return { aim: straight.aim, side: 0, target }; }
  return { aim: best.aim, side: best.side, target };
}

// Pass: in front of the teammate (their run, or towards goal), with the strength the distance needs.
export function passAim(passer, ball, mate, { world = ball.world || WORLD, attackRight = true } = {}) {
  let target;
  if (mate) {
    const lead = .45, forward = attackRight ? 1 : -1;
    target = { x: mate.x + (mate.vx || 0) * lead + forward * 46, y: mate.y + (mate.vy || 0) * lead };
  } else {
    // No teammate (1 against 1): a soft touch into space towards the rival goal.
    const towards = unit((attackRight ? world.right : world.left) - ball.x, (world.height / 2) - ball.y);
    target = { x: ball.x + towards.x * 160, y: ball.y + towards.y * 160 };
  }
  const pad = ball.radius + 24;
  target.x = Math.max(world.left + pad, Math.min(world.right - pad, target.x));
  target.y = Math.max(world.top + pad, Math.min(world.bottom - pad, target.y));
  const distance = Math.hypot(target.x - ball.x, target.y - ball.y);
  // Strong enough to arrive with some pace (the ball loses ~0.72 of its speed per pixel·s of drag).
  const power = Math.max(PASS_POWER.min, Math.min(PASS_POWER.max, (distance * .72 + 140) / 400));
  return { aim: compensateAim(passer, ball, { x: target.x - ball.x, y: target.y - ball.y }, power), power, target };
}
