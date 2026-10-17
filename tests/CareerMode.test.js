import test from 'node:test';
import assert from 'node:assert/strict';
import { getTeamById } from '../src/config/teams.js';
import {
  careerCountries, createStartingOffers, createCareer, nextCareerMatch, recordCareerMatch, leagueOutcome, startNextSeason,
  careerScore, careerTitle, careerLeagueOf, leagueTier, nationalTournamentFor, careerDifficulty, CAREER_SEASONS, simulateLeagueTable,
} from '../src/game/CareerMode.js';

function seeded(seed = 7) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

test('every career country has a national team and leagues', () => {
  const countries = careerCountries();
  assert.equal(countries.length, 20);
  for (const country of countries) assert.ok(getTeamById(country.nationalId), country.id);
});

test('starting offers: five distinct clubs of the country, mostly from lower divisions', () => {
  const random = seeded(3); let low = 0, total = 0;
  for (let i = 0; i < 60; i++) {
    const offers = createStartingOffers('spain', random);
    assert.equal(offers.length, 5); assert.equal(new Set(offers).size, 5);
    for (const id of offers) { const tier = leagueTier(getTeamById(id).league); total++; if (tier >= 3) low++; assert.ok(tier >= 1 && tier <= 4); }
  }
  assert.ok(low / total > .7, `lower divisions ${low}/${total}`);
  assert.equal(createStartingOffers('mexico', seeded(5)).length, 5);
});

test('league outcome follows the agreed scale', () => {
  const m = (gf, ga) => ({ result: { goalsFor: gf, goalsAgainst: ga, won: gf > ga } });
  assert.equal(leagueOutcome([m(3, 1), m(3, 2)]).id, 'champion');
  assert.equal(leagueOutcome([m(3, 0), m(2, 3)]).id, 'runner-up');
  assert.match(leagueOutcome([m(3, 1), m(1, 3)]).id, /^playoff-/);
  assert.equal(leagueOutcome([m(3, 2), m(0, 3)]).id, 'mid');
  assert.equal(leagueOutcome([m(1, 3), m(2, 3)]).id, 'low');
});

test('winning everything climbs to the top flight and plays the national team', () => {
  const random = seeded(11);
  let club = null;
  for (let i = 0; i < 20 && !club; i++) club = createStartingOffers('spain', random).find(id => leagueTier(getTeamById(id).league) === 4);
  assert.ok(club, 'a fourth-division club is offered');
  const state = createCareer({ countryId: 'spain', clubId: club, random });
  for (let season = 1; season <= CAREER_SEASONS; season++) {
    assert.equal(state.phase, 'season');
    let guard = 0;
    while (nextCareerMatch(state) && guard++ < 20) recordCareerMatch(state, 3, 0, random);
    assert.equal(state.phase, 'summary');
    const summary = state.history.at(-1);
    assert.equal(summary.outcome, 'champion'); assert.equal(summary.position, 1);
    startNextSeason(state, null, random);
  }
  assert.equal(state.phase, 'finished');
  assert.equal(leagueTier(careerLeagueOf(state, state.clubId)), 1);
  const kinds = state.trophies.map(item => item.kind);
  assert.ok(kinds.includes('promotion')); assert.ok(kinds.includes('champions')); assert.ok(kinds.includes('club-world-cup'));
  assert.ok(kinds.includes('world-cup')); assert.ok(kinds.includes('euro'));
  assert.ok(state.loyalty);
  assert.equal(careerScore(state), state.trophies.reduce((sum, item) => sum + item.points, 0) + 100);
  assert.equal(careerTitle(careerScore(state)).id, 'legend');
});

test('losing a semi-final skips the final and losing keeps the division', () => {
  const random = seeded(19);
  const state = createCareer({ countryId: 'england', clubId: getTeamById('premier-arsenal') ? 'premier-arsenal' : createStartingOffers('england', random)[0], random });
  const league = careerLeagueOf(state, state.clubId);
  while (nextCareerMatch(state)) recordCareerMatch(state, 0, 3, random);
  assert.ok(['low'].includes(state.history[0].outcome));
  assert.ok(state.offers.length >= 1);
  startNextSeason(state, null, random);
  assert.equal(careerLeagueOf(state, state.clubId), league);
  // Season 2 is a World Cup year only for clubs that already reached a top flight.
  const national = state.plan.stages.find(stage => stage.id === 'national');
  assert.equal(!!national, leagueTier(league) === 1);
  if (national) {
    recordCareerMatch(state, 3, 0, random); recordCareerMatch(state, 3, 0, random); // league
    recordCareerMatch(state, 1, 3, random); // semi-final lost
    assert.equal(national.outcome, 'eliminated'); assert.equal(national.matches[1].result, null);
  }
});

test('accepting a transfer offer changes club', () => {
  const random = seeded(23);
  const state = createCareer({ countryId: 'italy', clubId: createStartingOffers('italy', random)[0], random });
  while (nextCareerMatch(state)) recordCareerMatch(state, 3, 1, random);
  const offer = state.offers[0];
  startNextSeason(state, offer.teamId, random);
  assert.equal(state.clubId, offer.teamId);
});

test('tournament calendar and difficulty cap', () => {
  assert.equal(nationalTournamentFor('spain', 2), 'world-cup');
  assert.equal(nationalTournamentFor('spain', 4), 'euro');
  assert.equal(nationalTournamentFor('argentina', 8), 'copa-america');
  assert.equal(nationalTournamentFor('saudi-arabia', 4), null);
  assert.equal(nationalTournamentFor('spain', 3), null);
  assert.equal(careerDifficulty('champions', 1), 'normal');
  assert.equal(careerDifficulty('pro', 12), 'pro');
});

test('simulated table puts the club in its position', () => {
  const rows = simulateLeagueTable('laliga', 'x-club', 3, seeded(2));
  assert.equal(rows[2].teamId, 'x-club'); assert.equal(rows.length, 21);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i].points <= rows[i - 1].points);
});
