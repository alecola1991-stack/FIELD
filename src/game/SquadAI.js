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
    return commands;
  }

  // Who touched the ball last (seat index) and who before them, to know when a ball comes from the human.
  trackTouches(bodies, ball, dt) {
    this.touchTime = (this.touchTime || 0) + dt;
    let toucher = -1, best = Infinity;
    bodies.forEach((body, seat) => { const d = dist(body, ball); if (d < body.radius + ball.radius + 6 && d < best) { best = d; toucher = seat; } });
    if (toucher >= 0 && toucher !== this.lastToucher) { this.prevToucher = this.lastToucher ?? -1; this.lastToucher = toucher; this.touchTime = 0; }
  }

  // Best direct shot at the right goal: the aim point (near post, centre, far post) whose lane is clearest.
  shotLine(ball, rivals, world) {
    let best = null;
    for (const y of [world.goalTop + 20, world.height / 2, world.goalBottom - 20]) {
      const aim = { x: world.right + 4, y };
      if (!this.laneOpen(ball, aim, rivals, 14)) continue;
      const lx = aim.x - ball.x, ly = aim.y - ball.y, length2 = lx * lx + ly * ly || 1;
      const clearance = Math.min(...rivals.map(rival => {
        const t = clamp(((rival.x - ball.x) * lx + (rival.y - ball.y) * ly) / length2, 0, 1);
        return Math.hypot(ball.x + lx * t - rival.x, ball.y + ly * t - rival.y);
      }));
      if (!best || clearance > best.clearance) best = { aim: { x: lx, y: ly }, clearance };
    }
    return best;
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
  teammate(bodies, ball, dt, world) {
    const [human, mate, ...rivals] = bodies, W = world.width, centerY = world.height / 2;
    const speed = this.speedFor(this.mateLevel, mate);
    const humanBall = dist(human, ball), mateBall = dist(mate, ball);
    const rivalBall = Math.min(...rivals.map(rival => dist(rival, ball)));
    const humanHasBall = humanBall < human.radius + ball.radius + 20;
    // A loose ball the human is not going for: the teammate fetches it.
    const humanGoing = ((human.vx || 0) * (ball.x - human.x) + (human.vy || 0) * (ball.y - human.y)) / (humanBall || 1) > 70;
    const fetch = this.looseTime > .5 && !humanGoing && mateBall < humanBall + 220;
    this.mateChasing = !humanHasBall && (fetch || (this.mateChasing ? mateBall < humanBall + 30 : mateBall < humanBall - 30));
    const nearestRival = rivals.reduce((best, rival) => dist(rival, ball) < dist(best, ball) ? rival : best, rivals[0]);

    // A ball from the human in the rival half with a shot on: always shoot, first time or after the first touch.
    const fromHuman = (this.lastToucher === 0 && humanBall > human.radius + ball.radius + 20) || (this.lastToucher === 1 && this.prevToucher === 0 && this.touchTime < 1.2);
    if (fromHuman && ball.x > W / 2 && canKickBall(mate, ball) && mate.shotCooldown <= 0) {
      const shot = this.shotLine(ball, rivals, world);
      if (shot) {
        const error = (MATE_ERROR[this.mateLevel] ?? 20) * 1.6, aim = { x: shot.aim.x, y: shot.aim.y + (this.random() - .5) * error };
        this.lastShot = { fromHuman: true }; return { x: 0, y: 0, speed, kick: true, aim, power: 1.25, shot: true };
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
      const decision = unmirror(this.mateBot.update(mirror(mate, W), mirror(ball, W), mirror(nearestRival, W), dt));
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
  // Fixed roles: one keeper, one forward. The keeper is the rival nearer its own goal;
  // they swap only when the keeper ends up clearly ahead of the forward.
  rivals(bodies, ball, dt, world) {
    const [human, mate, ...rivals] = bodies, W = world.width, centerY = world.height / 2;
    const config = BOT_LEVELS[this.difficulty], play = RIVAL_PLAY[this.difficulty] || RIVAL_PLAY.normal;
    let keeper = this.rivalKeeper;
    if (rivals[keeper].x < rivals[1 - keeper].x - 90) keeper = this.rivalKeeper = 1 - keeper;
    const forward = 1 - keeper, K = rivals[keeper], F = rivals[forward];
    const ours = [human, mate];
    const reach = body => body.radius + ball.radius + 20;
    const ourOnBall = ours.find(body => dist(body, ball) < reach(body));
    const commands = {};
    const keeperSpeed = this.speedFor(this.difficulty, K), forwardSpeed = this.speedFor(this.difficulty, F);
    const keeperHasBall = dist(K, ball) < reach(K);

    // Keeper.
    if (keeperHasBall) {
      commands[2 + keeper] = this.rivalCarry(K, F, ball, ours, world, play, config, keeperSpeed, true);
    } else {
      const nearestOurs = ours.reduce((best, body) => dist(body, ball) < dist(best, ball) ? body : best, ours[0]);
      const danger = ball.x > W * .7 && (dist(K, ball) < dist(nearestOurs, ball) + 30 || this.looseTime > .25);
      if (danger) {
        commands[2 + keeper] = this.moveTo(K, { x: ball.x + K.radius + ball.radius - 4, y: ball.y }, keeperSpeed, 10);
        if (canKickBall(K, ball) && K.shotCooldown <= 0) commands[2 + keeper] = this.rivalCarry(K, F, ball, ours, world, play, config, keeperSpeed, true);
      } else {
        const target = { x: clamp(world.right - 70 - (world.right - ball.x) * .16, W * .72, world.right - K.radius), y: clamp(centerY + (ball.y - centerY) * (.45 + config.defense * .3), world.goalTop + 16, world.goalBottom - 16) };
        commands[2 + keeper] = this.moveTo(K, target, keeperSpeed);
      }
    }

    // Forward: never drops back next to the keeper.
    const forwardHasBall = dist(F, ball) < reach(F);
    if (ourOnBall && ball.x > W * .7) {
      // We attack deep: the keeper deals with it; the forward waits up the pitch for the counter.
      commands[2 + forward] = this.moveTo(F, { x: W * .5, y: clamp(centerY + (centerY - ball.y) * .5, world.top + 70, world.bottom - 70) }, forwardSpeed);
    } else if (forwardHasBall) {
      commands[2 + forward] = this.rivalCarry(F, K, ball, ours, world, play, config, forwardSpeed, false);
    } else if (keeperHasBall || (ball.vx < -150 && ball.x > F.x && !ourOnBall)) {
      // Get open up the pitch to receive, away from the nearest defender.
      const marker = ours.reduce((best, body) => dist(body, F) < dist(best, F) ? body : best, ours[0]);
      let target = { x: clamp(Math.min(ball.x - 240, W * .48), W * .24, W * .55), y: clamp(centerY + (ball.y < centerY ? 1 : -1) * 120, world.top + 60, world.bottom - 60) };
      if (dist(marker, target) < 90) target = { x: target.x, y: clamp(target.y + (target.y >= marker.y ? 95 : -95), world.top + 60, world.bottom - 60) };
      commands[2 + forward] = this.moveTo(F, target, forwardSpeed);
    } else if (ourOnBall || ball.x < W * .7) {
      // Press the ball from its goal side; a loose ball in reach is taken on.
      if (canKickBall(F, ball) && F.shotCooldown <= 0 && !ourOnBall) commands[2 + forward] = this.rivalCarry(F, K, ball, ours, world, play, config, forwardSpeed, false);
      else {
        const press = { x: clamp(ball.x + F.radius + ball.radius - 2, world.left + F.radius, W * .7), y: ball.y };
        commands[2 + forward] = this.moveTo(F, press, forwardSpeed, 10);
        // Win the ball by poking it forward (towards our own attack, not a blind shot).
        if (canKickBall(F, ball) && F.shotCooldown <= 0) Object.assign(commands[2 + forward], { kick: true, aim: { x: -120, y: (centerY - ball.y) * .4 }, power: .5 });
      }
    } else {
      // Ball deep in our own half with the keeper on it: wait at the halfway line for the outlet.
      commands[2 + forward] = this.moveTo(F, { x: W * .45, y: clamp(centerY + (centerY - ball.y) * .5, world.top + 70, world.bottom - 70) }, forwardSpeed);
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
