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

test('play coins, purchases, and unlocked cosmetics persist and merge idempotently', () => {
  memoryStorage();
  const profile = new CareerProfile();
  profile.recordMatch(true);
  profile.earnCoins(60);
  assert.equal(profile.stats.coinsEarned - profile.stats.coinsSpent, 90);
  assert.equal(profile.buyItem('circle-raised', 80), true);
  assert.equal(profile.stats.coinsEarned - profile.stats.coinsSpent, 10);
  profile.equipItem('circle-raised', 'circleRelief', 'raised');
  const snapshot = profile.toJSON();
  profile.merge(snapshot);
  const restored = new CareerProfile();
  assert.equal(restored.stats.coinsEarned - restored.stats.coinsSpent, 10);
  assert.deepEqual(restored.ownedItems, ['circle-raised']);
  assert.equal(restored.equipped.circleRelief, 'raised');
});

test('cosmetics cannot be bought without enough earned coins', () => {
  memoryStorage(); const profile = new CareerProfile(); profile.earnCoins(79);
  assert.equal(profile.buyItem('circle-raised',80),false); assert.deepEqual(profile.ownedItems,[]);
  profile.earnCoins(1); assert.equal(profile.buyItem('circle-raised',80),true);
  assert.equal(profile.stats.coinsEarned-profile.stats.coinsSpent,0); assert.equal(profile.buyItem('circle-raised',80),false);
});

test('new cosmetic equipment slots persist with safe defaults', () => {
  memoryStorage(); const profile = new CareerProfile();
  profile.equipped={...profile.equipped,fieldTint:'lagoon',shotEffect:'aurora',ballSkin:'cosmic',playerEffect:'halo',goalEffect:'fireworks',circleRelief:'gold'}; profile.save();
  const restored=new CareerProfile();
  assert.deepEqual(restored.equipped,{circleRelief:'gold',fieldTint:'lagoon',shotEffect:'aurora',ballSkin:'cosmic',playerEffect:'halo',goalEffect:'fireworks'});
});
