import { WORLD } from '../config/settings.js';

const FIELD_THEMES = {
  training: { grass: '#18352d', stripe: '#ffffff05', line: 'rgba(197,235,215,.31)', net: '#172428', accent: '#8ec8aa' },
  arcade: { grass: '#173b32', stripe: '#ffffff07', line: 'rgba(197,235,215,.34)', net: '#172428', accent: '#82ddb0' },
  champions: { grass: '#142842', stripe: '#92bfff0a', line: 'rgba(194,213,255,.48)', net: '#17233a', accent: '#e4c879' },
  'world-cup': { grass: '#25402f', stripe: '#e7c56c09', line: 'rgba(239,224,181,.42)', net: '#1c3028', accent: '#e7c56c' },
  euro: { grass: '#173653', stripe: '#7ab6ef0a', line: 'rgba(202,226,250,.43)', net: '#12283a', accent: '#7ab6ef' },
  'copa-america': { grass: '#174337', stripe: '#69d2a00a', line: 'rgba(192,239,218,.42)', net: '#122e29', accent: '#69d2a0' },
  'league-laliga': { grass: '#3a3028', stripe: '#ffc9840a', line: 'rgba(255,223,188,.39)', net: '#29211d', accent: '#eaa56b' },
  'league-premier': { grass: '#202d48', stripe: '#9caeff0b', line: 'rgba(205,215,255,.4)', net: '#1a2235', accent: '#9aaeff' },
  'league-serie-a': { grass: '#183648', stripe: '#8cddf00a', line: 'rgba(195,231,245,.4)', net: '#142936', accent: '#70c6e0' },
  'league-ligue-1': { grass: '#283044', stripe: '#bbc7ff09', line: 'rgba(215,222,255,.4)', net: '#202639', accent: '#b9aaff' },
  'league-bundesliga': { grass: '#19382f', stripe: '#d4f2a90a', line: 'rgba(216,242,197,.4)', net: '#152c25', accent: '#c5dc83' },
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); this.dpr = 1; this.scale = 1; this.ox = 0; this.oy = 0; this.particles = [];
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(canvas);
    this.resize();
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect(); this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
    this.canvas.width = Math.round(w * this.dpr); this.canvas.height = Math.round(h * this.dpr);
    this.scale = Math.min(this.canvas.width / WORLD.width, this.canvas.height / WORLD.height);
    this.ox = (this.canvas.width - WORLD.width * this.scale) / 2; this.oy = (this.canvas.height - WORLD.height * this.scale) / 2;
  }
  burst(x, y, color, count = 8, force = 120) {
    for (let i = 0; i < count; i++) { const a = Math.random() * Math.PI * 2, speed = force * (.25 + Math.random() * .75); this.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: .32 + Math.random() * .28, max: .6, size: 1.5 + Math.random() * 2.5, color }); }
  }
  fireBurst(x, y, count = 18, force = 190) {
    const colors = ['#ffef9a', '#ffb33d', '#ff713d', '#ec4938'];
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI + Math.random() * Math.PI, speed = force * (.28 + Math.random() * .72);
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 34, life: .38 + Math.random() * .28, max: .66, size: 2 + Math.random() * 3, color: colors[i % colors.length], fire: true });
    }
  }
  render(game, dt) {
    const c = this.ctx, W = WORLD; c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#0b1115'; c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(this.scale, 0, 0, this.scale, this.ox, this.oy);
    this.drawField(c, game.fieldTheme, game.competitionRound);
    if (game.trajectory) this.drawTrajectory(c, game.ball);
    if (game.shotRangeTimer > 0) this.drawShotRange(c, game.player, game.ball, game.shotRangeTimer);
    if (game.bot) this.drawPlayer(c, game.bot, game.bot.color);
    this.drawPlayer(c, game.player, game.player.color);
    this.drawBall(c, game.ball);
    this.updateParticles(c, dt);
    if (game.goalTimer > 0) { c.fillStyle = `rgba(220,255,235,${Math.min(.075, game.goalTimer * .05)})`; c.fillRect(W.left, W.top, W.right - W.left, W.bottom - W.top); }
  }
  drawField(c, themeName = 'arcade', round = 0) {
    const { left, right, top, bottom, goalTop, goalBottom, goalBack } = WORLD;
    const theme = FIELD_THEMES[themeName] || FIELD_THEMES.arcade;
    const cupMatch = ['champions', 'world-cup', 'euro', 'copa-america'].includes(themeName);
    const importantMatch = cupMatch && round >= 3;
    c.fillStyle = theme.net; c.fillRect(0, 0, WORLD.width, WORLD.height);
    // Low contrast net texture outside the playing area.
    c.fillStyle = theme.net; c.fillRect(goalBack, goalTop, left - goalBack, goalBottom - goalTop); c.fillRect(right, goalTop, WORLD.width - goalBack - right, goalBottom - goalTop);
    c.save(); c.beginPath(); c.rect(left, top, right - left, bottom - top); c.clip();
    c.fillStyle = theme.grass; c.fillRect(left, top, right - left, bottom - top);
    const stripe = (right - left) / 10;
    for (let i = 0; i < 10; i += 2) { c.fillStyle = theme.stripe; c.fillRect(left + i * stripe, top, stripe, bottom - top); }
    c.restore();
    c.strokeStyle = theme.line; c.lineWidth = 2;
    c.strokeRect(left, top, right - left, bottom - top);
    c.beginPath(); c.moveTo(WORLD.width / 2, top); c.lineTo(WORLD.width / 2, bottom); c.stroke();
    c.beginPath(); c.arc(WORLD.width / 2, WORLD.height / 2, WORLD.centerCircleRadius, 0, Math.PI * 2); c.stroke();
    if (cupMatch) {
      const cx = WORLD.width / 2, cy = WORLD.height / 2;
      c.beginPath(); c.arc(cx, cy, WORLD.centerCircleRadius + 7, 0, Math.PI * 2); c.strokeStyle = `${theme.accent}55`; c.lineWidth = importantMatch ? 3 : 1.5; c.stroke();
      c.save(); c.globalAlpha = .28; c.strokeStyle = theme.accent; c.lineWidth = 1.5;
      if (themeName === 'world-cup') { c.beginPath(); c.ellipse(cx, cy, 10, 5, 0, 0, Math.PI * 2); c.ellipse(cx, cy, 5, 10, 0, 0, Math.PI * 2); c.stroke(); }
      else if (themeName === 'euro') { for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 - Math.PI / 2; c.beginPath(); c.arc(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11, 1.7, 0, Math.PI * 2); c.fillStyle = theme.accent; c.fill(); } }
      else if (themeName === 'copa-america') { c.beginPath(); c.moveTo(cx - 12, cy + 7); c.quadraticCurveTo(cx, cy - 12, cx + 12, cy + 7); c.stroke(); c.beginPath(); c.moveTo(cx - 8, cy + 10); c.lineTo(cx + 8, cy + 10); c.stroke(); }
      else { c.beginPath(); c.moveTo(cx - 8, cy - 6); c.lineTo(cx + 8, cy - 6); c.moveTo(cx - 6, cy); c.lineTo(cx + 6, cy); c.moveTo(cx - 4, cy + 6); c.lineTo(cx + 4, cy + 6); c.stroke(); }
      c.restore();
    }
    c.beginPath(); c.arc(WORLD.width / 2, WORLD.height / 2, 3, 0, Math.PI * 2); c.fillStyle = theme.accent; c.fill();
    // Simple penalty areas and goal boxes.
    c.strokeRect(left, WORLD.height / 2 - 128, 115, 256); c.strokeRect(left, WORLD.height / 2 - 72, 44, 144);
    c.strokeRect(right - 115, WORLD.height / 2 - 128, 115, 256); c.strokeRect(right - 44, WORLD.height / 2 - 72, 44, 144);
    c.fillStyle = theme.accent + '66'; c.beginPath(); c.arc(left + 76, WORLD.height / 2, 2.5, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(right - 76, WORLD.height / 2, 2.5, 0, Math.PI * 2); c.fill();
    c.strokeStyle = theme.accent + '88'; c.lineWidth = 3; c.strokeRect(goalBack, goalTop, left - goalBack, goalBottom - goalTop); c.strokeRect(right, goalTop, WORLD.width - goalBack - right, goalBottom - goalTop);
    c.strokeStyle = theme.accent; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(left, goalTop); c.lineTo(left, goalBottom); c.moveTo(right, goalTop); c.lineTo(right, goalBottom); c.stroke(); c.lineCap = 'butt';
    c.fillStyle = theme.accent; for (const x of [left, right]) for (const y of [goalTop, goalBottom]) { c.beginPath(); c.arc(x, y, WORLD.goalPostRadius, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = theme.accent + 'a0'; c.font = '9px "DM Mono",monospace'; c.textAlign = 'center'; c.fillText('HOME', (goalBack + left) / 2, goalTop - 8); c.fillText('AWAY', (right + WORLD.width - goalBack) / 2, goalTop - 8);
  }
  smooth(entity) {
    if (entity._rx === undefined) { entity._rx = entity.x; entity._ry = entity.y; }
    const blend = .33; entity._rx += (entity.x - entity._rx) * blend; entity._ry += (entity.y - entity._ry) * blend;
    return [entity._rx, entity._ry];
  }
  drawPlayer(c, player, color) {
    const [x, y] = this.smooth(player), r = player.radius, kick = player.kickScale || 0;
    c.save(); c.translate(x, y);
    c.fillStyle = '#0005'; c.beginPath(); c.ellipse(2, 8, r * 1.05, r * .82, 0, 0, Math.PI * 2); c.fill();
    c.scale(1 + kick * .18, 1 - kick * .1);
    c.shadowColor = color + '55'; c.shadowBlur = 15;
    const grad = c.createRadialGradient(-r * .35, -r * .42, 2, 0, 0, r * 1.2); grad.addColorStop(0, lighten(color)); grad.addColorStop(.52, color); grad.addColorStop(1, shade(color));
    c.fillStyle = grad; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
    if (player.secondaryColor) {
      // Paint a true semicircle instead of a clipped rectangle, avoiding
      // square color bleed on Canvas implementations with different clip edges.
      c.fillStyle = player.secondaryColor; c.beginPath(); c.moveTo(0, -r);
      c.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); c.lineTo(0, r); c.closePath(); c.fill();
    }
    c.strokeStyle = '#ffffff70'; c.lineWidth = 1.5; c.stroke();
    c.font = '700 15px "DM Mono",monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 2.5; c.lineJoin = 'round'; c.strokeStyle = 'rgba(5,12,10,.8)'; c.strokeText(String(player.number), 0, 1);
    c.fillStyle = readable(color); c.fillText(String(player.number), 0, 1);
    c.restore();
    c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.font = '600 10px "DM Mono",monospace'; c.fillStyle = '#eaf4ed'; c.shadowColor = '#07100c'; c.shadowBlur = 5; c.fillText(player.name.toUpperCase(), x, y - r - 12); c.shadowBlur = 0;
  }
  drawBall(c, ball) {
    const [x, y] = this.smooth(ball), r = ball.radius;
    c.save(); c.translate(x, y); c.fillStyle = '#0007'; c.beginPath(); c.ellipse(2, 5, r * 1.08, r * .76, 0, 0, Math.PI * 2); c.fill();
    c.rotate(ball.spin); c.scale(1 + ball.kickScale * .16, 1 - ball.kickScale * .12);
    c.shadowColor = '#e9f4ee70'; c.shadowBlur = 9; c.fillStyle = '#e8eee9'; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
    c.fillStyle = '#23352d'; c.beginPath(); c.arc(0, 0, 3.3, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; c.beginPath(); c.arc(Math.cos(a) * 7, Math.sin(a) * 7, 2.1, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }
  drawTrajectory(c, ball) {
    const speed = Math.hypot(ball.vx, ball.vy); if (speed < 35) return;
    const drag = .72, t = Math.min(1.25, Math.log(1 + speed * drag / 95) / drag), steps = 18;
    c.beginPath();
    for (let i = 0; i <= steps; i++) { const time = t * i / steps, x = ball.x + ball.vx * (1 - Math.exp(-drag * time)) / drag, y = ball.y + ball.vy * (1 - Math.exp(-drag * time)) / drag; if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); }
    c.setLineDash([4, 7]); c.lineWidth = 2; c.strokeStyle = 'rgba(220,245,229,.33)'; c.stroke(); c.setLineDash([]);
  }
  drawShotRange(c, player, ball, timer) {
    const [x, y] = this.smooth(player), radius = player.radius + ball.radius + 37;
    c.save(); c.globalAlpha = Math.min(.72, timer * 1.7); c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255,150,75,.055)'; c.fill(); c.setLineDash([5, 6]); c.lineWidth = 2;
    c.strokeStyle = '#ffc27c99'; c.stroke(); c.setLineDash([]); c.restore();
  }
  updateParticles(c, dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) { const p = this.particles[i]; p.life -= dt; if (p.life <= 0) { this.particles.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .92; p.vy = p.vy * .92 - (p.fire ? 24 : 0) * dt; c.globalAlpha = Math.min(1, p.life / p.max); c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.fire ? p.size * (.55 + p.life / p.max * .45) : p.size, 0, Math.PI * 2); c.fill(); }
    c.globalAlpha = 1;
  }
}
function shade(hex) { const n = parseInt(hex.slice(1), 16); const r = Math.round(((n >> 16) & 255) * .63), g = Math.round(((n >> 8) & 255) * .63), b = Math.round((n & 255) * .63); return `rgb(${r},${g},${b})`; }
function lighten(hex) { const n = parseInt(hex.slice(1), 16); const f = x => Math.round(x + (255 - x) * .28); return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`; }
function readable(hex) { const n = parseInt(hex.slice(1), 16), lum = .299 * ((n >> 16) & 255) + .587 * ((n >> 8) & 255) + .114 * (n & 255); return lum > 145 ? '#0b1710' : '#f5fff8'; }
