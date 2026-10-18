import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD } from '../src/config/settings.js';
import { Ball, BALL_RADIUS } from '../src/game/Ball.js';
import { Player } from '../src/game/Player.js';
import { kickBall } from '../src/game/Physics.js';
import { Possession, TACTICAL, tacticalShot, tacticalPass, simulateCross } from '../src/game/Tactical.js';
import { Game } from '../src/game/Game.js';
import { GameState } from '../src/game/GameState.js';
import { BotAI } from '../src/game/BotAI.js';

const near = (player, ball) => { ball.x = player.x + player.radius + ball.radius + .5; ball.y = player.y; };
const inMouth = y => y > WORLD.goalTop + 6 && y < WORLD.goalBottom - 6;

test('touching the ball keeps it glued; turning swings it around the player', () => {
  const p = new Player({ x: 400, y: 350 }), rival = new Player({ x: 900, y: 350 }), ball = new Ball(0, 0); ball.world = WORLD; near(p, ball);
  const pos = new Possession(), same = (a, b) => a === b;
  pos.step([p, rival], ball, 1 / 60, same); assert.equal(pos.holder, p);
  for (let i = 0; i < 25; i++) { p.move(0, 1, 1 / 60); ball.update(1 / 60); pos.step([p, rival], ball, 1 / 60, same); }
  const gap = Math.hypot(ball.x - p.x, ball.y - p.y) - p.radius - ball.radius;
  assert.ok(gap < 2, `glued (gap ${gap})`); assert.ok(ball.y > p.y + p.radius, 'ball turned to the new direction');
  // Standing still and looking left: the ball goes round to the left side.
  p.vx = p.vy = 0; p.faceX = -1; p.faceY = 0;
  // Against the bottom touchline the ball slides along it instead of going into the player.
  const q = new Player({ x: 500, y: WORLD.bottom - 22 }), b2 = new Ball(0, 0); b2.world = WORLD; q.faceX = 0; q.faceY = 1; near(q, b2);
  const pos2 = new Possession(); pos2.step([q], b2, 1 / 60, same); for (let i = 0; i < 30; i++) pos2.step([q], b2, 1 / 60, same);
  assert.ok(Math.hypot(b2.x - q.x, b2.y - q.y) > q.radius + b2.radius - .5, 'no overlap at the wall');
  for (let i = 0; i < 30; i++) pos.step([p, rival], ball, 1 / 60, same);
  assert.ok(ball.x < p.x - p.radius, 'ball on the left');
});

test('a rival touching the ball steals it; a kick frees it', () => {
  const p = new Player({ x: 400, y: 350 }), rival = new Player({ x: 0, y: 0 }), ball = new Ball(0, 0); ball.world = WORLD; near(p, ball);
  const pos = new Possession(), same = (a, b) => a === b; ball.onKicked = body => pos.kicked(body, ball);
  pos.step([p, rival], ball, 1 / 60, same);
  rival.x = ball.x + rival.radius + ball.radius; rival.y = ball.y;
  pos.step([p, rival], ball, 1 / 60, same); assert.equal(pos.holder, rival);
  assert.ok(kickBall(rival, ball)); assert.equal(pos.holder, null);
});

test('a hard shot from a rival is not controlled', () => {
  const p = new Player({ x: 400, y: 350 }), rival = new Player({ x: 700, y: 350 }), ball = new Ball(0, 0); ball.world = WORLD;
  const pos = new Possession(), same = (a, b) => a === b;
  near(p, ball); ball.vx = -700; pos.lastKicker = rival; pos.lastKickSpeed = 700;
  pos.step([p, rival], ball, 1 / 60, same); assert.equal(pos.holder, null);
});

test('tactical shots go in, up/down picks the post, and are 20 % stronger', () => {
  for (const [x, y] of [[650, 350], [700, 200], [760, 520]]) {
    for (const axisY of [-1, 0, 1]) for (const curve of [false, true]) {
      const p = new Player({ x, y }), ball = new Ball(0, 0); ball.world = WORLD; near(p, ball);
      const shot = tacticalShot(p, ball, { attackRight: true, axisY, curve, power: TACTICAL.shotPower });
      const cross = simulateCross(p, ball, shot.aim, shot.power, shot.curve, WORLD, true);
      assert.ok(cross !== null && inMouth(cross), `${x},${y} axis ${axisY} curve ${curve}: ${cross}`);
      if (axisY < 0 && !curve) assert.ok(cross < 350); if (axisY > 0 && !curve) assert.ok(cross > 350);
    }
  }
  assert.equal(TACTICAL.shotPower, 1.2);
});

test('pass goes to the teammate in the pushed direction; otherwise it is a push', () => {
  const p = new Player({ x: 300, y: 350 }), ball = new Ball(0, 0); ball.world = WORLD; near(p, ball);
  const mate = { x: 600, y: 250, vx: 0, vy: 0 };
  const pass = tacticalPass(p, ball, { mates: [mate], direction: { x: 1, y: -.3 } });
  assert.equal(pass.receiver, mate);
  const through = tacticalPass(p, ball, { mates: [mate], direction: { x: 1, y: -.3 }, through: true });
  assert.ok(through.target.x > mate.x + 60);
  const push = tacticalPass(p, ball, { mates: [mate], direction: { x: 0, y: 1 } });
  assert.equal(push.receiver, null); assert.equal(push.power, TACTICAL.pushPower);
});

test('tactical ball is 10 % smaller; online stays arcade', () => {
  const game = Object.create(Game.prototype);
  Object.assign(game, { settings: { name: 'P', number: 10, teamId: 'laliga-barcelona', difficulty: 'easy', modifiers: {}, gameplay: 'tactical' },
    state: new GameState(), botAI: new BotAI('easy'), ball: new Ball(0, 0), raf: 1,
    input: { down: new Set(), pressed: new Set(), axes: () => ({ x: 0, y: 0 }), consume: () => false },
    sound: { play() {}, bump() {} }, renderer: { burst() {}, fireBurst() {} }, hooks: {} });
  game.start('bot', 'easy', {}); assert.equal(game.gameplay, 'tactical'); assert.ok(game.possession);
  assert.ok(Math.abs(game.ball.radius - BALL_RADIUS * .9) < 1e-9);
  game.start('online', 'easy', {}); assert.equal(game.gameplay, 'arcade'); assert.equal(game.possession, null); assert.equal(game.ball.radius, BALL_RADIUS);
});
