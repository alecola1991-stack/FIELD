import test from 'node:test';
import assert from 'node:assert/strict';
import { CareerProfile } from '../src/game/CareerProfile.js';

function memoryStorage() {
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

test('career match stats record elapsed time and best score and survive reload', () => {
  memoryStorage();
  const profile = new CareerProfile();
  profile.recordMatch(true, { playerScore: 5, elapsedSeconds: 93 });
  profile.recordMatch(false, { playerScore: 3, elapsedSeconds: 46 });
  assert.deepEqual({ matches: profile.stats.matches, wins: profile.stats.wins, losses: profile.stats.losses, time: profile.stats.timePlayedSeconds, best: profile.stats.bestScore }, { matches: 2, wins: 1, losses: 1, time: 139, best: 5 });
  assert.equal(new CareerProfile().stats.timePlayedSeconds, 139);
});

test('trophy awards are unique and persist with their date', () => {
  memoryStorage();
  const profile = new CareerProfile();
  assert.equal(profile.awardTrophy('first-win', 'Primera victoria'), true);
  assert.equal(profile.awardTrophy('first-win', 'Primera victoria'), false);
  const reloaded = new CareerProfile();
  assert.equal(reloaded.trophies.length, 1);
  assert.ok(Number.isFinite(Date.parse(reloaded.trophies[0].date)));
});
