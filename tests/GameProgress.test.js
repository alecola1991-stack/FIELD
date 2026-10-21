import test from 'node:test';
import assert from 'node:assert/strict';
import { computeProgress, progressId, TOP_LEAGUES, CUP_IDS, PROGRESS_CATEGORIES } from '../src/game/GameProgress.js';
import { ACHIEVEMENTS } from '../src/game/Achievements.js';
import { LEGEND_MATCHES } from '../src/config/legends.js';
import { DIFFICULTIES } from '../src/config/settings.js';
import { RANKS } from '../src/config/ranks.js';
import { CAREER_MILESTONES } from '../src/game/GameProgress.js';

const everything = () => [
  ...CUP_IDS, ...TOP_LEAGUES.map(league => `league-${league.id}`), ...ACHIEVEMENTS.map(item => item.id),
  ...CAREER_MILESTONES.map(item => progressId('career', item.id)), ...DIFFICULTIES.map(item => progressId('difficulty', item.id)),
  ...LEGEND_MATCHES.map(item => progressId('legend', item.id)), ...RANKS.map(rank => progressId('rank', rank.id)),
];

test('weights add up to 100 and only the five big leagues count', () => {
  assert.equal(PROGRESS_CATEGORIES.reduce((sum, item) => sum + item.weight, 0), 100);
  assert.deepEqual(TOP_LEAGUES.map(league => league.id), ['laliga', 'premier', 'serie-a', 'bundesliga', 'ligue-1']);
  assert.ok(TOP_LEAGUES.every(league => (league.tier ?? 1) === 1));
});

test('a new player starts near 0 % and a complete save reaches exactly 100 %', () => {
  const start = computeProgress({ level: 1 });
  assert.equal(start.percent, 0); assert.equal(start.title.label, 'Novato'); assert.equal(start.complete, false);
  const full = computeProgress({ level: 100, trophyIds: everything() });
  assert.equal(full.percent, 100); assert.equal(full.complete, true); assert.equal(full.title.label, 'Completista');
  assert.equal(full.nearest.length, 0);
});

test('almost complete never rounds up to 100 %', () => {
  // Everything but one level: 99.85 % shows as 99 %.
  const progress = computeProgress({ level: 99, trophyIds: everything() });
  assert.equal(progress.percent, 99); assert.equal(progress.complete, false);
  // Missing one of the five big leagues costs 4 %.
  const noLaLiga = computeProgress({ level: 100, trophyIds: everything().filter(id => id !== 'league-laliga') });
  assert.equal(noLaLiga.percent, 96); assert.equal(noLaLiga.nearest[0].item.id, 'laliga');
});

test('category weights apply', () => {
  const cups = computeProgress({ level: 1, trophyIds: CUP_IDS });
  assert.ok(Math.abs(cups.exact - (20 + 15 / 100)) < 1e-9);
});

test('locked difficulties are not suggested as the next goal', () => {
  const progress = computeProgress({ level: 1, trophyIds: [progressId('difficulty', 'easy'), progressId('difficulty', 'normal')] });
  assert.ok(!progress.nearest.some(goal => goal.category.id === 'difficulty'));
});
