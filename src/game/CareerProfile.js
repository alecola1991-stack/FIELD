const BASE_KEY = 'field-career-profile';
const statKeys = ['matches', 'wins', 'losses', 'goalsFor', 'goalsAgainst', 'trainingGoals', 'leagueSeasons', 'timePlayedSeconds', 'bestScore'];

export class CareerProfile {
  constructor(scope = 'guest') { this.scope = normalizeScope(scope); this.load(); }

  get key() { return this.scope === 'guest' ? BASE_KEY : `${BASE_KEY}:${this.scope}`; }

  load() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(this.key) || '{}') || {}; } catch { /* Ignore damaged profile data. */ }
    this.shards = normalizeShards(saved.shards);
    if (!Object.keys(this.shards).length) this.shards.legacy = normalizeStats(saved.stats);
    this.stats = sumShards(this.shards);
    this.trophies = Array.isArray(saved.trophies) ? saved.trophies.filter(item => item && typeof item.id === 'string').slice(0, 200) : [];
  }

  setScope(scope) { this.scope = normalizeScope(scope); this.load(); }
  recordGoal(side, training = false) {
    const shard = this.deviceShard();
    if (training) shard.trainingGoals++;
    else if (side === 1) shard.goalsFor++;
    else shard.goalsAgainst++;
    this.refreshStats();
    this.save();
  }
  recordMatch(won, { playerScore = 0, elapsedSeconds = 0 } = {}) {
    const shard = this.deviceShard(); shard.matches++; shard[won ? 'wins' : 'losses']++;
    shard.timePlayedSeconds += safeCount(elapsedSeconds); shard.bestScore = Math.max(shard.bestScore, safeCount(playerScore));
    this.refreshStats(); this.save();
  }
  recordLeagueSeason() { this.deviceShard().leagueSeasons++; this.refreshStats(); this.save(); }
  ensureProgressionWins(wins) {
    const shard = this.deviceShard(); shard.wins = Math.max(shard.wins, safeCount(wins));
    shard.matches = Math.max(shard.matches, shard.wins); this.refreshStats(); this.save();
  }
  awardTrophy(id, name) {
    if (!id || this.trophies.some(trophy => trophy.id === id)) return false;
    this.trophies.unshift({ id: String(id), name: String(name).slice(0, 80), date: new Date().toISOString() });
    this.trophies = this.trophies.slice(0, 200); this.save(); return true;
  }
  toJSON() {
    const shards = {};
    for (const [device, stats] of Object.entries(this.shards)) shards[device] = { ...stats };
    return { stats: { ...this.stats }, shards, trophies: this.trophies.map(item => ({ ...item })) };
  }
  apply(value = {}) {
    this.shards = normalizeShards(value.shards);
    if (!Object.keys(this.shards).length) this.shards.legacy = normalizeStats(value.stats);
    this.refreshStats();
    this.trophies = Array.isArray(value.trophies) ? value.trophies.filter(item => item && typeof item.id === 'string').slice(0, 200) : [];
    this.save();
  }
  merge(value = {}) {
    let remoteShards = normalizeShards(value.shards);
    if (!Object.keys(remoteShards).length) remoteShards.legacy = normalizeStats(value.stats);
    for (const [device, incoming] of Object.entries(remoteShards)) {
      const current = this.shards[device] || (this.shards[device] = normalizeStats({}));
      for (const key of statKeys) current[key] = Math.max(current[key], incoming[key]);
    }
    this.refreshStats();
    const known = new Set(this.trophies.map(trophy => trophy.id));
    for (const trophy of value.trophies || []) if (trophy && typeof trophy.id === 'string' && !known.has(trophy.id)) { this.trophies.push(trophy); known.add(trophy.id); }
    this.trophies.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    this.trophies = this.trophies.slice(0, 200); this.save();
  }
  deviceShard() { return this.shards[getDeviceId()] || (this.shards[getDeviceId()] = normalizeStats({})); }
  refreshStats() { this.stats = sumShards(this.shards); }
  save() { try { localStorage.setItem(this.key, JSON.stringify(this.toJSON())); } catch { /* Keep the current session playable if storage is full. */ } }
}

function safeCount(value) { return Number.isFinite(Number(value)) ? Math.max(0, Math.min(1_000_000_000, Math.floor(Number(value)))) : 0; }
function normalizeScope(scope) { return scope && scope !== 'guest' ? String(scope).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100) || 'guest' : 'guest'; }
function normalizeStats(value = {}) { return Object.fromEntries(statKeys.map(key => [key, safeCount(value?.[key])])); }
function normalizeShards(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, 100).filter(([id, stats]) => typeof id === 'string').map(([id, stats]) => [id.slice(0, 100), normalizeStats(stats)]));
}
function sumShards(shards) { const total = normalizeStats({}); for (const shard of Object.values(shards)) for (const key of statKeys) total[key] = key === 'bestScore' ? Math.max(total[key], safeCount(shard[key])) : Math.min(1_000_000_000, total[key] + safeCount(shard[key])); return total; }
function getDeviceId() {
  const key = 'field-device-id';
  try {
    let id = localStorage.getItem(key);
    if (!id) { id = globalThis.crypto?.randomUUID?.() || `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; localStorage.setItem(key, id); }
    return id;
  } catch { return 'temporary-device'; }
}
