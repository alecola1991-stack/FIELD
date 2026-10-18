import { Ball } from './Ball.js';
import { predictShot, curveFor } from './Physics.js';
import { WORLD } from '../config/settings.js';

// "Táctico" gameplay (FIFA-like basics):
//  - Possession: touching the ball keeps it glued to the player, on the side they last looked at; it
//    turns around the player when they turn. It is lost when a rival touches it or when it is kicked.
//    A powerful shot from a rival is not controlled: it bounces as usual.
//  - Shot (○ / Space): always at goal, 20 % stronger; up/down picks the post (none: the open spot).
//  - Curved shot (L2 + ○ / Shift + Space): bends in to the far side, or out to the chosen post.
//  - Pass (✕ / E) and through pass (△ / R) to the teammate in the pushed direction (±30°);
//    with nobody there, a push of the ball in that direction.

export const TACTICAL = Object.freeze({
  ballScale: .9, shotPower: 1.2, turnRate: 13, gap: 1, stealCooldown: .9, releaseCooldown: .3,
  hardShot: 560, passCone: Math.PI / 6, pushPower: .5, stealGuard: .55, swing: .3,
});
const unit = (x, y) => { const length = Math.hypot(x, y) || 1; return { x: x / length, y: y / length }; };
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export class Possession {
  constructor() { this.holder = null; this.angle = 0; this.cooldowns = new Map(); this.ghosts = new Map(); this.lastKicker = null; this.lastKickSpeed = 0; this.guard = 0; this.swing = null; }
  reset() { this.holder = null; this.cooldowns.clear(); this.ghosts.clear(); this.lastKicker = null; this.lastKickSpeed = 0; this.guard = 0; this.swing = null; }
  // The ball was kicked by `body` (any kick): it is free, and the kicker cannot pick it up at once.
  kicked(body, ball) {
    this.holder = null; this.guard = 0; this.swing = null;
    // The kicker cannot pick the ball up again for a moment, and only for a very short moment does it
    // not collide with it (so the ball leaves cleanly but never passes through anyone).
    if (body) { this.cooldowns.set(body, TACTICAL.releaseCooldown); this.ghosts.set(body, .1); }
    this.lastKicker = body; this.lastKickSpeed = Math.hypot(ball.vx, ball.vy);
  }
  // One physics step. `bodies`: everyone on the pitch; `sameTeam(a, b)`.
  // Returns true while someone holds the ball (normal player–ball collisions are then skipped).
  step(bodies, ball, dt, sameTeam) {
    for (const map of [this.cooldowns, this.ghosts]) for (const [body, time] of map) { if (time - dt <= 0) map.delete(body); else map.set(body, time - dt); }
    const touching = bodies.filter(body => body && !this.cooldowns.has(body) && Math.hypot(ball.x - body.x, ball.y - body.y) <= body.radius + ball.radius + 1.5);
    this.guard = Math.max(0, this.guard - dt);
    if (this.swing && (this.swing.time -= dt) <= 0) this.swing = null;
    if (this.holder) {
      // Disputes: right after a steal the new holder is protected for a moment (no instant steal-back
      // ping-pong) and the ball swings round to their side away from the player who lost it.
      const thief = this.guard > 0 ? null : touching.find(body => body !== this.holder && !sameTeam(body, this.holder));
      if (thief) {
        const victim = this.holder;
        this.cooldowns.set(victim, TACTICAL.stealCooldown); this.take(thief, ball);
        this.guard = TACTICAL.stealGuard;
        this.swing = { angle: Math.atan2(thief.y - victim.y, thief.x - victim.x), time: TACTICAL.swing };
      }
    } else if (touching.length) {
      const speed = Math.hypot(ball.vx, ball.vy);
      const candidates = touching.filter(body => !(speed > TACTICAL.hardShot && this.lastKicker && !sameTeam(body, this.lastKicker) && this.lastKickSpeed > TACTICAL.hardShot));
      if (candidates.length) this.take(candidates.reduce((a, b) => Math.hypot(ball.x - a.x, ball.y - a.y) <= Math.hypot(ball.x - b.x, ball.y - b.y) ? a : b), ball);
    }
    if (!this.holder) return false;
    this.carry(this.holder, ball, dt);
    return true;
  }
  // A body that just kicked (or lost) the ball does not collide with it for a moment: the ball leaves cleanly.
  ignores(body) { return this.ghosts.has(body); }
  take(body, ball) { this.holder = body; this.swing = null; this.angle = Math.atan2(ball.y - body.y, ball.x - body.x); this.lastKicker = null; this.lastKickSpeed = 0; }
  // Keep the ball in front of the holder, turning towards where they look.
  carry(body, ball, dt) {
    const face = this.swing ? this.swing.angle : Math.atan2(body.faceY || 0, body.faceX ?? 1);
    const diff = angleDiff(face, this.angle), turn = TACTICAL.turnRate * dt;
    this.angle += Math.abs(diff) <= turn ? diff : Math.sign(diff) * turn;
    const distance = body.radius + ball.radius + TACTICAL.gap, world = ball.world || WORLD;
    let x = body.x + Math.cos(this.angle) * distance, y = body.y + Math.sin(this.angle) * distance;
    // Against a touchline the ball slides along it (staying at the same distance from the player).
    const minY = world.top + ball.radius, maxY = world.bottom - ball.radius;
    if (y < minY || y > maxY) {
      y = Math.max(minY, Math.min(maxY, y));
      const dy = y - body.y, side = Math.cos(this.angle) >= 0 ? 1 : -1;
      x = body.x + side * Math.sqrt(Math.max(0, distance * distance - dy * dy));
      this.angle = Math.atan2(y - body.y, x - body.x);
    }
    const inMouth = y > world.goalTop && y < world.goalBottom, minX = world.left + ball.radius, maxX = world.right - ball.radius;
    if (!inMouth && (x < minX || x > maxX)) {
      x = Math.max(minX, Math.min(maxX, x));
      const dx = x - body.x, side = Math.sin(this.angle) >= 0 ? 1 : -1;
      y = Math.max(minY, Math.min(maxY, body.y + side * Math.sqrt(Math.max(0, distance * distance - dx * dx))));
      this.angle = Math.atan2(y - body.y, x - body.x);
    }
    ball.x = x; ball.y = y; ball.vx = body.vx || 0; ball.vy = body.vy || 0; ball.curl = 0;
  }
}

// A kick adds the ball's velocity and part of the kicker's: aim so the result follows `aim`.
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

// Height in the goal: up / down on the stick choose a post; otherwise the spot farthest from the rivals.
export function shotTarget(ball, { world = ball.world || WORLD, attackRight = true, opponents = [], axisY = 0 } = {}) {
  const margin = ball.radius + (world.goalPostRadius || 6) + 10;
  const top = world.goalTop + margin, bottom = world.goalBottom - margin, center = (world.goalTop + world.goalBottom) / 2;
  const x = (attackRight ? world.right : world.left) + (attackRight ? 10 : -10);
  if (axisY < -.3) return { x, y: top, center, post: 'top' };
  if (axisY > .3) return { x, y: bottom, center, post: 'bottom' };
  let best = { y: center, score: -Infinity };
  for (const y of [top, center, bottom]) {
    let gap = 400;
    const dx = x - ball.x, dy = y - ball.y, length = Math.hypot(dx, dy) || 1;
    for (const rival of opponents) {
      if (!rival) continue;
      const along = ((rival.x - ball.x) * dx + (rival.y - ball.y) * dy) / length;
      if (along < 0 || along > length + 20) continue;
      gap = Math.min(gap, Math.abs((rival.x - ball.x) * dy - (rival.y - ball.y) * dx) / length - (rival.radius || 21));
    }
    const score = gap - Math.abs(y - center) * .02;
    if (score > best.score) best = { y, score };
  }
  return { x, y: best.y, center, post: '' };
}

// Where a kick crosses the goal line (null if it never gets there).
export function simulateCross(shooter, ball, aim, power, side, world, attackRight) {
  const shot = predictShot({ ...shooter, shotCooldown: 0 }, ball, aim, power);
  if (!shot) return null;
  const sim = new Ball(ball.x, ball.y); sim.radius = ball.radius; sim.maxSpeed = ball.maxSpeed; sim.world = world;
  sim.vx = shot.vx; sim.vy = shot.vy; sim.curl = curveFor(side, shot);
  const line = attackRight ? world.right : world.left;
  for (let i = 0; i < 480; i++) {
    sim.update(1 / 120);
    if (sim.y < world.top + sim.radius || sim.y > world.bottom - sim.radius) return null;
    if (attackRight ? sim.x >= line : sim.x <= line) return sim.y;
    if (Math.hypot(sim.vx, sim.vy) < 40) return null;
  }
  return null;
}

// Shot at goal: { aim, power, curve }. Curved: with a post chosen the ball bends out towards that post;
// without one it starts outside the far post and bends in.
export function tacticalShot(shooter, ball, { world = ball.world || WORLD, attackRight = true, opponents = [], axisY = 0, curve = false, power = 1 } = {}) {
  const target = shotTarget(ball, { world, attackRight, opponents, axisY });
  if (!curve) return { aim: compensateAim(shooter, ball, { x: target.x - ball.x, y: target.y - ball.y }, power), power, curve: 0, target };
  const margin = ball.radius + (world.goalPostRadius || 6) + 4;
  const wanted = target.post === 'top' ? -1 : target.post === 'bottom' ? 1 : (target.y < target.center ? 1 : target.y > target.center ? -1 : (ball.y < target.center ? 1 : -1));
  const base = Math.atan2(target.y - ball.y, target.x - ball.x);
  let best = null;
  for (const side of [wanted, -wanted]) {
    for (let step = -16; step <= 16; step++) {
      const angle = base + step * .035, aim = { x: Math.cos(angle), y: Math.sin(angle) };
      const y = simulateCross(shooter, ball, aim, power, side, world, attackRight);
      if (y === null || y < world.goalTop + margin || y > world.goalBottom - margin) continue;
      const score = Math.abs(y - target.y) + (side === wanted ? 0 : 25) + (step === 0 ? 8 : 0);
      if (!best || score < best.score) best = { aim, side, score };
    }
  }
  if (!best) return { aim: compensateAim(shooter, ball, { x: target.x - ball.x, y: target.y - ball.y }, power), power, curve: 0, target };
  return { aim: best.aim, power, curve: best.side, target };
}

// Teammate in the pushed direction (±30°), the closest one in angle.
export function passReceiver(passer, mates, direction) {
  const length = Math.hypot(direction.x, direction.y); if (!length) return null;
  const angle = Math.atan2(direction.y, direction.x);
  let best = null;
  for (const mate of mates) {
    if (!mate || mate === passer) continue;
    const off = Math.abs(angleDiff(Math.atan2(mate.y - passer.y, mate.x - passer.x), angle));
    if (off <= TACTICAL.passCone && (!best || off < best.off)) best = { mate, off };
  }
  return best?.mate || null;
}

// Pass (✕) or through pass (△): { aim, power, target, receiver }. With nobody in that direction, a push.
export function tacticalPass(passer, ball, { mates = [], direction = { x: 0, y: 0 }, through = false, world = ball.world || WORLD, attackRight = true } = {}) {
  const dir = Math.hypot(direction.x, direction.y) > .2 ? unit(direction.x, direction.y) : unit(passer.faceX ?? 1, passer.faceY || 0);
  const receiver = passReceiver(passer, mates, dir);
  let target;
  if (receiver) {
    const forward = attackRight ? 1 : -1;
    target = through
      ? { x: receiver.x + forward * 110 + (receiver.vx || 0) * .55, y: receiver.y + (receiver.vy || 0) * .55 }
      : { x: receiver.x + (receiver.vx || 0) * .3, y: receiver.y + (receiver.vy || 0) * .3 };
  } else target = { x: ball.x + dir.x * 120, y: ball.y + dir.y * 120 };
  const pad = ball.radius + 20;
  target.x = Math.max(world.left + pad, Math.min(world.right - pad, target.x));
  target.y = Math.max(world.top + pad, Math.min(world.bottom - pad, target.y));
  const distance = Math.hypot(target.x - ball.x, target.y - ball.y);
  const power = receiver ? Math.max(.42, Math.min(.95, (distance * .72 + 150) / 400)) : TACTICAL.pushPower;
  return { aim: compensateAim(passer, ball, { x: target.x - ball.x, y: target.y - ball.y }, power), power, target, receiver };
}

// Curved pass (good midfielders): find a start angle and spin whose path passes closest to `target`
// (simulated). Returns { aim, curve } or null when a straight pass is better.
export function curvedPassAim(passer, ball, target, power) {
  const base = Math.atan2(target.y - ball.y, target.x - ball.x), world = ball.world || WORLD;
  let best = null;
  for (const side of [1, -1]) for (let step = 2; step <= 18; step++) {
    const angle = base - side * step * .045, aim = { x: Math.cos(angle), y: Math.sin(angle) };
    const shot = predictShot({ ...passer, shotCooldown: 0 }, ball, aim, power); if (!shot) return null;
    const sim = new Ball(ball.x, ball.y); sim.radius = ball.radius; sim.world = world; sim.vx = shot.vx; sim.vy = shot.vy; sim.curl = curveFor(side, shot);
    let closest = Infinity;
    for (let i = 0; i < 240; i++) {
      sim.update(1 / 120);
      if (sim.y < world.top || sim.y > world.bottom || sim.x < world.left || sim.x > world.right) break;
      closest = Math.min(closest, Math.hypot(sim.x - target.x, sim.y - target.y));
      if (Math.hypot(sim.vx, sim.vy) < 60) break;
    }
    // Prefer the gentlest bend that still reaches the target.
    const score = closest + step * 2.5;
    if (closest < 45 && (!best || score < best.score)) best = { aim, curve: side, closest, score };
  }
  return best;
}
