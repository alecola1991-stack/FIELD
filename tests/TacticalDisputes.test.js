import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD } from '../src/config/settings.js';
import { Ball } from '../src/game/Ball.js';
import { Player } from '../src/game/Player.js';
import { Possession, TACTICAL } from '../src/game/Tactical.js';
import { TacticalAI, TeamAI, TACTICAL_AI_LEVELS } from '../src/game/TacticalAI.js';

const same = (a, b) => a === b;

test('after a steal the ball cannot be stolen straight back and swings away from the loser', () => {
  const owner = new Player({ x: 400, y: 350 }), thief = new Player({ x: 0, y: 0 }), ball = new Ball(0, 0); ball.world = WORLD;
  owner.faceX = 1; owner.faceY = 0; ball.x = owner.x + owner.radius + ball.radius + .5; ball.y = owner.y;
  const pos = new Possession(); pos.step([owner, thief], ball, 1 / 60, same);
  thief.x = ball.x + thief.radius + ball.radius; thief.y = ball.y; thief.faceX = -1; thief.faceY = 0;
  pos.step([owner, thief], ball, 1 / 60, same); assert.equal(pos.holder, thief);
  // The ball swings round to the thief's side away from the loser.
  for (let i = 0; i < 15; i++) pos.step([owner, thief], ball, 1 / 60, same);
  assert.ok(ball.x > thief.x, 'the ball is on the thief\'s side away from the loser');
  // The loser keeps touching the ball: it is not stolen back during the guard / cooldown.
  const frames = Math.floor(Math.min(TACTICAL.stealGuard, TACTICAL.stealCooldown) * 60) - 16;
  for (let i = 0; i < frames; i++) {
    owner.x = ball.x + owner.radius + ball.radius; owner.y = ball.y;
    pos.step([owner, thief], ball, 1 / 60, same); assert.equal(pos.holder, thief);
  }
  assert.ok(TACTICAL.stealCooldown > TACTICAL.stealGuard);
});

test('the AI dribbles turning gradually instead of zig-zagging', () => {
  const bot = new Player({ x: 900, y: 350, isBot: true }), human = new Player({ x: 760, y: 330 }), ball = new Ball(0, 0); ball.world = WORLD;
  bot.faceX = -1; bot.faceY = 0; bot.vx = -200; ball.x = bot.x - bot.radius - ball.radius - .5; ball.y = bot.y;
  const possession = new Possession(); possession.step([bot, human], ball, 1 / 60, same);
  let flip = 0; const ai = Object.assign(new TacticalAI({ difficulty: 'champions', random: () => (flip = 1 - flip) * .99 }), { possession });
  let last = null, maxTurn = 0;
  for (let i = 0; i < 40; i++) {
    const c = ai.single(bot, ball, human, 1 / 60, false);
    const a = Math.atan2(c.y, c.x);
    if (last !== null) maxTurn = Math.max(maxTurn, Math.abs(Math.atan2(Math.sin(a - last), Math.cos(a - last))));
    last = a; human.x = bot.x - 60 + Math.sin(i) * 20; human.y = bot.y + Math.cos(i) * 30;
  }
  assert.ok(maxTurn <= (2.8 + TACTICAL_AI_LEVELS.champions.dodge * 1.6) / 60 + 1e-6, `max turn per frame ${maxTurn}`);
});

test('goalkeepers react late and are slower at every level', () => {
  const order = ['easy', 'normal', 'hard', 'pro', 'champions', 'legend'];
  for (let i = 0; i < order.length; i++) {
    const keeper = TACTICAL_AI_LEVELS[order[i]].keeper;
    assert.ok(keeper.react >= .15 && keeper.speed < 1);
    if (i) assert.ok(keeper.react < TACTICAL_AI_LEVELS[order[i - 1]].keeper.react);
  }
  // A shot appears: the keeper keeps going to where it last saw the ball until it reacts.
  const ai = Object.assign(new TeamAI({ difficulty: 'hard' }), { possession: new Possession() });
  const keeper = new Player({ x: WORLD.right - 30, y: 350 }), ball = new Ball(0, 0); ball.world = WORLD; ball.x = 700; ball.y = 350;
  const context = { ball, dt: 1 / 60, attackRight: false, mates: [], rivals: [], config: ai.config(3, 'hard'), team: [null, null, keeper] };
  ai.keeper(keeper, context);
  ball.y = 220; ball.vx = 600;
  const early = ai.keeper(keeper, context);
  assert.ok(Math.abs(early.y) < .2, 'has not reacted yet');
  for (let t = 0; t < TACTICAL_AI_LEVELS.hard.keeper.react * 60 + 1; t++) ai.keeper(keeper, context);
  assert.ok(ai.keeper(keeper, context).y < -.2, 'reacts after its reaction time');
});
