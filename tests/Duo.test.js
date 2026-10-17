import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/Game.js';
import { Player } from '../src/game/Player.js';
import { Ball } from '../src/game/Ball.js';
import { GameState } from '../src/game/GameState.js';
import { BotAI } from '../src/game/BotAI.js';
import { SquadAI } from '../src/game/SquadAI.js';
import { getTeamById } from '../src/config/teams.js';

const DT = 1 / 60;
// Offline 2v2 without DOM: human idle unless `steer` is set.
function duo({ difficulty = 'hard', settings = {} } = {}) {
  const game = Object.create(Game.prototype);
  let axes = { x: 0, y: 0 }; const keys = new Set();
  Object.assign(game, {
    state: new GameState(), ball: new Ball(570, 350), botAI: new BotAI(difficulty),
    input: { axes: () => axes, consume: code => keys.delete(code), enabled: true, endFrame() {} },
    sound: { play() {}, bump() {} }, renderer: { burst() {}, fireBurst() {}, render() {} }, hooks: {},
    settings: { name: 'ALE', number: 10, teamId: 'laliga-real-madrid', goalReplays: false, ...settings },
    matchStats: { shotsPlayer: 0, shotsOpponent: 0, goals: [] }, goalTarget: 3, localSide: 'left', onlineAuthority: true,
    shotRangeTimer: 0, powerHudClock: 0, onlineSnapshotClock: 0, autosaveClock: 0, countdown: 0, countdownClock: 0, modifiers: undefined,
  });
  game.state.start('bot');
  game.player = new Player({ x: 0, y: 0 }); game.bot = new Player({ x: 0, y: 0, isBot: true });
  game.setupDuo(getTeamById('laliga-real-madrid'), getTeamById('laliga-barcelona'), difficulty, 'BAR', 9);
  game.applyModifiers(); game.resetReplay();
  game.steer = (x, y) => { axes = { x, y }; }; game.press = () => keys.add('Space');
  return game;
}

test('offline 2v2 seats: human + AI teammate against two AI rivals, with team kits', () => {
  const game = duo();
  const [human, mate, a, b] = game.squad.bodies;
  assert.equal(game.player, human); assert.equal(game.squad.offline, true);
  assert.ok(game.squad.ai instanceof SquadAI);
  assert.equal(mate.name, 'IA'); assert.notEqual(mate.number, human.number);
  assert.equal(mate.color, human.color, 'teammate wears our kit');
  assert.equal(a.color, getTeamById('laliga-barcelona').primary); assert.equal(b.color, a.color);
  assert.equal(game.others.length, 2);
  assert.ok(human.maxSpeed > mate.maxSpeed, 'AI bodies move at bot speed');
});

test('AI bodies move, the teammate passes to the human and goals are scored', () => {
  const game = duo();
  const start = game.squad.bodies.map(body => [body.x, body.y]);
  let passes = 0, last = null;
  const origUpdate = game.squad.ai.update.bind(game.squad.ai);
  game.squad.ai.update = (...args) => { const commands = origUpdate(...args); if (commands[1]?.pass && commands[1] !== last) { passes++; last = commands[1]; } return commands; };
  for (let i = 0; i < 60 * 3; i++) game.update(DT);
  game.squad.bodies.slice(1).forEach((body, index) => assert.ok(Math.hypot(body.x - start[index + 1][0], body.y - start[index + 1][1]) > 20, `seat ${index + 1} moved`));
  // Human waits in the rival half while the ball is in ours (so the teammate has someone to pass to),
  // otherwise goes for the ball from behind and shoots.
  for (let i = 0; i < 60 * 300 && !game.state.matchOver; i++) {
    const [human] = game.squad.bodies, ball = game.ball;
    if (ball.x < 570 && Math.hypot(ball.x - human.x, ball.y - human.y) > 160) game.steer(760 - human.x, (ball.y < 350 ? 450 : 250) - human.y);
    else {
      const gx = 1080 - ball.x, gy = 350 - ball.y, gl = Math.hypot(gx, gy) || 1;
      const tx = ball.x - gx / gl * 34, ty = ball.y - gy / gl * 34, d = Math.hypot(tx - human.x, ty - human.y);
      if (d > 14) game.steer((tx - human.x) / d, (ty - human.y) / d); else game.steer(gx / gl, gy / gl);
      if (Math.hypot(ball.x - human.x, ball.y - human.y) < 62 && ball.x > human.x - 10) game.press();
    }
    game.update(DT);
  }
  assert.ok(passes > 0, 'the teammate made at least one pass');
  assert.ok(game.state.scorePlayer + game.state.scoreBot > 0, 'goals are scored');
});

test('the teammate defends when the rivals attack', () => {
  const game = duo();
  const [human, mate, rival] = game.squad.bodies;
  human.x = 900; human.y = 350; rival.x = 420; rival.y = 330; game.ball.x = 395; game.ball.y = 330; game.ball.vx = -200;
  for (let i = 0; i < 40; i++) game.update(DT);
  assert.ok(mate.x < 330, `teammate dropped back to defend (x=${mate.x.toFixed(0)})`);
});

test('offline 2v2 snapshot keeps the extra bodies', () => {
  const game = duo();
  for (let i = 0; i < 120; i++) game.update(DT);
  const snapshot = game.captureSnapshot();
  assert.equal(snapshot.others.length, 2);
  const restored = duo();
  assert.equal(restored.restoreSnapshot(snapshot, false), true);
  restored.others.forEach((body, index) => { assert.equal(body.x, snapshot.others[index].x); assert.equal(body.y, snapshot.others[index].y); });
});

// ---- Behaviour of the squad AI on hand-made situations ----------------------------
const body = (x, y, extra = {}) => ({ x, y, vx: 0, vy: 0, radius: 22, maxSpeed: 280, shotCooldown: 0, speedScale: 1, ...extra });
const ballAt = (x, y) => ({ x, y, vx: 0, vy: 0, radius: 12 });

test('teammate in its half plays a strong pass to a well placed human in the rival half', () => {
  const ai = new SquadAI({ difficulty: 'hard' });
  const human = body(800, 330), mate = body(300, 360), rivalA = body(1000, 350), rivalB = body(520, 160);
  const commands = ai.update([human, mate, rivalA, rivalB], ballAt(330, 360), DT);
  const pass = commands[1];
  assert.ok(pass.kick && pass.pass, 'the teammate passes');
  assert.ok(pass.power >= .9, `strong pass (power ${pass.power.toFixed(2)})`);
  assert.ok(ai.lastPass.long, 'long pass to the rival half');
  assert.ok(ai.lastPass.x > human.x, 'aimed in front of the human, towards goal');
});

test('the long pass goes off the wall when a rival blocks the direct line', () => {
  const ai = new SquadAI({ difficulty: 'hard' });
  const human = body(800, 350), mate = body(300, 350), blocker = body(560, 352), keeper = body(1040, 350);
  const commands = ai.update([human, mate, blocker, keeper], ballAt(330, 350), DT);
  assert.ok(commands[1].kick && commands[1].pass, 'still passes');
  assert.equal(commands[1].bank, true, 'bank pass off a wall');
});

test('rivals keep one keeper and one forward: they never both defend the goal', () => {
  for (const difficulty of ['easy', 'normal', 'hard', 'pro', 'champions']) {
    const ai = new SquadAI({ difficulty });
    // We attack: the human dribbles deep in the rival half.
    const human = body(900, 330), mate = body(500, 380), rivalA = body(1040, 340), rivalB = body(1000, 380);
    const ball = ballAt(925, 330);
    let bodies = [human, mate, rivalA, rivalB];
    for (let i = 0; i < 90; i++) {
      const commands = ai.update(bodies, ball, DT);
      for (const seat of [2, 3]) { const c = commands[seat]; bodies[seat].x += (c.x || 0) * 240 * DT; bodies[seat].y += (c.y || 0) * 240 * DT; }
    }
    const back = [rivalA, rivalB].filter(rival => rival.x > 1140 * .78).length;
    assert.equal(back, 1, `${difficulty}: exactly one rival stays in goal`);
  }
});

test('the rival keeper feeds the forward and the forward uses the walls when blocked', () => {
  const ai = new SquadAI({ difficulty: 'easy' }); ai.random = () => 0;
  // Keeper on the ball, forward open up the pitch.
  const human = body(500, 150), mate = body(300, 560), keeper = body(980, 350), forward = body(560, 380);
  const pass = ai.update([human, mate, keeper, forward], ballAt(950, 350), DT)[2];
  assert.ok(pass.kick && pass.pass, 'keeper passes to the forward');
  assert.ok(pass.aim.x < 0, 'pass goes up the pitch');
  // Forward on the ball with a defender right in front: plays it off the wall.
  const ai2 = new SquadAI({ difficulty: 'easy' }); ai2.random = () => 0; ai2.rivalKeeper = 1;
  const defender = body(470, 340), striker = body(580, 340), keeper2 = body(1040, 350);
  const commands = ai2.update([defender, body(200, 350), striker, keeper2], ballAt(555, 340), DT);
  assert.ok(commands[2].kick && commands[2].bank, 'wall dribble around the defender');
});

test('the teammate always shoots when it receives the ball from the human in the rival half', () => {
  const ai = new SquadAI({ difficulty: 'hard' });
  const human = body(700, 300), mate = body(860, 420), keeper = body(1040, 340), forward = body(500, 200);
  // The human plays the ball (touch), then it travels to the teammate.
  ai.update([human, mate, keeper, forward], ballAt(730, 310), DT);
  const ball = { ...ballAt(830, 400), vx: 300, vy: 200 };
  const shot = ai.update([human, mate, keeper, forward], ball, DT)[1];
  assert.ok(shot.kick && shot.shot, 'shoots instead of passing back');
  assert.ok(shot.power > 1, 'strong shot');
  const crossY = ball.y + shot.aim.y / shot.aim.x * (1074 - ball.x);
  assert.ok(crossY > 255 && crossY < 445, `aimed inside the goal mouth (y=${crossY.toFixed(0)})`);
  // Without the human's pass (e.g. a rival touched it last) it does not force the shot.
  const ai2 = new SquadAI({ difficulty: 'hard' });
  ai2.update([human, mate, keeper, forward], ballAt(1020, 345), DT);
  assert.ok(!ai2.update([human, mate, keeper, forward], { ...ballAt(830, 400), vx: -100, vy: 0 }, DT)[1].shot);
});
