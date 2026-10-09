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
