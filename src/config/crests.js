// Team crests: our own designs built from combinable templates (shape × pattern × border × crown ×
// detail) in each team's colours. No letters, numbers, logos or images of official crests.
//  - Top flights and national teams: chosen with criteria from their identity (kit pattern, colours,
//    "royal" clubs with a crown, flag crosses, World Cup stars), plus hand-picked designs for the
//    best-known teams.
//  - Lower divisions: a random combination (seeded by the team id, so always the same) in their colours.
// Colours are adjusted so fields, stripes and borders stay distinguishable at small sizes.

export const CREST_SHAPES = Object.freeze(['circle', 'oval', 'square', 'rect', 'shield-round', 'shield-point', 'shield-curve']);
export const CREST_PATTERNS = Object.freeze(['plain', 'hstripes', 'vstripes', 'diagonal', 'diagonal-double', 'cross', 'saltire', 'checks', 'split-v', 'split-h', 'quarters', 'chevron', 'tricolor-v', 'tricolor-h', 'chief', 'pale', 'fess']);
export const CREST_BORDERS = Object.freeze(['thin', 'thick', 'double']);
export const CREST_DETAILS = Object.freeze(['none', 'star', 'disc', 'ring', 'diamond', 'stars']);

import { TEAM_LEAGUES } from './teams.js';

const GOLD = '#E5B93C', WHITE = '#FFFFFF', NAVY = '#14213D';
// First divisions (tier 1): their crests are chosen with criteria; lower tiers get a random combination.
const TOP_LEAGUES = new Set(TEAM_LEAGUES.filter(league => (league.tier ?? 1) === 1).map(league => league.id));

// ---- Colour helpers -----------------------------------------------------------------------------
function rgb(hex) {
  const value = String(hex || '').replace('#', '');
  const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value.padEnd(6, '0').slice(0, 6);
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) || 0);
}
function luminance(hex) {
  const [r, g, b] = rgb(hex).map(v => { const c = v / 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
  return .2126 * r + .7152 * g + .0722 * b;
}
export function contrast(a, b) { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + .05) / (y + .05); }
// The colour of `options` that stands out most against `base` (the first one that is clear enough).
function standout(base, options, minimum = 1.7) {
  for (const option of options) if (option && contrast(base, option) >= minimum) return option;
  return contrast(base, WHITE) >= contrast(base, NAVY) ? WHITE : NAVY;
}

// ---- Seeded random ------------------------------------------------------------------------------
function hash(text) { let h = 2166136261; for (const char of String(text)) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function seeded(text) {
  let a = hash(text);
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (random, items) => items[Math.floor(random() * items.length)];
const weighted = (random, table) => { const total = table.reduce((sum, [, w]) => sum + w, 0); let r = random() * total; for (const [item, w] of table) { r -= w; if (r <= 0) return item; } return table[0][0]; };

// ---- Identity rules -----------------------------------------------------------------------------
const KIT_PATTERN = {
  'vertical-stripes': 'vstripes', 'horizontal-stripes': 'hstripes', sash: 'diagonal', quarters: 'quarters', checkerboard: 'checks',
  'half-vertical': 'split-v', 'half-horizontal': 'split-h', 'tricolor-horizontal': 'tricolor-h', 'tricolor-vertical': 'tricolor-v',
};
// Shapes by football culture (league prefix or national confederation), then a seeded pick.
const SHAPE_STYLE = [
  [/^(bundesliga|liga-3-de|austria|swiss)/, [['circle', 4], ['shield-round', 2], ['square', 1], ['oval', 1]]],
  [/^(serie|italy)/, [['shield-curve', 3], ['oval', 3], ['circle', 2], ['shield-point', 1]]],
  [/^(premier|championship|league-one|scottish)/, [['shield-round', 3], ['shield-point', 3], ['circle', 2], ['shield-curve', 1]]],
  [/^(ligue)/, [['square', 2], ['shield-point', 3], ['circle', 2], ['rect', 1]]],
  [/^(laliga|primera-rfef|segunda-rfef)/, [['shield-round', 3], ['shield-point', 3], ['circle', 2], ['oval', 1], ['shield-curve', 1]]],
  [/^(mls|usl|liga-mx|saudi)/, [['square', 3], ['circle', 2], ['rect', 2], ['shield-point', 2]]],
  [/^(argentina|primera-nacional|brasileirao|colombia|chile|uruguay)/, [['shield-point', 4], ['shield-round', 2], ['circle', 2]]],
  [/^(liga-portugal|belgian|eredivisie|super-lig|tff)/, [['circle', 3], ['shield-point', 2], ['shield-round', 2], ['oval', 1]]],
];
const ROYAL = /\b(real|royal|reale|reial|rcd|koninklijke|king'?s)\b/i;
const ROYAL_IDS = new Set(['laliga-real-madrid', 'laliga-betis', 'laliga-sociedad', 'laliga-espanyol', 'laliga-celta', 'laliga-racing', 'laliga-deportivo',
  'laliga2-mallorca', 'laliga2-valladolid', 'laliga2-sporting', 'laliga2-oviedo', 'europe-spain', 'europe-belgium', 'europe-netherlands', 'europe-denmark', 'europe-sweden', 'europe-norway']);
// Flags and national identity: crosses, saltires, chequers, stripes.
const NATIONAL_PATTERN = {
  'europe-england': 'cross', 'europe-scotland': 'saltire', 'europe-denmark': 'cross', 'europe-sweden': 'cross', 'europe-norway': 'cross', 'europe-finland': 'cross',
  'europe-iceland': 'cross', 'europe-faroe': 'cross', 'europe-switzerland': 'cross', 'europe-georgia': 'cross', 'europe-croatia': 'checks', 'europe-greece': 'hstripes',
  'europe-france': 'tricolor-v', 'europe-italy': 'tricolor-v', 'europe-ireland': 'tricolor-v', 'europe-belgium': 'tricolor-v', 'europe-romania': 'tricolor-v',
  'europe-germany': 'tricolor-h', 'europe-netherlands': 'tricolor-h', 'europe-austria': 'fess', 'europe-hungary': 'tricolor-h', 'europe-poland': 'split-h',
  'europe-ukraine': 'split-h', 'europe-spain': 'fess', 'europe-portugal': 'split-v', 'america-argentina': 'tricolor-h', 'america-uruguay': 'hstripes',
  'america-colombia': 'chief', 'america-mexico': 'tricolor-v', 'america-usa': 'hstripes', 'america-canada': 'pale', 'america-peru': 'pale', 'america-chile': 'chief',
  'america-brazil': 'diamond-field', 'america-jamaica': 'saltire', 'europe-czechia': 'chevron',
};
// World Cup titles: stars over the crest (geometric detail).
const WORLD_CUPS = { 'america-brazil': 5, 'europe-germany': 4, 'europe-italy': 4, 'america-argentina': 3, 'europe-france': 2, 'america-uruguay': 2, 'europe-england': 1, 'europe-spain': 1 };

// Hand-picked designs for well-known teams (our own takes on their colours, not their crests).
const CURATED = {
  'laliga-real-madrid': { shape: 'circle', pattern: 'plain', border: 'double', crown: true, detail: 'ring', colors: ['#F7F7F7', '#3A2A78', GOLD] },
  'laliga-barcelona': { shape: 'shield-point', pattern: 'vstripes', stripes: 5, border: 'thick', detail: 'none', colors: ['#A50044', '#004D98', '#EDBB00'] },
  'laliga-atletico': { shape: 'shield-round', pattern: 'vstripes', stripes: 5, border: 'thick', detail: 'star', colors: ['#D71920', '#FFFFFF', '#1B3A6B'] },
  'laliga-athletic': { shape: 'shield-curve', pattern: 'vstripes', stripes: 5, border: 'double', detail: 'none', colors: ['#E32636', '#FFFFFF', '#171717'] },
  'laliga-sevilla': { shape: 'shield-round', pattern: 'chief', border: 'thick', detail: 'disc', colors: ['#FFFFFF', '#D71920', '#171717'] },
  'laliga-betis': { shape: 'shield-point', pattern: 'vstripes', stripes: 5, border: 'thick', crown: true, detail: 'none', colors: ['#16834A', '#FFFFFF', GOLD] },
  'laliga-valencia': { shape: 'shield-point', pattern: 'split-v', border: 'double', detail: 'diamond', colors: ['#FFFFFF', '#171717', '#F08A24'] },
  'laliga-villarreal': { shape: 'circle', pattern: 'plain', border: 'double', detail: 'disc', colors: ['#FFE500', '#0755A4', '#0755A4'] },
  'laliga-sociedad': { shape: 'circle', pattern: 'vstripes', stripes: 5, border: 'thick', crown: true, detail: 'none', colors: ['#1766AA', '#FFFFFF', GOLD] },
  'laliga-celta': { shape: 'shield-round', pattern: 'plain', border: 'thick', crown: true, detail: 'diamond', colors: ['#8CC7E8', '#D71920', WHITE] },
  'laliga-espanyol': { shape: 'oval', pattern: 'vstripes', stripes: 5, border: 'double', crown: true, detail: 'none', colors: ['#007FC8', '#FFFFFF', GOLD] },
  'laliga-osasuna': { shape: 'shield-point', pattern: 'split-h', border: 'thick', detail: 'none', colors: ['#D71920', '#13294B', GOLD] },
  'laliga-rayo': { shape: 'square', pattern: 'diagonal', border: 'thick', detail: 'none', colors: ['#FFFFFF', '#D71920', '#171717'] },
  'laliga-getafe': { shape: 'shield-curve', pattern: 'checks', border: 'thin', detail: 'none', colors: ['#0053A0', '#FFFFFF', NAVY] },
  'laliga-alaves': { shape: 'shield-round', pattern: 'vstripes', stripes: 3, border: 'double', detail: 'none', colors: ['#1473B8', '#FFFFFF', NAVY] },
  'laliga-elche': { shape: 'shield-point', pattern: 'fess', border: 'thick', detail: 'none', colors: ['#FFFFFF', '#178B55', '#178B55'] },
  'laliga-levante': { shape: 'shield-round', pattern: 'split-v', border: 'thick', detail: 'none', colors: ['#D71920', '#142D4E', GOLD] },
  'laliga-malaga': { shape: 'circle', pattern: 'vstripes', stripes: 5, border: 'thick', detail: 'none', colors: ['#5AADE0', '#FFFFFF', NAVY] },
  'laliga-racing': { shape: 'shield-curve', pattern: 'plain', border: 'double', crown: true, detail: 'disc', colors: ['#FFFFFF', '#147347', '#147347'] },
  'laliga-deportivo': { shape: 'shield-round', pattern: 'vstripes', stripes: 5, border: 'thick', crown: true, detail: 'none', colors: ['#0875BC', '#FFFFFF', GOLD] },
  'premier-liverpool': { shape: 'shield-curve', pattern: 'plain', border: 'double', detail: 'disc', colors: ['#C8102E', '#F6EB61', '#00B2A9'] },
  'premier-man-city': { shape: 'circle', pattern: 'plain', border: 'double', detail: 'star', colors: ['#6CABDD', '#FFFFFF', NAVY] },
  'premier-man-united': { shape: 'shield-point', pattern: 'plain', border: 'thick', detail: 'diamond', colors: ['#DA291C', '#FBE122', '#171717'] },
  'premier-arsenal': { shape: 'shield-round', pattern: 'chief', border: 'thick', detail: 'none', colors: ['#EF0107', '#FFFFFF', GOLD] },
  'premier-chelsea': { shape: 'circle', pattern: 'plain', border: 'double', detail: 'ring', colors: ['#034694', '#FFFFFF', '#DBA111'] },
  'premier-tottenham': { shape: 'oval', pattern: 'plain', border: 'thick', detail: 'disc', colors: ['#FFFFFF', '#132257', '#132257'] },
  'premier-newcastle': { shape: 'circle', pattern: 'vstripes', stripes: 5, border: 'thick', detail: 'none', colors: ['#171717', '#FFFFFF', '#41B6E6'] },
  'serie-a-juventus': { shape: 'oval', pattern: 'vstripes', stripes: 3, border: 'thin', detail: 'none', colors: ['#171717', '#FFFFFF', '#171717'] },
  'serie-a-inter': { shape: 'circle', pattern: 'vstripes', stripes: 5, border: 'double', detail: 'none', colors: ['#0068A8', '#171717', GOLD] },
  'serie-a-milan': { shape: 'oval', pattern: 'vstripes', stripes: 5, border: 'thick', detail: 'none', colors: ['#D71920', '#171717', WHITE] },
  'serie-a-roma': { shape: 'shield-curve', pattern: 'split-h', border: 'thick', detail: 'none', colors: ['#8E1B32', '#E6B64C', '#F5D21B'] },
  'serie-a-napoli': { shape: 'circle', pattern: 'plain', border: 'double', detail: 'ring', colors: ['#1687C9', '#FFFFFF', WHITE] },
  'serie-a-lazio': { shape: 'shield-point', pattern: 'fess', border: 'thick', detail: 'none', colors: ['#87CEEB', '#FFFFFF', NAVY] },
  'bundesliga-bayern': { shape: 'circle', pattern: 'checks', border: 'thick', detail: 'none', colors: ['#D71920', '#0066B2', '#FFFFFF'] },
  'bundesliga-dortmund': { shape: 'circle', pattern: 'plain', border: 'thick', detail: 'disc', colors: ['#FDE100', '#171717', '#171717'] },
  'bundesliga-leverkusen': { shape: 'shield-round', pattern: 'split-h', border: 'thick', detail: 'none', colors: ['#D71920', '#171717', WHITE] },
  'ligue-1-psg': { shape: 'circle', pattern: 'pale', border: 'double', detail: 'none', colors: ['#142D4E', '#D71920', '#FFFFFF'] },
  'ligue-1-marseille': { shape: 'shield-point', pattern: 'plain', border: 'double', detail: 'star', colors: ['#FFFFFF', '#55B8E8', '#55B8E8'] },
  'ligue-1-lyon': { shape: 'square', pattern: 'diagonal', border: 'thick', detail: 'none', colors: ['#FFFFFF', '#D71920', '#1766AA'] },
  'ligue-1-monaco': { shape: 'shield-round', pattern: 'diagonal', border: 'thin', crown: true, detail: 'none', colors: ['#FFFFFF', '#D71920', GOLD] },
};

function topFlight(team, topLeagues) { return team.type === 'national' || topLeagues.has(team.league); }

// The design of a team: { shape, pattern, stripes, border, crown, detail, stars, colors: [field, accent, trim] }.
export function crestDesign(team, { topLeagues = TOP_LEAGUES } = {}) {
  if (!team) return { shape: 'shield-round', pattern: 'plain', border: 'thin', crown: false, detail: 'none', stars: 0, stripes: 5, colors: ['#1B2B48', '#FFFFFF', '#FFFFFF'] };
  const random = seeded(team.id || team.name);
  const primary = team.primary || '#1B2B48', secondary = team.secondary && team.secondary.toLowerCase() !== primary.toLowerCase() ? team.secondary : null;
  const national = team.type === 'national';
  let design;
  if (CURATED[team.id]) design = { stripes: 5, crown: false, detail: 'none', ...CURATED[team.id] };
  else if (topFlight(team, topLeagues)) {
    // Top flights and national teams: from their identity.
    const style = SHAPE_STYLE.find(([pattern]) => pattern.test(team.league || ''))?.[1];
    const shape = national ? weighted(random, [['shield-point', 4], ['shield-curve', 3], ['shield-round', 2], ['circle', 1]]) : weighted(random, style || [['shield-round', 3], ['shield-point', 3], ['circle', 2], ['square', 1], ['oval', 1]]);
    let pattern = national ? NATIONAL_PATTERN[team.id] || KIT_PATTERN[team.kitPattern] || 'plain' : KIT_PATTERN[team.kitPattern] || 'plain';
    // Plain halves read better as a band or a chief on a crest.
    if (pattern === 'split-h' && !national) pattern = pick(random, ['split-h', 'chief', 'fess', 'plain']);
    if (pattern === 'split-v' && !national) pattern = pick(random, ['split-v', 'pale', 'split-v']);
    const crown = ROYAL_IDS.has(team.id) || ROYAL.test(team.name || '');
    const detail = pattern === 'plain' ? pick(random, ['disc', 'ring', 'star', 'diamond']) : weighted(random, [['none', 6], ['disc', 1], ['star', 1], ['diamond', 1]]);
    design = { shape, pattern, stripes: pick(random, [3, 5, 5]), border: weighted(random, [['thick', 3], ['double', 3], ['thin', 1]]), crown, detail };
  } else {
    // Lower divisions: random combination in their colours.
    design = {
      shape: pick(random, CREST_SHAPES), pattern: weighted(random, CREST_PATTERNS.map(item => [item, item === 'plain' ? 1 : 2])),
      stripes: pick(random, [3, 5]), border: pick(random, CREST_BORDERS), crown: ROYAL_IDS.has(team.id) || ROYAL.test(team.name || '') || random() < .06, detail: weighted(random, [['none', 5], ['disc', 1], ['star', 1], ['ring', 1], ['diamond', 1]]),
    };
  }
  if (national && WORLD_CUPS[team.id]) design.stars = WORLD_CUPS[team.id];
  if (design.pattern === 'diamond-field') { design.pattern = 'plain'; design.detail = 'diamond'; }
  // Colours: field, accent (stripes, halves…) and trim (border, crown, details), always distinguishable.
  const [field0, accent0, trim0] = design.colors || [primary, secondary || team.tertiary || null, team.tertiary || null];
  const field = field0;
  const accent = standout(field, [accent0, team.tertiary, WHITE, NAVY], 1.45);
  const trim = standout(field, [trim0, design.pattern === 'plain' ? accent : null, GOLD, WHITE, NAVY], 1.6);
  const trimOnAccent = standout(accent, [trim, GOLD, WHITE, NAVY], 1.35);
  return { ...design, stripes: design.stripes || 5, crown: !!design.crown, stars: design.stars || 0, colors: [field, accent, trim, trimOnAccent] };
}

// ---- SVG ----------------------------------------------------------------------------------------
// viewBox 0 0 100 120: the crown (if any) sits in the top band and the body below it.
function body(shape, top) {
  const b = 116, h = b - top, mid = top + h / 2;
  switch (shape) {
    case 'circle': { const r = Math.min(44, h / 2); return { d: `M50 ${mid - r}a${r} ${r} 0 1 1 0 ${2 * r}a${r} ${r} 0 1 1 0 ${-2 * r}Z`, cx: 50, cy: mid, top: mid - r, bottom: mid + r, left: 50 - r, right: 50 + r }; }
    case 'oval': { const rx = 38, ry = Math.min(50, h / 2); return { d: `M50 ${mid - ry}a${rx} ${ry} 0 1 1 0 ${2 * ry}a${rx} ${ry} 0 1 1 0 ${-2 * ry}Z`, cx: 50, cy: mid, top: mid - ry, bottom: mid + ry, left: 12, right: 88 }; }
    case 'square': { const s = Math.min(84, h), y = mid - s / 2, r = 14; return { d: `M${8 + r} ${y}H${92 - r}Q92 ${y} 92 ${y + r}V${y + s - r}Q92 ${y + s} ${92 - r} ${y + s}H${8 + r}Q8 ${y + s} 8 ${y + s - r}V${y + r}Q8 ${y} ${8 + r} ${y}Z`, cx: 50, cy: mid, top: y, bottom: y + s, left: 8, right: 92 }; }
    case 'rect': { const y = top + 2, r = 16; return { d: `M${14 + r} ${y}H${86 - r}Q86 ${y} 86 ${y + r}V${b - r}Q86 ${b} ${86 - r} ${b}H${14 + r}Q14 ${b} 14 ${b - r}V${y + r}Q14 ${y} ${14 + r} ${y}Z`, cx: 50, cy: (y + b) / 2, top: y, bottom: b, left: 14, right: 86 }; }
    case 'shield-round': { const y = top + 2, side = y + h * .52; return { d: `M10 ${y}H90V${side}C90 ${b - 8} 70 ${b} 50 ${b}C30 ${b} 10 ${b - 8} 10 ${side}Z`, cx: 50, cy: y + h * .46, top: y, bottom: b, left: 10, right: 90 }; }
    case 'shield-curve': { const y = top + 4, side = y + h * .45; return { d: `M10 ${y + 6}Q50 ${y - 8} 90 ${y + 6}V${side}C90 ${b - 22} 66 ${b - 6} 50 ${b}C34 ${b - 6} 10 ${b - 22} 10 ${side}Z`, cx: 50, cy: y + h * .44, top: y - 2, bottom: b, left: 10, right: 90 }; }
    default: { const y = top + 2, side = y + h * .42; return { d: `M10 ${y}H90V${side}C90 ${b - 24} 70 ${b - 10} 50 ${b}C30 ${b - 10} 10 ${b - 24} 10 ${side}Z`, cx: 50, cy: y + h * .42, top: y, bottom: b, left: 10, right: 90 }; }
  }
}
const star = (cx, cy, r) => {
  const points = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; points.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`); }
  return `<polygon points="${points.join(' ')}"/>`;
};
function patternSVG(design, box) {
  const [field, accent, trim] = design.colors, { top, bottom, left, right, cx, cy } = box, h = bottom - top, w = right - left;
  const rect = (x, y, width, height, fill) => `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" fill="${fill}"/>`;
  let out = rect(0, 0, 100, 120, field);
  switch (design.pattern) {
    case 'vstripes': { const n = design.stripes, sw = w / n; for (let i = 1; i < n; i += 2) out += rect(left + i * sw, 0, sw, 120, accent); break; }
    case 'hstripes': { const n = design.stripes, sh = h / n; for (let i = 1; i < n; i += 2) out += rect(0, top + i * sh, 100, sh, accent); break; }
    case 'diagonal': out += `<path d="M${left - 12} ${bottom + 12}L${right + 12} ${top - 12}" stroke="${accent}" stroke-width="${(w * .3).toFixed(1)}"/>`; break;
    case 'diagonal-double': { const o = w * .24; out += `<path d="M${left - 12 - o} ${bottom + 12 - o}L${right + 12 - o} ${top - 12 - o}M${left - 12 + o} ${bottom + 12 + o}L${right + 12 + o} ${top - 12 + o}" stroke="${accent}" stroke-width="${(w * .17).toFixed(1)}"/>`; break; }
    case 'cross': out += rect(cx - 7, 0, 14, 120, accent) + rect(0, cy - 7, 100, 14, accent); break;
    case 'saltire': out += `<path d="M${left - 5} ${top - 5}L${right + 5} ${bottom + 5}M${right + 5} ${top - 5}L${left - 5} ${bottom + 5}" stroke="${accent}" stroke-width="14"/>`; break;
    case 'checks': { const n = 4, sw = w / n, sh = h / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if ((i + j) % 2) out += rect(left + i * sw, top + j * sh, sw + .2, sh + .2, accent); break; }
    case 'split-v': out += rect(50, 0, 50, 120, accent); break;
    case 'split-h': out += rect(0, cy, 100, 120 - cy, accent); break;
    case 'quarters': out += rect(50, 0, 50, cy, accent) + rect(0, cy, 50, 120 - cy, accent); break;
    case 'chevron': out += `<polygon points="${left - 4},${bottom - h * .05} 50,${top + h * .35} ${right + 4},${bottom - h * .05} ${right + 4},${bottom + 20} 50,${top + h * .62} ${left - 4},${bottom + 20}" fill="${accent}"/>`; break;
    case 'tricolor-v': out += rect(left + w / 3, 0, w / 3, 120, accent) + rect(left + 2 * w / 3, 0, 100, 120, trim); break;
    case 'tricolor-h': out += rect(0, top + h / 3, 100, h / 3, accent) + rect(0, top + 2 * h / 3, 100, 120, trim); break;
    case 'chief': out += rect(0, 0, 100, top + h * .3, accent); break;
    case 'pale': out += rect(cx - w * .17, 0, w * .34, 120, accent); break;
    case 'fess': out += rect(0, cy - h * .15, 100, h * .3, accent); break;
    default: break;
  }
  return out;
}
function detailSVG(design, box) {
  const [field, accent, trim, trimOnAccent] = design.colors, { cx, cy, top, bottom } = box, h = bottom - top;
  const onPlain = design.pattern === 'plain', color = onPlain ? trim : trimOnAccent, r = h * .14;
  const ring = `stroke="${standout(color, [field === color ? accent : field, WHITE, NAVY], 1.5)}" stroke-width="2.4"`;
  switch (design.detail) {
    case 'star': return `<g fill="${color}" ${ring} stroke-linejoin="round">${star(cx, cy, r * 1.25)}</g>`;
    case 'disc': return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" ${ring}/>`;
    case 'ring': return `<circle cx="${cx}" cy="${cy}" r="${r * 1.15}" fill="none" stroke="${color}" stroke-width="${(r * .42).toFixed(1)}"/>`;
    case 'diamond': return `<polygon points="${cx},${cy - r * 1.35} ${cx + r},${cy} ${cx},${cy + r * 1.35} ${cx - r},${cy}" fill="${color}" ${ring}/>`;
    default: return '';
  }
}
function crownSVG(color, outline) {
  return `<g fill="${color}" stroke="${outline}" stroke-width="1.6" stroke-linejoin="round"><path d="M28 21L24 6L37 14L50 2L63 14L76 6L72 21Z"/><rect x="27" y="19" width="46" height="6" rx="1.5"/></g><g fill="${outline}"><circle cx="24" cy="6" r="2.2"/><circle cx="50" cy="2.6" r="2.4"/><circle cx="76" cy="6" r="2.2"/></g>`;
}
function starsSVG(count, color, outline) {
  if (!count) return '';
  const gap = 13, start = 50 - (count - 1) * gap / 2;
  return `<g fill="${color}" stroke="${outline}" stroke-width="1.2" stroke-linejoin="round">${Array.from({ length: count }, (_, i) => star(start + i * gap, 6.5, 5.6)).join('')}</g>`;
}

let uid = 0;
const cache = new Map();
// Inline SVG markup of a team crest. `title` is optional (the crest is decorative by default).
export function crestSVG(team, options = {}) {
  const key = team?.id || '-';
  let inner = cache.get(key);
  if (!inner) {
    const design = crestDesign(team, options), [field, accent, trim] = design.colors;
    const top = design.crown ? 22 : design.stars ? 13 : 4, box = body(design.shape, top);
    const width = design.border === 'thick' ? 6.5 : design.border === 'double' ? 4.2 : 3;
    const outline = standout(trim, [NAVY, '#0B1220', WHITE], 2.2);
    let svg = `<defs><clipPath id="§"><path d="${box.d}"/></clipPath></defs>`;
    svg += `<g clip-path="url(#§)">${patternSVG(design, box)}${detailSVG(design, box)}</g>`;
    svg += `<path d="${box.d}" fill="none" stroke="${trim}" stroke-width="${width}" stroke-linejoin="round"/>`;
    if (design.border === 'double') svg += `<path d="${box.d}" fill="none" stroke="${trim}" stroke-width="1.6" transform="translate(${box.cx} ${box.cy}) scale(.84) translate(${-box.cx} ${-box.cy})" vector-effect="non-scaling-stroke"/>`;
    // A thin dark outline keeps light crests readable on light backgrounds.
    svg += `<path d="${box.d}" fill="none" stroke="#0B1220" stroke-opacity=".55" stroke-width="1" transform="translate(${box.cx} ${box.cy}) scale(${1 + width / 200}) translate(${-box.cx} ${-box.cy})"/>`;
    if (design.crown) svg += crownSVG(design.colors[2] === field ? GOLD : trim === WHITE ? GOLD : trim, outline);
    else if (design.stars) svg += starsSVG(design.stars, GOLD, outline);
    inner = svg; cache.set(key, inner);
  }
  const id = `crest${++uid}`;
  const label = options.title ? `<title>${String(options.title).replace(/[<&>"]/g, '')}</title>` : '';
  return `<svg class="team-crest${options.className ? ' ' + options.className : ''}" viewBox="0 -4 100 124" ${options.title ? 'role="img"' : 'aria-hidden="true"'} focusable="false">${label}${inner.replaceAll('§', id)}</svg>`;
}
