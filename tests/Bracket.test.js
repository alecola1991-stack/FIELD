import test from 'node:test';
import assert from 'node:assert/strict';
import { createChampionsDraw, createClubWorldCupDraw, createBracket, playBracketRound, simulateRemainingBracket, bracketOpponent, bracketChampion } from '../src/game/Competitions.js';

const seeded = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

test('the bracket pairs the draw in order and the player meets the winner of the right block each round', () => {
  const teams = createChampionsDraw('laliga-betis', seeded(7));
  const bracket = createBracket(teams);
  assert.equal(bracket.rounds.length, 4);
  assert.deepEqual(bracket.rounds.map(round => round.length), [8, 4, 2, 1]);
  assert.equal(bracketOpponent(bracket, 0, 'laliga-betis'), teams[1].id);
  for (let round = 0; round < 4; round++) {
    const opponent = bracketOpponent(bracket, round, 'laliga-betis');
    const block = teams.slice(2 ** round, 2 ** (round + 1)).map(team => team.id);
    assert.ok(block.includes(opponent), `round ${round + 1} rival comes from slots ${2 ** round}-${2 ** (round + 1) - 1}`);
    playBracketRound(bracket, round, 'laliga-betis', 3, 1, seeded(round + 3));
    assert.ok(bracket.rounds[round].every(match => match.winner && match.homeGoals !== match.awayGoals));
  }
  assert.equal(bracketChampion(bracket), 'laliga-betis');
});

test('an eliminated player sees the rest of the tournament simulated to a champion', () => {
  const teams = createClubWorldCupDraw('laliga-real-madrid', seeded(11));
  const bracket = createBracket(teams);
  assert.equal(bracket.rounds.length, 5);
  playBracketRound(bracket, 0, 'laliga-real-madrid', 1, 3, seeded(2));
  simulateRemainingBracket(bracket, 1, seeded(5));
  const champion = bracketChampion(bracket);
  assert.ok(champion && champion !== 'laliga-real-madrid');
  assert.ok(bracket.rounds.flat().every(match => match.winner));
  assert.equal(bracketOpponent(bracket, 1, 'laliga-real-madrid'), null);
});

test('simulated scores respect the goal target and the bracket survives JSON saves', () => {
  const bracket = createBracket(createChampionsDraw('laliga-sevilla', seeded(3)));
  playBracketRound(bracket, 0, 'laliga-sevilla', 5, 2, seeded(9), 5);
  for (const match of bracket.rounds[0]) assert.equal(Math.max(match.homeGoals, match.awayGoals), 5);
  const restored = JSON.parse(JSON.stringify(bracket));
  assert.equal(bracketOpponent(restored, 1, 'laliga-sevilla'), bracketOpponent(bracket, 1, 'laliga-sevilla'));
});
