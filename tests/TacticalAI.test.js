import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD } from '../src/config/settings.js';
import { Ball } from '../src/game/Ball.js';
import { Player } from '../src/game/Player.js';
import { Possession } from '../src/game/Tactical.js';
import { TacticalAI, TACTICAL_AI_LEVELS } from '../src/game/TacticalAI.js';

const setup = (botX, botY) => {
  const bot = new Player({ x: botX, y: botY, isBot: true }), human = new Player({ x: 150, y: 120 }), ball = new Ball(0, 0); ball.world = WORLD;
  bot.faceX = -1; bot.faceY = 0; ball.x = bot.x - bot.radius - ball.radius - .5; ball.y = bot.y;
  const possession = new Possession(); possession.step([bot, human], ball, 1 / 60, (a, b) => a === b);
  const ai = Object.assign(new TacticalAI({ difficulty: 'hard', random: () => .5 }), { possession });
  return { bot, human, ball, ai, possession };
};

test('levels get faster, more precise and shoot from further away', () => {
  const order = ['easy', 'normal', 'hard', 'pro', 'champions'];
  for (let i = 1; i < order.length; i++) {
    const a = TACTICAL_AI_LEVELS[order[i - 1]], b = TACTICAL_AI_LEVELS[order[i]];
    assert.ok(b.speed > a.speed && b.react < a.react && b.range > a.range && b.error < a.error && b.press >= a.press);
  }
});

test('with the ball in its own half the AI carries it forward instead of shooting', () => {
  const { bot, human, ball, ai, possession } = setup(900, 350);
  assert.equal(possession.holder, bot);
  const command = ai.single(bot, ball, human, 1 / 60, false);
  assert.equal(command.kick, false); assert.ok(command.x < -.5, 'runs towards the left goal');
});

test('past halfway and in range it shoots at goal', () => {
  const { bot, human, ball, ai } = setup(330, 350);
  const command = ai.single(bot, ball, human, 1 / 60, false);
  assert.equal(command.kick, true); assert.ok(command.aim.x < 0);
});

test('when the human has the ball the AI goes to steal it', () => {
  const human = new Player({ x: 500, y: 350 }), bot = new Player({ x: 800, y: 350, isBot: true }), ball = new Ball(0, 0); ball.world = WORLD;
  human.faceX = 1; human.faceY = 0; ball.x = human.x + human.radius + ball.radius + .5; ball.y = 350;
  const possession = new Possession(); possession.step([human, bot], ball, 1 / 60, (a, b) => a === b);
  const ai = Object.assign(new TacticalAI({ difficulty: 'champions', random: () => .9 }), { possession });
  const command = ai.single(bot, ball, human, 1 / 60, false);
  assert.ok(command.x < 0, 'moves towards the ball');
});
