const BASE_STORAGE_KEY = 'field-progression';
const MAX_LEVEL = 100;
const WIN_XP = 100;

export class Progression {
  constructor(scope = 'guest') {
    this.scope = normalizeScope(scope);
    this.load();
  }

  get storageKey() { return this.scope === 'guest' ? BASE_STORAGE_KEY : `${BASE_STORAGE_KEY}:${this.scope}`; }

  load() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(this.storageKey) || '{}') || {}; } catch { /* Ignore broken local data. */ }
    this.level = clamp(Math.floor(Number(saved.level) || 1), 1, MAX_LEVEL);
    this.xp = Math.max(0, Math.floor(Number(saved.xp) || 0));
    this.wins = Math.max(0, Math.floor(Number(saved.wins) || 0));
    if (this.level === MAX_LEVEL) this.xp = 0;
    else this.xp = Math.min(this.xp, this.xpForNextLevel() - 1);
  }

  setScope(scope) { this.scope = normalizeScope(scope); this.load(); }
  toJSON() { return { level: this.level, xp: this.xp, wins: this.wins }; }
  apply(value = {}) {
    this.level = clamp(Math.floor(Number(value.level) || 1), 1, MAX_LEVEL);
    this.xp = Math.max(0, Math.floor(Number(value.xp) || 0));
    this.wins = Math.max(0, Math.floor(Number(value.wins) || 0));
    if (this.level === MAX_LEVEL) this.xp = 0;
    else this.xp = Math.min(this.xp, this.xpForNextLevel() - 1);
    this.save();
  }
  merge(value = {}) {
    const localTotal = totalXp(this.level, this.xp), remoteLevel = clamp(Math.floor(Number(value.level) || 1), 1, MAX_LEVEL);
    const remoteXp = Math.max(0, Math.floor(Number(value.xp) || 0));
    const remoteTotal = totalXp(remoteLevel, remoteXp);
    if (remoteTotal > localTotal) this.apply({ level: remoteLevel, xp: remoteXp, wins: Math.max(this.wins, Number(value.wins) || 0) });
    else this.wins = Math.max(this.wins, Math.floor(Number(value.wins) || 0));
    this.save();
  }

  static get maxLevel() { return MAX_LEVEL; }
  static get winReward() { return WIN_XP; }
  xpForNextLevel() { return this.level >= MAX_LEVEL ? 0 : 100 + this.level * 20; }
  progressRatio() { const need = this.xpForNextLevel(); return need === 0 ? 1 : this.xp / need; }

  awardWin() {
    this.wins++;
    let gained = this.level === MAX_LEVEL ? 0 : WIN_XP;
    const oldLevel = this.level;
    this.xp += gained;
    while (this.level < MAX_LEVEL && this.xp >= this.xpForNextLevel()) {
      this.xp -= this.xpForNextLevel();
      this.level++;
    }
    if (this.level === MAX_LEVEL) this.xp = 0;
    this.save();
    return { gained, oldLevel, level: this.level, leveledUp: this.level > oldLevel, xp: this.xp, next: this.xpForNextLevel(), wins: this.wins };
  }

  save() {
    try { localStorage.setItem(this.storageKey, JSON.stringify(this.toJSON())); } catch { /* Progress still works for the current session. */ }
  }
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function totalXp(level, xp) { let total = Math.max(0, Number(xp) || 0); for (let current = 1; current < clamp(level, 1, MAX_LEVEL); current++) total += 100 + current * 20; return total; }
function normalizeScope(scope) { return scope && scope !== 'guest' ? String(scope).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100) || 'guest' : 'guest'; }
