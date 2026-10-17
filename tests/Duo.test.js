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
  // Human keeps running towards the rival goal along the wing, so the teammate has someone to pass to.
  for (let i = 0; i < 60 * 240 && !game.state.matchOver; i++) {
    const [human] = game.squad.bodies;
    game.steer(human.x < 900 ? 1 : -1, human.y < 220 ? .4 : human.y > 300 ? -.4 : 0);
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
