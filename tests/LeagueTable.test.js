import test from 'node:test';
import assert from 'node:assert/strict';
import { TEAMS } from '../src/config/teams.js';
import { createLeagueSchedule, createLeagueStandings, updateLeagueStandings } from '../src/game/Competitions.js';

test('league standings keep the last five results of every club for the form column', () => {
  const player = TEAMS.find(team => team.league === 'laliga');
  const schedule = createLeagueSchedule('laliga', player.id, () => .4);
  let standings = createLeagueStandings('laliga');
  for (let round = 0; round < 7; round++) standings = updateLeagueStandings(standings, schedule[round], player.id, round % 3 === 0 ? 1 : 2, 1, () => .5);
  const mine = standings.find(row => row.teamId === player.id);
  assert.deepEqual(mine.form, ['W', 'D', 'W', 'W', 'D'], 'only the last five, oldest first');
  assert.ok(standings.every(row => row.form.length === 5 && row.form.every(result => ['W', 'D', 'L'].includes(result))));
  for (const row of standings) {
    const wins = row.form.filter(result => result === 'W').length;
    assert.ok(wins <= row.wins);
  }
});

test('older saved standings without form still update', () => {
  const player = TEAMS.find(team => team.league === 'premier');
  const schedule = createLeagueSchedule('premier', player.id, () => .4);
  const legacy = createLeagueStandings('premier').map(({ form, ...row }) => row);
  const updated = updateLeagueStandings(legacy, schedule[0], player.id, 0, 2, () => .5);
  assert.deepEqual(updated.find(row => row.teamId === player.id).form, ['L']);
});
