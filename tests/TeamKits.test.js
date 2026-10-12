import test from 'node:test';
import assert from 'node:assert/strict';
import { PROFILE_TEAMS, getKitBackground } from '../src/config/teams.js';

test('first division and national teams have visible, recognizable kit patterns', () => {
  const byId = new Map(PROFILE_TEAMS.map(team => [team.id, team]));
  assert.equal(byId.get('laliga-barcelona').kitPattern, 'vertical-stripes');
  assert.equal(byId.get('premier-newcastle').kitPattern, 'vertical-stripes');
  assert.equal(byId.get('europe-croatia').kitPattern, 'checkerboard');
  assert.equal(byId.get('america-argentina').kitPattern, 'vertical-stripes');
  assert.match(getKitBackground(byId.get('laliga-barcelona')), /repeating-linear-gradient/);
});

test('every team gets a stable kit pattern and second divisions get a varied mix', () => {
  const allowed = new Set(['horizontal-stripes', 'vertical-stripes', 'checkerboard', 'half-horizontal', 'half-vertical', 'quarters']);
  for (const team of PROFILE_TEAMS) assert.ok(allowed.has(team.kitPattern), `${team.id} is missing a kit pattern`);
  const secondDivision = PROFILE_TEAMS.filter(team => ['laliga2', 'championship', 'serie-b', 'ligue-2', 'bundesliga-2'].includes(team.league));
  assert.ok(new Set(secondDivision.map(team => team.kitPattern)).size >= 5);
});

test('first-division and national shirts use their dorsal font colors', () => {
  const byId = new Map(PROFILE_TEAMS.map(team => [team.id, team]));
  assert.equal(byId.get('laliga-barcelona').numberColor, '#f6d65c');
  assert.equal(byId.get('europe-spain').numberColor, '#f6d65c');
  assert.equal(byId.get('america-argentina').numberColor, '#17274b');
  assert.equal(byId.get('bundesliga-dortmund').numberColor, '#171717');
  for (const team of PROFILE_TEAMS) assert.match(team.numberColor, /^#[0-9a-f]{6}$/i, `${team.id} needs a dorsal color`);
});
