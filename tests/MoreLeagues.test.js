import test from 'node:test';
import assert from 'node:assert/strict';
import { TEAM_LEAGUES, TEAM_COUNTRIES, TEAMS } from '../src/config/teams.js';
import { MORE_LEAGUES, MORE_COUNTRIES } from '../src/config/teams-more.js';
import { createChampionsDraw, createLeagueSchedule } from '../src/game/Competitions.js';

test('new divisions and countries are playable leagues grouped by country, with their division level', () => {
  for (const league of MORE_LEAGUES) {
    const listed = TEAM_LEAGUES.find(item => item.id === league.id);
    assert.ok(listed, `${league.id} is listed`); assert.equal(listed.tier, league.tier);
    assert.ok(TEAM_COUNTRIES.find(country => country.id === league.country)?.groups.includes(league.id), `${league.id} is grouped under ${league.country}`);
    const roster = TEAMS.filter(team => team.league === league.id);
    assert.ok(roster.length >= 12, `${league.id} has a full roster`);
    assert.ok(roster.every(team => /^#[0-9A-F]{6}$/i.test(team.primary) && /^#[0-9A-F]{6}$/i.test(team.secondary)));
    assert.equal(createLeagueSchedule(league.id, roster[0].id).length, roster.length - 1);
  }
  for (const country of MORE_COUNTRIES) assert.ok(TEAM_COUNTRIES.some(item => item.id === country.id));
  assert.equal(TEAM_LEAGUES.find(league => league.id === 'laliga2').tier, 2);
  assert.equal(TEAM_LEAGUES.find(league => league.id === 'segunda-rfef-3').tier, 4);
  const stars = id => TEAMS.find(team => team.id === id).stars;
  assert.ok(stars('eredivisie-ajax') > stars('eredivisie-telstar') && stars('brasileirao-b-sport') > stars('brasileirao-c-guarani'));
});

test('the Champions draw only takes clubs from first divisions', () => {
  let seed = 3; const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 20; i++) {
    const draw = createChampionsDraw('league-one-leicester', random);
    assert.equal(draw.length, 16);
    for (const team of draw.filter(team => team.id !== 'league-one-leicester')) assert.equal(TEAM_LEAGUES.find(league => league.id === team.league).tier, 1, team.id);
  }
});

test('all 211 FIFA national teams; the World Cup draws from every confederation group', async () => {
  const { NATIONAL_TEAMS, TEAM_COUNTRIES } = await import('../src/config/teams.js');
  const { createInternationalDraw } = await import('../src/game/Competitions.js');
  assert.equal(NATIONAL_TEAMS.length, 211);
  assert.deepEqual(TEAM_COUNTRIES.find(country => country.id === 'national').groups, ['europe', 'america', 'africa', 'asia', 'oceania']);
  let seed = 9; const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const draw = createInternationalDraw('world-cup', 'oceania-new-zealand', random);
  const groups = draw.reduce((count, team) => ({ ...count, [team.league]: (count[team.league] || 0) + 1 }), {});
  assert.equal(draw.length, 16); assert.deepEqual(groups, { europe: 5, america: 4, africa: 3, asia: 3, oceania: 1 });
  const euro = createInternationalDraw('euro', 'europe-spain', random);
  assert.ok(euro.every(team => team.league === 'europe') && euro.length === 16);
});
