import { WORLD } from '../config/settings.js';
import { canKickBall } from './Physics.js';
import { tacticalShot, tacticalPass, tacticalPass as passFor, curvedPassAim } from './Tactical.js';

// AI for the "Táctico" gameplay (sticky possession). Every AI player follows the same plan:
//  - with the ball: carry it towards the rival goal, dodging whoever comes to steal it, and shoot once past
//    halfway and within range (or when pressed close to goal); in 2v2, pass to a free teammate ahead;
//  - rival with the ball: the closest player of the team presses to touch the ball (that steals it), the
//    other covers between the ball and its own goal;
//  - loose ball: the closest goes for it; teammates of the one with the ball get open ahead of it.
// Difficulty sets speed, reaction time, shooting range and precision, how hard it presses and how
// well it dodges and passes.

export const TACTICAL_AI_LEVELS = Object.freeze({
  easy: { speed: .66, react: .42, range: 250, error: 70, press: .55, dodge: .08, pass: .25, curve: 0 },
  normal: { speed: .76, react: .3, range: 310, error: 44, press: .7, dodge: .28, pass: .45, curve: .1 },
  hard: { speed: .86, react: .2, range: 370, error: 26, press: .85, dodge: .42, pass: .65, curve: .2 },
  pro: { speed: .95, react: .12, range: 430, error: 14, press: .95, dodge: .66, pass: .8, curve: .3 },
  champions: { speed: 1.03, react: .07, range: 480, error: 6, press: 1, dodge: .88, pass: .9, curve: .35 },
  legend: { speed: 1.08, react: .05, range: 500, error: 3, press: 1, dodge: .96, pass: .95, curve: .4 },
});
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const unit = (x, y) => { const length = Math.hypot(x, y) || 1; return { x: x / length, y: y / length }; };

export class TacticalAI {
  constructor({ difficulty = 'normal', mateLevel = difficulty, rivalStars = 3, mateStars = 3, random = Math.random } = {}) {
    this.level = TACTICAL_AI_LEVELS[difficulty] ? difficulty : 'normal';
    this.mateLevel = TACTICAL_AI_LEVELS[mateLevel] ? mateLevel : this.level;
    this.rivalStars = rivalStars; this.mateStars = mateStars; this.random = random;
    this.brains = new Map(); this.possession = null; this.humanPass = null;
  }
  brain(body) {
    let brain = this.brains.get(body);
    if (!brain) { brain = { timer: 0, target: null, shootIn: 0, dodge: 0 }; this.brains.set(body, brain); }
    return brain;
  }
  config(stars, level) {
    const base = TACTICAL_AI_LEVELS[level], boost = (clamp(stars || 3, 1, 5) - 3) * .03;
    return { ...base, speed: base.speed + boost, error: Math.max(2, base.error * (1 - boost * 3)) };
  }

  // 1 against 1: the bot against the human. Returns a command { x, y, speed, kick, aim, power, curve, pass }.
  single(bot, ball, human, dt, attackRight = false) {
    const config = this.config(this.rivalStars, this.level);
    return this.decide(bot, { ball, dt, attackRight, mates: [], rivals: [human].filter(Boolean), config });
  }

  // 2 against 2 (offline): bodies [human, teammate, rival A, rival B]. Commands for seats 1..3.
  update(bodies, ball, dt) {
    const [human, mate, rivalA, rivalB] = bodies;
    const mateConfig = this.config(this.mateStars, this.mateLevel), rivalConfig = this.config(this.rivalStars, this.level);
    const commands = {};
    commands[1] = this.humanPassRun(mate, ball, dt) || this.decide(mate, { ball, dt, attackRight: true, mates: [human], rivals: [rivalA, rivalB], config: mateConfig, humanMate: human });
    commands[2] = this.decide(rivalA, { ball, dt, attackRight: false, mates: [rivalB], rivals: [human, mate], config: rivalConfig });
    commands[3] = this.decide(rivalB, { ball, dt, attackRight: false, mates: [rivalA], rivals: [human, mate], config: rivalConfig });
    return commands;
  }

  // The human passed (✕ / △): the teammate runs onto the ball for a moment.
  expectPass(target) { this.humanPass = { target: target ? { x: target.x, y: target.y } : null, time: 1.8 }; }
  humanPassRun(mate, ball, dt) {
    if (!this.humanPass) return null;
    this.humanPass.time -= dt;
    const holder = this.possession?.holder, speed = Math.hypot(ball.vx, ball.vy);
    if (this.humanPass.time <= 0 || holder || canKickBall(mate, ball) || speed < 30) { this.humanPass = null; return null; }
    const path = { x: ball.vx / speed, y: ball.vy / speed };
    const along = Math.max(30, (mate.x - ball.x) * path.x + (mate.y - ball.y) * path.y);
    const meet = { x: ball.x + path.x * along, y: ball.y + path.y * along };
    const target = this.humanPass.target && dist(this.humanPass.target, meet) < 180 ? this.humanPass.target : meet;
    return this.moveTo(mate, target, this.config(this.mateStars, this.mateLevel).speed * 1.05);
  }

  moveTo(body, target, speed, slow = 26) {
    const world = body.world || WORLD, pad = (body.radius || 21) + 4;
    const tx = clamp(target.x, world.left + pad, world.right - pad), ty = clamp(target.y, world.top + pad, world.bottom - pad);
    const dx = tx - body.x, dy = ty - body.y, distance = Math.hypot(dx, dy);
    if (distance < 6) return { x: 0, y: 0, speed, kick: false };
    const scale = distance < slow ? Math.max(.3, distance / slow) : 1;
    return { x: dx / distance * scale, y: dy / distance * scale, speed, kick: false };
  }

  decide(body, context) {
    if (!body) return { x: 0, y: 0, kick: false };
    const { ball, dt, attackRight, mates, rivals, config } = context;
    const world = ball.world || WORLD, brain = this.brain(body);
    if (!context.noTick) brain.timer -= dt;
    const holder = this.possession?.holder || null;
    const team = [body, ...mates];
    if (holder === body) return this.attack(body, context, brain, world);
    // Our team has the ball: get open ahead of the holder.
    if (holder && team.includes(holder)) return this.support(body, holder, context, world);
    // Rival has the ball, or it is loose: the closest of the team goes for it, the other covers.
    const chaser = team.reduce((best, player) => (player && dist(player, ball) < dist(best, ball) ? player : best), body);
    const goingForIt = chaser === body || (context.humanMate && chaser === context.humanMate && dist(body, ball) < 140);
    if (holder && !goingForIt) return this.cover(body, holder, context, world);
    if (!holder && !goingForIt) return this.support(body, chaser, context, world);
    // Press / chase. Reaction time: the target is refreshed every `react` seconds (with a lead on the ball).
    if (brain.timer <= 0 || !brain.target) {
      brain.timer = config.react;
      // Intercept: aim where the ball will be when we get there (better levels read it further ahead).
      const runSpeed = Math.max(120, config.speed * (body.maxSpeed || 280));
      const lead = clamp(dist(body, ball) / runSpeed, .1, holder ? .35 + config.press * .55 : .6);
      brain.target = { x: ball.x + (ball.vx || 0) * lead, y: ball.y + (ball.vy || 0) * lead };
      if (holder) {
        // Recovery run: when the holder is between us and our goal, first get goal-side (in the shot lane),
        // then step into the ball. Better levels recover more often instead of chasing from behind.
        const ownGoal = { x: attackRight ? world.left : world.right, y: (world.goalTop + world.goalBottom) / 2 };
        const goalSide = Math.abs(body.x - ownGoal.x) < Math.abs(ball.x - ownGoal.x) - 8;
        if (!goalSide && this.random() < .35 + config.press * .6) {
          const lane = unit(ownGoal.x - ball.x, ownGoal.y - ball.y), gap = 55 + (1 - config.press) * 40;
          brain.target = { x: ball.x + lane.x * gap + (ball.vx || 0) * lead * .6, y: ball.y + lane.y * gap + (ball.vy || 0) * lead * .6 };
        }
      }
      if (holder) {
        // Coming from behind the holder: go round their side to reach the ball (it is in front of them).
        const u = unit(ball.x - holder.x, ball.y - holder.y), behind = (body.x - holder.x) * u.x + (body.y - holder.y) * u.y < 0;
        if (behind && dist(body, holder) < 120) {
          const side = ((body.x - holder.x) * -u.y + (body.y - holder.y) * u.x) >= 0 ? 1 : -1;
          const reach = (holder.radius || 21) + (body.radius || 21) + 8;
          brain.target = { x: holder.x + -u.y * side * reach + u.x * 10, y: holder.y + u.x * side * reach + u.y * 10 };
          brain.timer = Math.min(brain.timer, .08);
        }
      }
      // Lower levels sometimes hesitate instead of pressing.
      brain.hesitate = holder && this.random() > config.press;
    }
    if (brain.hesitate) return this.cover(body, holder, context, world);
    return this.moveTo(body, brain.target, config.speed, 4);
  }

  // With the ball: run at goal, dodge the closest rival, shoot past halfway and in range, or pass.
  attack(body, { ball, attackRight, mates, rivals, config }, brain, world) {
    const goalX = attackRight ? world.right : world.left, centerY = (world.goalTop + world.goalBottom) / 2;
    const toGoal = Math.abs(goalX - body.x), pastHalf = attackRight ? body.x > world.width / 2 : body.x < world.width / 2;
    const forward = attackRight ? 1 : -1;
    const threat = rivals.filter(Boolean).reduce((best, rival) => (!best || dist(rival, body) < dist(best, body) ? rival : best), null);
    const threatDistance = threat ? dist(threat, body) : Infinity;
    const ahead = threat && (threat.x - body.x) * forward > -10;
    const ready = body.shotCooldown <= 0 && canKickBall(body, ball);
    // Shoot: past halfway and within range, or pressed close to goal.
    if (ready && brain.timer <= 0) {
      brain.timer = config.react;
      const inRange = pastHalf && toGoal < config.range;
      const pressedNearGoal = pastHalf && threatDistance < 70 && toGoal < config.range * 1.35;
      if (inRange || pressedNearGoal) return this.shoot(body, ball, { attackRight, rivals, config, world });
      // Pass to a free teammate ahead when a rival closes in.
      const mate = mates.find(other => other && (other.x - body.x) * forward > 40 && rivals.every(rival => !rival || dist(rival, other) > 90));
      if (mate && threatDistance < 95 && this.random() < config.pass) {
        const result = tacticalPass(body, ball, { mates: [mate], direction: { x: mate.x - body.x, y: mate.y - body.y }, through: (mate.x - body.x) * forward > 120, world, attackRight });
        return { x: 0, y: 0, speed: config.speed, kick: true, aim: result.aim, power: result.power, pass: true };
      }
    }
    // Carry: towards the goal, aiming a little away from the rival in front.
    let target = { x: goalX - forward * 60, y: centerY + clamp(body.y - centerY, -90, 90) * .6 };
    let dir = unit(target.x - body.x, target.y - body.y);
    if (threat && ahead && threatDistance < 150) {
      if (brain.dodge <= 0) { brain.dodge = .5; brain.dodgeSide = this.random() < config.dodge ? Math.sign(body.y - threat.y || (body.y < world.height / 2 ? -1 : 1)) || 1 : 0; }
      if (brain.dodgeSide) {
        const away = { x: 0, y: brain.dodgeSide };
        const weight = (1 - threatDistance / 150) * 1.4 * config.dodge;
        dir = unit(dir.x + away.x * weight, dir.y + away.y * weight);
        // Keep off the touchlines while dodging.
        if ((dir.y < 0 && body.y < world.top + 50) || (dir.y > 0 && body.y > world.bottom - 50)) { brain.dodgeSide = -brain.dodgeSide; dir = unit(dir.x, -dir.y); }
      }
    }
    // Shield: a rival right on top of us — turn away from them (the ball swings to the far side) while
    // still drifting towards goal. Better levels shield more.
    if (threat && threatDistance < 75 && this.random() < .4 + config.dodge * .6) {
      const away = unit(body.x - threat.x, body.y - threat.y), goal = unit(goalX - body.x, centerY - body.y);
      dir = unit(away.x + goal.x * (.35 + (1 - config.dodge) * .4), away.y + goal.y * (.35 + (1 - config.dodge) * .4));
      if ((dir.y < 0 && body.y < world.top + 40) || (dir.y > 0 && body.y > world.bottom - 40)) dir = unit(dir.x || goal.x, 0);
    }
    brain.dodge = Math.max(0, (brain.dodge || 0) - (1 / 60));
    return { x: dir.x, y: dir.y, speed: config.speed * .96, kick: false };
  }

  shoot(body, ball, { attackRight, rivals, config, world }) {
    const axisY = this.random() < .5 ? -1 : this.random() < .5 ? 1 : 0;
    const curve = this.random() < config.curve;
    const result = tacticalShot(body, ball, { world, attackRight, opponents: rivals, axisY, curve, power: 1 });
    // Precision: turn the aim by an error that grows with the distance to goal.
    const toGoal = Math.abs((attackRight ? world.right : world.left) - body.x);
    const angle = (this.random() * 2 - 1) * Math.atan2(config.error, Math.max(120, toGoal));
    const cos = Math.cos(angle), sin = Math.sin(angle), aim = result.aim;
    return { x: 0, y: 0, speed: config.speed, kick: true, aim: { x: aim.x * cos - aim.y * sin, y: aim.x * sin + aim.y * cos }, power: result.power, curve: result.curve };
  }

  // A teammate has the ball: get open ahead of it, on the other side of the pitch, away from rivals.
  support(body, holder, { attackRight, rivals, config }, world) {
    const forward = attackRight ? 1 : -1, centerY = world.height / 2;
    const side = holder.y < centerY ? 1 : -1;
    let target = { x: clamp(holder.x + forward * 170, world.left + 80, world.right - 80), y: centerY + side * 130 };
    const rival = rivals.filter(Boolean).find(other => dist(other, target) < 80);
    if (rival) target = { x: target.x, y: target.y + (target.y > rival.y ? 60 : -60) };
    return this.moveTo(body, target, config.speed * .9);
  }

  // Rival with the ball and a teammate already pressing: stand between the ball and our goal.
  cover(body, holder, { ball, attackRight, config }, world) {
    const ownGoal = { x: attackRight ? world.left : world.right, y: (world.goalTop + world.goalBottom) / 2 };
    const point = holder || ball;
    const target = { x: ownGoal.x + (point.x - ownGoal.x) * .45, y: ownGoal.y + (point.y - ownGoal.y) * .55 };
    return this.moveTo(body, target, config.speed * .92);
  }
}

// 3 contra 3 (Táctico): bodies [human forward, midfielder, goalkeeper, rival forward, rival midfielder,
// rival goalkeeper]. Commands for seats 1..5.
//  - Goalkeeper: stays on its line following the ball; comes out to claim a ball in its area; with the
//    ball, passes to its midfielder (or clears it up the pitch).
//  - Midfielder: holds the middle; presses a rival in its own half; with the ball, passes to the forward
//    (a through ball ahead of them, curved if the team has 4+ stars) or shoots if close enough.
//  - Forward (rival AI): attacks like in 2v2, presses high in the rival half, gets open for passes.

export class TeamAI extends TacticalAI {
  update(bodies, ball, dt) {
    const commands = {};
    const mateConfig = this.config(this.mateStars, this.mateLevel), rivalConfig = this.config(this.rivalStars, this.level);
    const teams = [[bodies[0], bodies[1], bodies[2]], [bodies[3], bodies[4], bodies[5]]];
    for (let seat = 1; seat < 6; seat++) {
      const left = seat < 3, team = teams[left ? 0 : 1], rivals = teams[left ? 1 : 0], body = bodies[seat], role = seat % 3;
      this.brain(body).timer -= dt;
      const context = { noTick: true, ball, dt, attackRight: left, mates: team.filter(other => other !== body), rivals, config: left ? mateConfig : rivalConfig, stars: left ? this.mateStars : this.rivalStars, team, humanMate: left ? bodies[0] : null };
      if (seat === 1 && this.humanPass) { const run = this.humanPassRun(body, ball, dt); if (run) { commands[seat] = run; continue; } }
      commands[seat] = role === 2 ? this.keeper(body, context) : role === 1 ? this.midfielder(body, context) : this.forward(body, context);
    }
    return commands;
  }

  keeper(body, context) {
    const { ball, attackRight, mates, config } = context, world = ball.world || WORLD;
    const holder = this.possession?.holder || null, line = attackRight ? world.left : world.right, inward = attackRight ? 1 : -1;
    const centerY = (world.goalTop + world.goalBottom) / 2;
    if (holder === body) {
      // Distribute: to the midfielder (or the forward if free), otherwise a long clearance up the pitch.
      const mid = mates.find(mate => mate && mate !== context.humanMate) || mates[0];
      const target = [context.humanMate, mid].filter(Boolean).find(mate => context.rivals.every(rival => !rival || Math.hypot(rival.x - mate.x, rival.y - mate.y) > 110)) || mid;
      if (target && canKickBall(body, ball) && body.shotCooldown <= 0) {
        const result = passFor(body, ball, { mates: [target], direction: { x: target.x - body.x, y: target.y - body.y }, world, attackRight });
        return { x: 0, y: 0, speed: config.speed, kick: true, aim: result.aim, power: Math.max(result.power, .8), pass: true };
      }
      return this.moveTo(body, { x: body.x + inward * 40, y: body.y }, config.speed);
    }
    // Claim a ball that comes into the area (loose, or a rival dribbling in).
    const inArea = Math.abs(ball.x - line) < 150 && Math.abs(ball.y - centerY) < 150;
    if (inArea && (!holder || !context.team.includes(holder))) return this.moveTo(body, { x: ball.x + (ball.vx || 0) * .12, y: ball.y + (ball.vy || 0) * .12 }, config.speed * 1.05, 4);
    // Stay on the line, covering the angle to the ball.
    const y = clamp(centerY + (ball.y - centerY) * .45, world.goalTop + 12, world.goalBottom - 12);
    return this.moveTo(body, { x: line + inward * 30, y }, config.speed);
  }

  midfielder(body, context) {
    const { ball, attackRight, mates, rivals, config, stars, team } = context, world = ball.world || WORLD;
    const holder = this.possession?.holder || null, forward = attackRight ? 1 : -1, half = world.width / 2;
    const striker = team[0];
    if (holder === body) {
      const brain = this.brain(body);
      const toGoal = Math.abs((attackRight ? world.right : world.left) - body.x);
      if (canKickBall(body, ball) && body.shotCooldown <= 0 && brain.timer <= 0) {
        brain.timer = config.react;
        const pastHalf = attackRight ? body.x > half : body.x < half;
        if (pastHalf && toGoal < config.range * .9) return this.shoot(body, ball, { attackRight, rivals, config, world });
        // Pass to the forward: through ball ahead of them when they are in front, curved with 4+ stars.
        if (striker && striker !== body && this.random() < .35 + config.pass * .6) {
          const ahead = (striker.x - body.x) * forward > 30;
          const result = passFor(body, ball, { mates: [striker], direction: { x: striker.x - body.x, y: striker.y - body.y }, through: ahead, world, attackRight });
          let aim = result.aim, curve = 0;
          if (stars >= 4) { const curved = curvedPassAim(body, ball, result.target, result.power); if (curved) { aim = curved.aim; curve = curved.curve; } }
          return { x: 0, y: 0, speed: config.speed, kick: true, aim, power: result.power, curve, pass: true };
        }
      }
      return this.attack(body, { ball, attackRight, mates, rivals, config }, this.brain(body), world);
    }
    if (holder && team.includes(holder)) {
      // Support behind the forward, a little to the side.
      const target = { x: clamp(holder.x - forward * 120, world.left + 90, world.right - 90), y: world.height / 2 + (holder.y < world.height / 2 ? 110 : -110) };
      return this.moveTo(body, target, config.speed * .9);
    }
    // Defend: press when the ball is in our half (or loose and closest), otherwise hold the middle.
    const ownHalf = attackRight ? ball.x < half + 60 : ball.x > half - 60;
    const closest = team.filter(player => player && player !== team[2]).every(player => player === body || Math.hypot(player.x - ball.x, player.y - ball.y) >= Math.hypot(body.x - ball.x, body.y - ball.y));
    if (ownHalf || (!holder && closest)) return this.decide(body, { ...context, mates: team.filter(player => player && player !== body && player !== team[2]) });
    return this.moveTo(body, { x: half - forward * 140, y: clamp(ball.y, world.top + 90, world.bottom - 90) }, config.speed * .9);
  }

  forward(body, context) {
    const { ball, attackRight, config, team } = context, world = ball.world || WORLD;
    const holder = this.possession?.holder || null, forward = attackRight ? 1 : -1, half = world.width / 2;
    if (holder === body) return this.attack(body, context, this.brain(body), world);
    if (holder && team.includes(holder)) {
      // Get open ahead of the ball for the through pass.
      const base = attackRight ? Math.max(holder.x, half) : Math.min(holder.x, half);
      const target = { x: clamp(base + forward * 200, world.left + 120, world.right - 120), y: world.height / 2 + (holder.y < world.height / 2 ? 120 : -120) };
      return this.moveTo(body, target, config.speed);
    }
    // High press: the forward chases the ball in the rival half or when it is loose and close.
    const rivalHalf = attackRight ? ball.x > half - 80 : ball.x < half + 80;
    if (rivalHalf || !holder) return this.decide(body, { ...context, mates: [] });
    return this.moveTo(body, { x: half + forward * 60, y: clamp(ball.y, world.top + 100, world.bottom - 100) }, config.speed * .85);
  }
}
