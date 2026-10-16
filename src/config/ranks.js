// Ranked tiers by ELO. Everyone starts at 500 (Amateur); below 500 is still Amateur.
export const RANKS = Object.freeze([
  { id: 'amateur', name: 'Amateur', min: 0, floor: 500, color: '#b9773f', light: '#f0c08e', dark: '#5d3416' },
  { id: 'profesional', name: 'Profesional', min: 550, floor: 550, color: '#93a7bd', light: '#eef4fb', dark: '#3c4a5a' },
  { id: 'experto', name: 'Experto', min: 600, floor: 600, color: '#d9a92c', light: '#fff0b0', dark: '#6b4c06' },
  { id: 'campeon', name: 'Campeón', min: 750, floor: 750, color: '#21b98c', light: '#bdffe9', dark: '#0b5641' },
  { id: 'leyenda', name: 'Leyenda', min: 800, floor: 800, color: '#8f5cf2', light: '#ffd76a', dark: '#3a1c7a' },
]);

const eloOf = value => Math.max(0, Math.floor(Number.isFinite(Number(value)) ? Number(value) : 500));
export function rankIndex(elo) {
  const value = eloOf(elo);
  let index = 0;
  RANKS.forEach((rank, i) => { if (value >= rank.min) index = i; });
  return index;
}
export function rankFor(elo) { return RANKS[rankIndex(elo)]; }

// Position inside the current tier, for progress bars: 0 at the tier floor, 1 at
// the next tier. The top tier has no next one and reports a full bar.
export function rankProgress(elo) {
  const value = eloOf(elo), index = rankIndex(value), rank = RANKS[index], next = RANKS[index + 1] || null;
  if (!next) return { rank, next: null, ratio: 1, from: rank.floor, to: null, elo: value };
  const ratio = Math.max(0, Math.min(1, (value - rank.floor) / (next.min - rank.floor)));
  return { rank, next, ratio, from: rank.floor, to: next.min, elo: value };
}

// Segments for animating an ELO change across tiers. Each segment moves one tier's
// bar from `from` to `to` (0..1); `change` says the badge then switches up or down.
export function rankJourney(before, after) {
  const start = eloOf(before), end = eloOf(after), first = rankIndex(start), last = rankIndex(end);
  if (first === last) return [{ rank: RANKS[first], from: rankProgress(start).ratio, to: rankProgress(end).ratio, change: null }];
  const up = last > first, segments = [{ rank: RANKS[first], from: rankProgress(start).ratio, to: up ? 1 : 0, change: up ? 'up' : 'down' }];
  for (let index = first + (up ? 1 : -1); index !== last; index += up ? 1 : -1) segments.push({ rank: RANKS[index], from: up ? 0 : 1, to: up ? 1 : 0, change: up ? 'up' : 'down' });
  segments.push({ rank: RANKS[last], from: up ? 0 : 1, to: rankProgress(end).ratio, change: null });
  return segments;
}
