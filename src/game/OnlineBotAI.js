import { BotAI } from './BotAI.js';
import { SquadAI } from './SquadAI.js';
import { WORLD } from '../config/settings.js';

// Bots that fill online rooms (Arcade gameplay, run by the match host). They play like a human:
//  - Defending, they wait around halfway and come out to press in their own half, standing on the
//    line between the ball and their goal (covering the shot) and stepping in to tackle.
//  - Attacking, when the human blocks the way in midfield or near a corner, they play the ball off
//    the side wall to get past and run onto the rebound; otherwise they carry it with swerves.
//  - Moods change every few seconds (eager, calm, waiting to pounce), reactions are irregular and
//    shots vary (posts, early strikes, fire shots), so they are hard to read.
// Their level comes from their ELO (a little below the human they face).

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const unit = (x, y) => { const length = Math.hypot(x, y) || 1; return { x: x / length, y: y / length }; };

export function botLevelFor(elo) {
  const value = Number(elo) || 500;
  return value < 440 ? 'easy' : value < 600 ? 'normal' : value < 780 ? 'hard' : value < 980 ? 'pro' : 'champions';
}
// Top speed (px/s) of a bot by ELO: close to a human's 305, a little less for low ratings.
export function botSpeedFor(elo) { return clamp(250 + ((Number(elo) || 500) - 500) * .07, 238, 298); }
// eager: presses as soon as the ball enters its half and tackles early; calm: covers the lane and
// waits; pounce: sits deeper and jumps in when the human gets close.
const MOODS = ['eager', 'eager', 'calm', 'calm', 'pounce'];

// 1v1: the bot defends the right goal and attacks the left one (the human hosts on the left).
export class OnlineBotAI extends BotAI {
  constructor(elo = 500, random = Math.random) {
    super(botLevelFor(elo));
    this.elo = Number(elo) || 500; this.random = random; this.topSpeed = botSpeedFor(elo);
    this.skill = clamp((this.elo - 350) / 800, 0, 1);
    this.mood = 'calm'; this.moodTime = 0; this.burst = 0; this.burstCooldown = 1; this.chase = 0; this.wallCooldown = 0; this.tackle = 0;
    this.wiggle = { phase: random() * 6.28, rate: 5 + random() * 4, amount: .3 + random() * .3 }; this.clock = 0;
  }
  setMood() {
    this.mood = MOODS[Math.floor(this.random() * MOODS.length)];
    this.moodTime = 2 + this.random() * 3.5;
    this.wiggle = { phase: this.random() * 6.28, rate: 4.5 + this.random() * 5, amount: .22 + this.random() * .35 };
  }
  pace(bot, factor = 1) { return Math.min(1.1, this.topSpeed * factor / (bot.maxSpeed || 305)); }
  steer(bot, target, speed, slow = 24) {
    const dx = target.x - bot.x, dy = target.y - bot.y, d = Math.hypot(dx, dy);
    if (d < 5) return { x: 0, y: 0, speed };
    const scale = d < slow ? Math.max(.35, d / slow) : 1;
    return { x: dx / d * scale, y: dy / d * scale, speed };
  }

  update(bot, ball, player, dt) {
    const world = ball.world || WORLD, centerY = (world.goalTop + world.goalBottom) / 2;
    this.clock += dt; this.moodTime -= dt; this.burst = Math.max(0, this.burst - dt); this.burstCooldown -= dt;
    this.chase = Math.max(0, this.chase - dt); this.wallCooldown -= dt; this.tackle = Math.max(0, this.tackle - dt);
    if (this.moodTime <= 0) this.setMood();
    const before = this.thinkTimer;
    const decision = super.update(bot, ball, player, dt);
    // Irregular reactions: sometimes quicker, sometimes slower than the level's average.
    if (this.thinkTimer > before) this.thinkTimer *= .5 + this.random() * .9;
    if (this.burstCooldown <= 0 && this.random() < dt * .9) { this.burst = .4 + this.random() * .4; this.burstCooldown = 1.6 + this.random() * 2.2; }
    const boost = this.burst > 0 ? 1.1 : 1;
    const contact = bot.radius + ball.radius, reach = contact + 14;
    const humanOnBall = dist(player, ball) < player.radius + ball.radius + 20;
    const botOnBall = dist(bot, ball) < reach + 6;
    const ownGoal = { x: world.right, y: centerY };

    // After a wall pass: run onto the rebound.
    if (this.chase > 0 && !humanOnBall) {
      const lead = { x: ball.x + (ball.vx || 0) * .28, y: ball.y + (ball.vy || 0) * .28 };
      const move = this.steer(bot, lead, this.pace(bot, 1.08), 6);
      return { ...decision, x: move.x, y: move.y, speedMultiplier: move.speed, kick: false, kickDirection: null, behavior: 'attack' };
    }

    // ---- Defending: the human has the ball, or a rolling ball will reach them first ----
    const rolling = Math.hypot(ball.vx || 0, ball.vy || 0) > 60;
    const humanFirst = !botOnBall && rolling && dist(player, ball) + 25 < dist(bot, ball);
    // A human holding the ball still for a while gets pressed anywhere.
    this.held = humanOnBall && !rolling ? (this.held || 0) + dt : 0;
    if (humanOnBall || humanFirst) {
      const ownHalf = this.held > 1.6 || ball.x > world.width * (this.mood === 'eager' ? .46 : this.mood === 'pounce' ? .58 : .52);
      const lane = unit(ownGoal.x - ball.x, ownGoal.y - ball.y);
      let target;
      if (ownHalf) {
        // Out to press: on the ball–goal line, close to the ball; step in to tackle at times.
        const close = dist(bot, ball);
        if (this.tackle <= 0 && close < 95 && this.random() < dt * (this.mood === 'eager' ? 3.2 : this.mood === 'pounce' ? 4.5 : 1.6) * (.6 + this.skill)) this.tackle = .35 + this.random() * .25;
        const gap = this.tackle > 0 ? 0 : this.mood === 'calm' ? 62 : 44;
        target = { x: ball.x + lane.x * gap + (ball.vx || 0) * .12, y: ball.y + lane.y * gap + (ball.vy || 0) * .12 };
      } else {
        // Ball in the human's half: wait near halfway, on the line between the ball and our goal.
        const x = Math.max(world.width * (this.mood === 'pounce' ? .64 : .58), ball.x + 160);
        const t = (x - ball.x) / (ownGoal.x - ball.x || 1);
        target = { x, y: ball.y + (ownGoal.y - ball.y) * clamp(t, 0, 1) };
      }
      target.x = clamp(target.x, world.left + bot.radius, world.right - bot.radius);
      target.y = clamp(target.y, world.top + bot.radius, world.bottom - bot.radius);
      const speed = this.pace(bot, (ownHalf ? 1 : .82) * boost);
      const move = this.steer(bot, target, speed, ownHalf ? 10 : 30);
      // A loose touch on the ball while defending: clear it forward (BotAI's kick, aimed at goal).
      return { ...decision, x: move.x, y: move.y, speedMultiplier: move.speed, behavior: 'defend', powered: false };
    }

    // A still, loose ball nobody is near: go and take it. (The base AI would keep guarding the goal,
    // and with an idle human both would wait forever.)
    const loose = !rolling && !humanOnBall && dist(player, ball) > 150;
    if (loose && decision.behavior === 'defend') {
      const goalY = centerY + (this.random() - .5) * 40;
      const back = unit(ball.x - (world.left - 4), ball.y - goalY), offset = bot.radius + 14;
      const behind = { x: clamp(ball.x + back.x * offset, world.left + bot.radius, world.right - bot.radius), y: clamp(ball.y + back.y * offset, world.top + bot.radius, world.bottom - bot.radius) };
      const ready = botOnBall && bot.shotCooldown <= 0;
      const move = ready ? this.steer(bot, ball, this.pace(bot, boost), 4) : this.steer(bot, behind, this.pace(bot, boost), 8);
      return { ...decision, x: move.x, y: move.y, speedMultiplier: move.speed, kick: ready, kickDirection: ready ? { x: world.left - 4 - ball.x, y: goalY - ball.y } : null, powered: false, behavior: 'attack' };
    }

    let { x, y } = decision;
    let speed = Math.max(decision.speedMultiplier || 0, this.pace(bot, boost));
    let kick = decision.kick, kickDirection = decision.kickDirection, powered = false, power;
    const goalDistance = ball.x - world.left;

    // ---- Wall pass: blocked in midfield or near a corner, play it off the side wall ----
    if (botOnBall && bot.shotCooldown <= 0 && this.wallCooldown <= 0) {
      const toGoal = unit(world.left - ball.x, centerY - ball.y);
      const relX = player.x - ball.x, relY = player.y - ball.y;
      const along = relX * toGoal.x + relY * toGoal.y, lateral = Math.abs(toGoal.x * relY - toGoal.y * relX);
      const blocked = along > -5 && along < 170 && lateral < player.radius + ball.radius + 45;
      const midfield = ball.x > world.width * .28 && ball.x < world.width * .74;
      const corner = ball.x < world.left + 240 && Math.abs(ball.y - centerY) > (world.goalBottom - world.goalTop) / 2 + 30;
      const wallY = player.y >= ball.y ? world.top + ball.radius : world.bottom - ball.radius;
      const toWall = Math.abs(wallY - ball.y);
      if (blocked && (midfield || corner) && toWall < 260 && this.random() < .35 + this.skill * .45) {
        this.wallCooldown = 1.6 + this.random() * 1.6;
        const ahead = corner ? Math.max(50, toWall * .6) : Math.max(90, toWall * 1.05);
        kickDirection = { x: Math.max(world.left + 30, ball.x - ahead) - ball.x, y: wallY - ball.y };
        kick = true; power = corner ? .62 : .74; this.chase = 1.1 + this.random() * .5;
        return { ...decision, x: 0, y: 0, speedMultiplier: speed, kick, kickDirection, powered: false, power, behavior: 'wall' };
      }
    }

    // Carrying: swerve (feints) instead of running in a straight line.
    if (decision.behavior === 'attack' && dist(bot, ball) < reach + 30) {
      const wave = Math.sin(this.clock * this.wiggle.rate + this.wiggle.phase) * this.wiggle.amount;
      const nx = x - y * wave, ny = y + x * wave, length = Math.hypot(nx, ny) || 1;
      x = nx / length; y = ny / length;
    }
    // Early strikes from distance when the lane is free.
    if (!kick && dist(bot, ball) <= reach && bot.shotCooldown <= 0 && goalDistance < 540 && this.random() < dt * (this.mood === 'eager' ? 1.2 : .7)) {
      const blocked = player.x < ball.x && Math.abs(player.y - ball.y) < 70;
      if (!blocked) { kick = true; kickDirection = { x: world.left - 4 - ball.x, y: centerY - ball.y }; }
    }
    if (kick && kickDirection && kickDirection.x < 0 && !power) {
      // Vary the target: a post away from the human, or the open side, with a little noise.
      const top = world.goalTop + 20, bottom = world.goalBottom - 20;
      const away = player.y < (top + bottom) / 2 ? bottom : top;
      const r = this.random();
      const aimY = r < .55 ? away : r < .8 ? (top + bottom) / 2 + (this.random() - .5) * 60 : (away === top ? bottom : top);
      const noise = (1 - this.skill) * 30 * (this.random() - .5);
      kickDirection = { x: world.left - 4 - ball.x, y: clamp(aimY + noise, top - 10, bottom + 10) - ball.y };
      powered = bot.powerCooldown <= 0 && goalDistance < 620 && this.random() < .35;
    }
    return { ...decision, x, y, speedMultiplier: speed, kick, kickDirection, powered, power };
  }
}

// 2v2: the host moves the bot seats. SquadAI plans the team play (seat 0 is always the human host
// on the left; it already plays balls off the walls); on top of it the bots press in their own half
// covering the way to goal, change pace and swerve with the ball.
export class OnlineSquadBots {
  constructor({ seats = [], elos = {}, random = Math.random } = {}) {
    this.seats = new Set(seats); this.random = random;
    const level = seat => botLevelFor(elos[seat]);
    const rivalSeat = [2, 3].find(seat => this.seats.has(seat)), mateSeat = this.seats.has(1) ? 1 : null;
    this.squad = new SquadAI({ difficulty: rivalSeat ? level(rivalSeat) : 'normal', mateLevel: mateSeat ? level(mateSeat) : 'normal' });
    this.speeds = Object.fromEntries([...this.seats].map(seat => [seat, botSpeedFor(elos[seat])]));
    this.state = Object.fromEntries([...this.seats].map(seat => [seat, { burst: 0, cooldown: random() * 2, phase: random() * 6.28, rate: 5 + random() * 4, press: random() < .6 }]));
    this.clock = 0;
  }
  // The human passed: the bot teammate runs onto it (SquadAI's own behaviour).
  expectPass(target) { this.squad.expectPass?.(target); }
  update(bodies, ball, dt) {
    this.clock += dt;
    const plan = this.squad.update(bodies, ball, dt), commands = {};
    for (const seat of this.seats) {
      const body = bodies[seat]; if (!body) continue;
      const state = this.state[seat], command = { ...(plan[seat] || { x: 0, y: 0 }) };
      state.cooldown -= dt; state.burst = Math.max(0, state.burst - dt);
      if (state.cooldown <= 0) { state.cooldown = 1.5 + this.random() * 2.5; state.press = this.random() < .65; if (this.random() < .5) state.burst = .4 + this.random() * .4; }
      const left = seat < 2;
      const rivals = bodies.filter((_, index) => (index < 2) !== left);
      const rivalOnBall = rivals.find(rival => dist(rival, ball) < rival.radius + ball.radius + 20);
      // Press in our own half: on the line between the ball and our goal, close to the ball.
      const world = ball.world || WORLD, ownHalf = left ? ball.x < world.width * .52 : ball.x > world.width * .48;
      if (rivalOnBall && state.press && ownHalf && dist(body, ball) < 320 && !command.kick) {
        const goal = { x: left ? world.left : world.right, y: (world.goalTop + world.goalBottom) / 2 };
        const lane = unit(goal.x - ball.x, goal.y - ball.y), gap = dist(body, ball) < 90 ? 0 : 40;
        const target = { x: ball.x + lane.x * gap, y: ball.y + lane.y * gap }, length = dist(body, target) || 1;
        command.x = (target.x - body.x) / length; command.y = (target.y - body.y) / length;
      }
      // Swerve when carrying the ball.
      if (dist(body, ball) < body.radius + ball.radius + 30 && !command.kick) {
        const wave = Math.sin(this.clock * state.rate + state.phase) * .35;
        const nx = command.x - command.y * wave, ny = command.y + command.x * wave, length = Math.hypot(nx, ny) || 1;
        if (Math.hypot(command.x, command.y) > .2) { command.x = nx / length; command.y = ny / length; }
      }
      const base = Math.max(command.speed ?? 1, Math.min(1.08, this.speeds[seat] / (body.maxSpeed || 305)));
      command.speed = state.burst > 0 ? Math.min(1.1, base * 1.1) : base;
      commands[seat] = command;
    }
    return commands;
  }
}
