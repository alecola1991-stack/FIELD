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
});

test('the bot presses in its own half covering the way to goal, and waits near halfway otherwise', () => {
  const setup = (humanX, humanY, frames = 150) => {
    const ai = new OnlineBotAI(700, () => .9), bot = new Player({ x: 950, y: 200, isBot: true }), human = new Player({ x: humanX, y: humanY }), ball = new Ball(humanX + 25, humanY);
    ai.mood = 'calm'; ai.moodTime = 10; ball.world = human.world = bot.world = undefined;
    for (let i = 0; i < frames; i++) { const d = ai.update(bot, ball, human, 1 / 60); bot.move(d.x, d.y, 1 / 60, d.speedMultiplier); human.vx = human.vy = 0; }
    return { bot, ball };
  };
  // Human on the ball in the bot's half: the bot ends up goal-side, on the ball–goal line, close.
  const near = setup(760, 300), goalY = 350;
  const t = (near.bot.x - near.ball.x) / (1074 - near.ball.x), lineY = near.ball.y + (goalY - near.ball.y) * t;
  assert.ok(near.bot.x > near.ball.x && Math.abs(near.bot.y - lineY) < 40 && Math.hypot(near.bot.x - near.ball.x, near.bot.y - near.ball.y) < 110, `goal-side cover (${Math.round(near.bot.x)},${Math.round(near.bot.y)})`);
  // Human on the ball in their own half: the bot waits around halfway (it does not chase up the pitch).
  const far = setup(300, 350, 80);
  assert.ok(far.bot.x > 600, `waits near halfway (${Math.round(far.bot.x)})`);
});

test('blocked in midfield, the bot plays the ball off the side wall and runs onto it', () => {
  const ai = new OnlineBotAI(900, () => .1), bot = new Player({ x: 620, y: 470, isBot: true }), human = new Player({ x: 540, y: 455 }), ball = new Ball(593, 470);
  bot.faceX = -1; ai.mood = 'eager'; ai.moodTime = 10; ai.thinkTimer = 1;
  const decision = ai.update(bot, ball, human, 1 / 60);
  assert.equal(decision.behavior, 'wall'); assert.equal(decision.kick, true);
  assert.ok(decision.kickDirection.x < 0 && decision.kickDirection.y > 0, 'towards goal, off the bottom wall (away from the human)');
  assert.ok(decision.power < 1 && ai.chase > 0);
});

test('bots may quit after a goal (1/20 conceding, 1/50 scoring) and skip replays (2/3 conceding, 1/3 scoring)', () => {
  const game = onlineGame({ opponentBot: { elo: 600 } }); let quits = 0;
  game.hooks.onBotQuit = () => quits++;
  game.botRandom = () => .04;
  assert.equal(game.maybeBotQuits(1), true, 'conceded: 0.04 < 1/20'); assert.equal(game.maybeBotQuits(-1), false, 'scored: 0.04 >= 1/50');
  game.botRandom = () => .015; assert.equal(game.maybeBotQuits(-1), true); assert.equal(quits, 2);
  // Never when the rival side has a person, nor for the guest.
  const people = onlineGame({}); people.botRandom = () => 0; assert.equal(people.maybeBotQuits(1), false);
  // Replay skips over many goals.
  const rate = leftScored => {
    let skipped = 0; game.botRandom = Math.random;
    for (let i = 0; i < 3000; i++) {
      game.state.goalSide = leftScored ? 1 : -1; game.replayClip = Array.from({ length: 40 }, (_, k) => ({ t: k / 30 })); game.settings.goalReplays = true;
      game.replaysEnabled = () => true;
      game.startReplay(); if (game.replay.botSkips.length) { skipped++; assert.ok(game.replay.botSkips[0].at >= .4 && game.replay.botSkips[0].at <= 2); }
    }
    return skipped / 3000;
  };
  assert.ok(Math.abs(rate(true) - 2 / 3) < .04, 'the bot that conceded skips 2/3');
  assert.ok(Math.abs(rate(false) - 1 / 3) < .04, 'the bot that scored lets it play 2/3');
  // The skip lands after its moment.
  game.state.goalSide = 1; game.botRandom = () => 0; game.startReplay();
  game.updateReplay(.2); assert.equal(game.replay.remoteSkip, false);
  game.updateReplay(.3); assert.equal(game.replay.remoteSkip, true);
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
