import { MISSION_TIERS, createMission, advanceMission, describeMission, templateOf } from './Missions.js';

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
    this.missions = normalizeMissions(saved.missions);
    this.missionBoard = normalizeBoard(saved.missionBoard);
    this.save(); // Persist the normalized profile without retired economy data.
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
  // Active missions, one per tier; missing tiers get a new mission for the player's level.
  activeMissions(level = 1) {
    const board = this.missionBoard; let changed = false;
    for (const tier of MISSION_TIERS) {
      if (board.active.some(mission => mission.tier === tier.id)) continue;
      board.active.push(createMission(tier.id, { level, completed: board.done[tier.id] || 0, seq: ++board.seq, random: this.random || Math.random })); changed = true;
    }
    board.active.sort((a, b) => MISSION_TIERS.findIndex(tier => tier.id === a.tier) - MISSION_TIERS.findIndex(tier => tier.id === b.tier));
    if (changed) this.save();
    return board.active.map(describeMission);
  }
  // One finished match. Returns the completed missions (with their XP) and the new ones that replace them.
  processMissionEvent(event = {}, level = 1) {
    this.activeMissions(level);
    const board = this.missionBoard, completed = [], added = [];
    board.active = board.active.map(mission => {
      if (!advanceMission(mission, event)) return mission;
      completed.push(describeMission(mission));
      board.done[mission.tier] = (board.done[mission.tier] || 0) + 1;
      const exclude = [mission.template, ...board.active.map(item => item.template)];
      const next = createMission(mission.tier, { level, completed: board.done[mission.tier], exclude, seq: ++board.seq, random: this.random || Math.random });
      added.push(describeMission(next));
      return next;
    });
    this.refreshStats(); this.save();
    return Object.assign(completed, { added });
  }
  missionsCompleted() { return Object.values(this.missionBoard.done).reduce((sum, value) => sum + value, 0); }
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
    return { stats: { ...this.stats }, shards, trophies: this.trophies.map(item => ({ ...item })), missions: structuredClone(this.missions), missionBoard: structuredClone(this.missionBoard) };
  }
  apply(value = {}) {
    this.shards = normalizeShards(value.shards);
    if (!Object.keys(this.shards).length) this.shards.legacy = normalizeStats(value.stats);
    this.refreshStats();
    this.trophies = Array.isArray(value.trophies) ? value.trophies.filter(item => item && typeof item.id === 'string').slice(0, 200) : [];
    this.missions = normalizeMissions(value.missions);
    this.missionBoard = normalizeBoard(value.missionBoard);
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
    const incomingMissions = normalizeMissions(value.missions);
    for (const [id, incoming] of Object.entries(incomingMissions)) {
      const current = this.missions[id] || { progress: 0, completed: false };
      this.missions[id] = { progress: Math.max(current.progress, incoming.progress), completed: current.completed || incoming.completed };
    }
    // Mission board: the one with more completed missions wins; on a tie, keep ours with the best progress.
    const incomingBoard = normalizeBoard(value.missionBoard), total = board => Object.values(board.done).reduce((sum, n) => sum + n, 0);
    if (total(incomingBoard) > total(this.missionBoard)) this.missionBoard = incomingBoard;
    else if (total(incomingBoard) === total(this.missionBoard)) {
      for (const mission of this.missionBoard.active) {
        const match = incomingBoard.active.find(item => item.uid === mission.uid && item.template === mission.template);
        if (match) mission.progress = Math.max(mission.progress, match.progress);
      }
    }
    this.refreshStats(); this.save();
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
  return Object.fromEntries(Object.entries(value).slice(0, 100).filter(([id, stats]) => typeof id === 'string' && !id.startsWith('promo:') && !id.startsWith('mission:')).map(([id, stats]) => [id.slice(0, 100), normalizeStats(stats)]));
}
function normalizeMissions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, 500).filter(([id, state]) => typeof id === 'string' && state && typeof state === 'object').map(([id, state]) => [id.slice(0, 120), { progress: safeCount(state.progress), completed: state.completed === true }]));
}
function normalizeBoard(value) {
  const board = { seq: 0, done: {}, active: [] };
  if (!value || typeof value !== 'object') return board;
  board.seq = safeCount(value.seq);
  for (const tier of MISSION_TIERS) board.done[tier.id] = safeCount(value.done?.[tier.id]);
  const seen = new Set();
  for (const mission of Array.isArray(value.active) ? value.active : []) {
    if (!mission || !templateOf(mission.template) || templateOf(mission.template).tier !== mission.tier || seen.has(mission.tier)) continue;
    seen.add(mission.tier);
    const goal = Math.max(1, safeCount(mission.goal));
    board.active.push({ uid: String(mission.uid || '').slice(0, 40), tier: mission.tier, template: mission.template, goal, xp: safeCount(mission.xp), progress: Math.min(goal, safeCount(mission.progress)) });
  }
  return board;
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
