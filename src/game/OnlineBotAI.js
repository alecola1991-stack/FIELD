import { BotAI } from './BotAI.js';
import { SquadAI } from './SquadAI.js';
import { WORLD } from '../config/settings.js';

// Bots that fill online rooms (Arcade gameplay, run by the match host). They play like an
// aggressive human: they press the ball high, change pace, swerve with the ball, vary their shots
// (posts, early strikes, fire shots) and switch moods every few seconds, so they are hard to read.
// Their level comes from their ELO (a little below the human they face).

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function botLevelFor(elo) {
  const value = Number(elo) || 500;
  return value < 440 ? 'easy' : value < 600 ? 'normal' : value < 780 ? 'hard' : value < 980 ? 'pro' : 'champions';
}
// Top speed (px/s) of a bot by ELO: close to a human's 305, a little less for low ratings.
export function botSpeedFor(elo) { return clamp(250 + ((Number(elo) || 500) - 500) * .07, 238, 298); }
const MOODS = ['press', 'press', 'press', 'normal', 'normal', 'bait'];

// 1v1: the bot defends the right goal and attacks the left one (the human hosts on the left).
export class OnlineBotAI extends BotAI {
  constructor(elo = 500, random = Math.random) {
    super(botLevelFor(elo));
    this.elo = Number(elo) || 500; this.random = random; this.topSpeed = botSpeedFor(elo);
    this.mood = 'press'; this.moodTime = 0; this.burst = 0; this.burstCooldown = 1;
    this.wiggle = { phase: random() * 6.28, rate: 5 + random() * 4, amount: .3 + random() * .3 }; this.clock = 0;
  }
  setMood() {
    this.mood = MOODS[Math.floor(this.random() * MOODS.length)];
    this.moodTime = 1.6 + this.random() * 3.2;
    this.wiggle = { phase: this.random() * 6.28, rate: 4.5 + this.random() * 5, amount: .25 + this.random() * .4 };
  }
  update(bot, ball, player, dt) {
    const world = ball.world || WORLD;
    this.clock += dt; this.moodTime -= dt; this.burst = Math.max(0, this.burst - dt); this.burstCooldown -= dt;
    if (this.moodTime <= 0) this.setMood();
    const before = this.thinkTimer;
    const decision = super.update(bot, ball, player, dt);
    // Irregular reactions: sometimes quicker, sometimes slower than the level's average.
    if (this.thinkTimer > before) this.thinkTimer *= .5 + this.random() * .9;
    const reach = bot.radius + ball.radius + 14;
    const humanOnBall = dist(player, ball) < player.radius + ball.radius + 20;
    const pace = speed => Math.min(1.08, speed / (bot.maxSpeed || 305));
    let speed = Math.max(decision.speedMultiplier || 0, pace(this.topSpeed * (this.mood === 'bait' ? .85 : 1)));
    // Bursts of pace at random moments.
    if (this.burstCooldown <= 0 && this.random() < dt * 1.2) { this.burst = .45 + this.random() * .4; this.burstCooldown = 1.4 + this.random() * 2; }
    if (this.burst > 0) speed = Math.min(1.1, speed * 1.12);
    let { x, y } = decision;
    // Pressing: go for the ball high up the pitch when the human has it (except in "bait" mood,
    // which waits a little deeper and then jumps in).
    const pressLine = this.mood === 'press' ? .28 : this.mood === 'bait' ? .5 : .4;
    if (humanOnBall && ball.x > world.width * pressLine && dist(bot, ball) < (this.mood === 'press' ? 520 : 320)) {
      const lead = clamp(dist(bot, ball) / 420, .05, .3);
      const target = { x: ball.x + (ball.vx || 0) * lead + 6, y: ball.y + (ball.vy || 0) * lead };
      const length = Math.hypot(target.x - bot.x, target.y - bot.y) || 1;
      x = (target.x - bot.x) / length; y = (target.y - bot.y) / length;
      if (this.mood === 'bait' && dist(bot, ball) < 170) { this.burst = Math.max(this.burst, .4); speed = Math.min(1.1, speed * 1.12); }
    }
    // With the ball: swerve (feints) instead of running in a straight line.
    if (decision.behavior === 'attack' && dist(bot, ball) < reach + 30) {
      const wave = Math.sin(this.clock * this.wiggle.rate + this.wiggle.phase) * this.wiggle.amount;
      const nx = x - y * wave, ny = y + x * wave, length = Math.hypot(nx, ny) || 1;
      x = nx / length; y = ny / length;
    }
    let kick = decision.kick, kickDirection = decision.kickDirection, powered = false;
    const ballDistance = dist(bot, ball), goalDistance = ball.x - world.left;
    // Early strikes from distance when the lane is free.
    if (!kick && ballDistance <= reach && bot.shotCooldown <= 0 && goalDistance < 560 && this.random() < dt * (this.mood === 'press' ? 1.4 : .8)) {
      const blocked = player.x < ball.x && Math.abs(player.y - ball.y) < 70;
      if (!blocked) { kick = true; kickDirection = { x: world.left - 4 - ball.x, y: world.height / 2 - ball.y }; }
    }
    if (kick && kickDirection && kickDirection.x < 0) {
      // Vary the target: a post away from the human, or the open side, with a little noise.
      const top = world.goalTop + 20, bottom = world.goalBottom - 20;
      const away = player.y < (top + bottom) / 2 ? bottom : top;
      const r = this.random();
      const aimY = r < .55 ? away : r < .8 ? (top + bottom) / 2 + (this.random() - .5) * 60 : (away === top ? bottom : top);
      const noise = (1 - Math.min(1, (this.elo - 300) / 900)) * 30 * (this.random() - .5);
      kickDirection = { x: world.left - 4 - ball.x, y: clamp(aimY + noise, top - 10, bottom + 10) - ball.y };
      powered = bot.powerCooldown <= 0 && goalDistance < 620 && this.random() < .35;
    }
    return { ...decision, x, y, speedMultiplier: speed, kick, kickDirection, powered };
  }
}

// 2v2: the host moves the bot seats. SquadAI plans the team play (seat 0 is always the human host
// on the left); on top of it the bots press harder, change pace and swerve with the ball.
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
      // Aggressive press on whoever has the ball nearby.
      if (rivalOnBall && state.press && dist(body, ball) < 300 && !command.kick) {
        const length = dist(body, ball) || 1;
        command.x = (ball.x - body.x) / length; command.y = (ball.y - body.y) / length;
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
