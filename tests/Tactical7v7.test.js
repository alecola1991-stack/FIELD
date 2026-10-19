import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD } from '../src/config/settings.js';
import { Ball } from '../src/game/Ball.js';
import { Game, SEVEN_FIELD_SCALE } from '../src/game/Game.js';
import { GameState } from '../src/game/GameState.js';
import { BotAI } from '../src/game/BotAI.js';
import { SevenAI, SEVEN_ROLES } from '../src/game/TeamTactics.js';

function fixture(options = { seven: true }, gameplay = 'tactical') {
  const game = Object.create(Game.prototype);
  Object.assign(game, { settings: { name: 'P', number: 10, teamId: 'laliga-barcelona', difficulty: 'hard', modifiers: {}, gameplay },
    state: new GameState(), botAI: new BotAI('hard'), ball: new Ball(0, 0), raf: 1,
    input: { down: new Set(), pressed: new Set(), axes: () => ({ x: 0, y: 0 }), consume: () => false, consumeKick: () => ({ kick: false }), curveHeld: () => false, endFrame() {}, setScheme() {} },
    sound: { play() {}, bump() {}, updateAmbience() {} }, renderer: { burst() {}, fireBurst() {} }, hooks: {} });
  game.start('bot', 'hard', { opponentTeam: { id: 'x', stars: 4 }, ...options });
  game.countdown = 0;
  return game;
}

test('7v7 only in Táctico: 14 players on a pitch 90 % bigger with the same goals', () => {
  const game = fixture();
  assert.equal(game.seven, true); assert.equal(game.trio, false);
  assert.equal(game.squad.bodies.length, 14); assert.ok(game.squad.ai instanceof SevenAI);
  assert.equal(game.world.width, Math.round(WORLD.width * SEVEN_FIELD_SCALE));
  assert.equal(game.world.goalBottom - game.world.goalTop, WORLD.goalBottom - WORLD.goalTop);
  assert.deepEqual(game.squad.roles, [...SEVEN_ROLES, ...SEVEN_ROLES]);
  // The human is the forward: the most advanced player of the left team at kick-off.
  const left = game.squad.bodies.slice(0, 7);
  assert.equal(game.player, left[0]); assert.ok(left.every(body => body.x <= game.player.x));
  // Numbers are not repeated within a team.
  for (const team of [left, game.squad.bodies.slice(7)]) assert.equal(new Set(team.map(body => body.number)).size, 7);
  assert.equal(fixture({ seven: true }, 'arcade').seven, false);
});

test('kick-off: the home team starts, then the team that conceded', () => {
  const game = fixture();
  const world = game.world, cx = world.width / 2, cy = world.height / 2, R = world.centerCircleRadius;
  assert.equal(game.kickoffSide, 'left'); assert.equal(game.kickoff.left, true);
  game.update(1 / 60);
  assert.equal(game.possession.holder, game.player, 'the human forward starts on the ball');
  // Rivals stay in their half and out of the centre circle while the ball has not moved.
  for (const body of game.squad.bodies.slice(7)) assert.ok(body.x >= cx && Math.hypot(body.x - cx, body.y - cy) >= R - 1);
  // The human team scores: the rival kicks off.
  game.recordGoal(1); game.state.goalTimer = 0; game.state.matchOver = false; game.resetPositions();
  assert.equal(game.kickoffSide, 'right'); assert.equal(game.kickoff.left, false);
  game.update(1 / 60);
  assert.equal(game.possession.holder, game.squad.bodies[7]);
  for (const body of game.squad.bodies.slice(0, 7)) assert.ok(body.x <= cx && Math.hypot(body.x - cx, body.y - cy) >= R - 1);
  // 3v3 too.
  const trio = fixture({ trio: true });
  assert.equal(trio.kickoff.left, true); trio.update(1 / 60); assert.equal(trio.possession.holder, trio.player);
});

test('7v7 AI plays a match: passes, shots and nobody leaves the pitch', () => {
  const game = fixture();
  let kicks = 0, outside = 0; const original = game.ball.onKicked; game.ball.onKicked = body => { kicks++; original(body); };
  for (let i = 0; i < 40 * 60; i++) {
    game.update(1 / 60);
    for (const body of game.squad.bodies) if (body.x < 0 || body.x > game.world.width || body.y < 0 || body.y > game.world.height) outside++;
    if (game.state.goalTimer > 0) { game.state.goalTimer = 0; game.resetPositions(); game.countdown = 0; }
  }
  assert.ok(kicks > 10, `kicks ${kicks}`); assert.equal(outside, 0);
});
