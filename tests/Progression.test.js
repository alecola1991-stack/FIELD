import test from 'node:test';
import assert from 'node:assert/strict';
import { Progression } from '../src/game/Progression.js';

let values = new Map();
globalThis.localStorage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
};

test('da XP al terminar una partida aunque se pierda y solo suma victorias al ganar', () => {
  values = new Map();
  const progress = new Progression('test-player');

  const loss = progress.awardMatch(false);
  assert.equal(loss.gained, 50);
  assert.equal(progress.xp, 50);
  assert.equal(progress.wins, 0);

  const win = progress.awardMatch(true);
  assert.equal(win.gained, 50);
  assert.equal(progress.xp, 100);
  assert.equal(progress.wins, 1);
});

test('awards mission XP and levels up without counting a match or a win', () => {
  values = new Map();
  const progress = new Progression('mission-xp-player');
  const reward = progress.awardXP(300);
  assert.equal(reward.gained, 300);
  assert.equal(progress.level, 3);
  assert.equal(progress.xp, 40);
  assert.equal(progress.wins, 0);
});
