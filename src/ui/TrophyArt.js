// Trophy drawings shared by the competition picker, the career mode cabinet and the progress
// screen. Original designs (not copies of the official trophies): each one evokes its competition
// through its metal, proportions and colours. Every read of TROPHY_ART[id] returns a fresh SVG
// with its own gradient ids, so several copies on one page (some hidden) never share definitions.
let serial = 0;

const METALS = {
  silver: [['0', '#7f8ba0'], ['.22', '#f5f8fc'], ['.5', '#c3ccd9'], ['.78', '#fdfdff'], ['1', '#8590a4']],
  gold: [['0', '#9a6a17'], ['.25', '#ffe7a0'], ['.5', '#d9a93b'], ['.78', '#fff1c2'], ['1', '#9a6a17']],
  wood: [['0', '#2b1a0e'], ['.5', '#6a4326'], ['1', '#2b1a0e']],
  dark: [['0', '#151a24'], ['.5', '#343c4d'], ['1', '#151a24']],
};
function defs(id) {
  const grad = (name, stops) => `<linearGradient id="${name}-${id}" x1="0" y1="0" x2="1" y2="0">${stops.map(([offset, color]) => `<stop offset="${offset}" stop-color="${color}"/>`).join('')}</linearGradient>`;
  return `<defs>${Object.entries(METALS).map(([name, stops]) => grad(name, stops)).join('')}<radialGradient id="glow-${id}" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>`;
}

const DRAW = {
  // Silver cup with broad bowl and wide looping handles, on a two-step base.
  champions: f => `
    <rect x="29" y="101" width="42" height="12" rx="2.5" fill="${f.dark}"/><rect x="33" y="95" width="34" height="7" rx="1.5" fill="${f.silver}"/>
    <path d="M45 95 47.5 74h5L55 95Z" fill="${f.silver}"/><ellipse cx="50" cy="74" rx="7" ry="3" fill="${f.silver}"/>
    <path d="M28 33C9 27 6 57 31 62" fill="none" stroke="${f.silver}" stroke-width="5.5" stroke-linecap="round"/>
    <path d="M72 33C91 27 94 57 69 62" fill="none" stroke="${f.silver}" stroke-width="5.5" stroke-linecap="round"/>
    <path d="M24 21h52c0 27-10 45-26 52C34 66 24 48 24 21Z" fill="${f.silver}"/>
    <ellipse cx="50" cy="21" rx="26" ry="4.5" fill="${f.silver}" stroke="#7f8ba0" stroke-width=".8"/>
    <path d="M29 36h42" stroke="#7f8ba0" stroke-width="1.2" opacity=".7"/>
    <path d="M24 21h52c0 27-10 45-26 52C34 66 24 48 24 21Z" fill="${f.glow}"/>`,
  // Silver cup over a tall wooden base with rows of small plaques.
  'copa-libertadores': f => `
    <path d="M27 114h46l-6-30H33Z" fill="${f.wood}"/>
    ${[90, 97, 104].map(y => [37, 46, 55].map(x => `<rect x="${x + (y - 90) * -.12}" y="${y}" width="8" height="4.5" rx=".8" fill="#e9c25a" opacity=".85"/>`).join('')).join('')}
    <rect x="31" y="80" width="38" height="5" rx="1.5" fill="${f.silver}"/>
    <path d="M46 80 47.5 63h5L54 80Z" fill="${f.silver}"/><ellipse cx="50" cy="63" rx="6" ry="2.4" fill="${f.silver}"/>
    <path d="M33 27C21 25 20 43 36 47M67 27C79 25 80 43 64 47" fill="none" stroke="${f.silver}" stroke-width="4" stroke-linecap="round"/>
    <path d="M31 17h38c0 22-7 37-19 44-12-7-19-22-19-44Z" fill="${f.silver}"/>
    <ellipse cx="50" cy="17" rx="19" ry="3.6" fill="${f.silver}" stroke="#7f8ba0" stroke-width=".8"/>
    <path d="m50 26 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8Z" fill="#e9c25a" stroke="#9a6a17" stroke-width=".6"/>
    <path d="M31 17h38c0 22-7 37-19 44-12-7-19-22-19-44Z" fill="${f.glow}"/>`,
  // Gold: two crossed orbits around a small sphere, on a slim column.
  'club-world-cup': f => `
    <rect x="31" y="102" width="38" height="11" rx="2.5" fill="${f.dark}"/><rect x="35" y="96" width="30" height="7" rx="1.5" fill="${f.gold}"/>
    <path d="M44 96 47 64h6l3 32Z" fill="${f.gold}"/>
    <ellipse cx="50" cy="38" rx="27" ry="11" transform="rotate(-28 50 38)" fill="none" stroke="${f.gold}" stroke-width="5"/>
    <ellipse cx="50" cy="38" rx="27" ry="11" transform="rotate(28 50 38)" fill="none" stroke="${f.gold}" stroke-width="5"/>
    <circle cx="50" cy="38" r="10" fill="${f.gold}"/><circle cx="50" cy="38" r="10" fill="${f.glow}"/>
    <path d="M47 64h6l-1-6h-4Z" fill="${f.gold}"/>`,
  // Gold: a globe with meridians on a faceted, flaring column; green bands on the base.
  'world-cup': f => `
    <rect x="31" y="98" width="38" height="15" rx="2.5" fill="${f.gold}"/><rect x="31" y="102" width="38" height="3.4" fill="#1f8a55"/><rect x="31" y="108" width="38" height="2.4" fill="#1f8a55"/>
    <path d="M36 98C40 82 43 72 44 58h12c1 14 4 24 8 40Z" fill="${f.gold}"/>
    <path d="M44.5 60 42 97M50 58v40M55.5 60 58 97" stroke="#9a6a17" stroke-width="1.1" opacity=".55"/>
    <circle cx="50" cy="38" r="21" fill="${f.gold}"/>
    <ellipse cx="50" cy="38" rx="9" ry="21" fill="none" stroke="#9a6a17" stroke-width="1.3" opacity=".7"/>
    <path d="M29.5 32h41M29.5 44h41M50 17v42" stroke="#9a6a17" stroke-width="1.3" opacity=".7"/>
    <circle cx="50" cy="38" r="21" fill="${f.glow}"/>`,
  // Silver: slender urn with flared lip and long thin handles.
  euro: f => `
    <rect x="32" y="103" width="36" height="10" rx="2.5" fill="${f.dark}"/><ellipse cx="50" cy="101" rx="16" ry="4.5" fill="${f.silver}"/>
    <path d="M46 99 47.5 86h5L54 99Z" fill="${f.silver}"/>
    <path d="M42 24C27 26 26 50 38 58M58 24C73 26 74 50 62 58" fill="none" stroke="${f.silver}" stroke-width="3" stroke-linecap="round"/>
    <path d="M36 13h28c-3 6-6 9-6 15 0 13 11 22 11 38 0 11-8 19-19 21-11-2-19-10-19-21 0-16 11-25 11-38 0-6-3-9-6-15Z" fill="${f.silver}"/>
    <ellipse cx="50" cy="13" rx="14" ry="3" fill="${f.silver}" stroke="#7f8ba0" stroke-width=".8"/>
    <path d="M38 64h24" stroke="#7f8ba0" stroke-width="1.1" opacity=".6"/>
    <path d="M36 13h28c-3 6-6 9-6 15 0 13 11 22 11 38 0 11-8 19-19 21-11-2-19-10-19-21 0-16 11-25 11-38 0-6-3-9-6-15Z" fill="${f.glow}"/>`,
  // Silver: deep bowl with scalloped decoration and angular handles, on a wide wooden plinth.
  'copa-america': f => `
    <rect x="22" y="97" width="56" height="16" rx="2.5" fill="${f.wood}"/><rect x="22" y="97" width="56" height="3" fill="${f.silver}"/>
    <rect x="34" y="90" width="32" height="7" rx="1.5" fill="${f.silver}"/>
    <path d="M45 90 47 66h6l2 24Z" fill="${f.silver}"/><ellipse cx="50" cy="78" rx="5" ry="2.2" fill="${f.silver}"/><ellipse cx="50" cy="66" rx="6.5" ry="2.6" fill="${f.silver}"/>
    <path d="M30 26h-9v8l10 14M70 26h9v8L69 48" fill="none" stroke="${f.silver}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M28 19h44c0 24-9 39-22 45-13-6-22-21-22-45Z" fill="${f.silver}"/>
    <ellipse cx="50" cy="19" rx="22" ry="4" fill="${f.silver}" stroke="#7f8ba0" stroke-width=".8"/>
    <path d="M33 40a4.3 4.3 0 0 0 8.5 0 4.3 4.3 0 0 0 8.5 0 4.3 4.3 0 0 0 8.5 0 4.3 4.3 0 0 0 8.5 0" fill="none" stroke="#7f8ba0" stroke-width="1.2"/>
    <path d="M28 19h44c0 24-9 39-22 45-13-6-22-21-22-45Z" fill="${f.glow}"/>`,
  // Gold league cup with a star medallion.
  league: f => `
    <rect x="30" y="101" width="40" height="12" rx="2.5" fill="${f.dark}"/><rect x="41" y="105" width="18" height="4" rx="1" fill="#e9c25a" opacity=".8"/>
    <rect x="34" y="94" width="32" height="8" rx="1.5" fill="${f.gold}"/>
    <path d="M45 94 47.5 72h5L55 94Z" fill="${f.gold}"/><ellipse cx="50" cy="72" rx="6.5" ry="2.6" fill="${f.gold}"/>
    <path d="M30 28C16 27 15 50 34 55M70 28C84 27 85 50 66 55" fill="none" stroke="${f.gold}" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M28 20h44c0 25-9 41-22 48-13-7-22-23-22-48Z" fill="${f.gold}"/>
    <ellipse cx="50" cy="20" rx="22" ry="4" fill="${f.gold}" stroke="#9a6a17" stroke-width=".8"/>
    <circle cx="50" cy="40" r="9.5" fill="#13213d"/><path d="m50 33.5 2 4.2 4.6.6-3.3 3.2.8 4.6-4.1-2.2-4.1 2.2.8-4.6-3.3-3.2 4.6-.6Z" fill="#ffe7a0"/>
    <path d="M28 20h44c0 25-9 41-22 48-13-7-22-23-22-48Z" fill="${f.glow}"/>`,
};

export function trophySvg(id) {
  const draw = DRAW[id] || DRAW.champions, n = `t${++serial}`;
  const fills = { silver: `url(#silver-${n})`, gold: `url(#gold-${n})`, wood: `url(#wood-${n})`, dark: `url(#dark-${n})`, glow: `url(#glow-${n})` };
  return `<svg class="trophy-svg" viewBox="0 0 100 120" role="img" aria-hidden="true">${defs(n)}${draw(fills)}</svg>`;
}

export const TROPHY_IDS = Object.keys(DRAW);
export const TROPHY_ART = Object.defineProperties({}, Object.fromEntries(TROPHY_IDS.map(id => [id, { get: () => trophySvg(id), enumerable: true }])));
