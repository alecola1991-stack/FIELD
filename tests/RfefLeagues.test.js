import test from 'node:test';
import assert from 'node:assert/strict';
import { TEAM_LEAGUES, TEAM_COUNTRIES, TEAMS, FEDERATION_LEAGUE_IDS, getKitBackground } from '../src/config/teams.js';
import { createChampionsDraw, createLeagueSchedule } from '../src/game/Competitions.js';
import { TROPHY_CATALOG } from '../src/game/Achievements.js';

const RFEF_GROUPS = { 'primera-rfef-1': 20, 'primera-rfef-2': 20, 'segunda-rfef-1': 18, 'segunda-rfef-2': 18, 'segunda-rfef-3': 18, 'segunda-rfef-4': 18, 'segunda-rfef-5': 18 };

test('Primera and Segunda RFEF groups are playable Spanish leagues with full rosters', () => {
  assert.deepEqual([...FEDERATION_LEAGUE_IDS].sort(), Object.keys(RFEF_GROUPS).sort());
  const spain = TEAM_COUNTRIES.find(country => country.id === 'spain');
  for (const [id, size] of Object.entries(RFEF_GROUPS)) {
    assert.ok(TEAM_LEAGUES.some(league => league.id === id && league.federation === true));
    assert.ok(spain.groups.includes(id), `${id} should appear under España`);
    const roster = TEAMS.filter(team => team.league === id);
    assert.equal(roster.length, size, `${id} should have ${size} clubs`);
    assert.ok(roster.every(team => team.stars === 2 && /^#[0-9A-F]{6}$/i.test(team.primary) && /^#[0-9A-F]{6}$/i.test(team.secondary) && team.kitPattern && team.numberColor));
    assert.ok(roster.every(team => getKitBackground(team).includes(team.primary)));
  }
  assert.equal(TEAMS.filter(team => FEDERATION_LEAGUE_IDS.has(team.league)).length, 130);
});

test('RFEF league seasons cover every group rival exactly once', () => {
  for (const [id, size] of Object.entries(RFEF_GROUPS)) {
    const player = TEAMS.find(team => team.league === id);
    const schedule = createLeagueSchedule(id, player.id, () => .5);
    assert.equal(schedule.length, size - 1);
    const rivals = schedule.map(fixtures => {
      const fixture = fixtures.find(item => item.homeId === player.id || item.awayId === player.id);
      return fixture.homeId === player.id ? fixture.awayId : fixture.homeId;
    });
    assert.equal(new Set(rivals).size, size - 1);
  }
});

test('Champions never draws RFEF rivals, but an RFEF club can still enter as the player', () => {
  for (let seed = 0; seed < 40; seed++) {
    let state = seed + 1;
    const random = () => (state = (state * 16807) % 2147483647) / 2147483647;
    const draw = createChampionsDraw('laliga-betis', random);
    assert.equal(draw.length, 16);
    assert.ok(draw.every(team => !FEDERATION_LEAGUE_IDS.has(team.league)));
  }
  const withRfefPlayer = createChampionsDraw('primera-rfef-2-zaragoza', () => .3);
  assert.equal(withRfefPlayer[0].id, 'primera-rfef-2-zaragoza');
  assert.ok(withRfefPlayer.slice(1).every(team => !FEDERATION_LEAGUE_IDS.has(team.league)));
});

test('each RFEF group gets its own league trophy', () => {
  for (const id of Object.keys(RFEF_GROUPS)) assert.ok(TROPHY_CATALOG.some(item => item.id === `league-${id}`));
});
