import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/Game.js';
import { Player } from '../src/game/Player.js';

test('el invitado predice su movimiento y conserva las teclas al recibir snapshots', () => {
  const game = Object.create(Game.prototype);
  game.localSide = 'right'; game.onlineAuthority = false;
  game.state = { mode: 'online', elapsed: 0, scorePlayer: 0, scoreBot: 0, goalTimer: 0, matchOver: false, paused: false, formatTime: () => '00:00' };
  game.player = new Player({ x: 650, y: 350, name: 'LUIS' });
  game.bot = new Player({ x: 100, y: 350, name: 'ANA' });
  game.ball = { x: 375, y: 350, vx: 0, vy: 0, radius: 13, spin: 0, kickScale: 0 };
  game.settings = { trajectory: false }; game.botAI = {};
  game.goalTarget = 5; game.countdown = 0; game.countdownClock = 0;
  game.fieldTheme = 'arcade'; game.competitionRound = 0; game.shotRangeTimer = 0;
  game.remoteInput = { x: 0, y: 0, kick: false };
  game.hooks = { onTime() {}, onPowerCooldown() {} };
  game.input = { down: new Set(['KeyD']), pressed: new Set(), axes: () => ({ x: 1, y: 0 }), consume: () => false };

  assert.equal(game.applyOnlineSnapshot({
    mode: 'online', elapsed: 1, scorePlayer: 0, scoreBot: 0, goalTimer: 0, matchOver: false,
    goalTarget: 5, countdown: 0, countdownClock: 0, trajectory: false, fieldTheme: 'arcade', competitionRound: 0,
    player: { x: 100, y: 350, vx: 0, vy: 0 }, bot: { x: 650, y: 350, vx: 0, vy: 0 },
    ball: { x: 375, y: 350, vx: 0, vy: 0 },
  }), true);
  assert.equal(game.input.down.has('KeyD'), true);

  const before = game.player.x;
  game.predictOnlineGuest(1 / 60);
  assert.ok(game.player.x > before, 'el jugador local avanza sin esperar al servidor');
});


test('online state preserves smoothing, maps stats, and snaps countdown respawns', () => {
  const game = Object.create(Game.prototype);
  Object.assign(game, { localSide: 'right', onlineAuthority: false, settings: {}, botAI: {}, hooks: {}, countdown: 0 });
  game.state = { mode: 'online', scorePlayer: 0, scoreBot: 0, formatTime: () => '00:00' };
  game.player = new Player({ x: 650, y: 350, name: 'LUIS' });
  game.bot = new Player({ x: 100, y: 350, name: 'ANA' });
  game.ball = { x: 375, y: 350, _rx: 370, _ry: 350 };
  const snapshot = { mode: 'online', scorePlayer: 0, scoreBot: 0, countdown: 0,
    player: { x: 102, y: 350 }, bot: { x: 648, y: 350 }, ball: { x: 380, y: 350 },
    matchStats: { shotsPlayer: 2, shotsOpponent: 4, goals: [{ side: 'player', minute: 1 }] } };
  game.applyOnlineSnapshot(snapshot);
  assert.equal(game.ball._rx, 370, 'a regular packet does not reset the rendered position');
  assert.equal(game.matchStats.shotsPlayer, 4);
  assert.equal(game.matchStats.goals[0].side, 'opponent');
  game.applyOnlineSnapshot({ ...snapshot, countdown: 5, bot: { x: 690, y: 350 } });
  assert.equal(game.player.x, 690, 'countdown reset must not retain predicted momentum');
  assert.equal(game.ball._rx, 380);
});

test('remote movement fills packet gaps but stops after 100ms without a snapshot', () => {
  const game = Object.create(Game.prototype);
  Object.assign(game, { countdown: 0, state: { goalTimer: 0, matchOver: false }, shotRangeTimer: 0,
    input: { axes: () => ({ x: 0, y: 0 }), consume: () => false }, onlineSnapshotAge: 0 });
  game.player = new Player({ x: 650, y: 350, name: 'LUIS' });
  game.bot = new Player({ x: 100, y: 350, name: 'ANA' }); game.bot.vx = 100;
  game.ball = { x: 375, y: 350, vx: 100, vy: 0, radius: 13, spin: 0 };
  for (let frame = 0; frame < 20; frame++) game.predictOnlineGuest(1 / 60);
  assert.ok(Math.abs(game.bot.x - 110) < .001);
  assert.ok(Math.abs(game.ball.x - 385) < .001);
});

test('network snapshots omit AI and fixed metadata while saves retain them', () => {
  const game = Object.create(Game.prototype);
  Object.assign(game, { state: { mode: 'online' }, botAI: { difficulty: 'easy' }, matchStats: { shotsPlayer: 2, shotsOpponent: 0, goals: [] }, fieldTheme: 'arcade' });
  const save = game.captureSnapshot(), packet = game.captureSnapshot(true);
  assert.ok(save.ai); assert.equal(save.fieldTheme, 'arcade');
  assert.equal(packet.ai, undefined); assert.equal(packet.fieldTheme, undefined);
  assert.deepEqual(packet.matchStats, save.matchStats);
  assert.ok(JSON.stringify(packet).length < JSON.stringify(save).length);
});


test('input changes and shots send immediately while unchanged input uses keepalives', () => {
  const originalRAF = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 1;
  try {
    const game = Object.create(Game.prototype), sent = [];
    Object.assign(game, { last: 1000, state: { running: true, paused: false, mode: 'online' }, onlineAuthority: false,
      onlineInputClock: 0, onlinePendingKick: false, autosaveClock: 0, renderer: { render() {} },
      hooks: { onOnlineInput: input => sent.push(input) }, settings: {},
      input: { axes: () => axes, endFrame() {} }, predictOnlineGuest() {} });
    let axes = { x: 0, y: 0 };
    game.loop(1016); assert.equal(sent.length, 1);
    for (let time = 1032; time < 1200; time += 16) game.loop(time);
    assert.equal(sent.length, 1, 'unchanged input no longer floods the channel at 30Hz');
    axes = { x: 1, y: 0 }; game.loop(1200);
    assert.equal(sent.length, 2); assert.equal(sent[1].x, 1);
    game.onlinePendingKick = true; game.loop(1216);
    assert.equal(sent.length, 3); assert.equal(sent[2].kick, true);
    assert.equal(game.onlinePendingKick, false);
    for (let time = 1232; time < 1450; time += 16) game.loop(time);
    assert.equal(sent.length, 4, 'steady movement receives a periodic keepalive');
  } finally { globalThis.requestAnimationFrame = originalRAF; }
});
