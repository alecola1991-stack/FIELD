import test from 'node:test';
import assert from 'node:assert/strict';
import { getTeamById } from '../src/config/teams.js';
import {
  careerCountries, createStartingOffers, createCareer, nextCareerMatch, recordCareerMatch, leagueOutcome, startNextSeason,
  careerScore, careerTitle, careerLeagueOf, leagueTier, nationalTournamentFor, careerDifficulty, CAREER_SEASONS, CAREER_GOAL_TARGET, simulateLeagueTable,
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

test('league outcome: one decisive match (win champion, lose by one play-off, else lower half)', () => {
  const m = (gf, ga) => ({ result: { goalsFor: gf, goalsAgainst: ga, won: gf > ga } });
  assert.equal(leagueOutcome([m(2, 1)]).id, 'champion'); assert.equal(leagueOutcome([m(1, 0)]).id, 'champion');
  assert.equal(leagueOutcome([m(1, 2)], () => .2).id, 'playoff-won'); assert.equal(leagueOutcome([m(0, 1)], () => .8).id, 'playoff-lost');
  assert.equal(leagueOutcome([m(0, 2)]).id, 'low');
});

test('league outcome of careers saved with two key matches follows the earlier scale', () => {
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

test('one match per competition, first to 2 goals: the league decider and cup finals', () => {
  const random = seeded(31);
  const state = createCareer({ countryId: 'spain', clubId: createStartingOffers('spain', random)[0], random });
  assert.equal(CAREER_GOAL_TARGET, 2);
  for (const stage of state.plan.stages) assert.equal(stage.matches.length, 1, stage.id);
  assert.equal(state.plan.stages[0].matches[0].label, 'Partido decisivo');
  recordCareerMatch(state, 2, 1, random);
  assert.equal(state.plan.stages[0].status, 'done');
  // A won league in the top flight brings next season's continental final, a single match.
  while (nextCareerMatch(state)) recordCareerMatch(state, 2, 0, random);
  startNextSeason(state, null, random);
  for (const stage of state.plan.stages) assert.equal(stage.matches.length, 1, stage.id);
});

test('losing a final and losing keeps the division', () => {
  const random = seeded(19);
  const state = createCareer({ countryId: 'england', clubId: getTeamById('premier-arsenal') ? 'premier-arsenal' : createStartingOffers('england', random)[0], random });
  const league = careerLeagueOf(state, state.clubId);
  while (nextCareerMatch(state)) recordCareerMatch(state, 0, 2, random);
  assert.ok(['low'].includes(state.history[0].outcome));
  assert.ok(state.offers.length >= 1);
  startNextSeason(state, null, random);
  assert.equal(careerLeagueOf(state, state.clubId), league);
  // Season 2 is a World Cup year only for clubs that already reached a top flight.
  const national = state.plan.stages.find(stage => stage.id === 'national');
  assert.equal(!!national, leagueTier(league) === 1);
  if (national) {
    recordCareerMatch(state, 2, 0, random); // league
    recordCareerMatch(state, 1, 2, random); // final lost
    assert.equal(national.outcome, 'runner-up');
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
