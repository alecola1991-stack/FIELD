import { TEAM_COUNTRIES } from '../config/teams.js';

// Match ball by competition. Every ball keeps the flat look with a thin black outline; the decoration
// (stripes, stars or the online globe) turns with the ball so its spin is visible.
export const BALL_YELLOW = '#ffd400';

// Two stripes in the colours of each country's flag (league matches).
const FLAG_STRIPES = {
  spain: ['#AA151B', '#AA151B'], england: ['#CE1124', '#FFFFFF'], italy: ['#009246', '#CE2B37'], france: ['#0055A4', '#EF4135'],
  germany: ['#111111', '#DD0000'], argentina: ['#74ACDF', '#FFFFFF'], mexico: ['#006847', '#CE1126'], brazil: ['#009C3B', '#002776'],
  'north-america': ['#3C3B6E', '#D80621'], portugal: ['#006600', '#FF0000'], belgium: ['#111111', '#EF3340'], turkey: ['#E30A17', '#FFFFFF'],
  netherlands: ['#AE1C28', '#21468B'], scotland: ['#005EB8', '#FFFFFF'], 'saudi-arabia': ['#006C35', '#FFFFFF'], colombia: ['#003893', '#CE1126'],
  chile: ['#0039A6', '#D52B1E'], uruguay: ['#0038A8', '#FFFFFF'], austria: ['#ED2939', '#FFFFFF'], switzerland: ['#DA291C', '#FFFFFF'],
};

export function ballStyleFor(fieldTheme = 'arcade', mode = '') {
  if (mode === 'online') return { type: 'online', base: '#FFFFFF' };
  if (fieldTheme === 'champions') return { type: 'stars', base: '#FFFFFF', color: '#1C4FB8' };
  if (fieldTheme === 'copa-libertadores') return { type: 'stripes', base: '#F07A1A', stripes: ['#111111', '#111111'] };
  if (fieldTheme === 'world-cup') return { type: 'stripes', base: '#FFFFFF', stripes: ['#1765A8', '#16924E', '#D83B45'] };
  if (fieldTheme?.startsWith('league-')) {
    const country = TEAM_COUNTRIES.find(item => item.groups.includes(fieldTheme.slice(7)));
    const stripes = FLAG_STRIPES[country?.id];
    if (stripes) return { type: 'stripes', base: BALL_YELLOW, stripes };
  }
  return { type: 'plain', base: BALL_YELLOW };
}

function star(c, x, y, outer) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? outer * .45 : outer; c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
  c.closePath(); c.fill();
}

// Draws the ball body (already translated to its centre) with radius r and the given spin.
export function drawBallBody(c, r, style, spin = 0) {
  c.fillStyle = style.base; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
  if (style.type !== 'plain') {
    c.save(); c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.clip(); c.rotate(spin);
    if (style.type === 'stripes') {
      const count = style.stripes.length, band = r * (count > 2 ? .24 : .3), gap = r * (count > 2 ? .56 : .62);
      style.stripes.forEach((color, i) => { c.fillStyle = color; c.fillRect(-r, (i - (count - 1) / 2) * gap - band / 2, r * 2, band); });
    } else if (style.type === 'stars') {
      c.fillStyle = style.color;
      star(c, 0, 0, r * .34);
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; star(c, Math.cos(a) * r * .68, Math.sin(a) * r * .68, r * .2); }
    } else if (style.type === 'online') {
      // The online globe: outline, equator, parallels and a meridian.
      const g = r * .66; c.strokeStyle = '#1765A8'; c.lineWidth = Math.max(1, r * .1);
      c.beginPath(); c.arc(0, 0, g, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.ellipse(0, 0, g * .45, g, 0, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(-g, 0); c.lineTo(g, 0); c.moveTo(-g * .86, -g * .5); c.lineTo(g * .86, -g * .5); c.moveTo(-g * .86, g * .5); c.lineTo(g * .86, g * .5); c.stroke();
    }
    c.restore();
  }
  c.strokeStyle = '#000000'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
}
