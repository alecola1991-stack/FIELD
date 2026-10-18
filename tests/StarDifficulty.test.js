import test from 'node:test';
import assert from 'node:assert/strict';
import { difficultyForStars, starXpMultiplier } from '../src/config/settings.js';
import { Progression } from '../src/game/Progression.js';

test('rival stars pick the AI level', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(difficultyForStars), ['easy', 'normal', 'hard', 'pro', 'champions']);
  assert.equal(difficultyForStars(undefined), 'hard');
  assert.equal(difficultyForStars(9), 'champions');
});

test('beating stronger rivals gives more XP (+10 % per star, wins only)', () => {
  assert.equal(starXpMultiplier(5), 1.5); assert.equal(starXpMultiplier(1), 1.1);
  const base = new Progression('test-a'); base.xp = 0; base.level = 1;
  const plain = base.awardMatch(true, 1).gained;
  const bonus = new Progression('test-b'); bonus.xp = 0; bonus.level = 1;
  assert.equal(bonus.awardMatch(true, 1.5).gained, Math.round(plain * 1.5));
  const loss = new Progression('test-c'); loss.xp = 0; loss.level = 1;
  assert.equal(loss.awardMatch(false, 1.5).gained, plain);
});
