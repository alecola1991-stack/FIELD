import test from 'node:test';
import assert from 'node:assert/strict';
import { TEAM_LEAGUES, TEAMS, getTeamById } from '../src/config/teams.js';
import { createChampionsDraw, createInternationalDraw, createLeagueOpponents } from '../src/game/Competitions.js';

test('all selector clubs have unique ids and a one-to-five star rating', () => {
  assert.equal(new Set(TEAMS.map(team => team.id)).size, TEAMS.length);
  assert.ok(TEAMS.every(team => Number.isInteger(team.stars) && team.stars >= 1 && team.stars <= 5));
  assert.equal(getTeamById('laliga-barcelona').stars, 5);
  assert.equal(getTeamById('laliga-real-madrid').stars, 5);
  assert.equal(getTeamById('laliga-atletico').stars, 5);
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
