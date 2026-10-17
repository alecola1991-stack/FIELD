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

test('mission board: one mission per tier, completing one adds a new harder mission with a bigger reward', () => {
  memoryStorage();
  const profile = new CareerProfile('missions-player'); profile.random = () => 0;
  const active = profile.activeMissions(1);
  assert.deepEqual(active.map(mission => mission.tier), ['easy', 'medium', 'hard', 'elite']);
  const xp = Object.fromEntries(active.map(mission => [mission.tier, mission.xp]));
  assert.ok(xp.easy < xp.medium && xp.medium < xp.hard && xp.hard < xp.elite, 'harder tiers pay more');
  assert.ok(active.every(mission => !['expert-wins', 'expert-clean', 'pro-wins', 'champions-wins'].includes(mission.template)), 'no locked difficulty missions at level 1');
  // The first easy mission (random 0) is "play 3 matches".
  assert.equal(active[0].template, 'play'); assert.equal(active[0].goal, 3);
  const match = { mode: 'bot', won: false, goalsFor: 1, goalsAgainst: 3, difficulty: 'easy' };
  assert.equal(profile.processMissionEvent(match, 1).length, 0);
  assert.equal(profile.processMissionEvent(match, 1).length, 0);
  const done = profile.processMissionEvent(match, 1);
  assert.equal(done.length, 1); assert.equal(done[0].template, 'play'); assert.equal(done[0].xp, xp.easy);
  assert.equal(done.added.length, 1); assert.equal(done.added[0].tier, 'easy'); assert.notEqual(done.added[0].template, 'play', 'a different mission replaces it');
  const next = profile.activeMissions(1).find(mission => mission.tier === 'easy');
  assert.equal(next.progress, 0); assert.ok(next.xp > xp.easy, 'reward grows with completed missions');
  assert.equal(profile.missionsCompleted(), 1);
  // Survives reload and merges into another device's profile.
  const reloaded = new CareerProfile('missions-player');
  assert.equal(reloaded.activeMissions(1).find(mission => mission.tier === 'easy').uid, next.uid);
  const other = new CareerProfile('missions-remote'); other.merge(profile.toJSON());
  assert.equal(other.missionsCompleted(), 1);
});

test('streak missions reset on a loss and elite missions need titles', () => {
  memoryStorage();
  const profile = new CareerProfile('streaks'); profile.random = () => 0;
  profile.activeMissions(1);
  const medium = profile.missionBoard.active.find(mission => mission.tier === 'medium');
  medium.template = 'streak-3'; medium.goal = 3; medium.progress = 0;
  const win = { mode: 'bot', won: true, goalsFor: 3, goalsAgainst: 1, difficulty: 'normal' };
  profile.processMissionEvent(win, 1); profile.processMissionEvent(win, 1);
  profile.processMissionEvent({ ...win, won: false, goalsFor: 0 }, 1);
  assert.equal(profile.missionBoard.active.find(mission => mission.tier === 'medium').progress, 0);
  const elite = profile.missionBoard.active.find(mission => mission.tier === 'elite');
  elite.template = 'cup-champion'; elite.goal = 1; elite.progress = 0;
  assert.ok(!profile.processMissionEvent(win, 1).some(mission => mission.tier === 'elite'));
  assert.ok(profile.processMissionEvent({ ...win, mode: 'tournament', competitionMode: true, isFinal: true, isChampion: true }, 1).some(mission => mission.tier === 'elite'));
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
