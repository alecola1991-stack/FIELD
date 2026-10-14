import { DEFAULT_MODIFIERS } from '../config/modifiers.js';
export const ONLINE_RULES = DEFAULT_MODIFIERS;
export const ONLINE_MODES = Object.freeze({ ranked: { name: 'Partido Ranked', capacity: 2 }, quick: { name: 'Partido rápido', capacity: 2 }, tournament: { name: 'Torneo', capacity: 4 } });
export function normalizeUsername(value) { return String(value || '').trim().toLowerCase(); }
export function validUsername(value) { return /^[a-z0-9_]{3,20}$/.test(normalizeUsername(value)); }
export function assignedMatch(lobby, userId) { return lobby?.matches?.find(match => match.state === 'playing' && [match.p1, match.p2].includes(userId)) || null; }
export function opponentId(match, userId) { return match.p1 === userId ? match.p2 : match.p1; }
