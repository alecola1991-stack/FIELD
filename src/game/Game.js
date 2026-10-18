import { normalizeModifiers, modifierWorld } from '../config/modifiers.js';
import { WORLD } from '../config/settings.js';
import { Player } from './Player.js';
import { Ball } from './Ball.js';
import { Input } from './Input.js';
import { BotAI } from './BotAI.js';
import { SquadAI } from './SquadAI.js';
import { Renderer } from './Renderer.js';
import { GameState } from './GameState.js';
import { getTeamById } from '../config/teams.js';
import { kickBall, curveSide, resolveBallNet, resolveBallWalls, resolvePlayerBall, resolvePlayerPlayers, resolvePlayerWalls, isGoal } from './Physics.js';

const POWER_SHOT_COOLDOWN_SECONDS = 20;
const ONLINE_PACKET_INTERVAL = 1 / 30;
// Goal replays: the last REPLAY_SECONDS before (and a short tail after) a goal.
const REPLAY_SECONDS = 3;
const REPLAY_TAIL_SECONDS = .45;
const REPLAY_MIN_FRAMES = 20;

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
    this.resetReplay();
  }
  start(mode = 'bot', difficulty = this.settings.difficulty, options = {}) {
    this.state.start(mode); if (mode !== 'legends') this.settings.difficulty = difficulty; this.botAI.setDifficulty(mode === 'legends' ? 'legend' : difficulty);
    this.modifiers = normalizeModifiers(mode === 'online' ? {} : options.modifiers || this.settings.modifiers);
    this.world = modifierWorld(this.modifiers);
    // Career matches use the career club or national team instead of the profile team.
    this.playerTeamId = options.playerTeamId || null;
    const team = getTeamById(this.playerTeamId || this.settings.teamId);
    this.fieldTheme = options.fieldTheme || (mode === 'training' ? 'training' : mode === 'tournament' ? 'champions' : 'arcade');
    this.competitionRound = options.competitionRound || 0;
    this.goalTarget = this.modifiers.goalTarget || (mode === 'league' ? (Number(options.goalTarget) || 2) : mode === 'career' ? (Number(options.goalTarget) || 3) : mode === 'tournament' ? 3 : 5);
    this.localSide = options.localSide === 'right' ? 'right' : 'left';
    if (mode === 'online' && options.squad) this.localSide = options.squad.localSeat < 2 ? 'left' : 'right';
    // 1v1: the left player hosts. 2v2: seat 0 (left captain) hosts.
    this.onlineAuthority = mode !== 'online' || (options.squad ? options.squad.localSeat === 0 : this.localSide === 'left');
    this.onlineSnapshotClock = 0; this.onlineInputClock = 0; this.remoteInput = { x: 0, y: 0, kick: false }; this.onlineMatchEnded = false; this.onlinePendingKick = false;
    this.lastOnlineAxes = null; this.onlineSnapshotAge = 0;
    this.input.enabled = true; this.input.down.clear(); this.input.pressed.clear();
    this.trajectory = !!this.settings.trajectory; this.shotRangeTimer = 0; this.autosaveClock = 0; this.powerHudClock = 0;
    const localX = this.localSide === 'left' ? WORLD.width * .31 : WORLD.width * .69;
    this.player = new Player({ x: localX, y: WORLD.height / 2, name: this.settings.name, number: this.settings.number, color: team?.primary || '#68746e', secondaryColor: team?.secondary || null, numberColor: team?.numberColor, kitPattern: team?.kitPattern, tertiaryColor: team?.tertiary || null, kitBands: team?.kitBands || null, numberOutline: team?.numberOutline });
    if (this.localSide === 'right') this.player.faceX = -1;
    const opponentTeam = options.opponentTeam || null;
    this.botAI.setTeamStrength(opponentTeam?.stars || 3);
    this.matchStats = { shotsPlayer: 0, shotsOpponent: 0, goals: [] };
    this.resetReplay(); this.hooks.onReplay?.(null);
    const opponentX = this.localSide === 'left' ? WORLD.width * .69 : WORLD.width * .31;
    const opponentName = mode === 'online' ? options.opponentName || 'RIVAL' : teamInitials(opponentTeam?.name || options.opponentName || 'BOT');
    const opponentNumber = mode === 'online' ? options.opponentNumber ?? 10 : [10, 9, 11][Math.floor(Math.random() * 3)];
    this.bot = mode !== 'training' ? new Player({ x: opponentX, y: WORLD.height / 2, name: opponentName, number: opponentNumber, color: opponentTeam?.primary || '#f19676', secondaryColor: opponentTeam?.secondary || null, numberColor: opponentTeam?.numberColor, kitPattern: opponentTeam?.kitPattern, tertiaryColor: opponentTeam?.tertiary || null, kitBands: opponentTeam?.kitBands || null, numberOutline: opponentTeam?.numberOutline, isBot: mode !== 'online', speed: mode === 'online' ? 305 : 280 }) : null;
    if (this.bot && mode === 'online') this.bot.faceX = this.localSide === 'left' ? -1 : 1;
    this.squad = null; this.others = [];
    if (mode === 'online' && options.squad) this.setupSquad(options.squad);
    else if (options.duo && this.bot && !['training', 'legends', 'online'].includes(mode)) this.setupDuo(team, opponentTeam, difficulty, opponentName, opponentNumber, options.mateDifficulty);
    this.ball.reset(WORLD.width / 2, WORLD.height / 2); this.goalResetTimer = 0; this.last = 0;
    this.applyModifiers();
    this.beginCountdown();
    if (!this.raf) this.raf = requestAnimationFrame(this.boundLoop);
    this.hooks.onStart?.(mode); this.hooks.onScore?.(0, 0); this.hooks.onTime?.('00:00');
  }
  applyModifiers() {
    this.modifiers = normalizeModifiers(this.modifiers); this.world = modifierWorld(this.modifiers);
    for (const body of [this.player, this.bot, ...(this.others || [])]) if (body) {
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
      const team = getTeamById(this.playerTeamId || settings.teamId);
      this.player.name = settings.name; this.player.number = settings.number;
      this.player.color = team?.primary || '#68746e'; this.player.secondaryColor = team?.secondary || null; this.player.numberColor = team?.numberColor || '#ffffff'; this.player.kitPattern = team?.kitPattern || 'half-vertical'; this.player.tertiaryColor = team?.tertiary || null; this.player.kitBands = team?.kitBands || null; this.player.numberOutline = team?.numberOutline !== false;
    }
    this.botAI.setDifficulty(this.state.mode === 'legends' ? 'legend' : settings.difficulty); this.trajectory = !!settings.trajectory;
  }
  setPaused(paused) { this.state.paused = paused; this.input.enabled = !paused; this.last = 0; this.input.down.clear(); this.input.pressed.clear(); }
  stop() { if (this.replay) { this.replay = null; this.hooks.onReplay?.(null); } this.sound?.updateAmbience?.(null,null,false); this.input.enabled = false; this.state.running = false; this.state.paused = false; this.trajectory = false; if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; this.last = 0; }
  resetBall() { this.ball.reset(WORLD.width / 2, WORLD.height / 2); }
  resetPlayer() { if (this.player) { this.player.x = WORLD.width * .31; this.player.y = WORLD.height / 2; this.player.stop(); } }
  loop(time) {
    this.raf = requestAnimationFrame(this.boundLoop);
    if (!this.state.running) return;
    this.sound?.updateAmbience?.(this.ball,this.world || WORLD,!this.state.paused && !this.state.matchOver && this.renderEnabled !== false);
    if (this.state.paused) { if (time - (this.pausedPaintAt || 0) < 100) return; this.pausedPaintAt = time; }
    this.renderer.setAllowRotate?.(this.settings.verticalField !== false); this.input.rotated = !!this.renderer.rotated;
    const dt = this.last ? Math.min((time - this.last) / 1000, .033) : 0; this.last = time;
    if (!this.state.paused) {
      if (this.state.mode === 'online' && !this.onlineAuthority) {
        this.predictOnlineGuest(dt);
        this.onlineInputClock += dt;
        const axes = this.input.axes();
        const changed = !this.lastOnlineAxes || axes.x !== this.lastOnlineAxes.x || axes.y !== this.lastOnlineAxes.y;
        const discrete = [axes.x, axes.y].every(value => [-1, 0, 1].includes(value));
        if (!this.lastOnlineAxes || (changed && (discrete || this.onlineInputClock >= ONLINE_PACKET_INTERVAL)) || this.onlinePendingKick || this.onlineInputClock >= .2) {
          this.onlineInputClock = 0; this.lastOnlineAxes = axes;
          this.hooks.onOnlineInput?.({ x: axes.x, y: axes.y, kick: this.onlinePendingKick, curve: this.onlinePendingKick && this.onlinePendingCurve });
          this.onlinePendingKick = false; this.onlinePendingCurve = false;
        }
      } else this.update(dt);
      this.captureReplayFrame(dt);
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
    if (this.renderEnabled !== false) {
      const view = this.replayView();
      this.renderer.render(view ? { ...view, trajectory: false, shotPreview: false, goalTimer: 0, goalSide: 0, world: this.world || WORLD, fieldTheme: this.fieldTheme, mode: this.state.mode, competitionRound: this.competitionRound, shotRangeTimer: 0, replay: true }
        : { player: this.player, bot: this.bot, others: this.others, ball: this.ball, trajectory: this.trajectory, shotPreview: !!this.settings.shotPreview && this.countdown === 0 && this.state.goalTimer <= 0 && !this.state.matchOver && !this.replay, curveAim: curveSide(this.input.curveHeld?.(), this.input.axes().y), goalTimer: this.state.goalTimer, goalSide: this.state.goalSide, world: this.world || WORLD, fieldTheme: this.fieldTheme, mode: this.state.mode, competitionRound: this.competitionRound, shotRangeTimer: this.shotRangeTimer }, this.state.paused ? 0 : dt);
    }
    this.input.endFrame();
  }
  update(dt) {
    if (dt <= 0) return;
    if (this.replay) { this.updateReplay(dt); return; }
    if (this.countdown > 0) {
      this.countdownClock -= dt;
      if (this.countdownClock <= 0) {
        this.countdown--;
        if (this.countdown > 0) { this.countdownClock += 1; this.hooks.onCountdown?.(this.countdown); }
        else { this.countdownClock = 0; this.hooks.onCountdown?.(null); }
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
      this.state.goalTimer = Math.max(0, this.state.goalTimer - dt);
      // The ball keeps rolling into the goal and sinks into the soft net while the goal is celebrated.
      for (let step = 0; step < 3; step++) { this.ball.update(dt / 3); resolveBallNet(this.ball, dt / 3); }
      if (this.state.goalTimer <= 0 && !this.startReplay()) this.finishGoalSequence();
      return;
    }
    if (this.squad) { this.updateSquad(dt); return; }
    const move = this.input.axes(); this.player.move(move.x, move.y, dt);
    const shotInput = this.readKick();
    if (shotInput.kick) {
      this.shotRangeTimer = .62;
      const powered = this.player.powerCooldown <= 0;
      const kicked = kickBall(this.player, this.ball, () => {
        this.sound.play('kick');
        if (powered) { this.renderer.fireBurst(this.ball.x, this.ball.y); this.player.powerFlash = .48; }
        else this.renderer.burst(this.ball.x, this.ball.y, '#c5f4d8', 7, 100);
      }, null, powered ? 1.45 : 1, curveSide(shotInput.curve, move.y));
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
          }, null, powered ? 1.45 : 1, curveSide(command.curve === true, command.y));
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
  finishGoalSequence() {
    this.resetReplay();
    if (this.state.matchOver) {
      this.state.paused = true; this.input.enabled = false;
      // The normal network tick stops while paused: deliver the terminal state first.
      if (this.state.mode === 'online' && this.onlineAuthority) this.hooks.onOnlineSnapshot?.(this.captureSnapshot(true));
      this.hooks.onMatchEnd?.({ mode: this.state.mode, elapsedSeconds: this.state.elapsed, playerScore: this.state.scorePlayer, botScore: this.state.scoreBot, winner: this.state.scorePlayer > this.state.scoreBot ? 'player' : 'opponent', stats: this.matchSummary() });
    } else { this.resetPositions(); this.beginCountdown(); }
  }
  // ---- Goal replays -------------------------------------------------------
  // Frames are recorded locally on every peer, so nothing heavy crosses the
  // network. Online, the host decides when the replay starts and ends; it ends
  // early only when both players have skipped it, and never lasts over 3 s.
  resetReplay() {
    this.replay = null; this.replayFrames = []; this.replayClip = null; this.replayClock = 0; this.replayTail = 0;
  }
  replaysEnabled() { return this.state.mode !== 'training' && this.settings?.goalReplays !== false; }
  captureReplayFrame(dt) {
    if (!(dt > 0) || this.replay || !this.player || !this.state.running || this.countdown > 0 || this.state.mode === 'training') return;
    const scoring = this.state.goalTimer > 0;
    if (scoring && this.replayTail <= 0) return;
    const body = item => item && [item.x, item.y, item.faceX, item.faceY, item.kickScale || 0, item.powerFlash || 0, item.spin || 0];
    this.replayFrames ||= []; this.replayClock = (this.replayClock || 0) + dt;
    this.replayFrames.push({ t: this.replayClock, player: body(this.player), bot: body(this.bot), ball: body(this.ball), others: (this.others || []).map(body) });
    while (this.replayFrames.length && this.replayFrames[0].t < this.replayClock - REPLAY_SECONDS) this.replayFrames.shift();
    if (scoring) { this.replayTail -= dt; if (this.replayTail <= 0) this.replayClip = this.replayFrames.slice(); }
  }
  markGoalForReplay() { this.replayTail = REPLAY_TAIL_SECONDS; this.replayClip = null; }
  startReplay() {
    const clip = this.replayClip || (this.replayTail > 0 ? (this.replayFrames || []).slice() : null);
    if (!this.replaysEnabled() || !clip || clip.length < REPLAY_MIN_FRAMES) return false;
    this.replay = { frames: clip, time: 0, duration: Math.min(REPLAY_SECONDS, clip.at(-1).t - clip[0].t), localSkip: false, remoteSkip: false };
    this.notifyReplay();
    return true;
  }
  updateReplay(dt) {
    const replay = this.replay;
    if (this.input.consume('Space')) this.skipReplay();
    replay.time += dt;
    const bothSkipped = replay.localSkip && (this.state.mode !== 'online' || replay.remoteSkip);
    if (replay.time >= replay.duration || bothSkipped) { this.hooks.onReplay?.(null); this.finishGoalSequence(); }
  }
  skipReplay() {
    const replay = this.replay;
    if (!replay || replay.localSkip) return;
    replay.localSkip = true;
    if (this.state.mode === 'online' && !this.onlineAuthority) { replay.resendClock = .3; this.hooks.onReplaySkip?.(); }
    this.notifyReplay();
  }
  setRemoteReplaySkip(seat = null) {
    if (!this.replay || !this.onlineAuthority || this.replay.remoteSkip) return;
    if (this.squad) {
      if (!Number.isInteger(seat) || seat <= 0 || seat > 3) return;
      (this.replay.remoteSeats ||= new Set()).add(seat);
      if (this.replay.remoteSeats.size < 3) { this.notifyReplay(); return; }
    }
    this.replay.remoteSkip = true; this.notifyReplay();
  }
  notifyReplay() {
    const replay = this.replay;
    this.hooks.onReplay?.(replay && { online: this.state.mode === 'online', localSkip: replay.localSkip, remoteSkip: replay.remoteSkip, duration: replay.duration, ...(this.squad && this.state.mode === 'online' ? { players: 4, skipped: this.replaySkipCount() } : {}) });
  }
  // Guest side: follow the host's replay phase using the locally recorded clip.
  syncGuestReplay(info) {
    const active = info?.active === true;
    if (active && !this.replay) {
      const clip = this.replayClip || (this.replayFrames || []).slice();
      const frames = this.settings?.goalReplays !== false && clip.length >= REPLAY_MIN_FRAMES ? clip : [];
      this.replay = { frames, time: 0, duration: frames.length ? Math.min(REPLAY_SECONDS, frames.at(-1).t - frames[0].t) : 0, localSkip: false, remoteSkip: false, acked: false };
      this.notifyReplay();
      if (!frames.length) this.skipReplay(); // replays disabled locally: never hold the rival back
    } else if (!active && this.replay) { this.resetReplay(); this.hooks.onReplay?.(null); return; }
    if (!this.replay) return;
    let remoteSkip = info.skipHost === true, acked = info.skipGuest === true;
    if (this.squad) {
      const seats = Array.isArray(info.seats) ? info.seats : [], mine = this.squad.localSeat;
      acked = seats.includes(mine);
      remoteSkip = info.skipHost === true && [1, 2, 3].every(seat => seat === mine || seats.includes(seat));
      this.replay.remoteSeats = new Set(seats.filter(seat => seat !== mine)); this.replay.hostSkip = info.skipHost === true;
    }
    if (remoteSkip !== this.replay.remoteSkip || acked !== this.replay.acked) { this.replay.remoteSkip = remoteSkip; this.replay.acked = acked; this.notifyReplay(); }
  }
  replayView() {
    const replay = this.replay;
    if (!replay?.frames?.length) return null;
    const frames = replay.frames, target = frames[0].t + Math.min(replay.time, replay.duration);
    let index = frames.findIndex(frame => frame.t >= target); if (index < 0) index = frames.length - 1;
    const frame = frames[index];
    const body = (source, data) => {
      if (!source || !data) return source && null;
      const [x, y, faceX, faceY, kickScale, powerFlash, spin] = data;
      return { ...source, x, y, faceX, faceY, kickScale, powerFlash, spin, _rx: x, _ry: y };
    };
    return { player: body(this.player, frame.player), bot: body(this.bot, frame.bot), ball: body(this.ball, frame.ball), others: (this.others || []).map((item, index) => body(item, frame.others?.[index])).filter(Boolean) };
  }
  predictOnlineGuest(dt) {
    if (dt <= 0 || !this.player) return;
    if (this.replay) {
      if (this.input.consume('Space')) this.skipReplay();
      this.replay.time = Math.min(this.replay.duration, this.replay.time + dt);
      // Broadcast is unacknowledged: repeat the skip until the host confirms it.
      if (this.replay.localSkip && !this.replay.acked && (this.replay.resendClock -= dt) <= 0) { this.replay.resendClock = .3; this.hooks.onReplaySkip?.(); }
      this.onlinePendingKick = false; return;
    }
    const axes = this.input.axes();
    const shotInput = this.readKick(), kickPressed = shotInput.kick;
    if (this.countdown > 0 || this.state.goalTimer > 0 || this.state.matchOver) { this.onlinePendingKick = false; return; }
    if (kickPressed) { this.onlinePendingKick = true; this.onlinePendingCurve = shotInput.curve; }
    this.player.powerCooldown = Math.max(0, this.player.powerCooldown - dt);
    this.player.powerFlash = Math.max(0, this.player.powerFlash - dt);
    this.shotRangeTimer = Math.max(0, this.shotRangeTimer - dt);
    // Extrapolate only short packet gaps, never a prolonged disconnect.
    const age = this.onlineSnapshotAge || 0;
    const remoteDt = Math.max(0, Math.min(dt, .1 - age));
    this.onlineSnapshotAge = age + dt;
    if (remoteDt > 0) {
      for (const body of [this.bot, ...(this.others || [])]) if (body) { body.x += body.vx * remoteDt; body.y += body.vy * remoteDt; resolvePlayerWalls(body); }
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
      }, null, powered ? 1.45 : 1, curveSide(shotInput.curve, axes.y));
      if (kicked) this.matchStats.shotsPlayer++;
      if (kicked && powered) this.player.powerCooldown = (this.modifiers?.powerCooldown ?? POWER_SHOT_COOLDOWN_SECONDS);
    }
  }
  // Shot input this frame: { kick, curve }. Simple inputs without curve support shoot straight.
  readKick() { return this.input.consumeKick ? this.input.consumeKick() : { kick: this.input.consume('Space'), curve: false }; }
  recordGoal(side) {
    this.state.goalSide = side;
    const playerScored = this.state.mode === 'training' || (this.state.mode === 'online'
      ? (this.localSide === 'left' ? side === 1 : side === -1)
      : side === 1);
    if (playerScored) this.state.scorePlayer++;
    else this.state.scoreBot++;
    this.matchStats.goals.push({ side: playerScored ? 'player' : 'opponent', elapsedSeconds: this.state.elapsed, minute: Math.max(1, Math.floor(this.state.elapsed / 60) + 1) });
    this.state.goalTimer = 1.65; this.ball.vx *= .8; this.ball.vy *= .8;
    this.markGoalForReplay();
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
      // While a replay runs the goal phase is still open (a restored save resumes the reset, old guests keep waiting).
      goalTimer: this.replay ? Math.max(this.state.goalTimer, .01) : this.state.goalTimer, goalSide: this.state.goalSide, matchOver: this.state.matchOver, goalTarget: this.goalTarget,
      ...(online ? { replay: this.replay ? { active: true, skipHost: this.replay.localSkip, skipGuest: this.replay.remoteSkip, ...(this.squad ? { seats: [...(this.replay.remoteSeats || [])] } : {}) } : null } : {}),
      countdown: this.countdown, countdownClock: this.countdownClock, trajectory: this.trajectory,
      ...(online ? {} : { modifiers: this.modifiers, fieldTheme: this.fieldTheme, competitionRound: this.competitionRound }),
      matchStats: online ? this.matchStats : this.matchSummary(),
      player: entity(this.player), bot: entity(this.bot), ball: entity(this.ball),
      ...(online && this.squad ? { seats: this.squad.bodies.map(entity) } : {}),
      ...(!online && this.squad ? { others: this.others.map(entity) } : {}),
      ...(online ? {} : { difficulty: this.botAI.difficulty, ai: { thinkTimer: this.botAI.thinkTimer, targetX: this.botAI.targetX, targetY: this.botAI.targetY, shotsTaken: this.botAI.shotsTaken, mode: this.botAI.mode } }),
    };
  }
  restoreSnapshot(snapshot, notify = true, resetRender = true) {
    if (!snapshot || snapshot.mode !== this.state.mode || !snapshot.player || !snapshot.ball) return false;
    if (snapshot.modifiers && this.state.mode !== 'online') { this.modifiers = normalizeModifiers(snapshot.modifiers); this.applyModifiers(); }
    const restoreBody = (body, saved) => {
      if (!body || !saved) return;
      for (const key of ['x', 'y', 'vx', 'vy', 'faceX', 'faceY', 'shotCooldown', 'powerCooldown', 'powerFlash', 'kickScale', 'boost', 'spin']) if (Number.isFinite(saved[key])) body[key] = saved[key];
      if (resetRender) { body._rx = body.x; body._ry = body.y; }
    };
    this.state.elapsed = Number(snapshot.elapsed) || 0; this.state.scorePlayer = Number(snapshot.scorePlayer) || 0;
    this.state.scoreBot = Number(snapshot.scoreBot) || 0; this.state.goalTimer = Number(snapshot.goalTimer) || 0;
    this.state.goalSide = [-1, 1].includes(Number(snapshot.goalSide)) ? Number(snapshot.goalSide) : 0;
    this.state.matchOver = !!snapshot.matchOver; this.state.paused = false;
    this.goalTarget = this.state.mode === 'online' ? 5 : Number(snapshot.goalTarget) || this.goalTarget; this.countdown = Number(snapshot.countdown) || 0;
    this.countdownClock = Number(snapshot.countdownClock) || 0; this.trajectory = !!this.settings?.trajectory;
    this.fieldTheme = snapshot.fieldTheme || this.fieldTheme; this.competitionRound = Number(snapshot.competitionRound) || this.competitionRound;
    const savedStats = snapshot.matchStats;
    this.matchStats = { shotsPlayer: Number(savedStats?.shotsPlayer) || 0, shotsOpponent: Number(savedStats?.shotsOpponent) || 0, goals: Array.isArray(savedStats?.goals) ? savedStats.goals.map(goal => ({ ...goal })) : [] };
    restoreBody(this.player, snapshot.player); restoreBody(this.bot, snapshot.bot); restoreBody(this.ball, snapshot.ball);
    if (Array.isArray(snapshot.others)) (this.others || []).forEach((body, index) => restoreBody(body, snapshot.others[index]));
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
      kick: input.kick === true, curve: input.curve === true,
    };
  }
  applyOnlineSnapshot(snapshot) {
    if (this.state.mode !== 'online' || this.onlineAuthority || !snapshot || snapshot.mode !== 'online') return false;
    const squad = this.squad;
    if (squad && (!Array.isArray(snapshot.seats) || snapshot.seats.length !== 4)) return false;
    for (const body of squad ? [...snapshot.seats, snapshot.ball] : [snapshot.player, snapshot.bot, snapshot.ball]) {
      if (!body || !Number.isFinite(body.x) || !Number.isFinite(body.y)) return false;
      if (['vx', 'vy'].some(key => body[key] !== undefined && !Number.isFinite(body[key]))) return false;
    }
    // Older hosts can leave a timer negative by one frame after it expires.
    // Accept that bounded overshoot, while keeping invalid network values rejected.
    for (const key of ['goalTimer', 'countdownClock']) {
      if (snapshot[key] !== undefined && (!Number.isFinite(snapshot[key]) || snapshot[key] < -.033)) return false;
    }
    for (const key of ['elapsed', 'countdown', 'scorePlayer', 'scoreBot']) {
      if (snapshot[key] !== undefined && (!Number.isFinite(snapshot[key]) || snapshot[key] < 0)) return false;
    }
    // The host sends its own view (left side). Right-side guests flip scores
    // and stats; in 2v2 every body comes from its seat.
    const flip = !squad || this.localSide === 'right';
    const mapped = {
      ...snapshot,
      goalTimer: Math.max(0, snapshot.goalTimer || 0),
      countdownClock: Math.max(0, snapshot.countdownClock || 0),
      player: squad ? snapshot.seats[squad.localSeat] : snapshot.bot,
      bot: squad ? snapshot.seats[squad.botSeat] : snapshot.player,
      others: squad ? squad.otherSeats.map(seat => snapshot.seats[seat]) : undefined,
      scorePlayer: flip ? snapshot.scoreBot : snapshot.scorePlayer,
      scoreBot: flip ? snapshot.scorePlayer : snapshot.scoreBot,
      matchStats: snapshot.matchStats && (flip ? { shotsPlayer: snapshot.matchStats.shotsOpponent, shotsOpponent: snapshot.matchStats.shotsPlayer, goals: Array.isArray(snapshot.matchStats.goals) ? snapshot.matchStats.goals.map(goal => ({ ...goal, side: goal.side === 'player' ? 'opponent' : 'player' })) : [] } : snapshot.matchStats),
    };
    const priorScorePlayer = this.state.scorePlayer, priorScoreBot = this.state.scoreBot;
    const priorCountdown = this.countdown;
    const resetting = snapshot.countdown > 0 || snapshot.goalTimer > 0 || snapshot.matchOver || priorCountdown > 0 || priorScorePlayer !== mapped.scorePlayer || priorScoreBot !== mapped.scoreBot;
    const predictedPlayer = (squad || this.localSide === 'right') && !resetting ? { x: this.player.x, y: this.player.y, vx: this.player.vx, vy: this.player.vy, faceX: this.player.faceX, faceY: this.player.faceY } : null;
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
      this.markGoalForReplay();
      this.hooks.onScore?.(this.state.scorePlayer, this.state.scoreBot);
      const localScored = priorScorePlayer !== this.state.scorePlayer;
      this.hooks.onGoal?.(this.state.goalSide || (localScored ? -1 : 1));
    }
    this.syncGuestReplay(snapshot.replay);
    if (this.state.matchOver && this.state.goalTimer <= 0 && !this.replay) {
      this.state.paused = true; this.input.enabled = false;
      if (this.onlineMatchEnded) return true;
      this.onlineMatchEnded = true;
      this.state.paused = true;
      this.hooks.onMatchEnd?.({ mode: 'online', elapsedSeconds: this.state.elapsed, playerScore: this.state.scorePlayer, botScore: this.state.scoreBot, winner: this.state.scorePlayer > this.state.scoreBot ? 'player' : 'opponent', stats: this.matchSummary() });
    }
    return true;
  }
  // ---- Online resume ------------------------------------------------------------
  // When the host reloads mid-match, a guest sends where the match was so the host
  // continues it instead of starting at 0-0. Always in host order (left / right).
  resumeState(matchId) {
    if (this.state.mode !== 'online' || !matchId) return null;
    const flip = this.localSide === 'right';
    const left = flip ? this.state.scoreBot : this.state.scorePlayer, right = flip ? this.state.scorePlayer : this.state.scoreBot;
    const goals = (this.matchStats?.goals || []).slice(-9).map(goal => ({ side: (goal.side === 'player') !== flip ? 'player' : 'opponent', minute: goal.minute, elapsedSeconds: goal.elapsedSeconds }));
    return { matchId, left, right, elapsed: Math.round(this.state.elapsed * 10) / 10, goals };
  }
  applyResume(resume) {
    const score = value => Math.max(0, Math.min(this.goalTarget - 1, Math.floor(Number(value) || 0)));
    if (!resume || !this.onlineAuthority || this.state.mode !== 'online') return false;
    this.state.scorePlayer = score(resume.left); this.state.scoreBot = score(resume.right);
    this.state.elapsed = Math.max(0, Math.min(3600, Number(resume.elapsed) || 0));
    const goals = Array.isArray(resume.goals) ? resume.goals.slice(-9) : [];
    this.matchStats.goals = goals.filter(goal => ['player', 'opponent'].includes(goal?.side)).map(goal => ({ side: goal.side, minute: Math.max(1, Math.floor(Number(goal.minute) || 1)), elapsedSeconds: Math.max(0, Number(goal.elapsedSeconds) || 0) }));
    this.hooks.onScore?.(this.state.scorePlayer, this.state.scoreBot); this.hooks.onTime?.(this.state.formatTime());
    return true;
  }
  // ---- 2v2 online ------------------------------------------------------------
  // Seats in host order: 0 = left captain (host), 1 = left teammate,
  // 2 = right captain, 3 = right teammate. `player` is the local seat, `bot`
  // the first rival and `others` the remaining two bodies.
  setupSquad(squad) {
    const seats = Array.isArray(squad.seats) ? squad.seats.slice(0, 4) : [];
    while (seats.length < 4) seats.push({});
    const localSeat = Math.max(0, Math.min(3, Math.floor(Number(squad.localSeat) || 0)));
    const kits = [getTeamById(seats[0].teamId), getTeamById(seats[2].teamId)];
    const bodies = seats.map((seat, index) => {
      const team = kits[index < 2 ? 0 : 1], fallback = index < 2 ? '#68746e' : '#f19676';
      return Object.assign(new Player({ x: 0, y: 0, name: String(seat.name || 'JUGADOR').slice(0, 16), number: Number.isFinite(Number(seat.number)) ? Number(seat.number) : 10, color: team?.primary || fallback, secondaryColor: team?.secondary || null, numberColor: team?.numberColor, kitPattern: team?.kitPattern, tertiaryColor: team?.tertiary || null, kitBands: team?.kitBands || null, numberOutline: team?.numberOutline, isBot: false, speed: 305 }), { goldKit: !!seat.goldKit });
    });
    const botSeat = localSeat < 2 ? 2 : 0;
    this.squad = { bodies, localSeat, botSeat, otherSeats: [0, 1, 2, 3].filter(seat => seat !== localSeat && seat !== botSeat), seats };
    this.player = bodies[localSeat]; this.bot = bodies[botSeat]; this.others = this.squad.otherSeats.map(seat => bodies[seat]);
    bodies.forEach((body, seat) => this.placeSquadBody(body, seat));
  }
  // ---- 2v2 offline -----------------------------------------------------------
  // The human (seat 0) plays with an AI teammate (seat 1) against two AI rivals
  // (seats 2 and 3). Reuses the 2v2 seat layout and simulation of the online mode.
  setupDuo(team, opponentTeam, difficulty, opponentName, opponentNumber, mateLevel) {
    const ownNumber = Number(this.settings.number) || 10, mateNumber = ownNumber === 7 ? 8 : 7;
    const rivalTeamId = opponentTeam?.id || null;
    this.setupSquad({ localSeat: 0, seats: [
      { name: this.settings.name, number: ownNumber, teamId: team?.id },
      { name: 'IA', number: mateNumber, teamId: team?.id },
      { name: opponentName, number: opponentNumber, teamId: rivalTeamId },
      { name: opponentName, number: opponentNumber === 9 ? 11 : 9, teamId: rivalTeamId },
    ] });
    const [human, mate, rivalA, rivalB] = this.squad.bodies;
    // Rival kits fall back to the opponent colours when the team is not in the catalogue.
    const kit = source => source && { color: source.primary || '#f19676', secondaryColor: source.secondary || null, numberColor: source.numberColor || '#ffffff', kitPattern: source.kitPattern || 'half-vertical', tertiaryColor: source.tertiary || null, kitBands: source.kitBands || null, numberOutline: source.numberOutline !== false };
    if (opponentTeam) for (const rival of [rivalA, rivalB]) Object.assign(rival, kit(opponentTeam));
    if (team) for (const body of [human, mate]) Object.assign(body, kit(team));
    for (const body of [mate, rivalA, rivalB]) { body.isBot = true; body.maxSpeed = 280; }
    human.isBot = false;
    this.squad.offline = true;
    this.squad.ai = new SquadAI({ difficulty: this.botAI.difficulty || difficulty, rivalStars: opponentTeam?.stars || 3, mateStars: team?.stars || 3, ...(mateLevel ? { mateLevel } : {}) });
  }
  placeSquadBody(body, seat) {
    body.x = WORLD.width * (seat < 2 ? .3 : .7); body.y = WORLD.height * (seat % 2 === 0 ? .38 : .62);
    body.faceX = seat < 2 ? 1 : -1; body.faceY = 0; body.stop(); body._rx = body.x; body._ry = body.y;
  }
  replaySkipCount() {
    const replay = this.replay; if (!replay || !this.squad) return 0;
    if (this.onlineAuthority) return (replay.localSkip ? 1 : 0) + (replay.remoteSkip ? 3 : (replay.remoteSeats?.size || 0));
    return (replay.localSkip ? 1 : 0) + (replay.hostSkip ? 1 : 0) + (replay.remoteSeats?.size || 0);
  }
  // Host simulation of the four bodies; guest seats move with their last input.
  updateSquad(dt) {
    const { bodies, localSeat } = this.squad, leftLocal = this.localSide === 'left';
    const aiCommands = this.squad.ai ? this.squad.ai.update(bodies, this.ball, dt) : null;
    bodies.forEach((body, seat) => {
      let command;
      if (seat === localSeat) { const axes = this.input.axes(); command = { x: axes.x, y: axes.y, ...this.readKick() }; }
      else if (aiCommands) {
        command = aiCommands[seat] || { x: 0, y: 0 };
        body.move(Number(command.x) || 0, Number(command.y) || 0, dt, command.speed ?? 1);
        resolvePlayerWalls(body);
        if (command.kick && kickBall(body, this.ball, () => { this.sound.play('kick'); this.renderer.burst(this.ball.x, this.ball.y, seat < 2 ? '#c5f4d8' : '#ffd1bf', 5, 78); }, command.aim || null, command.power ?? 1)) {
          if ((seat < 2) === leftLocal) this.matchStats.shotsPlayer++; else this.matchStats.shotsOpponent++;
        }
        return;
      }
      else {
        command = this.hooks.getSeatInput?.(seat) || { x: 0, y: 0, kick: false };
        body.powerCooldown = Math.max(0, body.powerCooldown - dt); body.powerFlash = Math.max(0, body.powerFlash - dt);
      }
      body.move(Number(command.x) || 0, Number(command.y) || 0, dt);
      resolvePlayerWalls(body);
      if (!command.kick) return;
      if (seat === localSeat) this.shotRangeTimer = .62;
      const powered = body.powerCooldown <= 0;
      const kicked = kickBall(body, this.ball, () => {
        this.sound.play('kick');
        if (powered) { this.renderer.fireBurst(this.ball.x, this.ball.y); body.powerFlash = .48; }
        else this.renderer.burst(this.ball.x, this.ball.y, '#c5f4d8', 7, 100);
      }, null, powered ? 1.45 : 1, curveSide(command.curve === true, command.y));
      if (kicked) { if ((seat < 2) === leftLocal) this.matchStats.shotsPlayer++; else this.matchStats.shotsOpponent++; }
      if (kicked && powered) { body.powerCooldown = (this.modifiers?.powerCooldown ?? POWER_SHOT_COOLDOWN_SECONDS); if (seat === localSeat) this.hooks.onPowerCooldown?.(body.powerCooldown); }
    });
    // Two passes: with four bodies one push can create a new overlap.
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) resolvePlayerPlayers(bodies[i], bodies[j], strength => { if (pass === 0 && strength > 22) this.sound.bump(); });
    for (const body of bodies) resolvePlayerWalls(body);
    const steps = Math.max(1, Math.ceil(Math.hypot(this.ball.vx, this.ball.vy) * dt / Math.max(5, this.ball.radius)));
    for (let step = 0; step < steps; step++) {
      this.ball.update(dt / steps);
      for (const body of bodies) resolvePlayerBall(body, this.ball, strength => { if (strength > 30) this.sound.bump(); });
      for (const body of bodies) resolvePlayerWalls(body);
      const goalSide = isGoal(this.ball);
      if (goalSide !== 0) { this.recordGoal(goalSide); return; }
      resolveBallWalls(this.ball, () => this.sound.bump());
    }
  }
  resetPositions() {
    if (this.squad) { this.squad.bodies.forEach((body, seat) => this.placeSquadBody(body, seat)); this.ball.reset(WORLD.width / 2, WORLD.height / 2); this.ball._rx = this.ball.x; this.ball._ry = this.ball.y; return; }
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
