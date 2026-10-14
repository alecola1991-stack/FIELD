import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MODIFIERS, MODIFIER_OPTIONS, normalizeModifiers, modifiersAreDefault, modifierWorld } from '../src/config/modifiers.js';
import { WORLD } from '../src/config/settings.js';
import { Game } from '../src/game/Game.js';
import { GameState } from '../src/game/GameState.js';
import { BotAI } from '../src/game/BotAI.js';
import { Ball } from '../src/game/Ball.js';
import { Player } from '../src/game/Player.js';
import { isGoal, resolveBallWalls, resolvePlayerBall } from '../src/game/Physics.js';
import { UI } from '../src/ui/UI.js';
import { Renderer } from '../src/game/Renderer.js';

function fixture(mode = 'bot', modifiers = {}, side = 'left') {
  const game = Object.create(Game.prototype);
  Object.assign(game, { settings: { name: 'PLAYER', number: 10, teamId: 'laliga-barcelona', difficulty: 'easy', modifiers },
    state: new GameState(), botAI: new BotAI('easy'), ball: new Ball(0, 0), raf: 1,
    input: { down: new Set(), pressed: new Set(), axes: () => ({ x: 0, y: 0 }), consume: () => false },
    sound: { play() {}, bump() {} }, renderer: { burst() {}, fireBurst() {} }, hooks: {} });
  game.start(mode, 'easy', { localSide: side }); return game;
}

test('modifiers normalize malformed values, limits and defaults without mutating stored rules', () => {
  assert.deepEqual(normalizeModifiers(null), DEFAULT_MODIFIERS);
  assert.deepEqual(normalizeModifiers({}), DEFAULT_MODIFIERS);
  const input = { ballSize: Infinity, playerSize: -100, goalSize: 5, powerCooldown: '12', goalTarget: 2.4, shotPower: null };
  const rules = normalizeModifiers(input);
  assert.equal(rules.ballSize, 1); assert.equal(rules.playerSize, .6); assert.equal(rules.goalSize, 1.7);
  assert.equal(rules.powerCooldown, 12); assert.equal(rules.goalTarget, 2); assert.equal(rules.shotPower, 1);
  assert.equal(input.playerSize, -100);
  assert.ok(modifiersAreDefault({})); assert.equal(modifiersAreDefault(rules), false);
  for (const option of MODIFIER_OPTIONS) assert.ok(rules[option.key] >= option.min && rules[option.key] <= option.max);
});

test('every game mode applies size, shared geometry, player speed and goals at match start', () => {
  const rules = { ballSize: 1.8, playerSize: 1.2, goalSize: 1.3, playerSpeed: 1.4, shotPower: 1.5, goalTarget: 6 };
  for (const mode of ['bot', 'training', 'league', 'tournament', 'legends']) {
    const game = fixture(mode, rules);
    assert.equal(game.ball.radius, 21.6); assert.equal(game.player.radius, 26.4);
    assert.equal(game.player.maxSpeed, 427); assert.equal(game.goalTarget, 6);
    assert.equal(game.ball.world, game.world); assert.equal(game.player.world, game.world);
    assert.equal(game.world.goalBottom - game.world.goalTop, 247);
    assert.equal(game.player.shotPower, 1.5);
    if (game.bot) assert.equal(game.bot.radius, game.player.radius);
    if (mode === 'legends') assert.equal(game.botAI.difficulty, 'legend');
    if (mode === 'online') assert.equal(game.bot.maxSpeed, game.player.maxSpeed);
  }
});

test('saving a modified match preserves its rules even after preferences change', () => {
  const game = fixture('league', { ballSize: 1.5, goalSize: 1.4, playerSpeed: 1.2 });
  const snapshot = game.captureSnapshot();
  game.settings.modifiers = {};
  game.start('league', 'easy');
  assert.equal(game.ball.radius, 12);
  assert.ok(game.restoreSnapshot(snapshot));
  assert.equal(game.ball.radius, 18); assert.equal(game.modifiers.goalSize, 1.4);
  assert.equal(game.player.maxSpeed, 366);
  assert.equal(game.goalTarget, snapshot.goalTarget);
});

test('modified fire cooldown is used by a real shot and does not alter the current match via preferences', () => {
  const game = fixture('bot', { powerCooldown: 7, shotPower: 1.4 });
  game.countdown = 0; game.ball.x = game.player.x + 40; game.ball.y = game.player.y;
  game.input.consume = () => true;
  game.update(1 / 60);
  assert.equal(game.player.powerCooldown, 7);
  game.updateSettings({ ...game.settings, modifiers: { powerCooldown: 60 } });
  assert.equal(game.modifiers.powerCooldown, 7);
  assert.equal(game.matchStats.shotsPlayer, 1);
});

test('modified goal opening governs goals and post rebounds, and small fast balls do not pass through posts', () => {
  const wide = modifierWorld({ goalSize: 1.7 }), narrow = modifierWorld({ goalSize: .7 });
  const ball = new Ball(WORLD.left - 13, WORLD.goalTop + 20);
  ball.world = wide; assert.equal(isGoal(ball), -1);
  ball.world = narrow; assert.equal(isGoal(ball), 0);
  const post = new Ball(wide.left + 7, wide.goalTop + 6); post.world = wide; post.vx = -200;
  resolveBallWalls(post); assert.ok(Math.hypot(post.vx + 200, post.vy) > 100);
  const game = fixture('online', { ballSize: .5, shotPower: 1.8 });
  game.countdown = 0; game.ball.x = 96; game.ball.y = game.world.goalTop + 3; game.ball.vx = -1400;
  game.update(.033); assert.ok(game.ball.vx > 0, 'substeps catch the post before the ball skips across it');
  assert.equal(game.state.scorePlayer + game.state.scoreBot, 0);
});

test('exactly overlapping player and ball separate with finite coordinates', () => {
  const player = new Player({ x: 300, y: 300, name: 'P' }); player.faceX = 0; player.faceY = 0;
  const ball = new Ball(300, 300);
  resolvePlayerBall(player, ball);
  assert.ok([player.x, player.y, ball.x, ball.y].every(Number.isFinite));
  assert.ok(Math.hypot(player.x - ball.x, player.y - ball.y) >= player.radius + ball.radius - .001);
});

test('returning to the menu between competition matches saves the unfinished season', () => {
  const ui = Object.create(UI.prototype); let saved = 0, quit = 0;
  ui.saveAndQuit = () => saved++; ui.quit = () => quit++;
  ui.league = { status: 'next' }; ui.finishToMenu();
  ui.league = null; ui.tournament = { status: 'next' }; ui.finishToMenu();
  ui.tournament.status = 'champion'; ui.finishToMenu();
  assert.equal(saved, 2); assert.equal(quit, 1);
});

test('rendering caches the pitch and invalidates it when goal size changes', () => {
  const renderer = Object.create(Renderer.prototype);
  const context = new Proxy({}, { get: (_target, property) => property === 'canvas' ? { width: 1140, height: 700 } : () => {} });
  Object.assign(renderer, { ctx: context, canvas: { width: 1140, height: 700 }, fieldCache: {}, fieldCacheContext: context, scale: 1, ox: 0, oy: 0,
    smooth: entity => [entity.x, entity.y], drawPlayer() {}, drawBall() {}, updateParticles() {} });
  let fields = 0; renderer.drawField = () => fields++;
  const game = { ball: new Ball(500, 300), player: new Player({ x: 300, y: 300, name: 'P' }), cosmetics: {} };
  renderer.render(game, 1 / 60); renderer.render(game, 1 / 60);
  assert.equal(fields, 1);
  game.world = modifierWorld({ goalSize: 1.5 }); renderer.render(game, 1 / 60);
  assert.equal(fields, 2);
});


test('invalid online states are rejected and completed matches remain paused on subsequent snapshots', () => {
  const game = fixture('online', {}, 'right');
  const snapshot = { mode: 'online', player: { x: 300, y: 350, vx: 0, vy: 0 }, bot: { x: 780, y: 350, vx: 0, vy: 0 }, ball: { x: 500, y: 350, vx: 0, vy: 0 },
    scorePlayer: 5, scoreBot: 3, elapsed: 30, goalTimer: 0, matchOver: true, countdown: 0 };
  assert.equal(game.applyOnlineSnapshot({ ...snapshot, ball: { x: NaN, y: 350 } }), false);
  assert.equal(game.applyOnlineSnapshot({ ...snapshot, elapsed: Infinity }), false);
  let ended = 0; game.hooks.onMatchEnd = () => ended++;
  game.applyOnlineSnapshot(snapshot); assert.equal(game.state.paused, true);
  game.applyOnlineSnapshot(snapshot); assert.equal(game.state.paused, true);
  assert.equal(ended, 1);
});


test('the goal net is deep enough for the entire oversized ball to cross the goal line', () => {
  for (const ballSize of [1, 1.5, 1.8, 2]) {
    const world = modifierWorld({ ballSize });
    for (const side of [-1, 1]) {
      const ball = new Ball(side === -1 ? world.left - 12 * ballSize - 1 : world.right + 12 * ballSize + 1, world.height / 2);
      ball.radius = 12 * ballSize; ball.world = world; ball.vx = side * 100;
      resolveBallWalls(ball);
      assert.equal(isGoal(ball), side, 'the back net must not stop a large ball before it becomes a goal');
    }
  }
});


test('guest career goals use local scoring direction rather than the physical goal side', () => {
  const ui = Object.create(UI.prototype), recorded = [];
  Object.assign(ui, { currentMatchMode: 'online', game: { localSide: 'right' }, career: { recordGoal: side => recorded.push(side) }, renderAccount() {}, checkAchievements() {}, syncAccount() {} });
  ui.recordGoal(-1); ui.recordGoal(1);
  assert.deepEqual(recorded, [1, -1]);
  ui.game.localSide = 'left'; ui.recordGoal(1);
  assert.equal(recorded[2], 1);
});


test('returning from an online match releases the room before stopping the game', () => {
  const events = [];
  const ui = Object.create(UI.prototype);
  const overlay = { classList: { add() {} } };
  Object.assign(ui, { currentMatchMode: 'online', onlineMatch: { leave: () => events.push('leave') },
    game: { setPaused() {}, stop: () => events.push('stop') }, saveCurrentCompetition() {}, syncAccount() {}, show() {}, refreshContinueButton() {},
    goal_banner: overlay, countdown_banner: overlay, pause_overlay: overlay, result_overlay: overlay });
  ui.saveAndQuit();
  assert.deepEqual(events, ['leave', 'stop']); assert.equal(ui.currentMatchMode, null);
});

test('continue accepts complete checkpoints and ignores incomplete or incompatible saves', async () => {
  const { loadCompetitionSave, storeCompetitionSave } = await import('../src/game/CompetitionSave.js');
  const previous = globalThis.localStorage;
  let value = null;
  globalThis.localStorage = { getItem: () => value, setItem: (_key, data) => { value = data; } };
  try {
    const game = fixture('league').captureSnapshot();
    const save = { version: 1, competition: { mode: 'league', league: { status: 'playing', jornada: 1, opponents: [{}] } }, match: { mode: 'league' }, game };
    storeCompetitionSave(save); assert.ok(loadCompetitionSave());
    for (const damaged of [ { ...save, game: {} }, { ...save, match: { mode: 'bot' } },
      { ...save, game: { ...game, ball: { x: null, y: 10 } } },
      { ...save, competition: { mode: 'league', league: { status: 'complete', jornada: 1, opponents: [{}] } } } ]) {
      storeCompetitionSave(damaged); assert.equal(loadCompetitionSave(), null);
    }
    value = '{bad json'; assert.equal(loadCompetitionSave(), null);
  } finally { globalThis.localStorage = previous; }
});


test('online ignores modifiers in preferences, start options and restored snapshots', () => {
  const game = fixture('online', { ballSize: 2, shotPower: 1.8, powerCooldown: 3, goalTarget: 1 });
  assert.deepEqual(game.modifiers, DEFAULT_MODIFIERS);
  assert.equal(game.goalTarget, 5); assert.equal(game.player.radius, 22); assert.equal(game.ball.radius, 12);
  const saved = game.captureSnapshot(); saved.modifiers = { ballSize: 2, goalTarget: 1 }; saved.goalTarget = 1;
  game.restoreSnapshot(saved); assert.equal(game.goalTarget, 5); assert.deepEqual(game.modifiers, DEFAULT_MODIFIERS);
});
