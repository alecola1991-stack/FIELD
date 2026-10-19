import { WORLD } from '../config/settings.js';
import { canKickBall } from './Physics.js';
import { tacticalPass as passFor, curvedPassAim } from './Tactical.js';
import { TacticalAI, TACTICAL_AI_LEVELS } from './TacticalAI.js';

// Team AI for the offline "Táctico" squads (2v2, 3v3, 7v7), modelled on how football games drive the
// players the user does not control:
//  - Every player is an individual: their own reaction time, pace, width/depth habits and flair, and
//    they rethink their position on their own clock (never all on the same frame). They notice a
//    change of possession a little late and turn in arcs instead of on the spot.
//  - Shape: a formation spot per role that slides with the ball (up when attacking, back when
//    defending).
//  - Attacking off the ball: support at an angle with a clear passing lane, come short when the
//    carrier is pressed, make forward runs into space (and the passer of a give-and-go runs for the
//    return), keep apart from teammates.
//  - With the ball: weigh every teammate (ground gained, how open they are, runners, shooting chances)
//    against carrying it; pass to beat the press, play one-twos and through balls, shoot in range.
//  - Defending: one presser (kept while it is the right one), a cover player goal-side of the ball, the
//    rest mark the nearest attackers in their zone or hold their spot.
// The player the human controls is skipped (`update(bodies, ball, dt, controlled)`).

export const SEVEN_ROLES = Object.freeze(['forward', 'midC', 'keeper', 'defL', 'defR', 'midL', 'midR']);
export const TRIO_ROLES = Object.freeze(['forward', 'midC', 'keeper']);
export const DUO_ROLES = Object.freeze(['forward', 'midC']);
// Spots as [fraction of the pitch length from our own goal line, fraction of its width].
export const SEVEN_SPOTS = Object.freeze({
  forward: [.62, .5], midC: [.42, .5], midL: [.47, .17], midR: [.47, .83], defL: [.2, .3], defR: [.2, .7],
});
export const SEVEN_KICKOFF = Object.freeze({
  forward: [.47, .5], midC: [.36, .5], midL: [.4, .18], midR: [.4, .82], defL: [.19, .32], defR: [.19, .68],
});
const TRIO_SPOTS = Object.freeze({ forward: [.6, .48], midC: [.38, .56] });
const DUO_SPOTS = Object.freeze({ forward: [.58, .4], midC: [.42, .62] });
// How long each role is happy to keep the ball before looking for a pass.
const HOLD_LIMIT = { defL: .6, defR: .6, midC: 1, midL: 1.1, midR: 1.1, forward: 2.2 };
// Who makes forward runs (and how keen they are).
const RUNNERS = { forward: 1, midL: .8, midR: .8, midC: .45, defL: .12, defR: .12 };

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const unit = (x, y) => { const length = Math.hypot(x, y) || 1; return { x: x / length, y: y / length }; };

export class SquadTactics extends TacticalAI {
  constructor(options = {}) {
    super(options);
    this.roles = options.roles || null; this.spots = options.spots || SEVEN_SPOTS;
    this.teamState = [{ presser: null, presserFor: 0, cover: null, marks: new Map(), markIn: 0 }, { presser: null, presserFor: 0, cover: null, marks: new Map(), markIn: 0 }];
    this.incoming = new Map(); // receiver → { time } for passes in flight
  }

  // In team modes the players' pace is closer to the human's (as in football games, where the player
  // you control is not faster than the rest); the level still sets reactions, passing and pressing.
  config(stars, level) {
    const config = super.config(stars, level);
    return { ...config, speed: .86 + (config.speed - .66) * .55 };
  }

  // ---- Individual character ---------------------------------------------------------------------
  persona(body) {
    const brain = this.brain(body);
    if (!brain.persona) {
      const r = () => this.random();
      brain.persona = { react: .8 + r() * .5, pace: .95 + r() * .09, width: (r() - .5) * .09, depth: (r() - .5) * .07, flair: r(), runs: .6 + r() * .8, think: .28 + r() * .3 };
      brain.think = r() * brain.persona.think; // desynchronised from the first frame
    }
    return brain.persona;
  }
  roleOf(seat, size) { return (this.roles && this.roles[seat]) || (size === 7 ? SEVEN_ROLES : size === 3 ? TRIO_ROLES : DUO_ROLES)[seat % size]; }

  // A body the human stops controlling: it thinks again from scratch.
  release(body) { const brain = this.brain(body); Object.assign(brain, { think: 0, target: null, run: null, moveDir: null, heading: null, sees: null, noticeIn: null, hold: 0 }); }

  // The human passed (✕ / △): the receiver runs onto the ball.
  expectPass(target, receiver) {
    if (receiver) this.incoming.set(receiver, { time: 1.8, point: target ? { x: target.x, y: target.y } : null });
  }

  update(bodies, ball, dt, controlled = 0) {
    const commands = {}, size = bodies.length / 2, holder = this.possession?.holder || null;
    const configs = [this.config(this.mateStars, this.mateLevel), this.config(this.rivalStars, this.level)];
    const teams = [bodies.slice(0, size), bodies.slice(size)];
    const human = bodies[controlled] || null;
    for (const [receiver, pass] of this.incoming) { pass.time -= dt; if (pass.time <= 0 || holder) this.incoming.delete(receiver); }
    for (const side of [0, 1]) this.organise(side, teams, bodies, ball, dt, configs[side], human, size);
    for (let seat = 0; seat < bodies.length; seat++) {
      const body = bodies[seat]; if (!body || seat === controlled) continue;
      const side = seat < size ? 0 : 1, team = teams[side], role = this.roleOf(seat, size), brain = this.brain(body);
      this.persona(body);
      brain.timer -= dt;
      if (holder !== body) { brain.heading = null; brain.hold = 0; }
      const context = {
        noTick: true, ball, dt, attackRight: side === 0, team, mates: team.filter(other => other && other !== body), rivals: teams[1 - side],
        config: configs[side], stars: side === 0 ? this.mateStars : this.rivalStars, role, side, size,
        humanMate: human && team.includes(human) ? human : null, state: this.teamState[side],
      };
      let command = role === 'keeper' ? this.keeperPlay(body, context) : this.outfield(body, context);
      if (!command.kick && holder !== body) command = this.smooth(body, brain, command, dt, context.state.presser === body);
      commands[seat] = command;
    }
    return commands;
  }

  // Natural movement: the running direction turns in an arc (faster when jogging or pressing).
  smooth(body, brain, command, dt, pressing) {
    const length = Math.hypot(command.x, command.y);
    if (length < .05) { brain.moveDir = null; return command; }
    const want = Math.atan2(command.y, command.x);
    const speed = Math.hypot(body.vx || 0, body.vy || 0), rate = pressing ? 11 : speed > 200 ? 6 : 8.5;
    let current = brain.moveDir ?? (speed > 40 ? Math.atan2(body.vy, body.vx) : want);
    const diff = Math.atan2(Math.sin(want - current), Math.cos(want - current)), max = rate * dt;
    current += Math.abs(diff) <= max ? diff : Math.sign(diff) * max;
    brain.moveDir = current;
    // Slow down a little while turning hard.
    const turning = Math.abs(diff) > 1.2 ? .8 : 1;
    return { ...command, x: Math.cos(current) * length, y: Math.sin(current) * length, speed: (command.speed ?? 1) * turning };
  }

  // ---- Team organisation (per frame, per team) -------------------------------------------------
  organise(side, teams, bodies, ball, dt, config, human, size) {
    const state = this.teamState[side], team = teams[side], rivals = teams[1 - side];
    const holder = this.possession?.holder || null, ours = holder && team.includes(holder);
    const outfield = team.filter((body, index) => body && this.roleOf(index + side * size, size) !== 'keeper');
    const ai = outfield.filter(body => body !== human);
    const target = holder || ball;
    // Presser: the closest AI player, kept until another one is clearly better placed.
    state.presserFor += dt;
    if (ours) { state.presser = null; state.cover = null; }
    else {
      const sorted = ai.slice().sort((a, b) => dist(a, target) - dist(b, target));
      const humanClosest = human && outfield.includes(human) && dist(human, target) < dist(sorted[0] || human, target) - 10;
      const best = humanClosest ? null : sorted[0] || null;
      const keep = state.presser && ai.includes(state.presser) && !humanClosest && (state.presserFor < .7 || dist(state.presser, target) < dist(best, target) + 70);
      if (!keep && state.presser !== best) { state.presser = best; state.presserFor = 0; }
      // Cover: the next one, goal-side of the ball (only while a rival has it).
      state.cover = holder ? sorted.find(body => body !== state.presser && dist(body, target) < 320) || null : null;
    }
    // Marking: every ~0.8 s assign the rival attackers (closest to our goal first) to free defenders.
    state.markIn -= dt;
    if (state.markIn <= 0) {
      state.markIn = .7 + this.random() * .3;
      const ownGoalX = side === 0 ? (ball.world || WORLD).left : (ball.world || WORLD).right;
      const threats = rivals.filter((rival, index) => rival && rival !== holder && this.roleOf(index + (1 - side) * size, size) !== 'keeper')
        .sort((a, b) => Math.abs(a.x - ownGoalX) - Math.abs(b.x - ownGoalX));
      const free = new Set(ai.filter(body => body !== state.presser && body !== state.cover));
      const marks = new Map();
      for (const threat of threats) {
        let pick = null;
        for (const body of free) {
          const previous = state.marks.get(body) === threat ? .75 : 1;
          if (!pick || dist(body, threat) * previous < pick.d) pick = { body, d: dist(body, threat) * previous };
        }
        if (pick && pick.d < 420) { marks.set(pick.body, threat); free.delete(pick.body); }
      }
      state.marks = marks;
    }
  }

  // Formation spot for a role, sliding with the ball, plus this player's own habits.
  spot(role, context, persona = null) {
    const { ball, attackRight } = context, world = ball.world || WORLD, length = world.right - world.left, width = world.bottom - world.top;
    const table = context.size === 3 ? TRIO_SPOTS : context.size === 2 ? DUO_SPOTS : this.spots;
    const [baseX, baseY] = table[role] || table.midC || [.4, .5];
    const holder = this.possession?.holder, attacking = !!holder && context.team.includes(holder);
    const bx = clamp(attackRight ? (ball.x - world.left) / length : (world.right - ball.x) / length, 0, 1), by = clamp((ball.y - world.top) / width, 0, 1);
    let x = baseX + (bx - .5) * .5 + (attacking ? .18 : -.03) + (persona?.depth || 0);
    if (!attacking && role.startsWith('def')) x = Math.min(x, bx - .06);
    x = clamp(x, .05, role === 'forward' ? .92 : role.startsWith('def') ? .7 : .86);
    const y = clamp(baseY + (by - .5) * .3 + (persona?.width || 0), .06, .94);
    return { x: attackRight ? world.left + x * length : world.right - x * length, y: world.top + y * width };
  }
  inside(point, world, pad = 40) {
    return { x: clamp(point.x, world.left + pad, world.right - pad), y: clamp(point.y, world.top + pad, world.bottom - pad) };
  }

  // ---- Outfield players --------------------------------------------------------------------------
  outfield(body, context) {
    const { ball, config, team, role, dt, state } = context, world = ball.world || WORLD;
    const holder = this.possession?.holder || null, brain = this.brain(body), persona = this.persona(body);
    const pace = config.speed * persona.pace;
    if (holder === body) return this.carry(body, context, brain, world);
    // A pass is coming to me: meet the ball.
    if (this.incoming.has(body) && !holder) return this.meetBall(body, ball, pace * 1.04);
    // Kick-off for the other team: wait in position.
    if (this.kickoff && this.kickoff.left !== context.attackRight) return this.moveTo(body, this.spot(role, context, persona), pace * .7);
    // Possession changes are noticed a moment late (better levels sooner).
    const ours = holder ? team.includes(holder) : null;
    if (ours !== null && brain.sees !== ours) {
      brain.noticeIn = brain.noticeIn ?? config.react * persona.react * 1.3;
      brain.noticeIn -= dt;
      if (brain.noticeIn <= 0) { brain.sees = ours; brain.noticeIn = null; brain.think = 0; brain.run = null; }
    } else brain.noticeIn = null;
    brain.think = (brain.think ?? 0) - dt;
    if (brain.run) { brain.run.time -= dt; if (brain.run.time <= 0 || (holder && !team.includes(holder))) brain.run = null; }
    // Loose ball: the closest goes for it; a ball rolling my way is intercepted.
    if (!holder) {
      if (state.presser === body || dist(body, ball) < 90) return this.decide(body, { ...context, mates: [] });
      const speed = Math.hypot(ball.vx || 0, ball.vy || 0);
      if (speed > 120) {
        const along = ((body.x - ball.x) * ball.vx + (body.y - ball.y) * ball.vy) / speed;
        const off = Math.abs((body.x - ball.x) * ball.vy - (body.y - ball.y) * ball.vx) / speed;
        if (along > 0 && along < 380 && off < 70) return this.meetBall(body, ball, pace);
      }
    }
    if (brain.sees === true || (!holder && brain.sees !== false)) return this.attackShape(body, context, brain, persona, pace, world);
    return this.defendShape(body, context, brain, persona, pace, world);
  }

  meetBall(body, ball, speed) {
    const v = Math.hypot(ball.vx || 0, ball.vy || 0);
    if (v < 30) return this.moveTo(body, ball, speed, 4);
    const along = Math.max(25, ((body.x - ball.x) * ball.vx + (body.y - ball.y) * ball.vy) / v);
    return this.moveTo(body, { x: ball.x + ball.vx / v * along, y: ball.y + ball.vy / v * along }, speed, 4);
  }

  attackShape(body, context, brain, persona, pace, world) {
    const holder = this.possession?.holder || null;
    if (brain.run) return this.moveTo(body, brain.run.point, pace * 1.02, 10);
    if (brain.think <= 0 || !brain.target) {
      brain.think = persona.think * persona.react;
      brain.target = holder && context.team.includes(holder) ? this.supportPoint(body, holder, context, brain, persona, world) : this.spot(context.role, context, persona);
      brain.jog = dist(body, brain.target) < 160;
    }
    if (brain.run) return this.moveTo(body, brain.run.point, pace * 1.02, 10);
    return this.moveTo(body, brain.target, pace * (brain.jog ? .72 : .92), 40);
  }

  // Where to be when a teammate has the ball.
  supportPoint(body, holder, context, brain, persona, world) {
    const { role, rivals, attackRight, config } = context, forward = attackRight ? 1 : -1;
    const pressure = Math.min(...rivals.filter(Boolean).map(rival => dist(rival, holder)), 999);
    // Forward run into space (forwards and wide players above all).
    const keen = (RUNNERS[role] ?? .3) * persona.runs * (.5 + config.pass * .6);
    const goalLine = attackRight ? world.right : world.left;
    const roomAhead = Math.abs(goalLine - body.x) > 180;
    if (roomAhead && this.random() < keen * .3) {
      const startX = forward > 0 ? Math.max(body.x, holder.x) : Math.min(body.x, holder.x);
      let point = { x: startX + forward * (170 + this.random() * 150), y: body.y + (this.random() - .5) * 140 };
      // Into the channel away from the nearest defender.
      const marker = rivals.filter(Boolean).reduce((best, rival) => !best || dist(rival, point) < dist(best, point) ? rival : best, null);
      if (marker && dist(marker, point) < 90) point.y += point.y > marker.y ? 70 : -70;
      point.x = forward > 0 ? Math.min(point.x, goalLine - 70) : Math.max(point.x, goalLine + 70);
      brain.run = { point: this.inside(point, world, 50), time: 1.1 + this.random() * .9 };
      return brain.run.point;
    }
    // The carrier is under pressure: come short at an angle with a clear lane.
    if (pressure < 120 && dist(body, holder) < 340) {
      const toGoal = Math.atan2(0, forward), side = body.y > holder.y ? 1 : -1;
      for (const angle of [side * 1.9, side * 1.35, -side * 1.9, side * 2.5, -side * 1.35]) {
        const radius = 135 + this.random() * 40;
        const point = this.inside({ x: holder.x + Math.cos(toGoal + angle) * radius, y: holder.y + Math.sin(toGoal + angle) * radius }, world, 50);
        if (this.passLane(holder, point, rivals, 70, 32)) return this.apart(point, body, context.mates, world);
      }
    }
    // Otherwise: my spot, nudged until the passing lane from the ball is clear.
    let point = this.spot(role, context, persona);
    if (!this.passLane(holder, point, rivals, 60, 32)) {
      for (const [dx, dy] of [[0, 75], [0, -75], [-forward * 60, 55], [-forward * 60, -55], [forward * 60, 0]]) {
        const option = this.inside({ x: point.x + dx, y: point.y + dy }, world, 50);
        if (this.passLane(holder, option, rivals, 60, 32)) { point = option; break; }
      }
    }
    return this.apart(point, body, context.mates, world);
  }

  // Keep away from teammates (no two players in the same spot).
  apart(point, body, mates, world) {
    let { x, y } = point;
    for (const mate of mates) {
      if (!mate || mate === body) continue;
      const d = Math.hypot(x - mate.x, y - mate.y);
      if (d < 105) { const push = unit(x - mate.x || 1, y - mate.y); x += push.x * (105 - d); y += push.y * (105 - d); }
    }
    return this.inside({ x, y }, world, 40);
  }

  defendShape(body, context, brain, persona, pace, world) {
    const { ball, attackRight, state, config, role } = context, holder = this.possession?.holder || null;
    const ownGoal = { x: attackRight ? world.left : world.right, y: (world.goalTop + world.goalBottom) / 2 };
    if (state.presser === body) return this.decide(body, { ...context, mates: [] });
    if (holder) {
      const danger = dist(holder, ownGoal) < 560;
      // The cover player stops backing off and tackles near our goal, or once the presser is beaten.
      const presser = state.presser, beaten = !presser || Math.abs(presser.x - ownGoal.x) > Math.abs(holder.x - ownGoal.x) + 10;
      if (state.cover === body && (danger || beaten)) return this.decide(body, { ...context, mates: [] });
      // Zonal step-out: a rival dribbling right past me (further out near our goal).
      if (dist(body, holder) < (role.startsWith('def') ? 120 : 95) * (danger ? 1.4 : 1)) return this.decide(body, { ...context, mates: [] });
    }
    if (brain.think <= 0 || !brain.target) {
      brain.think = persona.think * persona.react;
      const point = holder || ball;
      if (state.cover === body && holder) {
        // Cover / contain: goal-side of the ball, close enough to step in.
        const lane = unit(ownGoal.x - point.x, ownGoal.y - point.y), gap = 85 + (1 - config.press) * 50;
        brain.target = { x: point.x + lane.x * gap, y: point.y + lane.y * gap };
      } else if (state.marks.has(body)) {
        // Marking: goal-side of my man, a little towards the ball; looser far from the ball.
        const man = state.marks.get(body), lane = unit(ownGoal.x - man.x, ownGoal.y - man.y), tight = 30 + (1 - config.press) * 35;
        const mark = { x: man.x + lane.x * tight + (point.x - man.x) * .12, y: man.y + lane.y * tight + (point.y - man.y) * .12 };
        const zone = this.spot(role, context, persona), far = clamp((dist(man, point) - 350) / 400, 0, .6);
        brain.target = { x: mark.x + (zone.x - mark.x) * far, y: mark.y + (zone.y - mark.y) * far };
      } else brain.target = this.spot(role, context, persona);
      brain.target = this.inside(brain.target, world, 30);
      brain.jog = dist(body, brain.target) < 120;
    }
    return this.moveTo(body, brain.target, pace * (brain.jog ? .7 : .95), 30);
  }

  // ---- The player on the ball ------------------------------------------------------------------
  carry(body, context, brain, world) {
    const { ball, attackRight, rivals, config, stars, role, dt, team } = context;
    const persona = this.persona(body);
    brain.hold = (brain.hold || 0) + dt;
    if (role === 'forward' && this.kickoff) { const kick = this.kickoffPass(body, team[1], context); if (kick) return kick; }
    const forward = attackRight ? 1 : -1, goalX = attackRight ? world.right : world.left;
    const toGoal = Math.abs(goalX - body.x), pastHalf = attackRight ? body.x > world.width / 2 : body.x < world.width / 2;
    const threat = rivals.filter(Boolean).reduce((best, rival) => (!best || dist(rival, body) < dist(best, body) ? rival : best), null);
    const pressure = threat ? dist(threat, body) : Infinity;
    if (brain.wall) { brain.wall.time -= dt; if (brain.wall.time <= 0) brain.wall = null; }
    if (canKickBall(body, ball) && body.shotCooldown <= 0 && brain.timer <= 0) {
      brain.timer = config.react * persona.react;
      const defender = role.startsWith('def');
      const range = config.range * (defender ? .6 : role === 'forward' ? 1 : .9) * (context.size === 7 ? 1.08 : 1);
      if (pastHalf && toGoal < range) return this.shoot(body, ball, { attackRight, rivals, config, world });
      // A bit further out: shoot when there is a clear sight of goal (the bolder, the further).
      const goal = { x: goalX, y: (world.goalTop + world.goalBottom) / 2 }, reach = range * (1.2 + persona.flair * .25);
      if (pastHalf && !defender && dist(body, goal) < reach && this.passLane(ball, goal, rivals.filter((rival, index) => this.roleOf(index + (attackRight ? context.size : 0), context.size) !== 'keeper'), 0, 24) && this.random() < .45 + persona.flair * .3) return this.shoot(body, ball, { attackRight, rivals, config, world });
      const option = this.bestOption(body, context, world);
      // Value of keeping the ball: free space in front, minus the pressure on me.
      const ahead = rivals.filter(Boolean).filter(rival => (rival.x - body.x) * forward > -10 && Math.abs(rival.y - body.y) < Math.abs(rival.x - body.x) * 1.4 + 30);
      const room = Math.min(260, ...ahead.map(rival => dist(rival, body)));
      const keep = room * .45 - (pressure < 100 ? 90 : pressure < 150 ? 35 : 0) + persona.flair * 25;
      const wall = brain.wall && option && option.mate === brain.wall.from && option.gain > 20;
      const tooLong = brain.hold > (HOLD_LIMIT[role] || 1) && option && option.gain > -20;
      const beatPress = pressure < 110 && option;
      const better = option && option.value > keep + 70 - config.pass * 45;
      if ((wall || beatPress || better || tooLong) && this.random() < .5 + config.pass * .5) return this.pass(body, option, context, world);
      // A defender closed down with nothing on: clear it long.
      if (defender && !option && pressure < 90) {
        const target = context.mates.filter(Boolean).reduce((best, mate) => !best || (mate.x - best.x) * forward > 0 ? mate : best, null);
        if (target) { const result = passFor(body, ball, { mates: [target], direction: { x: target.x - body.x, y: target.y - body.y }, world, attackRight }); return { x: 0, y: 0, speed: config.speed, kick: true, aim: result.aim, power: .95, pass: true }; }
      }
    }
    return this.attack(body, { ball, dt, attackRight, mates: [], rivals, config }, brain, world);
  }

  // The best teammate to pass to (or null): ground gained, openness, runners and chances.
  bestOption(body, context, world) {
    const { ball, attackRight, mates, rivals, role, config } = context, forward = attackRight ? 1 : -1;
    const goalX = attackRight ? world.right : world.left;
    const ahead = rivals.filter(Boolean).map(rival => ({ x: rival.x + (rival.vx || 0) * .3, y: rival.y + (rival.vy || 0) * .3 }));
    let best = null;
    for (const mate of mates) {
      if (!mate) continue;
      const mateSeat = context.team.indexOf(mate) + (attackRight ? 0 : context.size);
      if (this.roleOf(mateSeat, context.size) === 'keeper' && !role.startsWith('def')) continue;
      const runner = ((mate.vx || 0) * forward) > 110;
      const lead = runner ? .45 : .2;
      const point = { x: mate.x + (mate.vx || 0) * lead, y: mate.y + (mate.vy || 0) * lead };
      const length = dist(ball, point); if (length < 60 || length > 540) continue;
      const lane = this.passLane(ball, point, rivals, 55 + length * .06, 28 + length * .03); if (!lane) continue;
      // Also where the defenders are heading (better passers read it).
      if (this.random() < .4 + config.pass * .6 && !this.passLane(ball, point, ahead, 45 + length * .05, 26 + length * .03)) continue;
      const gain = (point.x - body.x) * forward;
      const chance = Math.abs(goalX - point.x) < config.range * .9 ? 70 : 0;
      const value = gain + Math.min(lane.open, 200) * .45 + (runner ? 55 : 0) + chance - Math.max(0, length - 380) * .6 + (mate === context.humanMate ? 30 : 0);
      if (!best || value > best.value) best = { mate, value, gain, runner, length };
    }
    return best;
  }

  pass(body, option, context, world) {
    const { ball, attackRight, config, stars, role } = context, forward = attackRight ? 1 : -1, mate = option.mate;
    const result = passFor(body, ball, { mates: [mate], direction: { x: mate.x - body.x, y: mate.y - body.y }, through: option.runner, world, attackRight, firm: .2 + config.pass * .1 });
    let aim = result.aim, curve = 0;
    if (stars >= 4 && role.startsWith('mid') && option.length > 220 && this.random() < .5) {
      const curved = curvedPassAim(body, ball, result.target, result.power);
      if (curved) { aim = curved.aim; curve = curved.curve; }
    }
    // The receiver runs onto it; a forward pass may be a give-and-go (the passer runs for the return).
    this.incoming.set(mate, { time: 1.6 });
    const persona = this.persona(body), brain = this.brain(body);
    if (option.gain > -30 && !role.startsWith('def') && this.random() < .3 + persona.flair * .35 + config.pass * .15) {
      const goalLine = attackRight ? world.right : world.left;
      let x = body.x + forward * (160 + this.random() * 90); x = forward > 0 ? Math.min(x, goalLine - 70) : Math.max(x, goalLine + 70);
      brain.run = { point: this.inside({ x, y: body.y + (mate.y > body.y ? -40 : 40) }, world, 50), time: 1.3 };
      this.brain(mate).wall = { from: body, time: 1.8 };
    }
    return { x: 0, y: 0, speed: config.speed, kick: true, aim, power: result.power, curve, pass: true };
  }

  // ---- Goalkeeper --------------------------------------------------------------------------------
  keeperPlay(body, context) {
    const { ball, attackRight, config } = context, world = ball.world || WORLD;
    if (this.possession?.holder === body && canKickBall(body, ball) && body.shotCooldown <= 0) {
      const option = this.bestOption(body, { ...context, role: 'defL' }, world);
      const forward = attackRight ? 1 : -1;
      const target = option?.mate || context.mates.filter(Boolean).reduce((best, mate) => !best || (mate.x - body.x) * forward > (best.x - body.x) * forward ? mate : best, null);
      if (target) {
        const result = passFor(body, ball, { mates: [target], direction: { x: target.x - body.x, y: target.y - body.y }, world, attackRight });
        this.incoming.set(target, { time: 1.6 });
        return { x: 0, y: 0, speed: config.speed, kick: true, aim: result.aim, power: Math.max(result.power, option ? .6 : .95), pass: true };
      }
    }
    return this.keeper(body, context);
  }

  // Kick-off taken by the AI: a short pass back to the midfielder, as in real football.
  kickoffPass(body, mid, context) {
    const { ball, attackRight, config } = context, world = ball.world || WORLD;
    if (!this.kickoff || this.possession?.holder !== body || !mid || !canKickBall(body, ball) || body.shotCooldown > 0) return null;
    const result = passFor(body, ball, { mates: [mid], direction: { x: mid.x - body.x, y: mid.y - body.y }, world, attackRight, firm: .3 });
    this.incoming.set(mid, { time: 1.6 });
    return { x: 0, y: 0, speed: config.speed, kick: true, aim: result.aim, power: result.power, pass: true };
  }

  keeper(body, context) {
    const { ball, attackRight, config } = context, world = ball.world || WORLD;
    const holder = this.possession?.holder || null, line = attackRight ? world.left : world.right, inward = attackRight ? 1 : -1;
    const centerY = (world.goalTop + world.goalBottom) / 2;
    if (holder === body) return this.moveTo(body, { x: body.x + inward * 40, y: body.y }, config.speed);
    // Reflexes: the keeper reads the ball only every `keeper.react` seconds (it reacts late to a shot)
    // and moves slower than the outfield players. Both depend on the difficulty.
    const reflex = (TACTICAL_AI_LEVELS[attackRight ? this.mateLevel : this.level] || TACTICAL_AI_LEVELS.normal).keeper;
    const brain = this.brain(body);
    brain.readIn = (brain.readIn || 0) - context.dt;
    if (!brain.read || brain.readIn <= 0) { brain.read = { x: ball.x, y: ball.y, vx: ball.vx || 0, vy: ball.vy || 0 }; brain.readIn = reflex.react; }
    const seen = brain.read, speed = config.speed * reflex.speed;
    // Claim a ball that comes into the area (loose, or a rival dribbling in).
    const inArea = Math.abs(seen.x - line) < 150 && Math.abs(seen.y - centerY) < 150;
    if (inArea && (!holder || !(context.team || []).includes(holder))) return this.moveTo(body, { x: seen.x + seen.vx * .12, y: seen.y + seen.vy * .12 }, speed * 1.05, 4);
    // Stay on the line, covering the angle to the ball.
    const y = clamp(centerY + (seen.y - centerY) * .45, world.goalTop + 12, world.goalBottom - 12);
    return this.moveTo(body, { x: line + inward * 30, y }, speed);
  }
}

// Named team AIs per format (same brain, different shape).
export class DuoAI extends SquadTactics { constructor(options = {}) { super({ roles: [...DUO_ROLES, ...DUO_ROLES], ...options }); } }
export class TeamAI extends SquadTactics { constructor(options = {}) { super({ roles: [...TRIO_ROLES, ...TRIO_ROLES], ...options }); } }
export class SevenAI extends SquadTactics { constructor(options = {}) { super({ roles: [...SEVEN_ROLES, ...SEVEN_ROLES], spots: SEVEN_SPOTS, ...options }); } }
