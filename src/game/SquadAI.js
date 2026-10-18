import { BotAI } from './BotAI.js';
import { BOT_LEVELS, WORLD } from '../config/settings.js';
import { canKickBall } from './Physics.js';

// AI for offline 2v2. Bodies come in seat order: [human, teammate, rival A, rival B].
// The left team (human + teammate) attacks the right goal; the rivals attack the left one.
//
// Teammate: defends when the rivals have the ball, gets open ahead of the human when
// the human has it, and when it has the ball looks for the human first: from its own
// half to a human in the rival half it plays a strong pass, direct or off a wall,
// aimed just in front of the human towards goal so it can be struck first time.
//
// Rivals: always one keeper and one forward (whatever the difficulty). The keeper
// guards the goal and feeds the forward; the forward presses high, waits up the
// pitch for the ball, dribbles, plays the ball off the walls and passes back when
// it is closed down.

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const unit = (x, y) => { const length = Math.hypot(x, y) || 1; return { x: x / length, y: y / length }; };
const WALL_RESTITUTION = .78; // vertical speed kept by the touchlines (resolveBallWalls)
const BALL_DRAG = .72;        // Ball.update: speed lost per pixel travelled
// The 1v1 bot always attacks the left goal: mirror the world to drive the left team with it.
const mirror = (body, width) => body && ({ x: width - body.x, y: body.y, vx: -(body.vx || 0), vy: body.vy || 0, radius: body.radius, world: body.world, maxSpeed: body.maxSpeed, shotCooldown: body.shotCooldown, speedScale: body.speedScale });
const unmirror = decision => ({ ...decision, x: -decision.x, kickDirection: decision.kickDirection ? { x: -decision.kickDirection.x, y: decision.kickDirection.y } : null });

// Precision of the teammate's passes and shots by its own difficulty (pixels of error at the target).
const MATE_ERROR = Object.freeze({ easy: 54, normal: 34, hard: 20, pro: 10, champions: 4, legend: 4 });
export const MATE_LEVEL = Object.freeze({ easy: 'normal', normal: 'normal', hard: 'hard', pro: 'pro', champions: 'pro', legend: 'pro' });
// Passing and wall play of the rivals by difficulty (they always pass and use walls; better levels do it more and more precisely).
const RIVAL_PLAY = Object.freeze({
  easy: { passError: 60, wallChance: .3, shootRange: 300 },
  normal: { passError: 40, wallChance: .42, shootRange: 330 },
  hard: { passError: 26, wallChance: .55, shootRange: 360 },
  pro: { passError: 16, wallChance: .68, shootRange: 390 },
  champions: { passError: 8, wallChance: .8, shootRange: 420 },
  legend: { passError: 6, wallChance: .8, shootRange: 430 },
});

export class SquadAI {
  constructor({ difficulty = 'normal', rivalStars = 3, mateStars = 3, mateLevel = MATE_LEVEL[difficulty] || 'normal' } = {}) {
    this.difficulty = difficulty in BOT_LEVELS ? difficulty : 'normal';
    this.mateLevel = mateLevel in BOT_LEVELS ? mateLevel : 'normal';
    this.mateBot = new BotAI(this.mateLevel); this.mateBot.setTeamStrength(mateStars);
    this.rivalStars = rivalStars;
    this.rivalKeeper = 0; this.mateChasing = false; this.passCooldown = 0; this.rivalPassCooldown = 0; this.rivalWallCooldown = 0;
    this.lastPass = null; this.lastRivalPass = null; this.looseTime = 0;
    this.random = Math.random;
  }

  // Returns one command per seat 1..3: { x, y, speed, kick, aim, power }.
  update(bodies, ball, dt) {
    this.passCooldown = Math.max(0, this.passCooldown - dt);
    this.rivalPassCooldown = Math.max(0, this.rivalPassCooldown - dt);
    this.rivalWallCooldown = Math.max(0, this.rivalWallCooldown - dt);
    const world = ball.world || WORLD;
    this.trackTouches(bodies, ball, dt);
    // How long the ball has been loose: slow and nobody on it.
    const free = Math.hypot(ball.vx, ball.vy) < 90 && bodies.every(body => dist(body, ball) > body.radius + ball.radius + 22);
    this.looseTime = free ? this.looseTime + dt : 0;
    const commands = { 1: this.teammate(bodies, ball, dt, world), ...this.rivals(bodies, ball, dt, world) };
    this.unjam(commands, bodies, ball, dt, world);
    // Near a touchline, never aim into the wall unless it is a planned bank: the ball would stay pinned there.
    const edge = ball.radius + 34;
    for (const seat of [1, 2, 3]) {
      const command = commands[seat], aim = command?.aim; if (!command?.kick || !aim || command.bank) continue;
      if (ball.y < world.top + edge && aim.y < 0) aim.y = Math.abs(aim.x) * .35;
      if (ball.y > world.bottom - edge && aim.y > 0) aim.y = -Math.abs(aim.x) * .35;
    }
    // The teammate aims where it wants the ball to go: correct for the ball's and its own motion.
    const mateCommand = commands[1];
    if (mateCommand?.kick && mateCommand.aim && !mateCommand.compensated) mateCommand.aim = this.compensateAim(bodies[1], ball, mateCommand.aim, mateCommand.power ?? 1);
    return commands;
  }

  // A kick adds to the ball's current velocity (and a bit of the kicker's), see predictShot. To send the
  // ball along `aim`, kick in the direction that cancels that drift.
  compensateAim(body, ball, aim, power = 1) {
    const d = unit(aim.x, aim.y);
    const gap = Math.max(0, dist(body, ball) - body.radius - ball.radius), proximity = clamp(1 - gap / 42, 0, 1);
    const move = Math.hypot(body.vx || 0, body.vy || 0);
    const strength = (365.5 + Math.min(76.5, move * .17)) * power * (1 + (power > 1 ? .30 : .25) * proximity) * (body.shotPower || 1);
    const wx = (ball.vx || 0) + (body.vx || 0) * .187, wy = (ball.vy || 0) + (body.vy || 0) * .187;
    const along = d.x * wx + d.y * wy, disc = along * along - (wx * wx + wy * wy) + strength * strength;
    if (disc <= 0) return aim;
    const k = along + Math.sqrt(disc);
    return { x: (k * d.x - wx) / strength, y: (k * d.y - wy) / strength };
  }

  // Who touched the ball last (seat index) and who before them, to know when a ball comes from the human.
  trackTouches(bodies, ball, dt) {
    this.touchTime = (this.touchTime || 0) + dt;
    let toucher = -1, best = Infinity;
    bodies.forEach((body, seat) => { const d = dist(body, ball); if (d < body.radius + ball.radius + 6 && d < best) { best = d; toucher = seat; } });
    if (toucher >= 0 && toucher !== this.lastToucher) { this.prevToucher = this.lastToucher ?? -1; this.lastToucher = toucher; this.touchTime = 0; }
  }

  // Best direct shot at the right goal: the aim point (near post, centre, far post) whose lane is clearest.
  shotLine(ball, rivals, world, minMargin = -6, shotSpeed = 820) {
    // Aim points along the goal mouth (keeping clear of the posts). Each rival gets a reach: how far it can
    // move before the ball passes it. The best aim is the one that beats every rival by the widest margin.
    const clearance = ball.radius + (world.goalPostRadius || 6) + 10;
    let best = null;
    for (let y = world.goalTop + clearance; y <= world.goalBottom - clearance + .1; y += 12) {
      const aim = { x: world.right + 6, y };
      const lx = aim.x - ball.x, ly = aim.y - ball.y, length = Math.hypot(lx, ly) || 1, length2 = length * length;
      let margin = Infinity;
      for (const rival of rivals) {
        const t = clamp(((rival.x - ball.x) * lx + (rival.y - ball.y) * ly) / length2, 0, 1);
        const gap = Math.hypot(ball.x + lx * t - rival.x, ball.y + ly * t - rival.y) - rival.radius - ball.radius;
        const reach = (BOT_LEVELS[this.difficulty]?.speed || 220) * .85 * (t * length / shotSpeed) + 4;
        margin = Math.min(margin, gap - reach);
      }
      if (!best || margin > best.margin) best = { aim: { x: lx, y: ly }, margin };
    }
    return best && best.margin > minMargin ? best : null;
  }

  // Four bodies can trap the ball against a wall or in a corner. When it has barely
  // moved for a while, whoever reaches it first plays it out to open space and the
  // others give room.
  unjam(commands, bodies, ball, dt, world) {
    const ref = this.stall;
    if (!ref || Math.hypot(ball.x - ref.x, ball.y - ref.y) > 45) { this.stall = { x: ball.x, y: ball.y, time: 0 }; return; }
    ref.time += dt;
    if (ref.time < 1.6) return;
    const centerY = world.height / 2;
    for (const seat of [1, 2, 3]) {
      const body = bodies[seat], ours = seat < 2, command = commands[seat];
      if (canKickBall(body, ball) && body.shotCooldown <= 0) {
        const target = { x: world.width * (ours ? .72 : .28), y: centerY + (ball.y < centerY ? 60 : -60) };
        commands[seat] = { x: 0, y: 0, speed: command?.speed ?? 1, kick: true, aim: { x: target.x - ball.x, y: target.y - ball.y }, power: .85 };
        this.stall = { x: ball.x, y: ball.y, time: 0 };
      } else if (dist(body, ball) < 90) {
        commands[seat] = this.moveTo(body, { x: body.x + (world.width / 2 - body.x) * .4, y: body.y + (centerY - body.y) * .5 }, command?.speed ?? 1);
      }
    }
  }

  speedFor(level, body) {
    const config = BOT_LEVELS[level] || BOT_LEVELS.normal;
    return clamp(config.speed * (body.speedScale || 1) / (body.maxSpeed || 280), .3, 1.1);
  }

  moveTo(body, target, speed, slowRadius = 34) {
    const dx = target.x - body.x, dy = target.y - body.y, distance = Math.hypot(dx, dy);
    if (distance < 8) return { x: 0, y: 0, speed, kick: false };
    const scale = distance < slowRadius ? Math.max(.35, distance / slowRadius) : 1;
    return { x: dx / distance * scale, y: dy / distance * scale, speed, kick: false };
  }

  // Free path: no opponent close to the segment.
  laneOpen(from, to, opponents, margin = 42) {
    const lx = to.x - from.x, ly = to.y - from.y, length2 = lx * lx + ly * ly || 1;
    return opponents.every(body => {
      const t = clamp(((body.x - from.x) * lx + (body.y - from.y) * ly) / length2, 0, 1);
      return Math.hypot(from.x + lx * t - body.x, from.y + ly * t - body.y) > margin + body.radius;
    });
  }

  // Kick power so the ball still arrives with `arrival` speed after `length` pixels (Ball drag is linear in distance).
  passPower(length, arrival = 210) { return clamp((arrival + BALL_DRAG * length) / 430, .5, 1.3); }

  // Best trajectory from the ball to `target`: direct, or off the top/bottom wall when that lane is
  // clearer. Returns { aim, length, bank } or null when every lane is blocked.
  bestPassLine(ball, target, opponents, world, margin = 40) {
    const options = [];
    if (this.laneOpen(ball, target, opponents, margin)) options.push({ aim: { x: target.x - ball.x, y: target.y - ball.y }, length: dist(ball, target), bank: false, score: 0 });
    for (const wallY of [world.top + ball.radius, world.bottom - ball.radius]) {
      // Mirror the target across the wall, stretched by the lost vertical speed.
      const mirroredY = wallY + (wallY - target.y) / WALL_RESTITUTION;
      const t = (wallY - ball.y) / (mirroredY - ball.y);
      if (!(t > .12 && t < .88)) continue;
      const bounce = { x: ball.x + (target.x - ball.x) * t, y: wallY };
      if (bounce.x < world.left + 40 || bounce.x > world.right - 40) continue;
      if (!this.laneOpen(ball, bounce, opponents, margin - 6) || !this.laneOpen(bounce, target, opponents, margin - 6)) continue;
      options.push({ aim: { x: bounce.x - ball.x, y: bounce.y - ball.y }, length: (dist(ball, bounce) + dist(bounce, target)) * 1.12, bank: true, score: 60 });
    }
    if (!options.length) return null;
    options.sort((a, b) => (a.length + a.score) - (b.length + b.score));
    return options[0];
  }

  // ---- Teammate (left team, attacks the right goal) ----------------------------
  // Clásico controls: the human just passed (L / ✕) towards `target`. For a moment the teammate
  // runs onto the ball's path wherever it is on the pitch (not only in the rival half).
  expectPass(target) { this.humanPass = { target: target ? { x: target.x, y: target.y } : null, time: 1.6 }; }

  teammate(bodies, ball, dt, world) {
    const [human, mate, ...rivals] = bodies, W = world.width, centerY = world.height / 2;
    const speed = this.speedFor(this.mateLevel, mate);
    if (this.humanPass) {
      this.humanPass.time -= dt;
      const ballSpeed = Math.hypot(ball.vx, ball.vy);
      const rivalTouched = this.lastToucher >= 2 && (this.touchTime || 0) < 1.6 - this.humanPass.time;
      if (this.humanPass.time <= 0 || canKickBall(mate, ball) || rivalTouched || ballSpeed < 40) this.humanPass = null;
      else {
        // Meet the ball where its path passes closest to the teammate, a little ahead so it arrives running.
        const path = { x: ball.vx / ballSpeed, y: ball.vy / ballSpeed };
        const along = Math.max(30, (mate.x - ball.x) * path.x + (mate.y - ball.y) * path.y);
        const meet = { x: ball.x + path.x * along, y: ball.y + path.y * along };
        const goal = this.humanPass.target && dist(this.humanPass.target, meet) < 160 ? this.humanPass.target : meet;
        const pad = mate.radius + 6;
        return this.moveTo(mate, { x: clamp(goal.x, world.left + pad, world.right - pad), y: clamp(goal.y, world.top + pad, world.bottom - pad) }, speed, 3);
      }
    }
    const humanBall = dist(human, ball), mateBall = dist(mate, ball);
    const rivalBall = Math.min(...rivals.map(rival => dist(rival, ball)));
    const humanHasBall = humanBall < human.radius + ball.radius + 20;
    // A loose ball the human is not going for: the teammate fetches it.
    const humanGoing = ((human.vx || 0) * (ball.x - human.x) + (human.vy || 0) * (ball.y - human.y)) / (humanBall || 1) > 70;
    const fetch = this.looseTime > .5 && !humanGoing && mateBall < humanBall + 220;
    this.mateChasing = !humanHasBall && (fetch || (this.mateChasing ? mateBall < humanBall + 30 : mateBall < humanBall - 30));
    const nearestRival = rivals.reduce((best, rival) => dist(rival, ball) < dist(best, ball) ? rival : best, rivals[0]);

    // A ball from the human in the rival half with a shot on: always shoot, first time or after the first touch.
    const fromHuman = (this.lastToucher === 0 && humanBall > human.radius + ball.radius + 20) || (this.lastToucher === 1 && this.prevToucher === 0 && this.touchTime < 2);
    // Receiving the human's pass in the rival half: stand beside the line, on the side away from goal, so the ball
    // runs past the body (not into it) and can be struck first time towards goal.
    const passSpeed = Math.hypot(ball.vx, ball.vy);
    if (this.lastToucher === 0 && humanBall > human.radius + ball.radius + 20 && passSpeed > 150 && !canKickBall(mate, ball)) {
      const path = { x: ball.vx / passSpeed, y: ball.vy / passSpeed };
      const along = (mate.x - ball.x) * path.x + (mate.y - ball.y) * path.y;
      const meet = { x: ball.x + path.x * along, y: ball.y + path.y * along };
      const inside = meet.x > W / 2 && meet.x < world.right - 30 && meet.y > world.top + 30 && meet.y < world.bottom - 30;
      if (along > 40 && dist(mate, meet) < 130 && inside) {
        const toGoal = unit(world.right + 4 - meet.x, centerY - meet.y);
        let side = { x: -path.y, y: path.x };
        if (side.x * toGoal.x + side.y * toGoal.y > 0) side = { x: -side.x, y: -side.y };
        const offset = mate.radius + ball.radius + 8;
        return this.moveTo(mate, { x: meet.x + side.x * offset, y: meet.y + side.y * offset }, speed, 3);
      }
    }
    if (fromHuman && ball.x > W / 2 && canKickBall(mate, ball) && mate.shotCooldown <= 0) {
      const shot = this.shotLine(ball, rivals, world, -30);
      if (shot) {
        // Timing: let an incoming ball come onto the foot (full power, clean contact) unless a rival is closing in.
        const gap = mateBall - mate.radius - ball.radius;
        const incoming = ((ball.vx - (mate.vx || 0)) * (mate.x - ball.x) + (ball.vy - (mate.vy || 0)) * (mate.y - ball.y)) / (mateBall || 1);
        const pressure = rivals.some(rival => dist(rival, ball) < rival.radius + ball.radius + 55);
        // Hold still (stepping into it makes the ball bounce off the body) and strike one frame before contact.
        if (gap > 14 + incoming * dt * 2.5 && incoming > 60 && !pressure) return { x: 0, y: 0, speed: 0, kick: false };
        // Aim error is applied at the goal mouth, so better levels pick their corner.
        const error = (MATE_ERROR[this.mateLevel] ?? 20) * .8, safe = ball.radius + (world.goalPostRadius || 6) + 6;
        const target = { x: ball.x + shot.aim.x, y: clamp(ball.y + shot.aim.y + (this.random() - .5) * error, world.goalTop + safe, world.goalBottom - safe) };
        const aim = this.compensateAim(mate, ball, { x: target.x - ball.x, y: target.y - ball.y }, 1.45);
        // The kick must send the ball away from the body; otherwise get behind the ball first.
        const away = unit(ball.x - mate.x, ball.y - mate.y), dir = unit(aim.x, aim.y);
        if (dir.x * away.x + dir.y * away.y < .3) {
          const toGoal = unit(world.right + 4 - ball.x, world.height / 2 - ball.y), contact = mate.radius + ball.radius + 4;
          const ballSpeed = Math.hypot(ball.vx, ball.vy);
          // Ball running past the body towards goal: step out of its path if needed, then wait for it to come by.
          if (ballSpeed > 110 && ball.vx * toGoal.x + ball.vy * toGoal.y > -.2 * ballSpeed) {
            const path = { x: ball.vx / ballSpeed, y: ball.vy / ballSpeed };
            const side = (mate.x - ball.x) * -path.y + (mate.y - ball.y) * path.x, ahead = (mate.x - ball.x) * path.x + (mate.y - ball.y) * path.y;
            if (ahead > 0 && Math.abs(side) < mate.radius + ball.radius + 2) {
              const sign = side >= 0 ? 1 : -1;
              return this.moveTo(mate, { x: mate.x - path.y * sign * 40, y: mate.y + path.x * sign * 40 }, speed, 4);
            }
            if (ahead > -mate.radius) return { x: 0, y: 0, speed: 0, kick: false };
          }
          return this.moveTo(mate, { x: ball.x - toGoal.x * contact, y: ball.y - toGoal.y * contact }, speed, 8);
        }
        this.lastShot = { fromHuman: true };
        return { x: 0, y: 0, speed, kick: true, aim, power: 1.45, shot: true, compensated: true };
      }
    }

    // A rival controls the ball: stay goal side and contain instead of diving in (it is often the last defender).
    const rivalControl = !humanHasBall && rivals.some(rival => dist(rival, ball) < rival.radius + ball.radius + 20);
    if (rivalControl) {
      if (canKickBall(mate, ball) && mate.shotCooldown <= 0) return this.clear(mate, ball, rivals, human, world, speed);
      if (ball.x < W * .62) {
        const ownGoal = { x: world.left, y: centerY }, toGoal = unit(ownGoal.x - ball.x, ownGoal.y - ball.y);
        const gap = clamp(dist(ball, ownGoal) * .35, 40, 110);
        return this.moveTo(mate, { x: ball.x + toGoal.x * gap, y: ball.y + toGoal.y * gap }, speed, 14);
      }
      return this.moveTo(mate, { x: W * .36, y: clamp(centerY + (ball.y - centerY) * .4, world.top + 60, world.bottom - 60) }, speed * .9);
    }

    if (this.mateChasing) {
      // With the ball at its feet: look for the human first.
      if (canKickBall(mate, ball) && mate.shotCooldown <= 0 && this.passCooldown <= 0) {
        const pass = this.passTo(mate, human, ball, rivals, world);
        if (pass) return pass;
      }
      // From our half towards a human waiting in the rival half: carry the ball towards a passing lane.
      if (ball.x < W / 2 && human.x > W / 2 && mateBall < mate.radius + ball.radius + 30) {
        const away = Math.abs(nearestRival.y - ball.y) < 60 ? (ball.y > nearestRival.y ? 1 : -1) * 40 : 0;
        const lane = { x: ball.x - 18, y: clamp(ball.y + away, world.top + 40, world.bottom - 40) };
        const toward = unit(human.x - ball.x, human.y - ball.y);
        const behind = { x: lane.x - toward.x * 22, y: lane.y - toward.y * 22 };
        if (dist(mate, behind) > 16) return this.moveTo(mate, behind, speed, 10);
        return { x: toward.x, y: toward.y, speed: speed * .9, kick: false };
      }
      // Far from the ball: run to it, arriving from behind so the first touch goes forward.
      if (mateBall > mate.radius + ball.radius + 34) {
        const forward = unit(world.right + 4 - ball.x, centerY - ball.y);
        return this.moveTo(mate, { x: ball.x - forward.x * (mate.radius + ball.radius + 4), y: ball.y - forward.y * (mate.radius + ball.radius + 4) }, speed, 10);
      }
      const decision = unmirror(this.mateBot.update(mirror(mate, W), mirror(ball, W), mirror(nearestRival, W), dt));
      const shooting = decision.kick && decision.kickDirection && decision.kickDirection.x > 0
        && Math.abs(ball.y + decision.kickDirection.y / decision.kickDirection.x * (world.right - ball.x) - centerY) < (world.goalBottom - world.goalTop) / 2 + 40;
      if (shooting) {
        // Its own shots: pick the corner the keeper cannot reach; with no real chance, keep the ball and open an angle.
        const shot = this.shotLine(ball, rivals, world);
        if (shot) {
          const error = (MATE_ERROR[this.mateLevel] ?? 20) * .8, safe = ball.radius + (world.goalPostRadius || 6) + 6;
          const target = { x: ball.x + shot.aim.x, y: clamp(ball.y + shot.aim.y + (this.random() - .5) * error, world.goalTop + safe, world.goalBottom - safe) };
          return { x: 0, y: 0, speed, kick: true, aim: { x: target.x - ball.x, y: target.y - ball.y }, power: 1.35, shot: true };
        }
        if (ball.x > W * .6) {
          const keeper = rivals.reduce((best, rival) => rival.x > best.x ? rival : best, rivals[0]);
          const side = ball.y >= keeper.y ? 1 : -1;
          return this.moveTo(mate, { x: ball.x - 24, y: clamp(ball.y - side * 30, world.top + 40, world.bottom - 40) }, speed, 8);
        }
      }
      return { x: decision.x, y: decision.y, speed: decision.speedMultiplier ?? speed, kick: !!decision.kick, aim: decision.kickDirection, power: 1 };
    }

    // Ball loose or with a rival close to it: defend.
    const rivalsOnBall = rivalBall < Math.min(humanBall, mateBall) - 10 || (!humanHasBall && ball.vx < -120);
    if (rivalsOnBall) {
      if (ball.x < W * .58) {
        // Keeper between the ball and our goal, a little in front of the line.
        const target = { x: clamp(world.left + 70 + (ball.x - world.left) * .2, world.left + mate.radius, W * .3), y: clamp(centerY + (ball.y - centerY) * .62, world.goalTop + 16, world.goalBottom - 16) };
        if (mateBall < 120 && ball.x < W * .4) return this.clear(mate, ball, rivals, human, world, speed);
        return this.moveTo(mate, target, speed);
      }
      return this.moveTo(mate, { x: W * .36, y: clamp(centerY + (ball.y - centerY) * .4, world.top + 60, world.bottom - 60) }, speed * .9);
    }

    // The human has (or is about to have) the ball: offer a pass ahead, on the other lane.
    if (canKickBall(mate, ball) && mate.shotCooldown <= 0) {
      const pass = this.passTo(mate, human, ball, rivals, world);
      if (pass) return pass;
    }
    const lane = ball.y < centerY ? 1 : -1;
    let target = {
      x: clamp(Math.max(ball.x + 170, human.x + 120), world.left + 160, world.right - 140),
      y: clamp(centerY + lane * Math.max(110, Math.abs(ball.y - centerY) * .7), world.top + 50, world.bottom - 50),
    };
    const marker = rivals.find(rival => dist(rival, target) < 75);
    if (marker) target = { x: target.x, y: clamp(target.y + (target.y >= marker.y ? 85 : -85), world.top + 50, world.bottom - 50) };
    if (dist(mate, human) < mate.radius + human.radius + 26) target = { x: target.x, y: target.y + (mate.y >= human.y ? 60 : -60) };
    return this.moveTo(mate, target, speed);
  }

  // Where the human should receive: just in front of them, on the line towards the goal,
  // plus where they are running. Then they can strike first time.
  receivePoint(human, world, lead = .3) {
    const goal = { x: world.right + 4, y: world.height / 2 };
    const toGoal = unit(goal.x - human.x, goal.y - human.y);
    return { x: clamp(human.x + toGoal.x * 34 + (human.vx || 0) * lead, world.left + 30, world.right - 30), y: clamp(human.y + toGoal.y * 34 + (human.vy || 0) * lead, world.top + 24, world.bottom - 24) };
  }

  // Pass to the human. From our half to a human in the rival half it is a priority:
  // a strong pass along the best line (direct or off a wall). Otherwise it passes when
  // the human is ahead or freer and the teammate cannot score itself.
  passTo(mate, human, ball, rivals, world) {
    const W = world.width, distance = dist(ball, human);
    if (distance < 90 || distance > 820) return null;
    const longBall = ball.x < W / 2 && human.x > W / 2;
    const goalDistance = Math.hypot(world.right - human.x, world.height / 2 - human.y);
    const wellPlaced = human.x > W * .55 && goalDistance < 560 && Math.abs(human.y - world.height / 2) < 230 && rivals.every(rival => dist(rival, human) > 60);
    if (!longBall) {
      if (distance > 560) return null;
      const ahead = human.x - ball.x;
      const humanFree = rivals.every(rival => dist(rival, human) > 70);
      const mateBlocked = rivals.some(rival => rival.x > mate.x && Math.abs(rival.y - mate.y) < 60 && rival.x - mate.x < 150);
      const mateNearGoal = world.right - ball.x < 260 && Math.abs(ball.y - world.height / 2) < 150;
      if (mateNearGoal && !mateBlocked && !wellPlaced) return null;
      if (!(ahead > 40 || mateBlocked || (humanFree && ahead > -60) || wellPlaced)) return null;
    }
    const target = wellPlaced || longBall ? this.receivePoint(human, world, longBall ? .45 : .32) : { x: human.x + (human.vx || 0) * .32, y: human.y + (human.vy || 0) * .32 };
    const error = MATE_ERROR[this.mateLevel] ?? 20;
    target.x += (this.random() - .5) * error; target.y += (this.random() - .5) * error;
    const line = this.bestPassLine(ball, target, rivals, world, longBall ? 34 : 40);
    if (!line) return null;
    this.passCooldown = longBall ? .8 : 1.1; this.lastPass = { x: target.x, y: target.y, bank: line.bank, long: longBall };
    // Strong pass: arrives with pace so it is not intercepted, but controllable for a first-time shot.
    const power = longBall || wellPlaced ? this.passPower(line.length, 240) : clamp(.42 + distance / 1100, .45, .82);
    return { x: 0, y: 0, speed: 1, kick: true, aim: line.aim, power, pass: true, bank: line.bank };
  }

  // Clearance from defence: to the human if possible, else up the far wing.
  clear(mate, ball, rivals, human, world, speed) {
    if (canKickBall(mate, ball) && mate.shotCooldown <= 0) {
      const pass = this.passTo(mate, human, ball, rivals, world);
      if (pass) return pass;
      const wing = ball.y < world.height / 2 ? world.bottom - 80 : world.top + 80;
      return { x: 0, y: 0, speed, kick: true, aim: { x: world.width * .62 - ball.x, y: wing - ball.y }, power: .9 };
    }
    const target = { x: ball.x - mate.radius - ball.radius - 6, y: ball.y };
    return this.moveTo(mate, target, speed, 10);
  }

  // ---- Rivals (right team, attack the left goal) -------------------------------
  // Two fixed roles. The defender guards its half: when we have the ball there it cuts the
  // passing line between the human and the teammate (or blocks the shot near goal) and feeds
  // the striker when it wins the ball. The striker waits in our half, in the free lane, to
  // receive and shoot. Roles swap only if the defender ends up clearly ahead of the striker.
  rivals(bodies, ball, dt, world) {
    const [human, mate, ...rivals] = bodies, W = world.width, centerY = world.height / 2;
    const config = BOT_LEVELS[this.difficulty], play = RIVAL_PLAY[this.difficulty] || RIVAL_PLAY.normal;
    let keeper = this.rivalKeeper;
    if (rivals[keeper].x < rivals[1 - keeper].x - 90) keeper = this.rivalKeeper = 1 - keeper;
    const forward = 1 - keeper, K = rivals[keeper], F = rivals[forward];
    const ours = [human, mate];
    const reach = body => body.radius + ball.radius + 20;
    const nearestOurs = ours.reduce((best, body) => dist(body, ball) < dist(best, ball) ? body : best, ours[0]);
    const ourOnBall = dist(nearestOurs, ball) < reach(nearestOurs) ? nearestOurs : null;
    const commands = {};
    const keeperSpeed = this.speedFor(this.difficulty, K), forwardSpeed = this.speedFor(this.difficulty, F);
    const keeperHasBall = dist(K, ball) < reach(K);
    const forwardHasBall = dist(F, ball) < reach(F);
    const ourBall = ourOnBall || (!keeperHasBall && !forwardHasBall && dist(nearestOurs, ball) < Math.min(dist(K, ball), dist(F, ball)) - 20);

    // Defender.
    if (keeperHasBall) commands[2 + keeper] = this.rivalCarry(K, F, ball, ours, world, play, config, keeperSpeed, true);
    else if (canKickBall(K, ball) && K.shotCooldown <= 0 && !ourOnBall) commands[2 + keeper] = this.rivalCarry(K, F, ball, ours, world, play, config, keeperSpeed, true);
    else if (!ourBall && ball.x > W * .5 && dist(K, ball) < dist(nearestOurs, ball) + 30 && dist(K, ball) <= dist(F, ball)) {
      // Loose ball in its half: win it, coming from the goal side.
      commands[2 + keeper] = this.moveTo(K, { x: ball.x + K.radius + ball.radius - 4, y: ball.y }, keeperSpeed, 10);
    } else if (ourBall && ball.x > W * .45) {
      const carrier = nearestOurs, receiver = carrier === human ? mate : human;
      const goalDistance = Math.hypot(world.right - ball.x, centerY - ball.y);
      if (goalDistance < 220 + config.defense * 140 || ball.x > world.right - 150) {
        // Close to goal: block the shot, between the ball and the goal.
        const toBall = unit(ball.x - world.right, ball.y - centerY);
        commands[2 + keeper] = this.moveTo(K, { x: clamp(world.right + toBall.x * 70, W * .72, world.right - K.radius), y: clamp(centerY + toBall.y * 70, world.goalTop + 10, world.goalBottom - 10) }, keeperSpeed, 12);
        if (dist(K, ball) < 90 && canKickBall(K, ball) && K.shotCooldown <= 0) commands[2 + keeper] = this.rivalCarry(K, F, ball, ours, world, play, config, keeperSpeed, true);
      } else {
        // Cut the passing line between the carrier and its partner, nearer the receiver, inside its half.
        const cut = { x: carrier.x + (receiver.x - carrier.x) * .6, y: carrier.y + (receiver.y - carrier.y) * .6 };
        const target = { x: clamp(cut.x, W * .5, world.right - K.radius), y: clamp(cut.y, world.top + K.radius, world.bottom - K.radius) };
        commands[2 + keeper] = this.moveTo(K, target, keeperSpeed * 1.05, 12);
      }
    } else {
      // Ball in the other half: hold the middle of its own half, in line with the ball.
      commands[2 + keeper] = this.moveTo(K, { x: W * .7, y: clamp(centerY + (ball.y - centerY) * .4, world.top + 80, world.bottom - 80) }, keeperSpeed);
    }

    // Striker.
    if (forwardHasBall || (canKickBall(F, ball) && F.shotCooldown <= 0 && !ourOnBall)) {
      commands[2 + forward] = this.rivalCarry(F, K, ball, ours, world, { ...play, shootRange: play.shootRange * 1.15 }, config, forwardSpeed, false);
    } else if (!ourBall && ball.x < W * .55 && dist(F, ball) < dist(nearestOurs, ball) + 20) {
      // Loose ball near it: go and get it.
      commands[2 + forward] = this.moveTo(F, { x: ball.x + F.radius + ball.radius - 4, y: ball.y }, forwardSpeed, 10);
    } else if (ourOnBall && dist(F, ball) < 110) {
      // Our player is on the ball right next to it: try to steal it.
      commands[2 + forward] = this.moveTo(F, { x: ball.x + F.radius + ball.radius - 2, y: ball.y }, forwardSpeed, 10);
      if (canKickBall(F, ball) && F.shotCooldown <= 0) Object.assign(commands[2 + forward], { kick: true, aim: { x: -120, y: (centerY - ball.y) * .4 }, power: .5 });
    } else {
      // Wait in our half, in the lane farthest from our players, ready to receive and shoot.
      const lanes = [centerY - 140, centerY, centerY + 140].map(y => ({ x: clamp(W * .3 + (ball.x - W / 2) * .08, W * .22, W * .42), y }));
      const score = lane => Math.min(...ours.map(body => dist(body, lane))) - (this.laneOpen(ball, lane, ours, 30) ? 0 : 80);
      const target = lanes.reduce((best, lane) => score(lane) > score(best) ? lane : best, lanes[0]);
      commands[2 + forward] = this.moveTo(F, target, forwardSpeed);
    }
    return commands;
  }

  // Rival on the ball: shoot when in range with a clear lane, pass to the partner when it is
  // better placed, beat a defender off the wall, otherwise dribble towards goal.
  rivalCarry(body, partner, ball, opponents, world, play, config, speed, isKeeper) {
    const centerY = world.height / 2, goal = { x: world.left - 4, y: centerY };
    const canStrike = canKickBall(body, ball) && body.shotCooldown <= 0;
    const goalDistance = ball.x - world.left;
    const noisy = point => ({ x: point.x + (this.random() - .5) * play.passError, y: point.y + (this.random() - .5) * play.passError });
    if (canStrike) {
      // 1) Shot.
      const aimY = clamp(centerY + (this.random() - .5) * (1 - config.accuracy) * 220, world.goalTop + 18, world.goalBottom - 18);
      const shotAim = { x: goal.x, y: aimY };
      if (!isKeeper && goalDistance < play.shootRange && this.laneOpen(ball, shotAim, opponents, 26)) {
        return { x: 0, y: 0, speed, kick: true, aim: { x: shotAim.x - ball.x, y: shotAim.y - ball.y }, power: 1 };
      }
      // 2) Pass: the keeper always looks for the forward; the forward passes back when closed down
      //    and the partner is further forward and free.
      const pressed = opponents.some(other => dist(other, body) < other.radius + body.radius + 40);
      const partnerAhead = partner.x < body.x - 60 && opponents.every(other => dist(other, partner) > 80);
      if (this.rivalPassCooldown <= 0 && (isKeeper || (pressed && partnerAhead))) {
        const receive = { x: partner.x - 30, y: partner.y };
        const line = this.bestPassLine(ball, noisy(receive), opponents, world, 36);
        if (line) {
          this.rivalPassCooldown = 1; this.lastRivalPass = { keeper: isKeeper, bank: line.bank };
          return { x: 0, y: 0, speed, kick: true, aim: line.aim, power: this.passPower(line.length, 190), pass: true, bank: line.bank };
        }
      }
      // 3) Wall dribble: a defender blocks the way to goal → play the ball off the wall past them.
      const toGoal = unit(goal.x - ball.x, goal.y - ball.y);
      const blocker = opponents.find(other => {
        const relX = other.x - ball.x, relY = other.y - ball.y, along = relX * toGoal.x + relY * toGoal.y;
        return along > -10 && along < 170 && Math.abs(toGoal.x * relY - toGoal.y * relX) < other.radius + ball.radius + 34;
      });
      if (blocker && this.rivalWallCooldown <= 0 && this.random() < play.wallChance) {
        this.rivalWallCooldown = 1.6;
        const top = blocker.y >= ball.y, wallY = top ? world.top + ball.radius : world.bottom - ball.radius;
        const ahead = { x: clamp(ball.x - 170, world.left + 40, world.right - 40), y: top ? world.top + 70 : world.bottom - 70 };
        const mirroredY = wallY + (wallY - ahead.y) / WALL_RESTITUTION, t = (wallY - ball.y) / (mirroredY - ball.y);
        const bounce = { x: ball.x + (ahead.x - ball.x) * clamp(t, .2, .8), y: wallY };
        this.lastRivalWall = { x: bounce.x, y: bounce.y };
        return { x: 0, y: 0, speed, kick: true, aim: { x: bounce.x - ball.x, y: bounce.y - ball.y }, power: .72, bank: true, wall: true };
      }
      // Keeper under pressure with nothing on: clear long up the wing.
      if (isKeeper && pressed) {
        const wing = ball.y < centerY ? world.bottom - 90 : world.top + 90;
        return { x: 0, y: 0, speed, kick: true, aim: { x: world.width * .35 - ball.x, y: wing - ball.y }, power: .95 };
      }
    }
    // 4) Dribble: get behind the ball on the line to goal (away from the nearest defender) and push it.
    const nearest = opponents.reduce((best, other) => dist(other, ball) < dist(best, ball) ? other : best, opponents[0]);
    const sideStep = Math.abs(nearest.y - ball.y) < 70 && nearest.x < ball.x ? (ball.y >= nearest.y ? 1 : -1) * 70 : 0;
    const target = { x: goal.x, y: clamp(centerY + sideStep, world.top + 60, world.bottom - 60) };
    const dir = unit(target.x - ball.x, target.y - ball.y);
    const behind = { x: ball.x - dir.x * (body.radius + ball.radius + 4), y: ball.y - dir.y * (body.radius + ball.radius + 4) };
    if (dist(body, behind) > 18) return this.moveTo(body, behind, speed, 8);
    return { x: dir.x, y: dir.y, speed: speed * .92, kick: false };
  }
}
