import { DEFAULT_MODIFIERS } from '../config/modifiers.js';
export const ONLINE_RULES = DEFAULT_MODIFIERS;
export const ONLINE_MODES = Object.freeze({ ranked: { name: 'Partido Ranked', capacity: 2 }, quick: { name: 'Partido rápido', capacity: 2 }, tournament: { name: 'Torneo', capacity: 4 } });
// Seats per room: quick/ranked 2 (1v1) or 4 (2v2); tournaments 4, 6 or 8.
export const ONLINE_SIZES = Object.freeze({ ranked: [2, 4], quick: [2, 4], tournament: [4, 6, 8] });
export function normalizeUsername(value) { return String(value || '').trim().toLowerCase(); }
export function validUsername(value) { return /^[a-z0-9_]{3,20}$/.test(normalizeUsername(value)); }
export function roomSize(room) { return Number(room?.size) || ONLINE_MODES[room?.kind]?.capacity || 2; }
export function isTeamRoom(room) { return room?.kind !== 'tournament' && roomSize(room) === 4; }
// 2v2 matches: left team p1+p3 (p1 hosts), right team p2+p4. Seat order 0..3 = p1, p3, p2, p4.
export function matchSeats(match) { return match?.p3 ? [match.p1, match.p3, match.p2, match.p4] : [match?.p1, match?.p2]; }
export function matchPlayers(match) { return [match?.p1, match?.p2, match?.p3, match?.p4].filter(Boolean); }
export function onLeftTeam(match, userId) { return [match?.p1, match?.p3].includes(userId); }
export function assignedMatch(lobby, userId) { return lobby?.matches?.find(match => match.state === 'playing' && matchPlayers(match).includes(userId)) || null; }
export function opponentId(match, userId) { return onLeftTeam(match, userId) ? match.p2 : match.p1; }
export function wonMatch(match, userId) { return Boolean(match?.winner) && match.winner === (onLeftTeam(match, userId) ? match.p1 : match.p2); }
// Tournament rounds are numbered from the first round of an 8- or 4-leaf bracket.
export function bracketRounds(size) { return size > 4 ? 3 : 2; }
export function roundName(size, round) {
  const fromFinal = bracketRounds(size) - round;
  return fromFinal === 0 ? 'FINAL' : fromFinal === 1 ? 'SEMIFINAL' : 'CUARTOS';
}
