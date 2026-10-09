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

export class Game {
  constructor(canvas, settings, sound, hooks = {}) {
    this.canvas = canvas; this.settings = settings; this.sound = sound; this.hooks = hooks;
    this.renderer = new Renderer(canvas); this.input = new Input(); this.state = new GameState(); this.botAI = new BotAI(settings.difficulty);
    this.player = null; this.bot = null; this.ball = new Ball(WORLD.width / 2, WORLD.height / 2); this.trajectory = false;
    this.last = 0; this.raf = 0; this.boundLoop = time => this.loop(time); this.goalResetTimer = 0;
    this.countdown = 0; this.countdownClock = 0; this.fieldTheme = 'arcade'; this.competitionRound = 0;
    this.goalTarget = 5; this.shotRangeTimer = 0; this.autosaveClock = 0; this.powerHudClock = 0;
    this.onlineSnapshotClock = 0; this.onlineInputClock = 0; this.localSide = 'left'; this.onlineAuthority = true; this.remoteInput = { x: 0, y: 0, kick: false }; this.onlineMatchEnded = false;
  }
  start(mode = 'bot', difficulty = this.settings.difficulty, options = {}) {
    this.state.start(mode); this.settings.difficulty = difficulty; this.botAI.setDifficulty(difficulty);
    const team = getTeamById(this.settings.teamId);
    this.fieldTheme = options.fieldTheme || (mode === 'training' ? 'training' : mode === 'tournament' ? 'champions' : 'arcade');
    this.competitionRound = options.competitionRound || 0;
    this.goalTarget = mode === 'league' ? (Number(options.goalTarget) || 2) : mode === 'tournament' ? 3 : 5;
    this.localSide = options.localSide === 'right' ? 'right' : 'left';
    this.onlineAuthority = mode !== 'online' || this.localSide === 'left';
    this.onlineSnapshotClock = 0; this.onlineInputClock = 0; this.remoteInput = { x: 0, y: 0, kick: false }; this.onlineMatchEnded = false;
    this.trajectory = !!this.settings.trajectory; this.shotRangeTimer = 0; this.autosaveClock = 0; this.powerHudClock = 0;
    const localX = this.localSide === 'left' ? WORLD.width * .31 : WORLD.width * .69;
    this.player = new Player({ x: localX, y: WORLD.height / 2, name: this.settings.name, number: this.settings.number, color: team?.primary || '#68746e', secondaryColor: team?.secondary || null });
    if (this.localSide === 'right') this.player.faceX = -1;
    const opponentTeam = options.opponentTeam || null;
    const opponentX = this.localSide === 'left' ? WORLD.width * .69 : WORLD.width * .31;
    this.bot = mode !== 'training' ? new Player({ x: opponentX, y: WORLD.height / 2, name: options.opponentName || 'BOT', number: options.opponentNumber ?? (opponentTeam ? teamInitials(opponentTeam.name) : 'BOT'), color: opponentTeam?.primary || '#f19676', secondaryColor: opponentTeam?.secondary || null, isBot: mode !== 'online', speed: 280 }) : null;
    if (this.bot && mode === 'online') this.bot.faceX = this.localSide === 'left' ? -1 : 1;
    this.ball.reset(WORLD.width / 2, WORLD.height / 2); this.goalResetTimer = 0; this.last = 0;
    this.beginCountdown();
    if (!this.raf) this.raf = requestAnimationFrame(this.boundLoop);
    this.hooks.onStart?.(mode); this.hooks.onScore?.(0, 0); this.hooks.onTime?.('00:00');
  }
  updateSettings(settings) {
    this.settings = settings;
    if (this.player) {
      const team = getTeamById(settings.teamId);
      this.player.name = settings.name; this.player.number = settings.number;
      this.player.color = team?.primary || '#68746e'; this.player.secondaryColor = team?.secondary || null;
    }
    this.botAI.setDifficulty(settings.difficulty); this.trajectory = !!settings.trajectory;
  }
  setPaused(paused) { this.state.paused = paused; this.last = 0; }
  stop() { this.state.running = false; this.state.paused = false; this.trajectory = false; if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; this.last = 0; }
  resetBall() { this.ball.reset(WORLD.width / 2, WORLD.height / 2); }
  resetPlayer() { if (this.player) { this.player.x = WORLD.width * .31; this.player.y = WORLD.height / 2; this.player.stop(); } }
  loop(time) {
    this.raf = requestAnimationFrame(this.boundLoop);
    if (!this.state.running) return;
    const dt = this.last ? Math.min((time - this.last) / 1000, .033) : 0; this.last = time;
    if (!this.state.paused) {
      if (this.state.mode === 'online' && !this.onlineAuthority) {
        this.onlineInputClock += dt;
        if (this.onlineInputClock >= 1 / 30) {
          this.onlineInputClock %= 1 / 30;
          const axes = this.input.axes();
          this.hooks.onOnlineInput?.({ x: axes.x, y: axes.y, kick: this.input.consume('Space') });
        }
      } else this.update(dt);
      if (this.state.mode === 'online' && this.onlineAuthority && !this.state.paused) {
        this.onlineSnapshotClock += dt;
        if (this.onlineSnapshotClock >= 1 / 12) {
          this.onlineSnapshotClock %= 1 / 12;
          this.hooks.onOnlineSnapshot?.(this.captureSnapshot());
        }
      }
      if (dt > 0 && !this.state.paused) {
        this.autosaveClock += dt;
        if (this.autosaveClock >= 2) { this.autosaveClock %= 2; this.hooks.onAutosave?.(); }
      }
    }
    this.renderer.render({ player: this.player, bot: this.bot, ball: this.ball, trajectory: this.trajectory, goalTimer: this.state.goalTimer, fieldTheme: this.fieldTheme, competitionRound: this.competitionRound, shotRangeTimer: this.shotRangeTimer }, dt);
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
          this.state.paused = true;
          this.hooks.onMatchEnd?.({ mode: this.state.mode, playerScore: this.state.scorePlayer, botScore: this.state.scoreBot, winner: this.state.scorePlayer > this.state.scoreBot ? 'player' : 'opponent' });
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
      if (kicked && powered) { this.player.powerCooldown = POWER_SHOT_COOLDOWN_SECONDS; this.hooks.onPowerCooldown?.(POWER_SHOT_COOLDOWN_SECONDS); }
    }
    if (this.bot) {
      if (this.state.mode === 'online') {
        const command = this.hooks.getRemoteInput?.() || this.remoteInput;
        this.remoteInput = command;
        this.bot.powerCooldown = Math.max(0, this.bot.powerCooldown - dt);
        this.bot.move(command.x || 0, command.y || 0, dt);
        resolvePlayerWalls(this.bot);
        if (command.kick) {
          const powered = this.bot.powerCooldown <= 0;
          const kicked = kickBall(this.bot, this.ball, () => {
            this.sound.play('kick');
            if (powered) { this.renderer.fireBurst(this.ball.x, this.ball.y); this.bot.powerFlash = .48; }
            else this.renderer.burst(this.ball.x, this.ball.y, '#c5f4d8', 7, 100);
          }, null, powered ? 1.45 : 1);
          if (kicked && powered) this.bot.powerCooldown = POWER_SHOT_COOLDOWN_SECONDS;
        }
      } else {
        const decision = this.botAI.update(this.bot, this.ball, this.player, dt); this.bot.move(decision.x, decision.y, dt, decision.speedMultiplier);
        resolvePlayerWalls(this.bot);
        if (decision.kick) kickBall(this.bot, this.ball, () => { this.sound.play('kick'); this.renderer.burst(this.ball.x, this.ball.y, '#ffd1bf', 5, 78); }, decision.kickDirection);
      }
    }
    resolvePlayerWalls(this.player);
    if (this.bot) {
      resolvePlayerPlayers(this.player, this.bot, strength => { if (strength > 22) this.sound.bump(); });
      // Separation can push a body a few units through a touchline.
      resolvePlayerWalls(this.player); resolvePlayerWalls(this.bot);
    }
    this.ball.update(dt);
    if (this.bot) resolvePlayerBall(this.bot, this.ball, strength => { if (strength > 30) this.sound.bump(); });
    resolvePlayerBall(this.player, this.ball, strength => { if (strength > 30) this.sound.bump(); });
    const goalSide = isGoal(this.ball);
    if (goalSide !== 0) { this.recordGoal(goalSide); return; }
    resolveBallWalls(this.ball, () => this.sound.bump());
  }
  recordGoal(side) {
    if (this.state.mode === 'training') this.state.scorePlayer++;
    else if (this.state.mode === 'online'
      ? (this.localSide === 'left' ? side === 1 : side === -1)
      : side === 1) this.state.scorePlayer++;
    else this.state.scoreBot++;
    this.state.goalTimer = 1.65; this.ball.vx *= .25; this.ball.vy *= .25;
    const target = this.goalTarget;
    if (this.state.mode !== 'training' && Math.max(this.state.scorePlayer, this.state.scoreBot) >= target) this.state.matchOver = true;
    this.sound.play('goal'); this.renderer.burst(this.ball.x, this.ball.y, '#b8f4ce', 24, 190);
    this.hooks.onScore?.(this.state.scorePlayer, this.state.scoreBot); this.hooks.onGoal?.(side);
  }
  beginCountdown() { this.countdown = 5; this.countdownClock = 1; this.hooks.onCountdown?.(5); }
  captureSnapshot() {
    const entity = body => body && ({ x: body.x, y: body.y, vx: body.vx, vy: body.vy, faceX: body.faceX, faceY: body.faceY, shotCooldown: body.shotCooldown, powerCooldown: body.powerCooldown, powerFlash: body.powerFlash, kickScale: body.kickScale, boost: body.boost, spin: body.spin });
    return {
      mode: this.state.mode, elapsed: this.state.elapsed, scorePlayer: this.state.scorePlayer, scoreBot: this.state.scoreBot,
      goalTimer: this.state.goalTimer, matchOver: this.state.matchOver, goalTarget: this.goalTarget,
      countdown: this.countdown, countdownClock: this.countdownClock, trajectory: this.trajectory,
      fieldTheme: this.fieldTheme, competitionRound: this.competitionRound,
      player: entity(this.player), bot: entity(this.bot), ball: entity(this.ball), difficulty: this.botAI.difficulty,
      ai: { thinkTimer: this.botAI.thinkTimer, targetX: this.botAI.targetX, targetY: this.botAI.targetY, shotsTaken: this.botAI.shotsTaken, mode: this.botAI.mode },
    };
  }
  restoreSnapshot(snapshot, notify = true) {
    if (!snapshot || snapshot.mode !== this.state.mode || !snapshot.player || !snapshot.ball) return false;
    const restoreBody = (body, saved) => {
      if (!body || !saved) return;
      for (const key of ['x', 'y', 'vx', 'vy', 'faceX', 'faceY', 'shotCooldown', 'powerCooldown', 'powerFlash', 'kickScale', 'boost', 'spin']) if (Number.isFinite(saved[key])) body[key] = saved[key];
      body._rx = body.x; body._ry = body.y;
    };
    this.state.elapsed = Number(snapshot.elapsed) || 0; this.state.scorePlayer = Number(snapshot.scorePlayer) || 0;
    this.state.scoreBot = Number(snapshot.scoreBot) || 0; this.state.goalTimer = Number(snapshot.goalTimer) || 0;
    this.state.matchOver = !!snapshot.matchOver; this.state.paused = false;
    this.goalTarget = Number(snapshot.goalTarget) || this.goalTarget; this.countdown = Number(snapshot.countdown) || 0;
    this.countdownClock = Number(snapshot.countdownClock) || 0; this.trajectory = !!this.settings?.trajectory;
    this.fieldTheme = snapshot.fieldTheme || this.fieldTheme; this.competitionRound = Number(snapshot.competitionRound) || this.competitionRound;
    restoreBody(this.player, snapshot.player); restoreBody(this.bot, snapshot.bot); restoreBody(this.ball, snapshot.ball);
    if (snapshot.ai) Object.assign(this.botAI, snapshot.ai);
    this.input.down.clear(); this.input.pressed.clear();
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
    const mapped = {
      ...snapshot,
      player: snapshot.bot,
      bot: snapshot.player,
      scorePlayer: snapshot.scoreBot,
      scoreBot: snapshot.scorePlayer,
    };
    const priorScorePlayer = this.state.scorePlayer, priorScoreBot = this.state.scoreBot;
    const priorCountdown = this.countdown;
    this.restoreSnapshot(mapped, false);
    this.hooks.onTime?.(this.state.formatTime());
    if (this.countdown !== priorCountdown) this.hooks.onCountdown?.(this.countdown > 0 ? this.countdown : null);
    this.hooks.onPowerCooldown?.(this.player.powerCooldown || 0);
    if (priorScorePlayer !== this.state.scorePlayer || priorScoreBot !== this.state.scoreBot) {
      this.hooks.onScore?.(this.state.scorePlayer, this.state.scoreBot);
      const localScored = priorScorePlayer !== this.state.scorePlayer;
      this.hooks.onGoal?.(localScored ? 1 : -1);
    }
    if (this.state.matchOver && this.state.goalTimer <= 0 && !this.onlineMatchEnded) {
      this.onlineMatchEnded = true;
      this.state.paused = true;
      this.hooks.onMatchEnd?.({ mode: 'online', playerScore: this.state.scorePlayer, botScore: this.state.scoreBot, winner: this.state.scorePlayer > this.state.scoreBot ? 'player' : 'opponent' });
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
  if (meaningful.length > 1) return meaningful.map(word => word[0]).join('').slice(0, 3).toUpperCase();
  return (meaningful[0] || 'BOT').slice(0, 3).toUpperCase();
}
