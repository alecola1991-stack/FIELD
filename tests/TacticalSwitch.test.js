import test from 'node:test';
import assert from 'node:assert/strict';
import { Ball } from '../src/game/Ball.js';
import { Game } from '../src/game/Game.js';
import { GameState } from '../src/game/GameState.js';
import { BotAI } from '../src/game/BotAI.js';
import { SquadTactics, SevenAI } from '../src/game/TeamTactics.js';

function fixture(options) {
  const game = Object.create(Game.prototype), pressed = new Set();
  Object.assign(game, { settings: { name: 'P', number: 10, teamId: 'laliga-barcelona', difficulty: 'hard', modifiers: {}, gameplay: 'tactical' },
    state: new GameState(), botAI: new BotAI('hard'), ball: new Ball(0, 0), raf: 1,
    input: { down: new Set(), pressed, axes: () => ({ x: 0, y: 0 }), consume: code => { const hit = pressed.has(code); pressed.delete(code); return hit; }, consumeKick() { return this.consume('KeyE') ? { kick: true, curve: false, shot: 'pass' } : { kick: false }; }, curveHeld: () => false, endFrame() {}, setScheme() {} },
    sound: { play() {}, bump() {}, updateAmbience() {} }, renderer: { burst() {}, fireBurst() {} }, hooks: {} });
  game.start('bot', 'hard', { opponentTeam: { id: 'x', stars: 3 }, ...options });
  game.countdown = 0;
  return game;
}

test('the human takes over the teammate who wins the ball, and gets their own forward back at kick-off', () => {
  for (const options of [{ duo: true }, { trio: true }, { seven: true }]) {
    const game = fixture(options), { bodies } = game.squad, mate = bodies[1], human = bodies[0];
    // Give the ball to the AI teammate.
    game.kickoff = null; game.squad.ai.kickoff = null; game.possession.reset();
    game.ball.x = mate.x + mate.radius + game.ball.radius; game.ball.y = mate.y; game.ball.vx = game.ball.vy = 0; mate.faceX = 1; mate.faceY = 0;
    for (let i = 0; i < 3; i++) game.update(1 / 60);
    assert.equal(game.possession.holder, mate);
    assert.equal(game.player, mate, `${Object.keys(options)[0]}: control follows the ball`); assert.equal(game.squad.localSeat, 1);
    assert.equal(mate.isBot, false); assert.equal(human.isBot, true);
    assert.ok(!game.others.includes(mate) && game.others.includes(human));
    game.resetPositions();
    assert.equal(game.player, human); assert.equal(game.squad.localSeat, 0);
  }
});

test('pass button without the ball switches to the teammate closest to it', () => {
  const game = fixture({ seven: true }), { bodies } = game.squad;
  game.kickoff = null; game.squad.ai.kickoff = null; game.possession.reset();
  // Loose ball next to the right-side defender (seat 4), far from the human.
  game.ball.x = bodies[4].x + 60; game.ball.y = bodies[4].y; game.ball.vx = game.ball.vy = 0;
  game.input.pressed.add('KeyE'); game.update(1 / 60);
  assert.equal(game.squad.localSeat, 4); assert.equal(game.player, bodies[4]);
  // The fire shot cooldown stays with the human.
  bodies[4].powerCooldown = 7; game.input.pressed.add('KeyE'); game.update(1 / 60);
  assert.equal(game.player.powerCooldown > 6.9, true);
});

test('arcade and 1v1 never switch', () => {
  const arcade = Object.assign(fixture({ duo: true }), {});
  arcade.possession = null; assert.equal(arcade.canSwitch(), false);
  const single = fixture({}); assert.equal(single.canSwitch(), false);
});

test('team players are individuals: own character and their own thinking clock', () => {
  let seed = 3; const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ai = new SevenAI({ random }), a = {}, b = {};
  const pa = ai.persona(a), pb = ai.persona(b);
  assert.notDeepEqual(pa, pb); assert.notEqual(ai.brain(a).think, ai.brain(b).think);
  assert.ok(ai instanceof SquadTactics);
  // Autopilot (AI controls every seat) is used by the simulations.
  const game = fixture({ trio: true }); game.squad.autopilot = true;
  const commands = game.squad.ai.update(game.squad.bodies, game.ball, 1 / 60, -1);
  assert.deepEqual(Object.keys(commands).map(Number), [0, 1, 2, 3, 4, 5]);
});
