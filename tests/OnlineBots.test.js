import test from 'node:test';
import assert from 'node:assert/strict';
import { OnlineMatch } from '../src/game/OnlineMatch.js';
import { OnlineHub } from '../src/ui/OnlineHub.js';
import { OnlineBotAI, OnlineSquadBots, botLevelFor, botSpeedFor } from '../src/game/OnlineBotAI.js';
import { Game } from '../src/game/Game.js';
import { GameState } from '../src/game/GameState.js';
import { BotAI } from '../src/game/BotAI.js';
import { Ball } from '../src/game/Ball.js';
import { Player } from '../src/game/Player.js';

globalThis.window ??= { setInterval, clearInterval };
globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const channels = [];
const client = { channel: (topic, options) => { const channel = { topic, options, on() { return this; }, subscribe() { return this; }, track: async () => 'ok', send: async () => 'ok' }; channels.push(channel); return channel; }, removeChannel: async () => {} };

test('levels and pace follow the bot ELO', () => {
  assert.deepEqual([300, 500, 700, 900, 1200].map(botLevelFor), ['easy', 'normal', 'hard', 'pro', 'champions']);
  assert.ok(botSpeedFor(400) < botSpeedFor(900) && botSpeedFor(2000) <= 305);
});

test('1v1 against a bot starts at once with this client hosting', async () => {
  const match = new OnlineMatch(client); let started = null;
  match.setHandlers({ onMatchStart: info => { started = info; } });
  const before = channels.length;
  await match.connectAssigned({ id: 'm1', p1: 'me', p2: 'bot1' }, { userId: 'me', name: 'ALE' }, { userId: 'bot1', username: 'xx_messi11', elo: 470, bot: true });
  assert.equal(started.role, 'host'); assert.equal(started.localSide, 'left'); assert.equal(started.opponent.bot, true); assert.equal(started.opponent.username, 'xx_messi11');
  assert.equal(channels.length, before, 'no realtime channel is needed');
  assert.equal(match.matched, true);
});

test('2v2: the host only waits for the people, never for the bots', async () => {
  const seats = [{ userId: 'me' }, { userId: 'b1', bot: true }, { userId: 'b2', bot: true }, { userId: 'b3', bot: true }];
  const match = new OnlineMatch(client); let started = null;
  match.setHandlers({ onMatchStart: info => { started = info; } });
  await match.connectAssigned({ id: 'm2', p1: 'me', p2: 'b2', p3: 'b1', p4: 'b3' }, { userId: 'me' }, { userId: 'b2' }, { seats, localSeat: 0 });
  assert.equal(started?.role, 'host');
  const mixed = new OnlineMatch(client);
  await mixed.connectAssigned({ id: 'm3' }, { userId: 'me' }, { userId: 'p2' }, { seats: [{ userId: 'me' }, { userId: 'b1', bot: true }, { userId: 'p2' }, { userId: 'b3', bot: true }], localSeat: 0 });
  assert.deepEqual(mixed.squadHumanSeats(), [2]);
});

test('the hub asks for bots after 16 s of search, once per poll', async () => {
  const hub = Object.create(OnlineHub.prototype), calls = []; let now = 1000;
  const realNow = Date.now; Date.now = () => now;
  try {
    Object.assign(hub, { ui: { user: { id: 'me' } }, identity: { id: 'me' }, supportsBots: true, lobby: { id: 'room', state: 'waiting', public: true }, rpc: async (command, payload) => { calls.push([command, payload]); return null; }, consume: async () => {} });
    hub.askForBots(); now += 10000; hub.askForBots(); assert.equal(calls.length, 0);
    now += 6500; hub.askForBots(); await Promise.resolve();
    assert.deepEqual(calls, [['bots', { lobbyId: 'room' }]]);
    hub.lobby = { id: 'private', state: 'waiting', public: false }; now += 30000; hub.askForBots(); hub.askForBots();
    assert.equal(calls.length, 1, 'never in private rooms');
    hub.supportsBots = false; hub.lobby = { id: 'room2', state: 'waiting', public: true }; hub.askForBots(); now += 30000; hub.askForBots();
    assert.equal(calls.length, 1, 'not before the database supports it');
  } finally { Date.now = realNow; }
});

function onlineGame(options) {
  const game = Object.create(Game.prototype);
  Object.assign(game, { settings: { name: 'ALE', number: 10, teamId: 'laliga-barcelona', difficulty: 'normal', modifiers: {}, gameplay: 'arcade', goalReplays: false },
    state: new GameState(), botAI: new BotAI('normal'), ball: new Ball(0, 0), raf: 1,
    input: { enabled: true, down: new Set(), pressed: new Set(), axes: () => ({ x: 0, y: 0 }), consume: () => false, consumeKick: () => ({ kick: false }), curveHeld: () => false, endFrame() {}, setScheme() {} },
    sound: { play() {}, bump() {}, updateAmbience() {} }, renderer: { burst() {}, fireBurst() {} }, hooks: {} });
  game.start('online', 'normal', { opponentName: 'MESSI', ...options }); game.countdown = 0;
  return game;
}

test('1v1: the host moves an aggressive bot that shoots and scores', () => {
  const game = onlineGame({ opponentBot: { elo: 700 }, opponentUsername: 'xx_messi11', opponentElo: 700 });
  assert.ok(game.onlineBot instanceof OnlineBotAI);
  let kicks = 0; const start = { x: game.bot.x, y: game.bot.y };
  for (let i = 0; i < 60 * 60; i++) {
    const before = game.matchStats.shotsOpponent; game.update(1 / 60); kicks += game.matchStats.shotsOpponent - before;
    if (game.state.goalTimer > 0) { game.state.goalTimer = 0; game.resetPositions(); game.countdown = 0; }
    if (game.state.matchOver) break;
  }
  assert.ok(Math.hypot(game.bot.x - start.x, game.bot.y - start.y) > 5 || kicks > 0);
  assert.ok(kicks > 3, `bot shots ${kicks}`); assert.ok(game.state.scoreBot > 0, 'the bot scores against an idle human');
  // A guest never runs the bot.
  const guest = onlineGame({ opponentBot: { elo: 700 }, localSide: 'right' });
  assert.equal(guest.onlineBot, null);
});

test('the bot is hard to read: different moods give different runs', () => {
  const run = seed => {
    let value = seed; const random = () => ((value = (value * 16807) % 2147483647) / 2147483647);
    const ai = new OnlineBotAI(700, random), bot = new Player({ x: 800, y: 350, isBot: true }), human = new Player({ x: 500, y: 350 }), ball = new Ball(560, 350);
    const path = [];
    for (let i = 0; i < 120; i++) { const d = ai.update(bot, ball, human, 1 / 60); bot.move(d.x, d.y, 1 / 60, d.speedMultiplier); path.push(Math.round(bot.y)); }
    return path.join(',');
  };
  assert.notEqual(run(3), run(11));
  // Pressing: with the human on the ball in its own half, the bot goes for it.
  const ai = new OnlineBotAI(700, () => .1), bot = new Player({ x: 800, y: 350, isBot: true }), human = new Player({ x: 420, y: 350 }), ball = new Ball(445, 350);
  ai.mood = 'press'; ai.moodTime = 10;
  const decision = ai.update(bot, ball, human, 1 / 60);
  assert.ok(decision.x < -.7, 'runs at the ball');
});

test('2v2: bot seats are moved by the host, people keep their own input', () => {
  const seats = [{ name: 'ALE', number: 10, teamId: 'laliga-barcelona', username: 'ale' }, { name: 'JUAN', number: 8, teamId: 'laliga-betis', username: 'juan_3542', elo: 480, bot: true },
    { name: 'PEDRI', number: 8, teamId: 'laliga-sevilla', username: 'xx_pedri8', elo: 470, bot: true }, { name: 'RAUL', number: 7, teamId: 'laliga-sevilla', username: 'Raul_Merengue', elo: 460, bot: true }];
  const game = onlineGame({ squad: { seats, localSeat: 0 } });
  assert.ok(game.squad.ai instanceof OnlineSquadBots); assert.deepEqual([...game.squad.botSeats], [1, 2, 3]);
  const start = game.squad.bodies.map(body => ({ x: body.x, y: body.y }));
  for (let i = 0; i < 20 * 60; i++) { game.update(1 / 60); if (game.state.goalTimer > 0) { game.state.goalTimer = 0; game.resetPositions(); game.countdown = 0; } }
  for (const seat of [1, 2, 3]) assert.ok(Math.hypot(game.squad.bodies[seat].x - start[seat].x, game.squad.bodies[seat].y - start[seat].y) > 1, `seat ${seat} moved`);
  const people = onlineGame({ squad: { seats: seats.map(seat => ({ ...seat, bot: false })), localSeat: 0 } });
  assert.equal(people.squad.botSeats, undefined);
});
