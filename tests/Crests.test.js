import test from 'node:test';
import assert from 'node:assert/strict';
import { TEAMS, NATIONAL_TEAMS, HONORARY_TEAMS, TEAM_LEAGUES } from '../src/config/teams.js';
import { crestDesign, crestSVG, contrast, CREST_SHAPES, CREST_PATTERNS, CREST_BORDERS, CREST_DETAILS } from '../src/config/crests.js';

const all = [...TEAMS, ...NATIONAL_TEAMS, ...(HONORARY_TEAMS || [])];
const top = new Set(TEAM_LEAGUES.filter(league => (league.tier ?? 1) === 1).map(league => league.id));

test('every team has a valid crest of our own: shapes, patterns and borders from the templates, no text or images', () => {
  for (const team of all) {
    const design = crestDesign(team);
    assert.ok(CREST_SHAPES.includes(design.shape), `${team.id} shape ${design.shape}`);
    assert.ok(CREST_PATTERNS.includes(design.pattern), `${team.id} pattern ${design.pattern}`);
    assert.ok(CREST_BORDERS.includes(design.border) && CREST_DETAILS.includes(design.detail), team.id);
    const svg = crestSVG(team);
    assert.ok(svg.startsWith('<svg') && !/<text|<image|<use|href=/.test(svg), `${team.id}: only shapes`);
  }
});

test('the same team always gets the same crest; teams differ', () => {
  const team = TEAMS[200];
  assert.deepEqual(crestDesign(team), crestDesign(team));
  const signatures = new Set(all.map(team => JSON.stringify(crestDesign(team))));
  assert.ok(signatures.size > all.length * .97, `${signatures.size} distinct crests for ${all.length} teams`);
});

test('colours stay distinguishable at small sizes', () => {
  for (const team of all) {
    const { pattern, colors: [field, accent, trim] } = crestDesign(team);
    if (pattern !== 'plain') assert.ok(contrast(field, accent) >= 1.45, `${team.id}: field/accent ${field} ${accent}`);
    assert.ok(contrast(field, trim) >= 1.6 || contrast(field, trim) >= 1.45, `${team.id}: border ${field} ${trim}`);
  }
});

test('criteria for top flights and national teams; royal clubs wear a crown; World Cup stars', () => {
  const design = id => crestDesign(all.find(team => team.id === id));
  assert.equal(design('laliga-real-madrid').crown, true); assert.equal(design('laliga-betis').crown, true); assert.equal(design('laliga-barcelona').crown, false);
  assert.equal(design('laliga-barcelona').pattern, 'vstripes');
  assert.equal(design('europe-scotland').pattern, 'saltire'); assert.equal(design('europe-denmark').pattern, 'cross'); assert.equal(design('europe-croatia').pattern, 'checks');
  assert.equal(design('america-brazil').stars, 5); assert.equal(design('europe-spain').stars, 1);
  // Top flights follow the kit: striped kits give striped crests (unless hand-picked otherwise).
  const striped = TEAMS.filter(team => top.has(team.league) && team.kitPattern === 'vertical-stripes');
  assert.ok(striped.filter(team => ['vstripes'].includes(crestDesign(team).pattern)).length > striped.length * .8);
  // Lower divisions: varied combinations.
  const lower = TEAMS.filter(team => !top.has(team.league)), shapes = new Set(lower.map(team => crestDesign(team).shape)), patterns = new Set(lower.map(team => crestDesign(team).pattern));
  assert.equal(shapes.size, CREST_SHAPES.length); assert.ok(patterns.size >= 15);
});

test('every crest on a page gets its own clip id', () => {
  const a = crestSVG(TEAMS[0]), b = crestSVG(TEAMS[0]);
  const id = svg => svg.match(/clipPath id="([^"]+)"/)[1];
  assert.notEqual(id(a), id(b));
});
