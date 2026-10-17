import { BotAI } from './BotAI.js';
import { BOT_LEVELS, WORLD } from '../config/settings.js';
import { canKickBall } from './Physics.js';

// AI for offline 2v2: the human's teammate (left team, attacks the right goal)
// and the two rivals (right team, attack the left goal). Bodies come in seat
// order: [human, teammate, rival captain, rival partner].
//
// The teammate defends when the rivals have the ball, offers itself ahead of
// the human when the human has it, and when it wins the ball it looks for a
// pass to the human before trying to score itself. Rivals coordinate as one
// presser (the existing 1v1 bot) plus one cover player who guards the goal or
// waits for the rebound.

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const unit = (x, y) => { const length = Math.hypot(x, y) || 1; return { x: x / length, y: y / length }; };
// The 1v1 bot always attacks the left goal: mirror the world to drive the left team with it.
const mirror = (body, width) => body && ({ x: width - body.x, y: body.y, vx: -(body.vx || 0), vy: body.vy || 0, radius: body.radius, world: body.world, maxSpeed: body.maxSpeed, shotCooldown: body.shotCooldown, speedScale: body.speedScale });
const unmirror = decision => ({ ...decision, x: -decision.x, kickDirection: decision.kickDirection ? { x: -decision.kickDirection.x, y: decision.kickDirection.y } : null });

export const MATE_LEVEL = Object.freeze({ easy: 'normal', normal: 'normal', hard: 'hard', pro: 'pro', champions: 'pro', legend: 'pro' });

export class SquadAI {
  constructor({ difficulty = 'normal', rivalStars = 3, mateStars = 3, mateLevel = MATE_LEVEL[difficulty] || 'normal' } = {}) {
    this.difficulty = difficulty in BOT_LEVELS ? difficulty : 'normal';
    this.mateLevel = mateLevel in BOT_LEVELS ? mateLevel : 'normal';
    this.rivalBots = [new BotAI(this.difficulty), new BotAI(this.difficulty)];
    this.rivalBots.forEach(bot => bot.setTeamStrength(rivalStars));
    this.mateBot = new BotAI(this.mateLevel); this.mateBot.setTeamStrength(mateStars);
    this.rivalPresser = 0; this.mateChasing = false; this.passCooldown = 0; this.lastPass = null;
    this.random = Math.random;
  }

  // Returns one command per seat 1..3: { x, y, speed, kick, aim, power }.
  update(bodies, ball, dt) {
    this.passCooldown = Math.max(0, this.passCooldown - dt);
    const world = ball.world || WORLD;
    // How long the ball has been loose: slow and nobody on it.
    const free = Math.hypot(ball.vx, ball.vy) < 90 && bodies.every(body => Math.hypot(body.x - ball.x, body.y - ball.y) > body.radius + ball.radius + 22);
    this.looseTime = free ? (this.looseTime || 0) + dt : 0;
    const commands = { 1: this.teammate(bodies, ball, dt, world), ...this.rivals(bodies, ball, dt, world) };
    this.unjam(commands, bodies, ball, dt, world);
    // Near a touchline, never aim into the wall: the ball would stay pinned there.
    const edge = ball.radius + 34;
    for (const seat of [1, 2, 3]) {
      const aim = commands[seat]?.aim; if (!commands[seat]?.kick || !aim) continue;
      if (ball.y < world.top + edge && aim.y < 0) aim.y = Math.abs(aim.x) * .35;
      if (ball.y > world.bottom - edge && aim.y > 0) aim.y = -Math.abs(aim.x) * .35;
    }
    return commands;
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
      } else if (Math.hypot(body.x - ball.x, body.y - ball.y) < 90) {
        // Step back towards the middle to free the ball.
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

  // Free path for a pass: no rival close to the line between the ball and the receiver.
  laneOpen(from, to, rivals, margin = 42) {
    const lx = to.x - from.x, ly = to.y - from.y, length2 = lx * lx + ly * ly || 1;
    return rivals.every(rival => {
      const t = clamp(((rival.x - from.x) * lx + (rival.y - from.y) * ly) / length2, 0, 1);
      return Math.hypot(from.x + lx * t - rival.x, from.y + ly * t - rival.y) > margin + rival.radius;
    });
  }

  // ---- Teammate (left team, attacks the right goal) ----------------------------
  teammate(bodies, ball, dt, world) {
    const [human, mate, ...rivals] = bodies, W = world.width, centerY = world.height / 2;
    const speed = this.speedFor(this.mateLevel, mate);
    const contact = mate.radius + ball.radius;
    const humanBall = dist(human, ball), mateBall = dist(mate, ball);
    const rivalBall = Math.min(...rivals.map(rival => dist(rival, ball)));
    const humanHasBall = humanBall < human.radius + ball.radius + 20;
    // Who goes for the ball: hysteresis so the two do not swap every frame.
    // A loose ball the human is not going for: the teammate fetches it.
    const humanGoing = ((human.vx || 0) * (ball.x - human.x) + (human.vy || 0) * (ball.y - human.y)) / (humanBall || 1) > 70;
    const fetch = this.looseTime > .5 && !humanGoing && mateBall < humanBall + 220;
    this.mateChasing = !humanHasBall && (fetch || (this.mateChasing ? mateBall < humanBall + 30 : mateBall < humanBall - 30));
    const nearestRival = rivals.reduce((best, rival) => dist(rival, ball) < dist(best, ball) ? rival : best, rivals[0]);

    if (this.mateChasing) {
      // With the ball at its feet: pass to the human when they are better placed.
      if (canKickBall(mate, ball) && mate.shotCooldown <= 0 && this.passCooldown <= 0) {
        const pass = this.passTo(mate, human, ball, rivals, world);
        if (pass) return pass;
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
        // Step out to clear when the ball comes close.
        if (mateBall < 120 && ball.x < W * .4) return this.clear(mate, ball, rivals, human, world, speed);
        return this.moveTo(mate, target, speed);
      }
      // Rivals far upfield: cover the middle lane.
      return this.moveTo(mate, { x: W * .36, y: clamp(centerY + (ball.y - centerY) * .4, world.top + 60, world.bottom - 60) }, speed * .9);
    }

    // The human has (or is about to have) the ball: offer a pass ahead, on the other lane.
    if (mateBall < contact + 14 && canKickBall(mate, ball) && mate.shotCooldown <= 0) {
      const pass = this.passTo(mate, human, ball, rivals, world);
      if (pass) return pass;
    }
    const lane = ball.y < centerY ? 1 : -1;
    let target = {
      x: clamp(Math.max(ball.x + 170, human.x + 120), world.left + 160, world.right - 140),
      y: clamp(centerY + lane * Math.max(110, Math.abs(ball.y - centerY) * .7), world.top + 50, world.bottom - 50),
    };
    // Move away from a marker so the lane stays open.
    const marker = rivals.find(rival => dist(rival, target) < 75);
    if (marker) target = { x: target.x, y: clamp(target.y + (target.y >= marker.y ? 85 : -85), world.top + 50, world.bottom - 50) };
    // Do not get in the human's way.
    if (dist(mate, human) < mate.radius + human.radius + 26) target = { x: target.x, y: target.y + (mate.y >= human.y ? 60 : -60) };
    return this.moveTo(mate, target, speed);
  }

  // Pass to the human when they are ahead or freer and the lane is open. Leads the pass a little.
  passTo(mate, human, ball, rivals, world) {
    const distance = dist(ball, human);
    if (distance < 110 || distance > 560) return null;
    const ahead = human.x - ball.x;
    const humanFree = rivals.every(rival => dist(rival, human) > 70);
    const mateBlocked = rivals.some(rival => rival.x > mate.x && Math.abs(rival.y - mate.y) < 60 && rival.x - mate.x < 150);
    const mateNearGoal = world.right - ball.x < 260 && Math.abs(ball.y - world.height / 2) < 150;
    if (mateNearGoal && !mateBlocked) return null;
    if (!(ahead > 40 || mateBlocked || (humanFree && ahead > -60))) return null;
    const lead = { x: human.x + (human.vx || 0) * .32, y: human.y + (human.vy || 0) * .32 };
    if (!this.laneOpen(ball, lead, rivals)) return null;
    this.passCooldown = 1.1; this.lastPass = { x: lead.x, y: lead.y };
    const power = clamp(.42 + distance / 1100, .45, .82);
    return { x: 0, y: 0, speed: 1, kick: true, aim: { x: lead.x - ball.x, y: lead.y - ball.y }, power, pass: true };
  }

  // Clearance from defence: to the human if open, else up the far wing.
  clear(mate, ball, rivals, human, world, speed) {
    if (canKickBall(mate, ball) && mate.shotCooldown <= 0) {
      const pass = this.passTo(mate, human, ball, rivals, world);
      if (pass) return pass;
      const wing = ball.y < world.height / 2 ? world.bottom - 80 : world.top + 80;
      return { x: 0, y: 0, speed, kick: true, aim: { x: world.width * .62 - ball.x, y: wing - ball.y }, power: .9 };
    }
    // Get goal-side of the ball, then go through it.
    const target = { x: ball.x - mate.radius - ball.radius - 6, y: ball.y };
    return this.moveTo(mate, target, speed, 10);
  }

  // ---- Rivals (right team, attack the left goal) -------------------------------
  rivals(bodies, ball, dt, world) {
    const [human, mate, ...rivals] = bodies, centerY = world.height / 2;
    const distances = rivals.map(rival => dist(rival, ball));
    const other = 1 - this.rivalPresser;
    if (distances[other] < distances[this.rivalPresser] - 35) this.rivalPresser = other;
    const presser = this.rivalPresser, cover = 1 - presser;
    const ourNearest = dist(human, ball) <= dist(mate, ball) ? human : mate;
    const commands = {};
    const decision = this.rivalBots[presser].update(rivals[presser], ball, ourNearest, dt);
    commands[2 + presser] = { x: decision.x, y: decision.y, speed: decision.speedMultiplier ?? 1, kick: !!decision.kick, aim: decision.kickDirection, power: 1 };
    // The 1v1 bot waits in goal for a lone attacker; with a loose ball nearer to it, go and win it.
    const presserBody = rivals[presser];
    if (this.looseTime > .35 && distances[presser] < dist(ourNearest, ball) + 40) {
      const contact = presserBody.radius + ball.radius;
      const press = this.moveTo(presserBody, { x: ball.x + contact * .8, y: ball.y }, this.speedFor(this.difficulty, presserBody), 12);
      if (canKickBall(presserBody, ball) && presserBody.shotCooldown <= 0) Object.assign(press, { kick: true, aim: { x: world.left - 4 - ball.x, y: centerY - ball.y }, power: 1 });
      commands[2 + presser] = press;
    }

    const body = rivals[cover], speed = this.speedFor(this.difficulty, body);
    const config = BOT_LEVELS[this.difficulty];
    let target;
    if (ball.x > world.width * .5 || dist(ourNearest, ball) < distances[presser]) {
      // Defend: stay between the ball and the right goal.
      target = { x: clamp(world.right - 70 - (world.right - ball.x) * .18, world.width * .7, world.right - body.radius), y: clamp(centerY + (ball.y - centerY) * (.45 + config.defense * .25), world.goalTop + 16, world.goalBottom - 16) };
    } else {
      // Attack: hang back on the far side for the rebound or a second ball.
      target = { x: clamp(ball.x + 190, world.width * .32, world.width * .7), y: clamp(centerY + (centerY - ball.y) * .55, world.top + 60, world.bottom - 60) };
    }
    const command = this.moveTo(body, target, speed);
    // Loose ball in reach: shoot towards the left goal, or clear from defence.
    if (canKickBall(body, ball) && body.shotCooldown <= 0) {
      const aimY = clamp(centerY + (this.random() - .5) * (1 - config.accuracy) * 220, world.goalTop + 18, world.goalBottom - 18);
      Object.assign(command, { kick: true, aim: unit(world.left - 4 - ball.x, aimY - ball.y), power: 1 });
    }
    commands[2 + cover] = command;
    return commands;
  }
}
