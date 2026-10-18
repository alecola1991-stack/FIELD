import { WORLD } from '../config/settings.js';
import { Ball } from './Ball.js';



export function resolvePlayerWalls(player) {
  const { left, right, top, bottom, centerCircleRadius } = player.world || WORLD, r = player.radius;
  const escape = centerCircleRadius * .5;
  if (player.x - r < left - escape) { player.x = left - escape + r; if (player.vx < 0) player.vx *= -.28; }
  if (player.x + r > right + escape) { player.x = right + escape - r; if (player.vx > 0) player.vx *= -.28; }
  if (player.y - r < top - escape) { player.y = top - escape + r; if (player.vy < 0) player.vy *= -.28; }
  if (player.y + r > bottom + escape) { player.y = bottom + escape - r; if (player.vy > 0) player.vy *= -.28; }
}

export function resolvePlayerPlayers(first, second, onCollision = () => {}) {
  let dx = second.x - first.x, dy = second.y - first.y;
  let distance = Math.hypot(dx, dy);
  const minDistance = first.radius + second.radius;
  if (distance >= minDistance) return false;
  const actualDistance = distance;
  if (distance < .001) {
    // Stable fallback avoids NaNs if two bodies ever land at the same point.
    dx = first.faceX || 1; dy = first.faceY || 0; distance = Math.hypot(dx, dy) || 1;
  }
  const nx = dx / distance, ny = dy / distance;
  const overlap = minDistance - actualDistance;
  first.x -= nx * overlap * .5; first.y -= ny * overlap * .5;
  second.x += nx * overlap * .5; second.y += ny * overlap * .5;

  const closingSpeed = (second.vx - first.vx) * nx + (second.vy - first.vy) * ny;
  if (closingSpeed < 0) {
    // Equal-mass response with a restrained bounce so the players do not stick.
    const impulse = -(1 + .68) * closingSpeed * .5;
    first.vx -= nx * impulse; first.vy -= ny * impulse;
    second.vx += nx * impulse; second.vy += ny * impulse;
  }
  onCollision(Math.abs(closingSpeed));
  return true;
}

export function resolveBallWalls(ball, onWallBounce = () => {}) {
  const world = ball.world || WORLD;
  const onBounce = () => { if (ball.curl) ball.curl *= -.5; onWallBounce(); };
  const { left, right, top, bottom, goalTop, goalBottom, goalBack } = world, r = ball.radius;
  if (ball.y - r < top) { ball.y = top + r; if (ball.vy < 0) { ball.vy *= -.78; onBounce(); } }
  if (ball.y + r > bottom) { ball.y = bottom - r; if (ball.vy > 0) { ball.vy *= -.78; onBounce(); } }
  const mouth = ball.y > goalTop + r * .35 && ball.y < goalBottom - r * .35;
  if (ball.x - r < left && !(mouth && ball.vx < 0)) { ball.x = left + r; if (ball.vx < 0) { ball.vx *= -.8; onBounce(); } }
  if (ball.x + r > right && !(mouth && ball.vx > 0)) { ball.x = right - r; if (ball.vx > 0) { ball.vx *= -.8; onBounce(); } }
  // Rounded posts: resolve them as small circles so shots that clip a post
  // rebound naturally instead of slipping through the corner of the frame.
  const postR = world.goalPostRadius;
  for (const [px, py] of [[left, goalTop], [left, goalBottom], [right, goalTop], [right, goalBottom]]) {
    let dx = ball.x - px, dy = ball.y - py, distance = Math.hypot(dx, dy);
    const minDistance = r + postR;
    if (distance >= minDistance) continue;
    if (distance < .001) { dx = ball.vx < 0 ? 1 : -1; dy = ball.vy < 0 ? 1 : -1; distance = Math.hypot(dx, dy); }
    const nx = dx / distance, ny = dy / distance;
    ball.x = px + nx * minDistance; ball.y = py + ny * minDistance;
    const towardPost = ball.vx * nx + ball.vy * ny;
    if (towardPost < 0) { ball.vx -= 1.72 * towardPost * nx; ball.vy -= 1.72 * towardPost * ny; onBounce(); }
  }
  // Back net, with a small damped rebound to keep missed shots in play.
  if (ball.x < goalBack + r) { ball.x = goalBack + r; if (ball.vx < 0) { ball.vx *= -.62; onBounce(); } }
  if (ball.x > world.width - goalBack - r) { ball.x = world.width - goalBack - r; if (ball.vx > 0) { ball.vx *= -.62; onBounce(); } }
}

export function resolvePlayerBall(player, ball, onHit = () => {}, soft = false) {
  let dx = ball.x - player.x, dy = ball.y - player.y;
  let dist = Math.hypot(dx, dy), min = player.radius + ball.radius;
  if (dist >= min) return false;
  const actualDistance = dist;
  if (dist < .001) { dx = player.faceX ?? 1; dy = player.faceY || 0; if (Math.hypot(dx, dy) < .001) dx = 1; dist = Math.hypot(dx, dy); }
  const nx = dx / dist, ny = dy / dist, overlap = min - actualDistance;
  // Restore the earlier contact response: the ball receives most of the
  // positional correction and ordinary movement can push it more firmly.
  player.x -= nx * overlap * .16; player.y -= ny * overlap * .16;
  ball.x += nx * overlap * .84; ball.y += ny * overlap * .84;
  const rel = (ball.vx - player.vx) * nx + (ball.vy - player.vy) * ny;
  if (rel < 0) {
    ball.curl = 0;
    // Clásico gameplay (soft): gentler touches so the ball does not bounce away while dribbling.
    const impulse = soft ? -rel * 1.04 + 10 : -rel * 1.26 + 41;
    ball.vx += nx * impulse; ball.vy += ny * impulse;
    player.vx -= nx * impulse * .16; player.vy -= ny * impulse * .16;
  }
  onHit(Math.abs(rel));
  return true;
}

// Clásico gameplay: close control. While the player runs with the ball in front of them it stays
// glued to the boot: it is pulled to a point just ahead and takes the player's speed. A shot (recent
// kick), a fast ball arriving or a ball behind/beside the player are left alone.
export const DRIBBLE = Object.freeze({ reach: 16, minSpeed: 45, maxRelative: 280, facing: .3, pull: 15, match: 11 });
export function dribbleAssist(player, ball, dt) {
  if (!player || !ball || dt <= 0 || (player.shotCooldown || 0) > .12) return false;
  const speed = Math.hypot(player.vx || 0, player.vy || 0); if (speed < DRIBBLE.minSpeed) return false;
  const ux = player.vx / speed, uy = player.vy / speed;
  const dx = ball.x - player.x, dy = ball.y - player.y, dist = Math.hypot(dx, dy) || 1;
  const contact = player.radius + ball.radius;
  if (dist > contact + DRIBBLE.reach || (dx * ux + dy * uy) / dist < DRIBBLE.facing) return false;
  if (Math.hypot(ball.vx - player.vx, ball.vy - player.vy) > DRIBBLE.maxRelative) return false;
  const tx = player.x + ux * (contact + 1.5), ty = player.y + uy * (contact + 1.5);
  const pull = 1 - Math.exp(-DRIBBLE.pull * dt), match = 1 - Math.exp(-DRIBBLE.match * dt);
  ball.x += (tx - ball.x) * pull; ball.y += (ty - ball.y) * pull;
  ball.vx += (player.vx - ball.vx) * match; ball.vy += (player.vy - ball.vy) * match;
  ball.curl = 0;
  return true;
}

// Inside the goal after a goal: the net is soft. The ball sinks into the back net (spring)
// and is kept between the side nets. Returns how deep it presses into the back net.
export const NET_MAX_DEPTH = 26;
export function netPressDepth(ball, world = ball.world || WORLD) {
  const { left, right, goalTop, goalBottom, goalBack, width } = world;
  if (ball.y < goalTop || ball.y > goalBottom) return { side: 0, depth: 0 };
  const side = ball.x > right ? 1 : ball.x < left ? -1 : 0;
  if (!side) return { side: 0, depth: 0 };
  const back = side > 0 ? width - goalBack : goalBack, contact = back - side * ball.radius;
  return { side, depth: Math.max(0, (ball.x - contact) * side) };
}
export function resolveBallNet(ball, dt, world = ball.world || WORLD) {
  const { goalTop, goalBottom } = world, r = ball.radius;
  const { side, depth } = netPressDepth(ball, world);
  if (side && depth > 0) {
    // Spring that stretches the net, and strong damping: the net swallows the ball instead of firing it back.
    const outward = ball.vx * side;
    ball.vx += side * (-620 * depth - (outward > 0 ? 6 : 48) * outward) * dt;
    if (depth > NET_MAX_DEPTH) { ball.x -= side * (depth - NET_MAX_DEPTH); if (ball.vx * side > 0) ball.vx = 0; }
    ball.vy *= Math.exp(-4 * dt);
  }
  // Inside the goal the ball dies quickly (it drops in the net).
  if (side) { const drag = Math.exp(-2.2 * dt); ball.vx *= drag; ball.vy *= drag; }
  if (side) {
    if (ball.y < goalTop + r) { ball.y = goalTop + r; if (ball.vy < 0) ball.vy *= -.25; }
    if (ball.y > goalBottom - r) { ball.y = goalBottom - r; if (ball.vy > 0) ball.vy *= -.25; }
  }
  return depth;
}

export function isGoal(ball) {
  const { left, right, goalTop, goalBottom, goalPostRadius } = ball.world || WORLD;
  // A goal counts only when the whole ball clears the rounded posts too.
  const clearance = ball.radius + goalPostRadius;
  const inMouth = ball.y > goalTop + clearance && ball.y < goalBottom - clearance;
  if (!inMouth) return 0;
  if (ball.x + ball.radius < left) return -1;
  if (ball.x - ball.radius > right) return 1;
  return 0;
}

// The visible shooting zone extends beyond the player's body. A ball is
// reachable as soon as any part of its circle intersects this zone.
export const SHOT_REACH = 42;
export function shotRangeRadius(player) { return player.radius + SHOT_REACH; }
export function canKickBall(player, ball) {
  return !!player && !!ball && Math.hypot(ball.x - player.x, ball.y - player.y) - ball.radius <= shotRangeRadius(player) + 1e-7;
}

// Shared by the real shot and its preview, so power, momentum and speed caps agree.
export function predictShot(player, ball, aim = null, powerMultiplier = 1) {
  if (player.shotCooldown > 0 || !canKickBall(player, ball)) return null;
  const dx = ball.x - player.x, dy = ball.y - player.y, dist = Math.hypot(dx, dy);
  const move = Math.hypot(player.vx, player.vy);
  let fx, fy;
  if (aim && Number.isFinite(aim.x) && Number.isFinite(aim.y) && Math.hypot(aim.x, aim.y) > 0) {
    const length = Math.hypot(aim.x, aim.y); fx = aim.x / length; fy = aim.y / length;
  } else if (dist > 1e-7) { fx = dx / dist; fy = dy / dist; }
  else {
    const length = Math.hypot(player.faceX, player.faceY) || 1;
    fx = (player.faceX ?? 1) / length; fy = (player.faceY || 0) / length;
  }
  // Surface distance: maximum bonus at contact, tapering to zero at the reach edge.
  const gap = Math.max(0, dist - player.radius - ball.radius);
  const proximity = Math.max(0, Math.min(1, 1 - gap / SHOT_REACH));
  const bonus = powerMultiplier > 1 ? .30 : .25;
  const strength = (365.5 + Math.min(76.5, move * .17)) * powerMultiplier * (1 + bonus * proximity) * (player.shotPower || 1);
  let vx = ball.vx + fx * strength + player.vx * .187;
  let vy = ball.vy + fy * strength + player.vy * .187;
  const speed = Math.hypot(vx, vy);
  const cap = ball.maxSpeed || Ball.MAX_SPEED;
  if (speed > cap) { vx *= cap / speed; vy *= cap / speed; }
  return { vx, vy };
}

// Curved shots: which way the ball bends, from the shooter's vertical input when the curve key is held.
// Holding down bends it up and holding up bends it down; without an up/down direction the shot is straight.
// Returns +1 (bends down the screen), -1 (bends up) or 0.
export function curveSide(curveHeld, axisY) {
  return curveHeld && Math.abs(Number(axisY) || 0) > .3 ? -Math.sign(axisY) : 0;
}
export function curveFor(side, velocity) {
  return side ? Math.sign(side) * (velocity.vx < 0 ? -1 : 1) * Ball.CURL_RATE : 0;
}

export function kickBall(player, ball, onKick = () => {}, aim = null, powerMultiplier = 1, curve = 0) {
  const shot = predictShot(player, ball, aim, powerMultiplier);
  if (!shot) return false;
  ball.vx = shot.vx; ball.vy = shot.vy; ball.curl = curveFor(curve, shot);
  player.shotCooldown = .36; player.kickScale = .22; ball.kickScale = .18;
  ball.onKicked?.(player); // Táctico gameplay: frees the ball from possession
  onKick(); return true;
}
