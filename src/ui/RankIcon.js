import { rankFor, RANKS } from '../config/ranks.js';

// Original badge for each ELO tier: a shield that gets more ornate with each rank
// (chevrons → star → laurels → crown and wings). Flat colours only, so the same
// SVG can appear many times on a page without gradient id clashes.
const SHIELD = 'M24 5 L40 10 V23 C40 33 33 40 24 43.5 C15 40 8 33 8 23 V10 Z';
const INNER = 'M24 9 L36.5 13 V23 C36.5 31 31 36.6 24 39.4 C17 36.6 11.5 31 11.5 23 V13 Z';

function star(cx, cy, outer, inner = outer * .45, points = 5) {
  const coords = [];
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 ? inner : outer, angle = -Math.PI / 2 + i * Math.PI / points;
    coords.push(`${(cx + Math.cos(angle) * radius).toFixed(2)},${(cy + Math.sin(angle) * radius).toFixed(2)}`);
  }
  return `<polygon points="${coords.join(' ')}"/>`;
}
const leaf = (x, y, angle, color) => `<ellipse cx="${x}" cy="${y}" rx="2.1" ry="4.3" transform="rotate(${angle} ${x} ${y})" fill="${color}"/>`;

const EMBLEMS = {
  amateur: rank => `<path d="M16 28 L24 21 L32 28" fill="none" stroke="${rank.light}" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  profesional: rank => `<g fill="none" stroke="${rank.light}" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 23 L24 16.5 L32 23"/><path d="M16 31 L24 24.5 L32 31"/></g>`,
  experto: rank => `<g fill="${rank.light}" stroke="${rank.dark}" stroke-width=".8" stroke-linejoin="round">${star(24, 24.5, 9.5)}</g>`,
  campeon: rank => `<g>${[[14.6, 25, -18], [16, 30.6, -42], [19.6, 34.6, -68]].map(([x, y, a]) => leaf(x, y, a, rank.light) + leaf(48 - x, y, -a, rank.light)).join('')}</g>
    <g fill="${rank.light}" stroke="${rank.dark}" stroke-width=".8" stroke-linejoin="round">${star(24, 21.5, 6.8)}</g>`,
  leyenda: rank => `<g fill="${rank.light}" stroke="${rank.dark}" stroke-width=".8" stroke-linejoin="round">${star(24, 25, 8.5)}</g>`,
};
// Extras for the top tiers: wings behind the shield, crowns in front of it.
const BEHIND = {
  leyenda: rank => `<g fill="${rank.color}" stroke="${rank.dark}" stroke-width="1" stroke-linejoin="round">
      <path d="M8.5 15 L1.5 12.5 L3.5 18.5 L1 21.5 L5.5 23 L4 27.5 L9 26.5 Z"/>
      <path d="M39.5 15 L46.5 12.5 L44.5 18.5 L47 21.5 L42.5 23 L44 27.5 L39 26.5 Z"/>
    </g>`,
};
const CROWN = (rank, scale) => `<path transform="translate(24 0) scale(${scale}) translate(-24 0)" d="M16.5 9.4 L18 2.2 L21.4 6.2 L24 1 L26.6 6.2 L30 2.2 L31.5 9.4 Z" fill="${rank.light}" stroke="${rank.dark}" stroke-width="1.1" stroke-linejoin="round"/>`;
const FRONT = { campeon: rank => CROWN(rank, .75), leyenda: rank => CROWN(rank, 1) };

export function rankIconSvg(rankOrElo, size = 22) {
  const rank = typeof rankOrElo === 'object' ? rankOrElo : rankFor(rankOrElo);
  const rim = rank.id === 'leyenda' ? rank.light : rank.dark;
  return `<svg class="rank-icon rank-${rank.id}" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">`
    + (BEHIND[rank.id]?.(rank) || '')
    + `<path d="${SHIELD}" fill="${rank.dark}" stroke="${rim}" stroke-width="1.6" stroke-linejoin="round"/>`
    + `<path d="${INNER}" fill="${rank.color}"/>`
    + `<path d="M24 9 L36.5 13 V20 C31 18 17 18 11.5 20 V13 Z" fill="#ffffff" opacity=".16"/>`
    + EMBLEMS[rank.id](rank)
    + (FRONT[rank.id]?.(rank) || '')
    + '</svg>';
}

// Small inline badge for names (rooms, matches, leaderboard, HUD).
export function rankBadge(elo, { size = 18, withName = false } = {}) {
  const rank = rankFor(elo);
  const badge = document.createElement('span');
  badge.className = `rank-badge rank-${rank.id}`;
  badge.title = `Rango ${rank.name} · ${Math.round(Number(elo) || 500)} ELO`;
  badge.setAttribute('aria-label', `Rango ${rank.name}`);
  badge.innerHTML = rankIconSvg(rank, size) + (withName ? `<span class="rank-name">${rank.name}</span>` : '');
  return badge;
}

export { RANKS };
