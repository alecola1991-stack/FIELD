import { normalizeModifiers, modifierWorld } from '../config/modifiers.js';
import { WORLD } from '../config/settings.js';
import { Player } from './Player.js';
import { Ball } from './Ball.js';
import { Input } from './Input.js';
import { BotAI } from './BotAI.js';
import { Renderer } from './Renderer.js';
import { GameState } from './GameState.js';
import { getTeamById } from '../config/teams.js';
import { kickBall, resolveBallWalls, resolvePlayerBall, resolvePlayerPlayers, resolvePlayerWalls, isGoal } from './Physics.js';

const POWER_SHOT_COOLDOWN_SECONDS = 20;
const ONLINE_PACKET_INTERVAL = 1 / 30;

export class Game {
  constructor(canvas, settings, sound, hooks = {}) {
    this.canvas = canvas; this.settings = settings; this.sound = sound; this.hooks = hooks;
    this.renderer = new Renderer(canvas); this.input = new Input(); this.state = new GameState(); this.botAI = new BotAI(settings.difficulty);
    this.player = null; this.bot = null; this.ball = new Ball(WORLD.width / 2, WORLD.height / 2); this.trajectory = false;
    this.last = 0; this.raf = 0; this.boundLoop = time => this.loop(time); this.goalResetTimer = 0;
    this.countdown = 0; this.countdownClock = 0; this.fieldTheme = 'arcade'; this.competitionRound = 0;
    this.goalTarget = 5; this.shotRangeTimer = 0; this.autosaveClock = 0; this.powerHudClock = 0;
    this.onlineSnapshotClock = 0; this.onlineInputClock = 0; this.localSide = 'left'; this.onlineAuthority = true; this.remoteInput = { x: 0, y: 0, kick: false }; this.onlineMatchEnded = false; this.onlinePendingKick = false;
    this.matchStats = { shotsPlayer: 0, shotsOpponent: 0, goals: [] };
  }
  start(mode = 'bot', difficulty = this.settings.difficulty, options = {}) {
    this.state.start(mode); if (mode !== 'legends') this.settings.difficulty = difficulty; this.botAI.setDifficulty(mode === 'legends' ? 'legend' : difficulty);
    this.modifiers = normalizeModifiers(options.modifiers || this.settings.modifiers);
    this.world = modifierWorld(this.modifiers);
    const team = getTeamById(this.settings.teamId);
    this.fieldTheme = options.fieldTheme || (mode === 'training' ? 'training' : mode === 'tournament' ? 'champions' : 'arcade');
    this.competitionRound = options.competitionRound || 0;
    this.goalTarget = this.modifiers.goalTarget || (mode === 'league' ? (Number(options.goalTarget) || 2) : mode === 'tournament' ? 3 : 5);
    this.localSide = options.localSide === 'right' ? 'right' : 'left';
    this.onlineAuthority = mode !== 'online' || this.localSide === 'left';
    this.onlineSnapshotClock = 0; this.onlineInputClock = 0; this.remoteInput = { x: 0, y: 0, kick: false }; this.onlineMatchEnded = false; this.onlinePendingKick = false;
    this.lastOnlineAxes = null; this.onlineSnapshotAge = 0;
    this.input.enabled = true; this.input.down.clear(); this.input.pressed.clear();
    this.trajectory = !!this.settings.trajectory; this.shotRangeTimer = 0; this.autosaveClock = 0; this.powerHudClock = 0;
    const localX = this.localSide === 'left' ? WORLD.width * .31 : WORLD.width * .69;
    this.player = new Player({ x: localX, y: WORLD.height / 2, name: this.settings.name, number: this.settings.number, color: team?.primary || '#68746e', secondaryColor: team?.secondary || null, numberColor: team?.numberColor, kitPattern: team?.kitPattern });
    if (this.localSide === 'right') this.player.faceX = -1;
    const opponentTeam = options.opponentTeam || null;
    this.botAI.setTeamStrength(opponentTeam?.stars || 3);
    this.matchStats = { shotsPlayer: 0, shotsOpponent: 0, goals: [] };
    const opponentX = this.localSide === 'left' ? WORLD.width * .69 : WORLD.width * .31;
    const opponentName = mode === 'online' ? options.opponentName || 'RIVAL' : teamInitials(opponentTeam?.name || options.opponentName || 'BOT');
    const opponentNumber = mode === 'online' ? options.opponentNumber ?? 10 : [10, 9, 11][Math.floor(Math.random() * 3)];
    this.bot = mode !== 'training' ? new Player({ x: opponentX, y: WORLD.height / 2, name: opponentName, number: opponentNumber, color: opponentTeam?.primary || '#f19676', secondaryColor: opponentTeam?.secondary || null, numberColor: opponentTeam?.numberColor, kitPattern: opponentTeam?.kitPattern, isBot: mode !== 'online', speed: mode === 'online' ? 305 : 280 }) : null;
    if (this.bot && mode === 'online') this.bot.faceX = this.localSide === 'left' ? -1 : 1;
    this.ball.reset(WORLD.width / 2, WORLD.height / 2); this.goalResetTimer = 0; this.last = 0;
    this.applyModifiers();
    this.beginCountdown();
    if (!this.raf) this.raf = requestAnimationFrame(this.boundLoop);
    this.hooks.onStart?.(mode); this.hooks.onScore?.(0, 0); this.hooks.onTime?.('00:00');
  }
  applyModifiers() {
    this.modifiers = normalizeModifiers(this.modifiers); this.world = modifierWorld(this.modifiers);
    for (const body of [this.player, this.bot]) if (body) {
      body.radius = 22 * this.modifiers.playerSize;
      body.speedScale = this.modifiers.playerSpeed;
      body.maxSpeed = (body.isBot ? 280 : 305) * body.speedScale;
      body.shotPower = this.modifiers.shotPower; body.world = this.world;
    }
    this.ball.radius = 12 * this.modifiers.ballSize; this.ball.world = this.world;
    this.ball.maxSpeed = Ball.MAX_SPEED * Math.max(1, this.modifiers.shotPower);
  }
  updateSettings(settings) {
    this.settings = settings;
    if (this.player) {
      const team = getTeamById(settings.teamId);
      this.player.name = settings.name; this.player.number = settings.number;
      this.player.color = team?.primary || '#68746e'; this.player.secondaryColor = team?.secondary || null; this.player.numberColor = team?.numberColor || '#ffffff'; this.player.kitPattern = team?.kitPattern || 'half-vertical';
    }
    this.botAI.setDifficulty(this.state.mode === 'legends' ? 'legend' : settings.difficulty); this.trajectory = !!settings.trajectory;
  }
  setPaused(paused) { this.state.paused = paused; this.input.enabled = !paused; this.last = 0; this.input.down.clear(); this.input.pressed.clear(); }
  stop() { this.input.enabled = false; this.state.running = false; this.state.paused = false; this.trajectory = false; if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; this.last = 0; }
  resetBall() { this.ball.reset(WORLD.width / 2, WORLD.height / 2); }
  resetPlayer() { if (this.player) { this.player.x = WORLD.width * .31; this.player.y = WORLD.height / 2; this.player.stop(); } }
  loop(time) {
    this.raf = requestAnimationFrame(this.boundLoop);
    if (!this.state.running) return;
    if (this.state.paused) { if (time - (this.pausedPaintAt || 0) < 100) return; this.pausedPaintAt = time; }
    const dt = this.last ? Math.min((time - this.last) / 1000, .033) : 0; this.last = time;
    if (!this.state.paused) {
      if (this.state.mode === 'online' && !this.onlineAuthority) {
        this.predictOnlineGuest(dt);
        this.onlineInputClock += dt;
        const axes = this.input.axes();
        const changed = !this.lastOnlineAxes || axes.x !== this.lastOnlineAxes.x || axes.y !== this.lastOnlineAxes.y;
        if (changed || this.onlinePendingKick || this.onlineInputClock >= .2) {
          this.onlineInputClock = 0; this.lastOnlineAxes = axes;
          this.hooks.onOnlineInput?.({ x: axes.x, y: axes.y, kick: this.onlinePendingKick });
          this.onlinePendingKick = false;
        }
      } else this.update(dt);
      if (this.state.mode === 'online' && this.onlineAuthority && !this.state.paused) {
        this.onlineSnapshotClock += dt;
        if (this.onlineSnapshotClock >= ONLINE_PACKET_INTERVAL) {
          this.onlineSnapshotClock %= ONLINE_PACKET_INTERVAL;
          this.hooks.onOnlineSnapshot?.(this.captureSnapshot(true));
        }
      }
      if (dt > 0 && !this.state.paused) {
        this.autosaveClock += dt;
        if (this.autosaveClock >= 2) { this.autosaveClock %= 2; this.hooks.onAutosave?.(); }
      }
    }
    if (this.renderEnabled !== false) this.renderer.render({ player: this.player, bot: this.bot, ball: this.ball, trajectory: this.trajectory, shotPreview: !!this.settings.shotPreview && this.countdown === 0 && this.state.goalTimer <= 0 && !this.state.matchOver, goalTimer: this.state.goalTimer, goalSide: this.state.goalSide, world: this.world || WORLD, fieldTheme: this.fieldTheme, competitionRound: this.competitionRound, shotRangeTimer: this.shotRangeTimer, cosmetics: this.settings.cosmetics || {} }, this.state.paused ? 0 : dt);
    this.input.endFrame();
  }
  update(dt) {
    if (dt <= 0) return;
    if (this.countdown > 0) {
      this.countdownClock -= dt;
      if (this.countdownClock <= 0) {
        this.countdown--;
        if (this.countdown > 0) { this.countdownClock += 1; this.hooks.onCountdown?.(this.countdown); }
        else this.hooks.onCountdown?.(null);
      }
      return;
    }
    this.player.powerCooldown = Math.max(0, this.player.powerCooldown - dt);
    this.player.powerFlash = Math.max(0, this.player.powerFlash - dt);
    this.shotRangeTimer = Math.max(0, this.shotRangeTimer - dt);
    this.powerHudClock -= dt;
    if (this.powerHudClock <= 0) { this.powerHudClock = .1; this.hooks.onPowerCooldown?.(this.player.powerCooldown); }
    this.state.elapsed += dt; this.hooks.onTime?.(this.state.formatTime());
    if (this.state.goalTimer > 0) {
      this.state.goalTimer -= dt;
      if (this.state.goalTimer <= 0) {
        if (this.state.matchOver) {
          this.state.paused = true; this.input.enabled = false;
          this.hooks.onMatchEnd?.({ mode: this.state.mode, elapsedSeconds: this.state.elapsed, playerScore: this.state.scorePlayer, botScore: this.state.scoreBot, winner: this.state.scorePlayer > this.state.scoreBot ? 'player' : 'opponent', stats: this.matchSummary() });
        } else { this.resetPositions(); this.beginCountdown(); }
      }
      return;
    }
    const move = this.input.axes(); this.player.move(move.x, move.y, dt);
    if (this.input.consume('Space')) {
      this.shotRangeTimer = .62;
      const powered = this.player.powerCooldown <= 0;
      const kicked = kickBall(this.player, this.ball, () => {
        this.sound.play('kick');
        if (powered) { this.renderer.fireBurst(this.ball.x, this.ball.y); this.player.powerFlash = .48; }
        else this.renderer.burst(this.ball.x, this.ball.y, '#c5f4d8', 7, 100);
      }, null, powered ? 1.45 : 1);
      if (kicked) this.matchStats.shotsPlayer++;
      if (kicked && powered) { this.player.powerCooldown = (this.modifiers?.powerCooldown ?? POWER_SHOT_COOLDOWN_SECONDS); this.hooks.onPowerCooldown?.(this.modifiers?.powerCooldown ?? POWER_SHOT_COOLDOWN_SECONDS); }
    }
    if (this.bot) {
      if (this.state.mode === 'online') {
        const command = this.hooks.getRemoteInput?.() || this.remoteInput;
        this.remoteInput = command;
        this.bot.powerCooldown = Math.max(0, this.bot.powerCooldown - dt);
        this.bot.powerFlash = Math.max(0, this.bot.powerFlash - dt);
        this.bot.move(command.x || 0, command.y || 0, dt);
        resolvePlayerWalls(this.bot);
        if (command.kick) {
          const powered = this.bot.powerCooldown <= 0;
          const kicked = kickBall(this.bot, this.ball, () => {
            this.sound.play('kick');
            if (powered) { this.renderer.fireBurst(this.ball.x, this.ball.y); this.bot.powerFlash = .48; }
            else this.renderer.burst(this.ball.x, this.ball.y, '#c5f4d8', 7, 100);
          }, null, powered ? 1.45 : 1);
          if (kicked) this.matchStats.shotsOpponent++;
          if (kicked && powered) this.bot.powerCooldown = (this.modifiers?.powerCooldown ?? POWER_SHOT_COOLDOWN_SECONDS);
        }
      } else {
        const decision = this.botAI.update(this.bot, this.ball, this.player, dt); this.bot.move(decision.x, decision.y, dt, decision.speedMultiplier);
        resolvePlayerWalls(this.bot);
        if (decision.kick && kickBall(this.bot, this.ball, () => { this.sound.play('kick'); this.renderer.burst(this.ball.x, this.ball.y, '#ffd1bf', 5, 78); }, decision.kickDirection)) this.matchStats.shotsOpponent++;
      }
    }
    resolvePlayerWalls(this.player);
    if (this.bot) {
      resolvePlayerPlayers(this.player, this.bot, strength => { if (strength > 22) this.sound.bump(); });
      // Separation can push a body a few units through a touchline.
      resolvePlayerWalls(this.player); resolvePlayerWalls(this.bot);
    }
    const steps = Math.max(1, Math.ceil(Math.hypot(this.ball.vx, this.ball.vy) * dt / Math.max(5, this.ball.radius)));
    for (let step = 0; step < steps; step++) {
    this.ball.update(dt / steps);
    if (this.bot) resolvePlayerBall(this.bot, this.ball, strength => { if (strength > 30) this.sound.bump(); });
    resolvePlayerBall(this.player, this.ball, strength => { if (strength > 30) this.sound.bump(); });
    resolvePlayerWalls(this.player); if (this.bot) resolvePlayerWalls(this.bot);
    const goalSide = isGoal(this.ball);
    if (goalSide !== 0) { this.recordGoal(goalSide); return; }
    resolveBallWalls(this.ball, () => this.sound.bump());
    }
  }
  predictOnlineGuest(dt) {
    if (dt <= 0 || !this.player) return;
    const axes = this.input.axes();
    const kickPressed = this.input.consume('Space');
    if (this.countdown > 0 || this.state.goalTimer > 0 || this.state.matchOver) { this.onlinePendingKick = false; return; }
    if (kickPressed) this.onlinePendingKick = true;
    this.player.powerCooldown = Math.max(0, this.player.powerCooldown - dt);
    this.player.powerFlash = Math.max(0, this.player.powerFlash - dt);
    this.shotRangeTimer = Math.max(0, this.shotRangeTimer - dt);
    // Extrapolate only short packet gaps, never a prolonged disconnect.
    const age = this.onlineSnapshotAge || 0;
    const remoteDt = Math.max(0, Math.min(dt, .1 - age));
    this.onlineSnapshotAge = age + dt;
    if (remoteDt > 0) {
      if (this.bot) { this.bot.x += this.bot.vx * remoteDt; this.bot.y += this.bot.vy * remoteDt; resolvePlayerWalls(this.bot); }
      this.ball.x += this.ball.vx * remoteDt; this.ball.y += this.ball.vy * remoteDt;
      this.ball.spin += (this.ball.vx || 0) * remoteDt * .003;
      resolveBallWalls(this.ball);
    }
    this.player.move(axes.x, axes.y, dt);
    resolvePlayerWalls(this.player);
    if (kickPressed) {
      this.shotRangeTimer = .62;
      const powered = this.player.powerCooldown <= 0;
      const kicked = kickBall(this.player, this.ball, () => {
        this.sound.play('kick');
        if (powered) { this.renderer.fireBurst(this.ball.x, this.ball.y); this.player.powerFlash = .48; }
        else this.renderer.burst(this.ball.x, this.ball.y, '#c5f4d8', 7, 100);
      }, null, powered ? 1.45 : 1);
      if (kicked) this.matchStats.shotsPlayer++;
      if (kicked && powered) this.player.powerCooldown = (this.modifiers?.powerCooldown ?? POWER_SHOT_COOLDOWN_SECONDS);
    }
  }
  recordGoal(side) {
    this.state.goalSide = side;
    const playerScored = this.state.mode === 'training' || (this.state.mode === 'online'
      ? (this.localSide === 'left' ? side === 1 : side === -1)
      : side === 1);
    if (playerScored) this.state.scorePlayer++;
    else this.state.scoreBot++;
    this.matchStats.goals.push({ side: playerScored ? 'player' : 'opponent', elapsedSeconds: this.state.elapsed, minute: Math.max(1, Math.floor(this.state.elapsed / 60) + 1) });
    this.state.goalTimer = 1.65; this.ball.vx *= .25; this.ball.vy *= .25;
    const target = this.goalTarget;
    if (this.state.mode !== 'training' && Math.max(this.state.scorePlayer, this.state.scoreBot) >= target) this.state.matchOver = true;
    this.sound.play('goal'); this.renderer.burst(this.ball.x, this.ball.y, '#b8f4ce', 24, 190);
    this.hooks.onScore?.(this.state.scorePlayer, this.state.scoreBot); this.hooks.onGoal?.(side);
  }
  matchSummary() { return { shotsPlayer: this.matchStats.shotsPlayer, shotsOpponent: this.matchStats.shotsOpponent, goals: this.matchStats.goals.map(goal => ({ ...goal })) }; }
  beginCountdown() { this.countdown = 5; this.countdownClock = 1; this.hooks.onCountdown?.(5); }
  captureSnapshot(online = false) {
    const entity = body => body && ({ x: body.x, y: body.y, vx: body.vx, vy: body.vy, faceX: body.faceX, faceY: body.faceY, shotCooldown: body.shotCooldown, powerCooldown: body.powerCooldown, powerFlash: body.powerFlash, kickScale: body.kickScale, boost: body.boost, spin: body.spin });
    return {
      mode: this.state.mode, elapsed: this.state.elapsed, scorePlayer: this.state.scorePlayer, scoreBot: this.state.scoreBot,
      goalTimer: this.state.goalTimer, goalSide: this.state.goalSide, matchOver: this.state.matchOver, goalTarget: this.goalTarget,
      countdown: this.countdown, countdownClock: this.countdownClock, trajectory: this.trajectory,
      ...(online ? {} : { modifiers: this.modifiers, fieldTheme: this.fieldTheme, competitionRound: this.competitionRound }),
      matchStats: online ? this.matchStats : this.matchSummary(),
      player: entity(this.player), bot: entity(this.bot), ball: entity(this.ball),
      ...(online ? {} : { difficulty: this.botAI.difficulty, ai: { thinkTimer: this.botAI.thinkTimer, targetX: this.botAI.targetX, targetY: this.botAI.targetY, shotsTaken: this.botAI.shotsTaken, mode: this.botAI.mode } }),
    };
  }
  restoreSnapshot(snapshot, notify = true, resetRender = true) {
    if (!snapshot || snapshot.mode !== this.state.mode || !snapshot.player || !snapshot.ball) return false;
    if (snapshot.modifiers) { this.modifiers = normalizeModifiers(snapshot.modifiers); this.applyModifiers(); }
    const restoreBody = (body, saved) => {
      if (!body || !saved) return;
      for (const key of ['x', 'y', 'vx', 'vy', 'faceX', 'faceY', 'shotCooldown', 'powerCooldown', 'powerFlash', 'kickScale', 'boost', 'spin']) if (Number.isFinite(saved[key])) body[key] = saved[key];
      if (resetRender) { body._rx = body.x; body._ry = body.y; }
    };
    this.state.elapsed = Number(snapshot.elapsed) || 0; this.state.scorePlayer = Number(snapshot.scorePlayer) || 0;
    this.state.scoreBot = Number(snapshot.scoreBot) || 0; this.state.goalTimer = Number(snapshot.goalTimer) || 0;
    this.state.goalSide = [-1, 1].includes(Number(snapshot.goalSide)) ? Number(snapshot.goalSide) : 0;
    this.state.matchOver = !!snapshot.matchOver; this.state.paused = false;
    this.goalTarget = Number(snapshot.goalTarget) || this.goalTarget; this.countdown = Number(snapshot.countdown) || 0;
    this.countdownClock = Number(snapshot.countdownClock) || 0; this.trajectory = !!this.settings?.trajectory;
    this.fieldTheme = snapshot.fieldTheme || this.fieldTheme; this.competitionRound = Number(snapshot.competitionRound) || this.competitionRound;
    const savedStats = snapshot.matchStats;
    this.matchStats = { shotsPlayer: Number(savedStats?.shotsPlayer) || 0, shotsOpponent: Number(savedStats?.shotsOpponent) || 0, goals: Array.isArray(savedStats?.goals) ? savedStats.goals.map(goal => ({ ...goal })) : [] };
    restoreBody(this.player, snapshot.player); restoreBody(this.bot, snapshot.bot); restoreBody(this.ball, snapshot.ball);
    if (snapshot.ai) Object.assign(this.botAI, snapshot.ai);
    if (notify) {
      this.hooks.onScore?.(this.state.scorePlayer, this.state.scoreBot); this.hooks.onTime?.(this.state.formatTime());
      this.hooks.onCountdown?.(this.countdown > 0 ? this.countdown : null); this.hooks.onPowerCooldown?.(this.player.powerCooldown || 0);
    }
    return true;
  }
  setRemoteInput(input = {}) {
    this.remoteInput = {
      x: Math.max(-1, Math.min(1, Number(input.x) || 0)),
      y: Math.max(-1, Math.min(1, Number(input.y) || 0)),
      kick: input.kick === true,
    };
  }
  applyOnlineSnapshot(snapshot) {
    if (this.state.mode !== 'online' || this.onlineAuthority || !snapshot || snapshot.mode !== 'online') return false;
    for (const body of [snapshot.player, snapshot.bot, snapshot.ball]) {
      if (!body || !Number.isFinite(body.x) || !Number.isFinite(body.y)) return false;
      if (['vx', 'vy'].some(key => body[key] !== undefined && !Number.isFinite(body[key]))) return false;
    }
    for (const key of ['elapsed', 'goalTimer', 'countdown', 'countdownClock', 'scorePlayer', 'scoreBot']) {
      if (snapshot[key] !== undefined && (!Number.isFinite(snapshot[key]) || snapshot[key] < 0)) return false;
    }
    const mapped = {
      ...snapshot,
      player: snapshot.bot,
      bot: snapshot.player,
      scorePlayer: snapshot.scoreBot,
      scoreBot: snapshot.scorePlayer,
      matchStats: snapshot.matchStats && { shotsPlayer: snapshot.matchStats.shotsOpponent, shotsOpponent: snapshot.matchStats.shotsPlayer, goals: Array.isArray(snapshot.matchStats.goals) ? snapshot.matchStats.goals.map(goal => ({ ...goal, side: goal.side === 'player' ? 'opponent' : 'player' })) : [] },
    };
    const priorScorePlayer = this.state.scorePlayer, priorScoreBot = this.state.scoreBot;
    const priorCountdown = this.countdown;
    const resetting = snapshot.countdown > 0 || snapshot.goalTimer > 0 || snapshot.matchOver || priorCountdown > 0 || priorScorePlayer !== mapped.scorePlayer || priorScoreBot !== mapped.scoreBot;
    const predictedPlayer = this.localSide === 'right' && !resetting ? { x: this.player.x, y: this.player.y, vx: this.player.vx, vy: this.player.vy, faceX: this.player.faceX, faceY: this.player.faceY } : null;
    this.onlineSnapshotAge = 0;
    this.restoreSnapshot(mapped, false, resetting);
    if (predictedPlayer) {
      const authoritative = this.player;
      const error = Math.hypot(predictedPlayer.x - authoritative.x, predictedPlayer.y - authoritative.y);
      const predictionWeight = error < 50 ? .72 : error < 150 ? .42 : .18;
      authoritative.x += (predictedPlayer.x - authoritative.x) * predictionWeight;
      authoritative.y += (predictedPlayer.y - authoritative.y) * predictionWeight;
      authoritative.vx += (predictedPlayer.vx - authoritative.vx) * .7;
      authoritative.vy += (predictedPlayer.vy - authoritative.vy) * .7;
      authoritative.faceX = predictedPlayer.faceX; authoritative.faceY = predictedPlayer.faceY;
    }
    this.hooks.onTime?.(this.state.formatTime());
    if (this.countdown !== priorCountdown) this.hooks.onCountdown?.(this.countdown > 0 ? this.countdown : null);
    this.hooks.onPowerCooldown?.(this.player.powerCooldown || 0);
    if (priorScorePlayer !== this.state.scorePlayer || priorScoreBot !== this.state.scoreBot) {
      this.hooks.onScore?.(this.state.scorePlayer, this.state.scoreBot);
      const localScored = priorScorePlayer !== this.state.scorePlayer;
      this.hooks.onGoal?.(this.state.goalSide || (localScored ? -1 : 1));
    }
    if (this.state.matchOver && this.state.goalTimer <= 0) {
      this.state.paused = true; this.input.enabled = false;
      if (this.onlineMatchEnded) return true;
      this.onlineMatchEnded = true;
      this.state.paused = true;
      this.hooks.onMatchEnd?.({ mode: 'online', elapsedSeconds: this.state.elapsed, playerScore: this.state.scorePlayer, botScore: this.state.scoreBot, winner: this.state.scorePlayer > this.state.scoreBot ? 'player' : 'opponent', stats: this.matchSummary() });
    }
    return true;
  }
  resetPositions() {
    this.player.x = WORLD.width * (this.localSide === 'left' ? .31 : .69); this.player.y = WORLD.height / 2; this.player.stop(); this.player._rx = this.player.x; this.player._ry = this.player.y;
    if (this.bot) { this.bot.x = WORLD.width * (this.localSide === 'left' ? .69 : .31); this.bot.y = WORLD.height / 2; this.bot.stop(); this.bot._rx = this.bot.x; this.bot._ry = this.bot.y; }
    this.ball.reset(WORLD.width / 2, WORLD.height / 2); this.ball._rx = this.ball.x; this.ball._ry = this.ball.y;
  }
}

function teamInitials(name) {
  const words = String(name || '').replace(/\s+CF$/i, '').match(/[\p{L}\p{N}]+/gu) || [];
  const meaningful = words.filter(word => !/^(de|del|la|las|los|the|and|of)$/i.test(word));
  if (meaningful.length === 2) return `${meaningful[0][0]}${meaningful[1].slice(0, 2)}`.toUpperCase();
  if (meaningful.length > 2) return meaningful.map(word => word[0]).join('').slice(0, 3).toUpperCase();
  return (meaningful[0] || 'BOT').slice(0, 3).toUpperCase();
}
