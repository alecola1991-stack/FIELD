import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD } from '../src/config/settings.js';
import { modifierWorld } from '../src/config/modifiers.js';
import { Ball } from '../src/game/Ball.js';
import { Player } from '../src/game/Player.js';
import { Game } from '../src/game/Game.js';
import { GameState } from '../src/game/GameState.js';
import { BotAI } from '../src/game/BotAI.js';
import { TeamAI } from '../src/game/TeamTactics.js';
import { curvedPassAim } from '../src/game/Tactical.js';

function fixture(gameplay = 'tactical') {
  const game = Object.create(Game.prototype);
  Object.assign(game, { settings: { name: 'P', number: 10, teamId: 'laliga-barcelona', difficulty: 'hard', modifiers: {}, gameplay },
    state: new GameState(), botAI: new BotAI('hard'), ball: new Ball(0, 0), raf: 1,
    input: { down: new Set(), pressed: new Set(), axes: () => ({ x: 0, y: 0 }), consume: () => false, consumeKick: () => ({ kick: false }), curveHeld: () => false, endFrame() {}, setScheme() {} },
    sound: { play() {}, bump() {}, updateAmbience() {} }, renderer: { burst() {}, fireBurst() {} }, hooks: {} });
  game.start('bot', 'hard', { opponentTeam: { id: 'x', stars: 4 }, trio: true });
  return game;
}

test('3v3 pitch is 30 % bigger with goals of the same size', () => {
  const world = modifierWorld({}, 1.3);
  assert.equal(world.width, Math.round(WORLD.width * 1.3)); assert.equal(world.height, Math.round(WORLD.height * 1.3));
  assert.equal(world.goalBottom - world.goalTop, WORLD.goalBottom - WORLD.goalTop);
  assert.equal(world.right, world.width - (WORLD.width - WORLD.right));
});

test('3v3 only in Táctico: six players, the human is the forward up front', () => {
  const game = fixture();
  assert.equal(game.squad.bodies.length, 6); assert.equal(game.squad.teamSize, 3); assert.ok(game.squad.ai instanceof TeamAI);
  const [human, mid, keeper, rivalForward, rivalMid, rivalKeeper] = game.squad.bodies;
  assert.equal(game.player, human); assert.ok(human.x > mid.x && mid.x > keeper.x, 'forward ahead of midfielder ahead of keeper');
  assert.ok(rivalForward.x < rivalMid.x && rivalMid.x < rivalKeeper.x);
  assert.equal(game.world.width, Math.round(WORLD.width * 1.3));
  assert.ok(game.leftSeat(2) && !game.leftSeat(3));
  const arcade = fixture('arcade');
  assert.equal(arcade.squad, null); assert.equal(arcade.world.width, WORLD.width);
});

test('3v3 runs: AI commands for seats 1..5 and everyone stays on the pitch', () => {
  const game = fixture(); game.countdown = 0;
  for (let i = 0; i < 1200; i++) {
    game.update(1 / 60);
    if (game.state.goalTimer > 0) { game.state.goalTimer = 0; game.resetPositions(); game.countdown = 0; }
  }
  for (const body of game.squad.bodies) assert.ok(body.x > game.world.left - 60 && body.x < game.world.right + 60);
  const commands = game.squad.ai.update(game.squad.bodies, game.ball, 1 / 60);
  assert.deepEqual(Object.keys(commands).map(Number), [1, 2, 3, 4, 5]);
});

test('curved pass reaches the target', () => {
  const passer = new Player({ x: 400, y: 450 }), ball = new Ball(432, 450); ball.world = modifierWorld({}, 1.3);
  const result = curvedPassAim(passer, ball, { x: 820, y: 300 }, .9);
  assert.ok(result && (result.curve === 1 || result.curve === -1));
});
