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

test('competition missions give XP progress once and survive profile merge', () => {
  memoryStorage();
  const profile = new CareerProfile('missions-player');
  assert.deepEqual(profile.processMissionEvent({ competitionMode: true, won: true }), []);
  assert.deepEqual(profile.processMissionEvent({ competitionMode: true, won: true }), []);
  const earned = profile.processMissionEvent({ competitionMode: true, won: true });
  assert.equal(earned[0].id, 'competition-wins');
  assert.deepEqual(profile.processMissionEvent({ competitionMode: true, won: true }), []);
  profile.processMissionEvent({ competitionId: 'champions', isFinal: true, playerGoals: 1 });
  profile.processMissionEvent({ competitionId: 'world-cup', isChampion: true });
  profile.processMissionEvent({ leagueId: 'laliga', isLeagueChampion: true, teamId: 'laliga-barcelona' });
  const snapshot = profile.toJSON();
  const merged = new CareerProfile('missions-remote'); merged.merge(snapshot);
  assert.equal(merged.missions['competition-wins'].completed, true);
  assert.equal(merged.missions['league-champion:laliga-barcelona'].completed, true);
});

test('old economy data is removed on load and cloud merge without losing career or missions', () => {
  memoryStorage();
  const legacy = { stats: { matches: 8, wins: 5, coinsEarned: 90000, coinsSpent: 100 },
    ownedItems: ['ball-gold'], equipped: { ballSkin: 'gold' }, redeemedCodes: ['old-code'],
    trophies: [{ id: 'first-win', name: 'Victoria' }], missions: { 'competition-wins': { progress: 3, completed: true } } };
  localStorage.setItem('field-career-profile', JSON.stringify(legacy));
  const profile = new CareerProfile();
  for (const incoming of [legacy, { ...legacy, shards: { device: legacy.stats, 'promo:old-code': { coinsEarned: 90000 } } }]) {
    profile.merge(incoming);
    const data = profile.toJSON();
    for (const key of ['ownedItems', 'equipped', 'redeemedCodes']) assert.equal(key in data, false);
    assert.equal('coinsEarned' in data.stats, false); assert.equal('coinsSpent' in data.stats, false);
    assert.equal(Object.keys(data.shards).some(key => key.startsWith('promo:')), false);
    assert.equal(data.trophies[0].id, 'first-win'); assert.equal(data.missions['competition-wins'].completed, true);
  }
  assert.ok(new CareerProfile().stats.wins >= 5);
  assert.equal(JSON.stringify(JSON.parse(localStorage.getItem('field-career-profile'))).includes('coins'), false);
});
