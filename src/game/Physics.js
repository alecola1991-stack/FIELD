import { WORLD } from '../config/settings.js';

const GOAL_POSTS = [[WORLD.left, WORLD.goalTop], [WORLD.left, WORLD.goalBottom], [WORLD.right, WORLD.goalTop], [WORLD.right, WORLD.goalBottom]];

export function resolvePlayerWalls(player) {
  const { left, right, top, bottom, centerCircleRadius } = WORLD, r = player.radius;
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
  if (distance < .001) {
    // Stable fallback avoids NaNs if two bodies ever land at the same point.
    dx = first.faceX || 1; dy = first.faceY || 0; distance = Math.hypot(dx, dy) || 1;
  }
  const nx = dx / distance, ny = dy / distance;
  const overlap = minDistance - distance;
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

export function resolveBallWalls(ball, onBounce = () => {}) {
  const { left, right, top, bottom, goalTop, goalBottom, goalBack } = WORLD, r = ball.radius;
  if (ball.y - r < top) { ball.y = top + r; if (ball.vy < 0) { ball.vy *= -.78; onBounce(); } }
  if (ball.y + r > bottom) { ball.y = bottom - r; if (ball.vy > 0) { ball.vy *= -.78; onBounce(); } }
  const mouth = ball.y > goalTop + r * .35 && ball.y < goalBottom - r * .35;
  if (ball.x - r < left && !(mouth && ball.vx < 0)) { ball.x = left + r; if (ball.vx < 0) { ball.vx *= -.8; onBounce(); } }
  if (ball.x + r > right && !(mouth && ball.vx > 0)) { ball.x = right - r; if (ball.vx > 0) { ball.vx *= -.8; onBounce(); } }
  // Rounded posts: resolve them as small circles so shots that clip a post
  // rebound naturally instead of slipping through the corner of the frame.
  const postR = WORLD.goalPostRadius;
  for (const [px, py] of GOAL_POSTS) {
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
  if (ball.x > WORLD.width - goalBack - r) { ball.x = WORLD.width - goalBack - r; if (ball.vx > 0) { ball.vx *= -.62; onBounce(); } }
}

export function resolvePlayerBall(player, ball, onHit = () => {}) {
  let dx = ball.x - player.x, dy = ball.y - player.y;
  let dist = Math.hypot(dx, dy), min = player.radius + ball.radius;
  if (dist >= min) return false;
  if (dist < .001) { dx = player.faceX; dy = player.faceY; dist = Math.hypot(dx, dy) || 1; }
  const nx = dx / dist, ny = dy / dist, overlap = min - dist;
  // Restore the earlier contact response: the ball receives most of the
  // positional correction and ordinary movement can push it more firmly.
  player.x -= nx * overlap * .16; player.y -= ny * overlap * .16;
  ball.x += nx * overlap * .84; ball.y += ny * overlap * .84;
  const rel = (ball.vx - player.vx) * nx + (ball.vy - player.vy) * ny;
  if (rel < 0) {
    const impulse = -rel * 1.26 + 41;
    ball.vx += nx * impulse; ball.vy += ny * impulse;
    player.vx -= nx * impulse * .16; player.vy -= ny * impulse * .16;
  }
  onHit(Math.abs(rel));
  return true;
}

export function isGoal(ball) {
  const { left, right, goalTop, goalBottom, goalPostRadius } = WORLD;
  // A goal counts only when the whole ball clears the rounded posts too.
  const clearance = ball.radius + goalPostRadius;
  const inMouth = ball.y > goalTop + clearance && ball.y < goalBottom - clearance;
  if (!inMouth) return 0;
  if (ball.x + ball.radius < left) return -1;
  if (ball.x - ball.radius > right) return 1;
  return 0;
}

export function kickBall(player, ball, onKick = () => {}, aim = null, powerMultiplier = 1) {
  if (player.shotCooldown > 0) return false;
  const dx = ball.x - player.x, dy = ball.y - player.y, dist = Math.hypot(dx, dy);
  if (dist > player.radius + ball.radius + 37) return false;
  const move = Math.hypot(player.vx, player.vy);
  let fx, fy;
  if (aim && Number.isFinite(aim.x) && Number.isFinite(aim.y)) {
    const aimLength = Math.hypot(aim.x, aim.y) || 1; fx = aim.x / aimLength; fy = aim.y / aimLength;
  } else {
    // A player strike sends the ball away from the player's center. Movement
    // keys and facing direction do not aim the shot.
    fx = dx / (dist || 1); fy = dy / (dist || 1);
  }
  const strength = (365.5 + Math.min(76.5, move * .17)) * powerMultiplier;
  ball.vx += fx * strength + player.vx * .187;
  ball.vy += fy * strength + player.vy * .187;
  const speed = Math.hypot(ball.vx, ball.vy); if (speed > 663) { ball.vx *= 663 / speed; ball.vy *= 663 / speed; }
  player.shotCooldown = .36; player.kickScale = .22; ball.kickScale = .18;
  onKick(); return true;
}
