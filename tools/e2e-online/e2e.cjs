// End-to-end online tests: N isolated browsers (one per player) run the real game
// against the local Supabase stand-in (fakesupa.cjs) and the local Postgres.
// Usage: see README.md in this folder. node e2e.cjs <scenario...|all>
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium').default;
const { startFakeSupabase } = require('./fakesupa.cjs');
const { execSync } = require('node:child_process');
const crypto = require('node:crypto');

const APP = process.env.APP || 'http://localhost:5180/';
const RUN = Math.random().toString(36).slice(2, 6);
const wait = ms => new Promise(r => setTimeout(r, ms));
const TEAMS = ['laliga-athletic', 'laliga-celta', 'laliga-osasuna', 'laliga-atletico', 'laliga-athletic', 'laliga-celta', 'laliga-osasuna', 'laliga-atletico'];
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const jwt = sub => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', aud: 'authenticated', exp: 4102444800, iat: 1700000000 })}.sig`;
const PG = `-h ${process.env.PGHOST || '/tmp'} -p ${process.env.PGPORT || 5499} -U ${process.env.PGUSER || 'postgres'} -d ${process.env.PGDATABASE || 'field'}`;
const psql = sql => execSync(`psql -qtA ${PG} -c ${JSON.stringify(sql)}`).toString().trim();

let browser, supa, failures = [], log = [];
const note = (...args) => { const line = args.join(' '); log.push(line); console.log(line); };
function check(condition, message) { if (!condition) { failures.push(message); note('  ✗', message); } else note('  ✓', message); return condition; }

async function makePlayers(count, prefix) {
  const players = [];
  for (let i = 0; i < count; i++) {
    const id = crypto.randomUUID(), username = `${prefix}${RUN}${i + 1}`.slice(0, 20);
    psql(`insert into auth.users(id) values('${id}'); insert into field_private.players(user_id,username) values('${id}','${username}');`);
    players.push(await openTab({ id, username, index: i }));
  }
  await Promise.all(players.map(async player => {
    await player.page.goto(APP, { waitUntil: 'domcontentloaded' });
    await ready(player);
  }));
  return players;
}
// Opens a fresh, isolated tab (new sessionStorage) signed in as the player.
async function openTab({ id, username, index: i }) {
  {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const player = { id, username, page, context, errors: [], index: i };
    page.on('pageerror', error => player.errors.push(`pageerror: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource|favicon|fonts\.g/.test(message.text())) player.errors.push(`console: ${message.text()}`); });
    await page.setViewport({ width: 900, height: 640 });
    const session = { access_token: jwt(id), token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: `r-${id}`, user: { id, aud: 'authenticated', role: 'authenticated', email: `${username}@test.local`, app_metadata: {}, user_metadata: {} } };
    const settings = { name: username.toUpperCase().slice(0, 12), number: (i % 98) + 1, teamId: TEAMS[i % TEAMS.length], profileReady: true, sound: false, music: false, goalReplays: true, difficulty: 'easy' };
    await page.evaluateOnNewDocument((session, settings, id) => {
      try { localStorage.setItem('sb-localhost-auth-token', JSON.stringify(session)); localStorage.setItem(`field-settings:${id}`, JSON.stringify(settings)); localStorage.setItem('field-settings', JSON.stringify(settings)); } catch {}
    }, session, settings, id);
    return player;
  }
}
// Logic only: skip canvas drawing so 2 CPUs can run 8 games at full speed.
async function ready(player) {
  await player.page.waitForFunction(() => window.__field?.ui?.hub?.identity, { timeout: 30000 });
  await player.page.evaluate(() => { window.__field.game.renderEnabled = false; });
}
async function reload(player) { await player.page.reload({ waitUntil: 'domcontentloaded' }); await ready(player); await openOnline(player); }
async function closePlayers(players) { for (const player of players) await player.context.close().catch(() => {}); }

const evalIn = (player, fn, ...args) => player.page.evaluate(fn, ...args);
const state = player => evalIn(player, () => {
  const { ui, game } = window.__field, hub = ui.hub;
  const visible = node => node && !node.classList.contains('hidden');
  return {
    view: ui.currentView, mode: ui.currentMatchMode, running: game.state.running, matchOver: game.state.matchOver,
    score: [game.state.scorePlayer, game.state.scoreBot], countdown: game.countdown, replay: !!game.replay, authority: game.onlineAuthority,
    squad: game.squad ? game.squad.localSeat : null, lobby: hub.lobby && { id: hub.lobby.id, state: hub.lobby.state, kind: hub.lobby.kind, size: hub.lobby.size, champion: hub.lobby.champion, matches: hub.lobby.matches.map(m => ({ id: m.id, state: m.state, round: m.round, winner: m.winner })) },
    connected: hub.connectedMatchId, result: visible(ui.result_overlay), finishDisabled: ui.result_finish.disabled, finishText: ui.result_finish.textContent,
    resultScore: ui.result_score?.textContent, onlineStatus: ui.result_online_status?.textContent, hubMessage: document.getElementById('online-hub-message')?.textContent,
    roomStatus: ui.online_status?.textContent, matched: window.__field.onlineMatch.matched, elo: hub.identity?.elo, connection: visible(ui.connection_banner) ? ui.connection_banner.textContent : '',
  };
});
const action = (player, command, payload = {}) => evalIn(player, async (command, payload) => { await window.__field.ui.hub.action(command, payload); return document.getElementById('online-hub-message').textContent; }, command, payload);
const openOnline = player => evalIn(player, () => window.__field.ui.openOnline());
async function until(players, predicate, timeout = 30000, label = 'condition') {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const states = await Promise.all(players.map(state));
    if (states.every((s, i) => predicate(s, players[i]))) return states;
    await wait(250);
  }
  const states = await Promise.all(players.map(state));
  note(`  timeout waiting for ${label}:`, JSON.stringify(states.map(s => ({ v: s.view, m: s.mode, run: s.running, l: s.lobby?.state, c: s.connected?.slice(0, 6), matched: s.matched, res: s.result, st: s.roomStatus, msg: s.hubMessage, conn: s.connection }))));
  return null;
}
const inGame = s => s.mode === 'online' && s.running && s.matched;
// Host forces the end of the match: `hostWins` decides the side that scores the last goal.
async function finishMatch(host, hostWins = true) {
  return evalIn(host, hostWins => {
    const { game } = window.__field;
    if (!game.onlineAuthority || game.state.matchOver) return false;
    game.countdown = 0; game.state.goalTimer = 0;
    const leftScores = hostWins; // host is always on the left
    game.state.scorePlayer = leftScores ? 4 : 2; game.state.scoreBot = leftScores ? 2 : 4;
    game.recordGoal(leftScores ? 1 : -1);
    return true;
  }, hostWins);
}
const skipReplays = players => Promise.all(players.map(p => evalIn(p, () => { const g = window.__field.game; if (g.replay && !g.replay.localSkip) g.skipReplay(); })));
async function playOut(players, hostWins = true, timeout = 25000) {
  const host = (await Promise.all(players.map(async p => [p, await state(p)]))).find(([, s]) => s.authority && inGame(s))?.[0];
  if (!host) return false;
  await wait(400);
  await finishMatch(host, hostWins);
  const start = Date.now();
  while (Date.now() - start < timeout) {
    await skipReplays(players);
    const states = await Promise.all(players.map(state));
    if (states.every(s => s.result)) return true;
    await wait(200);
  }
  return false;
}
const clickFinish = player => evalIn(player, () => { const { ui } = window.__field; if (!ui.result_finish.disabled && !ui.result_overlay.classList.contains('hidden')) { ui.result_finish.click(); return true; } return false; });
async function leaveAll(players) {
  for (const p of players) await evalIn(p, async () => { window.confirm = () => true; const { ui } = window.__field; if (ui.hub.lobby) await ui.hub.action('leave'); }).catch(() => {});
}
const errorsOf = players => players.flatMap(p => p.errors.map(e => `${p.username}: ${e}`));

// ---- Scenarios -------------------------------------------------------------------
const scenarios = {
  async quick1v1() {
    note('▶ Partido rápido 1v1 público');
    const players = await makePlayers(2, 'qa');
    for (const p of players) await openOnline(p);
    await action(players[0], 'queue', { kind: 'quick', size: 2 });
    await action(players[1], 'queue', { kind: 'quick', size: 2 });
    check(await until(players, inGame, 20000, 'game start'), 'los dos entran al partido');
    check(await playOut(players, true), 'los dos ven el resultado');
    const states = await until(players, s => s.lobby?.state === 'finished' && !s.finishDisabled, 15000, 'confirmation');
    check(states && states[0].resultScore !== states[1].resultScore && states[0].resultScore.replace('–', '') === states[1].resultScore.split('–').reverse().join(''), `marcador espejado (${states?.[0].resultScore} / ${states?.[1].resultScore})`);
    check(states && states.every(s => /Sin cambios de ELO/.test(s.onlineStatus)), 'resultado confirmado sin ELO');
    for (const p of players) await clickFinish(p);
    check(await until(players, s => s.view === 'online', 8000, 'back to online'), 'vuelven al online');
    await leaveAll(players);
    check(!errorsOf(players).length, `sin errores de página ${errorsOf(players).join(' | ')}`);
    await closePlayers(players);
  },

  async private1v1() {
    note('▶ Partido privado 1v1 con código + invitación de amigo');
    const players = await makePlayers(2, 'qp');
    for (const p of players) await openOnline(p);
    await action(players[0], 'create', { kind: 'quick', size: 2 });
    const code = (await state(players[0])).lobby && await evalIn(players[0], () => window.__field.ui.hub.lobby.code);
    await action(players[1], 'join', { kind: 'quick', code: code.toLowerCase() });
    check(await until(players, inGame, 20000, 'game start'), 'entran con el código');
    check(await playOut(players, false), 'resultado al acabar');
    await until(players, s => s.lobby?.state === 'finished', 10000);
    for (const p of players) await clickFinish(p);
    await leaveAll(players);
    // Friend invite.
    await action(players[0], 'friend_request', { username: players[1].username });
    await action(players[1], 'friend_accept', { userId: players[0].id });
    await action(players[0], 'invite', { kind: 'quick', userId: players[1].id });
    const inviteId = await evalIn(players[1], async () => { await window.__field.ui.hub.refresh(); return window.__field.ui.hub.invites.find(i => i.incoming && i.state === 'pending')?.id; });
    check(inviteId, 'llega la invitación');
    await action(players[1], 'invite_accept', { inviteId });
    check(await until(players, inGame, 20000, 'invite game'), 'la invitación arranca el partido');
    await leaveAll(players);
    const after = await until(players, s => !s.running || s.view === 'online', 10000, 'after leave');
    check(after, 'salir de un partido no deja a nadie atascado');
    check(!errorsOf(players).length, `sin errores de página ${errorsOf(players).join(' | ')}`);
    await closePlayers(players);
  },

  async ranked1v1() {
    note('▶ Ranked 1v1 + revancha Ranked');
    const players = await makePlayers(2, 'qr');
    for (const p of players) await openOnline(p);
    await action(players[0], 'queue', { kind: 'ranked', size: 2 });
    await action(players[1], 'queue', { kind: 'ranked', size: 2 });
    check(await until(players, inGame, 20000, 'game start'), 'emparejados en Ranked');
    check(await playOut(players, true), 'resultado visible');
    let states = await until(players, s => s.lobby?.state === 'finished' && /ELO/.test(s.onlineStatus || ''), 15000, 'elo');
    const host = states && states.findIndex(s => s.authority);
    check(states && states[host].elo === 516 && states[1 - host].elo === 484, `ELO 516/484 (${states?.map(s => s.elo)})`);
    // Rematch: both vote from the result screen.
    for (const p of players) await evalIn(p, () => window.__field.ui.result_rematch.click());
    check(await until(players, s => inGame(s) && s.connected && s.lobby?.state === 'playing', 20000, 'rematch start'), 'la revancha arranca para los dos');
    check(await playOut(players, false), 'revancha jugada');
    states = await until(players, s => s.lobby?.state === 'finished' && /ELO/.test(s.onlineStatus || ''), 15000, 'elo 2');
    check(states && states.every(s => s.elo === 500 || Math.abs(s.elo - 500) <= 2), `ELO tras la revancha (${states?.map(s => s.elo)})`);
    await leaveAll(players);
    check(!errorsOf(players).length, `sin errores de página ${errorsOf(players).join(' | ')}`);
    await closePlayers(players);
  },

  async duo(kind = 'quick', isPublic = true) {
    note(`▶ 2v2 ${kind} ${isPublic ? 'público' : 'privado'}`);
    const players = await makePlayers(4, `q${kind[0]}${isPublic ? 'u' : 'v'}`);
    for (const p of players) await openOnline(p);
    if (isPublic) for (const p of players) await action(p, 'queue', { kind, size: 4 });
    else {
      await action(players[0], 'create', { kind, size: 4 });
      const code = await evalIn(players[0], () => window.__field.ui.hub.lobby.code);
      for (const p of players.slice(1)) await action(p, 'join', { kind, code });
      // Teams by join order are 1,2,1,2: players 3 and 4 swap sides, then the creator starts.
      const swap = await action(players[2], 'team', { swapWith: players[3].id });
      note('   intercambio:', swap);
      const teams = await evalIn(players[0], async () => { await window.__field.ui.hub.refresh(); return window.__field.ui.hub.lobby.players.map(p => p.team).join(','); });
      check(teams === '1,2,2,1', `intercambio de equipos en sala llena (${teams})`);
      await evalIn(players[0], () => window.__field.ui.hub.refresh());
      const msg = await action(players[0], 'start', {});
      note('   empezar:', msg);
    }
    const states = await until(players, inGame, 25000, '2v2 start');
    check(states, 'los cuatro entran al partido');
    if (!states) { await leaveAll(players); await closePlayers(players); return; }
    check(new Set(states.map(s => s.squad)).size === 4, `cuatro asientos distintos (${states.map(s => s.squad)})`);
    // Movement sync: every guest sees the host's body where the host has it.
    const sync = await Promise.all(players.map(p => evalIn(p, () => window.__field.game.squad.bodies.map(b => [Math.round(b.x), Math.round(b.y)]))));
    check(sync.every(bodies => bodies.every((b, i) => Math.hypot(b[0] - sync.find((_, k) => states[k].authority)[i][0], b[1] - sync.find((_, k) => states[k].authority)[i][1]) < 40)), 'posiciones sincronizadas en los cuatro');
    // A goal with replay: everyone must skip.
    const host = players[states.findIndex(s => s.authority)];
    // Software rendering on this machine slows the game clock: skip the kick-off countdown, then record ~1.5 s.
    await evalIn(host, () => { const g = window.__field.game; g.countdown = 0; g.countdownClock = 0; g.hooks.onCountdown?.(null); });
    await until([host], () => true, 100);
    for (let i = 0; i < 30; i++) { const frames = await evalIn(host, () => window.__field.game.replayFrames?.length || 0); if (frames >= 25) break; await wait(200); }
    const goalInfo = await evalIn(host, () => { const g = window.__field.game; const frames = g.replayFrames?.length; g.recordGoal(1); return { frames, countdown: g.countdown, goalTimer: g.state.goalTimer }; });
    note('   gol de prueba:', JSON.stringify(goalInfo));
    const replaying = await until(players, s => s.replay, 25000, 'replay'); // slow game clock here
    check(replaying, 'todos ven la repetición');
    await evalIn(players[0], () => window.__field.game.skipReplay());
    await wait(600);
    check((await state(host)).replay || !replaying, 'un solo salto no termina la repetición');
    await skipReplays(players);
    check(await until(players, s => !s.replay, 6000, 'replay end'), 'la repetición acaba al saltar todos');
    check(await playOut(players, true), 'los cuatro ven el resultado');
    const done = await until(players, s => s.lobby?.state === 'finished' && !s.finishDisabled, 15000, 'confirm 2v2');
    check(done, 'resultado confirmado por los dos equipos');
    if (done) {
      const scores = done.map(s => s.resultScore);
      const leftSeats = done.filter(s => s.squad < 2), rightSeats = done.filter(s => s.squad >= 2);
      check(leftSeats.every(s => s.resultScore === leftSeats[0].resultScore) && rightSeats.every(s => s.resultScore === rightSeats[0].resultScore) && leftSeats[0].resultScore !== rightSeats[0].resultScore, `cada equipo ve su marcador (${scores})`);
      if (kind === 'ranked') check(done.filter(s => s.elo === 516).length === 2 && done.filter(s => s.elo === 484).length === 2, `ELO 2v2 (${done.map(s => s.elo)})`);
    }
    // Rematch with four votes.
    for (const p of players) await evalIn(p, () => window.__field.ui.result_rematch.click());
    check(await until(players, s => inGame(s) && s.lobby?.state === 'playing', 25000, '2v2 rematch'), 'revancha 2v2 con los cuatro');
    // A guest leaves mid-match: the match ends for everybody.
    const guest = players[(await Promise.all(players.map(state))).findIndex(s => !s.authority)];
    await evalIn(guest, async () => { window.confirm = () => true; await window.__field.ui.hub.action('leave'); });
    check(await until(players.filter(p => p !== guest), s => !s.running || s.result, 20000, 'forfeit'), 'si alguien se va, el partido acaba para el resto');
    const final = await until(players.filter(p => p !== guest), s => s.lobby?.state === 'finished', 15000, 'forfeit settled');
    check(final, 'la sala queda resuelta por abandono');
    await leaveAll(players);
    check(!errorsOf(players).length, `sin errores de página ${errorsOf(players).join(' | ')}`);
    await closePlayers(players);
  },

  async tournament(size = 4, isPublic = true) {
    note(`▶ Torneo de ${size} ${isPublic ? 'público' : 'privado'}`);
    const players = await makePlayers(size, `qt${size}${isPublic ? 'u' : 'v'}`);
    for (const p of players) await openOnline(p);
    if (isPublic) for (const p of players) await action(p, 'queue', { kind: 'tournament', size });
    else {
      await action(players[0], 'create', { kind: 'tournament', size });
      const code = await evalIn(players[0], () => window.__field.ui.hub.lobby.code);
      for (const p of players.slice(1)) await action(p, 'join', { kind: 'tournament', code });
    }
    const lobbyId = (await state(players[0])).lobby?.id;
    const expected = size === 4 ? 3 : size === 6 ? 5 : 7;
    const start = Date.now(); let played = 0, rounds = new Set();
    while (Date.now() - start < 150000) {
      const states = await Promise.all(players.map(state));
      if (states.every(s => s.lobby?.state === 'finished' || !s.lobby)) break;
      for (const [i, s] of states.entries()) {
        if (s.result && !s.finishDisabled) await clickFinish(players[i]);
        else if (inGame(s) && s.authority && !s.matchOver && !s.replay) {
          const peers = players.filter((_, k) => states[k].connected === s.connected && inGame(states[k]));
          if (peers.length >= 2) { await finishMatch(players[i], Math.random() < .5); played++; rounds.add(s.connected); }
        }
      }
      await skipReplays(players);
      await wait(300);
    }
    const finalStates = await Promise.all(players.map(state));
    if (!finalStates.every(s => s.lobby?.state === 'finished' || !s.lobby)) note('  estado al agotar el tiempo:', JSON.stringify(finalStates.map((s, i) => ({ u: players[i].username, v: s.view, m: s.mode, run: s.running, res: s.result, fd: s.finishDisabled, c: s.connected?.slice(0, 6), matched: s.matched, l: s.lobby?.state, st: s.onlineStatus, msg: s.hubMessage }))));
    note('  partidos:', psql(`select string_agg(round||'.'||position||':'||state||':'||coalesce(substr(p1::text,1,4),'')||'v'||coalesce(substr(p2::text,1,4),''),' ' order by round,position) from field_private.matches where lobby_id='${lobbyId}'`));
    note('  jugadores:', players.map(p => p.username + '=' + p.id.slice(0, 4)).join(' '));
    const rows = psql(`select count(*)||'/'||count(*) filter (where state='finished') from field_private.matches where lobby_id='${lobbyId}'`);
    const champion = psql(`select coalesce(p.username,'') from field_private.lobbies l left join field_private.players p on p.user_id=l.champion where l.id='${lobbyId}'`);
    const lobbyState = psql(`select state from field_private.lobbies where id='${lobbyId}'`);
    check(lobbyState === 'finished' && rows === `${expected}/${expected}`, `torneo completo: ${rows} partidos, estado ${lobbyState}, campeón @${champion}`);
    await leaveAll(players);
    check(!errorsOf(players).length, `sin errores de página ${errorsOf(players).join(' | ')}`);
    await closePlayers(players);
  },

  async reconnect() {
    note('▶ Desconexiones 1v1: caída del invitado, recarga del anfitrión, recarga del invitado');
    const players = await makePlayers(2, 'qx');
    for (const p of players) await openOnline(p);
    await action(players[0], 'create', { kind: 'quick', size: 2 });
    const code = await evalIn(players[0], () => window.__field.ui.hub.lobby.code);
    await action(players[1], 'join', { kind: 'quick', code });
    let states = await until(players, inGame, 20000, 'start');
    check(states, 'partido iniciado');
    const hostIndex = states.findIndex(s => s.authority), host = players[hostIndex], guest = players[1 - hostIndex];
    await wait(6000);
    await evalIn(host, () => { const g = window.__field.game; g.state.scorePlayer = 2; g.state.scoreBot = 1; g.hooks.onScore?.(2, 1); });
    await wait(500);
    // 1) The guest's socket drops for a moment: realtime-js reconnects by itself.
    await fetch(`http://localhost:54321/__drop?user=${guest.id}`, { method: 'POST' });
    await wait(6000);
    states = await Promise.all(players.map(state));
    check(states.every(inGame) && !states.some(s => s.connection), `tras una caída breve el partido sigue (${states.map(s => s.connection || 'ok')})`);
    // 2) The host reloads the page in the middle of the match.
    await reload(host);
    states = await until(players, inGame, 40000, 'resume after host reload');
    check(states, 'tras recargar el anfitrión, el partido se reanuda');
    if (states) check(states.map(s => s.score.join('-')).sort().join(' ') === '1-2 2-1', `se conserva el marcador (${states.map(s => s.score.join('-'))})`);
    // 3) The guest reloads the page.
    await reload(guest);
    states = await until(players, inGame, 40000, 'resume after guest reload');
    check(states, 'tras recargar el invitado, el partido se reanuda');
    check(await playOut(players, true), 'el partido se puede terminar');
    check(await until(players, s => s.lobby?.state === 'finished', 15000, 'settle'), 'y se confirma el resultado');
    await leaveAll(players);
    check(!errorsOf(players).length, `sin errores de página ${errorsOf(players).join(' | ')}`);
    await closePlayers(players);
  },

  async duoReconnect() {
    note('▶ Desconexiones 2v2: recarga de un invitado y del anfitrión');
    const players = await makePlayers(4, 'qy');
    for (const p of players) await openOnline(p);
    for (const p of players) await action(p, 'queue', { kind: 'quick', size: 4 });
    let states = await until(players, inGame, 25000, 'start');
    check(states, '2v2 iniciado');
    if (!states) { await closePlayers(players); return; }
    const host = players[states.findIndex(s => s.authority)], guest = players[states.findIndex(s => !s.authority)];
    await wait(6000);
    await reload(guest);
    check(await until(players, inGame, 40000, 'guest back'), 'un invitado recarga y vuelve al 2v2');
    await reload(host);
    check(await until(players, inGame, 45000, 'host back'), 'el anfitrión recarga y el 2v2 se reanuda');
    check(await playOut(players, false), 'el 2v2 termina');
    check(await until(players, s => s.lobby?.state === 'finished', 15000, 'settle'), 'resultado confirmado');
    await leaveAll(players);
    check(!errorsOf(players).length, `sin errores de página ${errorsOf(players).join(' | ')}`);
    await closePlayers(players);
  },
};

scenarios.probe = async function (size = 4) {
  note(`▶ Sonda de cuenta atrás (${size === 4 ? '2v2' : '1v1'})`);
  const players = await makePlayers(size, 'qz');
  for (const p of players) await openOnline(p);
  for (const p of players) await action(p, 'queue', { kind: 'quick', size });
  await until(players, inGame, 25000, 'start');
  for (let i = 0; i < 8; i++) {
    const rows = await Promise.all(players.map(p => evalIn(p, () => new Promise(r => { const g = window.__field.game; let n = 0; const t0 = performance.now(); const c0 = g.countdown + g.countdownClock; const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(`${g.onlineAuthority ? 'H' : 'g'}:${g.countdown}/${g.countdownClock.toFixed(2)} fps=${n} game-s=${(c0 - g.countdown - g.countdownClock).toFixed(2)} vis=${document.visibilityState}`); }; requestAnimationFrame(f); }))));
    note('  ', rows.join(' | ')); await wait(1000);
  }
  await leaveAll(players); await closePlayers(players);
};
scenarios.profile = async function () {
  note('▶ Perfil de CPU durante un partido 1v1');
  const players = await makePlayers(2, 'qf');
  for (const p of players) await openOnline(p);
  for (const p of players) await action(p, 'queue', { kind: 'quick', size: 2 });
  const states = await until(players, inGame, 25000, 'start');
  await wait(3000);
  for (const [i, p] of players.entries()) {
    const cdp = await p.page.createCDPSession();
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
    await wait(3000);
    const { profile } = await cdp.send('Profiler.stop');
    const self = new Map(); const byId = new Map(profile.nodes.map(n => [n.id, n]));
    const counts = new Map(); for (const id of profile.samples) counts.set(id, (counts.get(id) || 0) + 1);
    for (const [id, c] of counts) { const n = byId.get(id); const key = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}`; self.set(key, (self.get(key) || 0) + c); }
    const total = profile.samples.length;
    note(`  ${states[i].authority ? 'anfitrión' : 'invitado'} top:`, [...self].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, c]) => `${(c / total * 100).toFixed(0)}% ${k}`).join(' || '));
  }
  await leaveAll(players); await closePlayers(players);
};
scenarios.serverForfeit = async function () {
  note('▶ El servidor resuelve el partido mientras se juega (aviso de abandono perdido)');
  const players = await makePlayers(2, 'qw');
  for (const p of players) await openOnline(p);
  for (const p of players) await action(p, 'queue', { kind: 'ranked', size: 2 });
  const states = await until(players, inGame, 20000, 'start');
  check(states, 'partido iniciado');
  const quitter = players[1];
  // The quitter's leave reaches the database but its realtime "leave" message is lost.
  psql(`select set_config('request.jwt.claim.sub','${quitter.id}',false); set role authenticated; select public.field_online('leave', jsonb_build_object('lobbyId','${states[0].lobby.id}')) is not null;`);
  const after = await until([players[0]], s => !s.running && s.view === 'online', 15000, 'server forfeit seen');
  check(after, 'el que sigue jugando sale del partido al resolverse en el servidor');
  check(after && /Victoria/.test(after[0].hubMessage), `y ve la victoria por abandono (${after?.[0].hubMessage})`);
  check(after && after[0].elo === 516, `con su ELO (${after?.[0].elo})`);
  await leaveAll(players); check(!errorsOf(players).length, `sin errores de página ${errorsOf(players).join(' | ')}`); await closePlayers(players);
};
scenarios.comeback = async function () {
  note('▶ Un jugador cierra el juego y vuelve 20 s después en otra pestaña');
  const players = await makePlayers(2, 'qc');
  for (const p of players) await openOnline(p);
  await action(players[0], 'create', { kind: 'quick', size: 2 });
  const code = await evalIn(players[0], () => window.__field.ui.hub.lobby.code);
  await action(players[1], 'join', { kind: 'quick', code });
  let states = await until(players, inGame, 20000, 'start');
  check(states, 'partido iniciado');
  const hostIndex = states.findIndex(s => s.authority), host = players[hostIndex], guestIndex = 1 - hostIndex;
  await evalIn(host, () => { const g = window.__field.game; g.countdown = 0; g.state.scorePlayer = 3; g.state.scoreBot = 1; g.hooks.onScore?.(3, 1); });
  await wait(800);
  await players[guestIndex].context.close();
  const waiting = await until([host], s => s.view === 'online' && !s.running, 30000, 'host notices');
  check(waiting && /reconectar/i.test(waiting[0].hubMessage), `el anfitrión ve que se intenta reconectar (${waiting?.[0].hubMessage})`);
  players[guestIndex] = await openTab(players[guestIndex]);
  await players[guestIndex].page.goto(APP, { waitUntil: 'domcontentloaded' });
  await ready(players[guestIndex]);
  states = await until(players, inGame, 40000, 'back in game');
  check(states, 'al volver (sin abrir el online a mano) los dos están otra vez en el partido');
  states = await until(players, s => inGame(s) && s.score[0] + s.score[1] === 4, 8000, 'first snapshot') || states;
  if (states) check(states.map(s => s.score.join('-')).sort().join(' ') === '1-3 3-1', `se conserva el marcador (${states.map(s => s.score.join('-'))})`);
  check(await playOut(players, true), 'el partido termina');
  check(await until(players, s => s.lobby?.state === 'finished', 15000, 'settle'), 'resultado confirmado');
  await leaveAll(players); check(!errorsOf(players).length, `sin errores de página ${errorsOf(players).join(' | ')}`); await closePlayers(players);
};
scenarios.staleRoom = async function () {
  note('▶ Expulsado de una sala en espera por inactividad');
  const players = await makePlayers(2, 'qs');
  for (const p of players) await openOnline(p);
  await action(players[0], 'queue', { kind: 'tournament', size: 8 });
  const lobbyId = (await state(players[0])).lobby.id;
  psql(`update field_private.members set last_seen=now()-interval '2 minutes' where lobby_id='${lobbyId}'`);
  await action(players[1], 'queue', { kind: 'tournament', size: 8 }); // cleans stale seats
  const recovered = await until([players[0]], s => !s.lobby, 15000, 'recover');
  check(recovered, `el jugador expulsado deja de estar atascado en la sala (${recovered?.[0].hubMessage})`);
  const msg = await action(players[0], 'queue', { kind: 'tournament', size: 8 });
  check(!/Sal de la sala|No perteneces/.test(msg), `y puede volver a buscar (${msg})`);
  await leaveAll(players); check(!errorsOf(players).length, `sin errores de página ${errorsOf(players).join(' | ')}`); await closePlayers(players);
};
const plans = {
  serverForfeit: () => scenarios.serverForfeit(), comeback: () => scenarios.comeback(), staleRoom: () => scenarios.staleRoom(),
  profile: () => scenarios.profile(),
  probe2: () => scenarios.probe(2), probe4: () => scenarios.probe(4),
  quick1v1: () => scenarios.quick1v1(), private1v1: () => scenarios.private1v1(), ranked1v1: () => scenarios.ranked1v1(),
  duoQuickPublic: () => scenarios.duo('quick', true), duoQuickPrivate: () => scenarios.duo('quick', false), duoRanked: () => scenarios.duo('ranked', true),
  tour4: () => scenarios.tournament(4, true), tour6: () => scenarios.tournament(6, true), tour8: () => scenarios.tournament(8, false),
  reconnect: () => scenarios.reconnect(), duoReconnect: () => scenarios.duoReconnect(),
};

(async () => {
  const wanted = process.argv.slice(2); const names = !wanted.length || wanted.includes('all') ? Object.keys(plans).filter(name => !['profile', 'probe2', 'probe4'].includes(name)) : wanted;
  supa = await startFakeSupabase({ port: 54321, latency: Number(process.env.LATENCY || 0) });
  browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), headless: true,
    args: [...chromium.args.filter(a => !['--single-process','--no-zygote'].includes(a)), '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--autoplay-policy=no-user-gesture-required'] });
  for (const name of names) {
    try { await plans[name](); } catch (error) { failures.push(`${name}: ${error.message}`); note('  ✗ excepción', name, error.stack.split('\n').slice(0, 3).join(' ')); }
  }
  note(`\nRESULTADO: ${failures.length ? failures.length + ' fallos' : 'todo OK'}`);
  note('stats', JSON.stringify({ ...supa.stats, rpcErrors: supa.stats.rpcErrors.slice(-12) }));
  for (const failure of failures) note(' -', failure);
  await browser.close(); await supa.close();
  process.exit(failures.length ? 1 : 0);
})();
