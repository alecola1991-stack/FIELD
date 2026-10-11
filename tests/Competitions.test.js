import test from 'node:test';
import assert from 'node:assert/strict';
import { TEAM_LEAGUES, TEAM_COUNTRIES, TEAM_GROUPS, TEAM_CLUB_GROUPS, PROFILE_TEAMS, HONORARY_TEAMS, TEAMS, getTeamById } from '../src/config/teams.js';
import { createChampionsDraw, createInternationalDraw, createLeagueOpponents, createLeagueSchedule, createLeagueStandings, updateLeagueStandings, sortLeagueStandings } from '../src/game/Competitions.js';

test('all selector clubs have unique ids and a one-to-five star rating', () => {
  assert.equal(new Set(TEAMS.map(team => team.id)).size, TEAMS.length);
  assert.ok(TEAMS.every(team => Number.isInteger(team.stars) && team.stars >= 1 && team.stars <= 5));
  assert.equal(getTeamById('laliga-barcelona').stars, 5);
  assert.equal(getTeamById('laliga-real-madrid').stars, 5);
  assert.equal(getTeamById('laliga-atletico').stars, 5);
});

test('team picker groups every league under a country and includes the honorary clubs', () => {
  assert.deepEqual(new Set(TEAM_COUNTRIES.flatMap(country => country.groups)), new Set(TEAM_GROUPS.map(group => group.id)));
  assert.ok(TEAM_COUNTRIES.find(country => country.id === 'spain').groups.includes('laliga'));
  assert.ok(TEAM_COUNTRIES.find(country => country.id === 'spain').groups.includes('laliga2'));
  assert.deepEqual(HONORARY_TEAMS.map(team => team.name), ['CD San Fernando 1940', 'GE Bazan']);
  assert.deepEqual(HONORARY_TEAMS.map(team => [team.primary, team.secondary]), [['#1769AA', '#FFFFFF'], ['#F3D21B', '#111111']]);
  assert.ok(HONORARY_TEAMS.every(team => TEAM_CLUB_GROUPS.some(group => group.id === team.league) && PROFILE_TEAMS.includes(team)));
  assert.ok(HONORARY_TEAMS.every(team => !TEAMS.includes(team)), 'honorary teams are selectable without becoming league clubs');
});

test('honorary clubs can enter the club cup but cannot enter a national tournament or league', () => {
  const draw = createChampionsDraw('honor-cd-san-fernando-1940', () => .5);
  assert.equal(draw[0].name, 'CD San Fernando 1940');
  assert.equal(draw.length, 16);
  assert.throws(() => createLeagueSchedule('laliga', 'honor-cd-san-fernando-1940'), /pertenezca a esta liga/);
  assert.throws(() => createInternationalDraw('world-cup', 'honor-cd-san-fernando-1940'), /selección/);
});

test('second tiers are playable leagues and schedules use each full roster', () => {
  for (const id of ['laliga2', 'championship', 'serie-b', 'ligue-2', 'bundesliga-2']) {
    assert.ok(TEAM_LEAGUES.some(league => league.id === id));
    const team = TEAMS.find(item => item.league === id);
    const opponents = createLeagueOpponents(id, team.id, () => .5);
    assert.equal(opponents.length, TEAMS.filter(item => item.league === id).length - 1);
    assert.ok(opponents.every(item => item.id !== team.id));
  }
  assert.equal(TEAMS.filter(team => team.league === 'laliga2').length, 22);
});

test('knockout draws seed lower-rated rivals earlier and tougher rivals later', () => {
  const draw = createChampionsDraw('laliga-barcelona', () => .5);
  const firstRoundRating = draw[1].stars;
  const finalRoundAverage = draw.slice(8).reduce((sum, team) => sum + team.stars, 0) / 8;
  assert.ok(finalRoundAverage > firstRoundRating);
  const international = createInternationalDraw('world-cup', 'europe-spain', () => .5);
  assert.equal(international.length, 16);
  assert.ok(international.slice(8).reduce((sum, team) => sum + team.stars, 0) / 8 >= international[1].stars);
});

test('league fixtures get progressively stronger on average', () => {
  const opponents = createLeagueOpponents('laliga2', 'laliga2-almeria', () => .5);
  const early = opponents.slice(0, 5).reduce((sum, team) => sum + team.stars, 0) / 5;
  const late = opponents.slice(-5).reduce((sum, team) => sum + team.stars, 0) / 5;
  assert.ok(late >= early);
});

test('league schedule requires a club from that division and covers every opponent once', () => {
  assert.throws(() => createLeagueSchedule('laliga', 'premier-arsenal'), /pertenezca a esta liga/);
  const leagueId = 'laliga2', playerId = 'laliga2-almeria';
  const schedule = createLeagueSchedule(leagueId, playerId, () => .5);
  const teams = TEAMS.filter(team => team.league === leagueId);
  assert.equal(schedule.length, teams.length - 1);
  const pairs = new Set();
  for (const round of schedule) {
    assert.equal(round.length, Math.floor(teams.length / 2));
    const appeared = new Set();
    for (const fixture of round) {
      assert.ok(!appeared.has(fixture.homeId)); assert.ok(!appeared.has(fixture.awayId));
      appeared.add(fixture.homeId); appeared.add(fixture.awayId);
      const key = [fixture.homeId, fixture.awayId].sort().join('|');
      assert.ok(!pairs.has(key)); pairs.add(key);
    }
    assert.equal(appeared.size, teams.length);
    assert.ok(round.some(fixture => fixture.homeId === playerId || fixture.awayId === playerId));
  }
  assert.equal(pairs.size, teams.length * (teams.length - 1) / 2);
});

test('league standings record the player result and every simulated fixture', () => {
  const leagueId = 'laliga', playerId = 'laliga-barcelona';
  const standings = createLeagueStandings(leagueId);
  const schedule = createLeagueSchedule(leagueId, playerId, () => .5);
  const firstRound = updateLeagueStandings(standings, schedule[0], playerId, 2, 1, () => .5);
  const ordered = sortLeagueStandings(firstRound, playerId);
  const player = firstRound.find(row => row.teamId === playerId);
  assert.equal(player.played, 1);
  assert.equal(player.wins, 1);
  assert.equal(player.points, 3);
  assert.equal(firstRound.filter(row => row.played === 1).length, firstRound.length);
  assert.equal(ordered[0].teamId, playerId);
  assert.ok(standings.every(row => row.played === 0), 'updates leave the original initial table untouched');
});
