import test from 'node:test';
import assert from 'node:assert/strict';
import { cycleTeamSelection, selectionFor } from '../src/ui/TeamSelection.js';
import { PROFILE_TEAMS, TEAM_COUNTRIES } from '../src/config/teams.js';

test('team arrows stay in the selected league, wrap and reverse for every category', () => {
  for (const country of TEAM_COUNTRIES) for (const league of country.groups) {
    const teams = PROFILE_TEAMS.filter(team => team.league === league);
    assert.ok(teams.length);
    assert.equal(cycleTeamSelection(teams[0].id, 'team', -1), teams.at(-1).id);
    assert.equal(cycleTeamSelection(teams.at(-1).id, 'team', 1), teams[0].id);
    for (const team of teams) assert.equal(selectionFor(cycleTeamSelection(team.id, 'team', 1)).team.league, league);
  }
});

test('league and country arrows select a valid team without mixing categories', () => {
  const first = 'laliga-barcelona';
  assert.equal(selectionFor(cycleTeamSelection(first, 'league', 1)).league.id, 'laliga2');
  assert.equal(selectionFor(cycleTeamSelection(first, 'country', 1)).country.id, 'england');
  for (const country of TEAM_COUNTRIES) {
    const team = PROFILE_TEAMS.find(team => country.groups.includes(team.league));
    const next = selectionFor(cycleTeamSelection(team.id, 'league', 1));
    assert.equal(next.country.id, country.id);
  }
});
