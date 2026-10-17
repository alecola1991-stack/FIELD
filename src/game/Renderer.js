import { WORLD } from '../config/settings.js';
import { FEDERATION_LEAGUE_IDS } from '../config/teams.js';
import { Ball } from './Ball.js';
import { predictShot, shotRangeRadius, resolveBallWalls, isGoal, curveFor, netPressDepth } from './Physics.js';

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
  'league-argentina': { grass: '#17466d', stripe: '#eaf6ff0a', line: 'rgba(225,241,255,.42)', net: '#102b43', accent: '#82c9f0' },
  'league-liga-mx': { grass: '#173b31', stripe: '#ffffff08', line: 'rgba(235,245,225,.4)', net: '#122c24', accent: '#e4c45d' },
  'league-brasileirao': { grass: '#16442e', stripe: '#d8f2a90a', line: 'rgba(216,242,197,.4)', net: '#102c20', accent: '#79d39a' },
  'league-mls': { grass: '#1b3541', stripe: '#9cd8ee0a', line: 'rgba(215,239,247,.4)', net: '#142731', accent: '#8ccfe3' },
  'league-liga-portugal': { grass: '#174037', stripe: '#ffffff08', line: 'rgba(230,246,235,.4)', net: '#102d26', accent: '#81d2a5' },
  'league-belgian-pro': { grass: '#3b2731', stripe: '#f1b5c008', line: 'rgba(249,222,229,.4)', net: '#291b23', accent: '#e8aabd' },
  'league-super-lig': { grass: '#1d383d', stripe: '#ffffff08', line: 'rgba(224,240,242,.4)', net: '#13282d', accent: '#87c9d3' },
  'copa-libertadores': { grass: '#183e36', stripe: '#d0a4600a', line: 'rgba(235,220,188,.42)', net: '#112d29', accent: '#d6a25b' },
  'club-world-cup': { grass: '#23364c', stripe: '#b4d7ff09', line: 'rgba(221,236,251,.42)', net: '#18283a', accent: '#a6c9ec' },
};
// Primera and Segunda RFEF groups share one theme.
const RFEF_THEME = { grass: '#2b3324', stripe: '#f2d6a00a', line: 'rgba(244,228,198,.39)', net: '#1f2419', accent: '#d8b46a' };
for (const id of FEDERATION_LEAGUE_IDS) FIELD_THEMES[`league-${id}`] = RFEF_THEME;

// Vivid pitch: green grass with a mown-stripe pattern and a grass-blade texture; lines and goals are white.
const hsl = (h, s, l, a = 1) => `hsla(${h.toFixed(1)},${(Math.max(0, Math.min(1, s)) * 100).toFixed(1)}%,${(Math.max(0, Math.min(1, l)) * 100).toFixed(1)}%,${a})`;
// Every pitch is grass green; the more important the competition, the lighter the green
// (a first division is lighter than Primera RFEF, which is lighter than Segunda RFEF).
const PITCH_GREEN = [
  [/^(champions|world-cup|club-world-cup)$/, .45],
  [/^(euro|copa-america|copa-libertadores)$/, .425],
  [/^league-(laliga|premier|serie-a|ligue-1|bundesliga)$/, .40],
  [/^(arcade)$/, .385],
  [/^league-(argentina|liga-mx|brasileirao|mls|liga-portugal|belgian-pro|super-lig)$/, .37],
  [/^(training)$/, .35],
  [/^league-(laliga2|championship|serie-b|ligue-2|bundesliga-2)$/, .33],
  [/^league-primera-rfef/, .295],
  [/^league-segunda-rfef/, .26],
];
function pitchGreen(themeName = 'arcade') {
  const l = PITCH_GREEN.find(([pattern]) => pattern.test(themeName))?.[1] ?? .385;
  // Darker pitches keep a bit less saturation so they read as deep grass, not neon.
  return { h: 132, s: Math.min(.47, .35 + (l - .26) * .9), l };
}
// Small deterministic random so the texture is identical every time it is drawn.
function seeded(seed) { let value = seed >>> 0 || 1; return () => (value = (value * 1664525 + 1013904223) >>> 0) / 4294967296; }
const PITCH_LINE = 'rgba(255,255,255,.88)';
export const BALL_COLOR = '#ffd400';

const VIEW_TOP = 25, VIEW_BOTTOM = WORLD.height - 25; // reachable band of the world
const TOUCH_CONTROLS_HEIGHT = 176; // css px kept clear for the portrait D-pad and kick button

export class Renderer {
  constructor(canvas) {
    this.fieldCache = document.createElement('canvas'); this.fieldCache.width = WORLD.width; this.fieldCache.height = WORLD.height;
    this.fieldCacheContext = this.fieldCache.getContext('2d', { alpha: false });
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); this.dpr = 1; this.scale = 1; this.ox = 0; this.oy = 0; this.particles = [];
    this.rotated = false; this.allowRotate = true;
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(canvas);
    this.resize();
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect(); this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
    this.canvas.width = Math.round(w * this.dpr); this.canvas.height = Math.round(h * this.dpr);
    // Frame only the band bodies can reach (players may step half a centre-circle
    // radius beyond the touchlines), not the empty world margin above and below.
    // Portrait screens (phones held upright) rotate the pitch so it fills the
    // height: the attacked goal (+x) points up. On touch layouts the bottom of
    // the canvas is reserved for the on-screen controls so they never cover it.
    const cw = this.canvas.width, ch = this.canvas.height, viewH = VIEW_BOTTOM - VIEW_TOP;
    this.rotated = this.allowRotate && ch > cw * 1.1;
    if (this.rotated) {
      const touch = window.matchMedia?.('(pointer:coarse), (max-width:700px)').matches;
      const usable = Math.max(ch * .55, ch - (touch ? TOUCH_CONTROLS_HEIGHT * this.dpr : 0));
      this.scale = Math.min(cw / viewH, usable / WORLD.width);
      this.ox = (cw - viewH * this.scale) / 2; this.oy = Math.max(0, (usable - WORLD.width * this.scale) / 2);
    } else {
      this.scale = Math.min(cw / WORLD.width, ch / viewH);
      this.ox = (cw - WORLD.width * this.scale) / 2; this.oy = (ch - viewH * this.scale) / 2;
    }
  }
  setAllowRotate(allow) { if (this.allowRotate !== !!allow) { this.allowRotate = !!allow; this.resize(); } }
  applyWorldTransform(c) {
    const s = this.scale;
    if (this.rotated) c.setTransform(0, -s, s, 0, this.ox - VIEW_TOP * s, this.oy + WORLD.width * s);
    else c.setTransform(s, 0, 0, s, this.ox, this.oy - VIEW_TOP * s);
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
    this.renderBlend = 1 - Math.exp(-24 * (dt > 0 ? Math.min(dt, .05) : 1 / 60));
    this.world = game.world || WORLD;
    // Fill the spare canvas with the pitch surround colour: no black bands.
    const c = this.ctx, W = this.world; c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = (FIELD_THEMES[game.fieldTheme] || FIELD_THEMES.arcade).net; c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.applyWorldTransform(c);
    if (this.fieldCacheContext) {
      const key = `${game.fieldTheme}|${game.competitionRound}|${W.goalTop}|${W.goalBottom}|${W.goalBack}|${this.rotated}`;
      if (key !== this.fieldCacheKey) { this.drawField(this.fieldCacheContext, game.fieldTheme, game.competitionRound); this.fieldCacheKey = key; }
      c.drawImage(this.fieldCache, 0, 0);
    } else this.drawField(c, game.fieldTheme, game.competitionRound);
    this.drawNets(c, game.ball, dt);
    if (game.trajectory) this.drawTrajectory(c, game.ball);
    if (game.shotRangeTimer > 0) this.drawShotRange(c, game.player, game.ball, game.shotRangeTimer);
    const ballPosition = this.smooth(game.ball);
    if (game.shotPreview) this.drawShotPreview(c, game.player, game.ball, ballPosition, game.curveAim);
    if (game.bot) this.drawPlayer(c, game.bot, game.bot.color);
    for (const other of game.others || []) this.drawPlayer(c, other, other.color);
    // 2v2: a ring under your own player tells you apart from your teammate.
    if (game.others?.length) this.drawLocalMarker(c, game.player);
    this.drawPlayer(c, game.player, game.player.color);
    this.drawBall(c, game.ball, ballPosition);
    this.updateParticles(c, dt);
    if (game.goalTimer > 0) {
      c.fillStyle = `rgba(220,255,235,${Math.min(.075, game.goalTimer * .05)})`; c.fillRect(W.left, W.top, W.right - W.left, W.bottom - W.top);
    }
    if (game.replay) {
      // Replay look: slightly darker pitch with a thin broadcast-style frame.
      c.fillStyle = 'rgba(6,12,28,.16)'; c.fillRect(W.left, W.top, W.right - W.left, W.bottom - W.top);
      c.strokeStyle = 'rgba(255,214,120,.55)'; c.lineWidth = 3; c.strokeRect(W.left - 6, W.top - 6, W.right - W.left + 12, W.bottom - W.top + 12);
    }
  }
  drawField(c, themeName = 'arcade', round = 0) {
    const world = this.world || WORLD;
    const { left, right, top, bottom, goalTop, goalBottom, goalBack } = world;
    const theme = FIELD_THEMES[themeName] || FIELD_THEMES.arcade;
    const cupMatch = ['champions', 'world-cup', 'euro', 'copa-america'].includes(themeName);
    const importantMatch = cupMatch && round >= 3;
    c.fillStyle = theme.net; c.fillRect(0, 0, world.width, world.height);
    // Low contrast net texture outside the playing area.
    c.fillStyle = theme.net; c.fillRect(goalBack, goalTop, left - goalBack, goalBottom - goalTop); c.fillRect(right, goalTop, world.width - goalBack - right, goalBottom - goalTop);
    c.save(); c.beginPath(); c.rect(left, top, right - left, bottom - top); c.clip();
    const grass = pitchGreen(themeName);
    c.fillStyle = hsl(grass.h, grass.s, grass.l); c.fillRect(left, top, right - left, bottom - top);
    // Mown stripes: alternate lighter and darker bands.
    const stripe = (right - left) / 12;
    for (let i = 0; i < 12; i++) { c.fillStyle = i % 2 ? hsl(grass.h, grass.s, grass.l + .035) : hsl(grass.h, grass.s + .03, grass.l - .025); c.fillRect(left + i * stripe, top, stripe + .5, bottom - top); }
    // Grass texture: soft patches plus thousands of short blades in slightly different tones.
    const random = seeded(7919);
    for (let i = 0; i < 70; i++) {
      const x = left + random() * (right - left), y = top + random() * (bottom - top), r = 30 + random() * 70;
      const patch = c.createRadialGradient(x, y, 0, x, y, r); const tone = random() < .5 ? .05 : -.05;
      patch.addColorStop(0, hsl(grass.h, grass.s, grass.l + tone, .22)); patch.addColorStop(1, hsl(grass.h, grass.s, grass.l + tone, 0));
      c.fillStyle = patch; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    c.lineWidth = 1; c.lineCap = 'round';
    const blades = [hsl(grass.h + 6, grass.s, grass.l + .12, .5), hsl(grass.h - 4, grass.s + .05, grass.l - .1, .5), hsl(grass.h, grass.s - .08, grass.l + .19, .38), hsl(grass.h + 10, grass.s, grass.l - .14, .42)];
    for (const color of blades) {
      c.strokeStyle = color; c.beginPath();
      for (let i = 0; i < 4200; i++) {
        const x = left + random() * (right - left), y = top + random() * (bottom - top), length = 2 + random() * 3.5, lean = (random() - .5) * 2.4;
        c.moveTo(x, y); c.lineTo(x + lean, y - length);
      }
      c.stroke();
    }
    c.lineCap = 'butt';
    c.restore();
    c.strokeStyle = PITCH_LINE; c.lineWidth = 2.5;
    c.strokeRect(left, top, right - left, bottom - top);
    c.beginPath(); c.moveTo(world.width / 2, top); c.lineTo(world.width / 2, bottom); c.stroke();
    c.beginPath(); c.arc(world.width / 2, world.height / 2, world.centerCircleRadius, 0, Math.PI * 2); c.stroke();
    if (cupMatch) {
      const cx = world.width / 2, cy = world.height / 2;
      c.beginPath(); c.arc(cx, cy, world.centerCircleRadius + 7, 0, Math.PI * 2); c.strokeStyle = `${theme.accent}55`; c.lineWidth = importantMatch ? 3 : 1.5; c.stroke();
      c.save(); c.globalAlpha = .28; c.strokeStyle = theme.accent; c.lineWidth = 1.5;
      if (themeName === 'world-cup') { c.beginPath(); c.ellipse(cx, cy, 10, 5, 0, 0, Math.PI * 2); c.ellipse(cx, cy, 5, 10, 0, 0, Math.PI * 2); c.stroke(); }
      else if (themeName === 'euro') { for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 - Math.PI / 2; c.beginPath(); c.arc(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11, 1.7, 0, Math.PI * 2); c.fillStyle = theme.accent; c.fill(); } }
      else if (themeName === 'copa-america') { c.beginPath(); c.moveTo(cx - 12, cy + 7); c.quadraticCurveTo(cx, cy - 12, cx + 12, cy + 7); c.stroke(); c.beginPath(); c.moveTo(cx - 8, cy + 10); c.lineTo(cx + 8, cy + 10); c.stroke(); }
      else { c.beginPath(); c.moveTo(cx - 8, cy - 6); c.lineTo(cx + 8, cy - 6); c.moveTo(cx - 6, cy); c.lineTo(cx + 6, cy); c.moveTo(cx - 4, cy + 6); c.lineTo(cx + 4, cy + 6); c.stroke(); }
      c.restore();
    }
    c.beginPath(); c.arc(world.width / 2, world.height / 2, 3.5, 0, Math.PI * 2); c.fillStyle = PITCH_LINE; c.fill();
    // Simple penalty areas and goal boxes.
    c.strokeStyle = PITCH_LINE; c.lineWidth = 2.5;
    c.strokeRect(left, world.height / 2 - 128, 115, 256); c.strokeRect(left, world.height / 2 - 72, 44, 144);
    c.strokeRect(right - 115, world.height / 2 - 128, 115, 256); c.strokeRect(right - 44, world.height / 2 - 72, 44, 144);
    c.fillStyle = PITCH_LINE; c.beginPath(); c.arc(left + 76, world.height / 2, 3, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(right - 76, world.height / 2, 3, 0, Math.PI * 2); c.fill();
    // White goals: frame, goal line and round posts.
    c.strokeStyle = '#ffffff'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(left, goalTop); c.lineTo(left, goalBottom); c.moveTo(right, goalTop); c.lineTo(right, goalBottom); c.stroke(); c.lineCap = 'butt';
    c.fillStyle = '#ffffff'; for (const x of [left, right]) for (const y of [goalTop, goalBottom]) { c.beginPath(); c.arc(x, y, world.goalPostRadius, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = theme.accent + 'a0'; c.font = '9px "DM Mono",monospace'; c.textAlign = 'center'; for (const [label, x] of [['HOME', (goalBack + left) / 2], ['AWAY', (right + world.width - goalBack) / 2]]) {
      if (this.rotated) { c.save(); c.translate(x + (x < world.width / 2 ? -16 : 16), world.height / 2); c.rotate(Math.PI / 2); c.fillText(label, 0, 0); c.restore(); }
      else c.fillText(label, x, goalTop - 8);
    }
  }
  // Goal nets, drawn every frame: a ball pressing the back net makes it bulge outwards around the
  // impact point; when it leaves, the net springs back with a little wobble.
  drawNets(c, ball, dt) {
    const world = this.world || WORLD, { left, right, goalTop, goalBottom, goalBack, width } = world;
    const press = ball ? netPressDepth(ball, world) : { side: 0, depth: 0 };
    this.nets ||= { [-1]: { depth: 0, vel: 0, y: world.height / 2 }, [1]: { depth: 0, vel: 0, y: world.height / 2 } };
    const step = Math.min(.05, Math.max(0, dt || 0));
    for (const side of [-1, 1]) {
      const net = this.nets[side];
      if (press.side === side && press.depth > 0) { net.depth = Math.min(30, press.depth * 1.15); net.vel = 0; net.y = ball.y; }
      else if (step) { net.vel += (-420 * net.depth - 9 * net.vel) * step; net.depth += net.vel * step; if (Math.abs(net.depth) < .05 && Math.abs(net.vel) < .5) { net.depth = 0; net.vel = 0; } }
    }
    for (const side of [-1, 1]) {
      const net = this.nets[side], line = side > 0 ? right : left, back = side > 0 ? width - goalBack : goalBack;
      // Outward displacement: none at the goal line, most at the back, centred on the impact height.
      const bulge = (x, y) => { const t = (x - line) / (back - line); return net.depth * Math.pow(Math.max(0, t), 1.5) * Math.exp(-((y - net.y) ** 2) / (2 * 42 * 42)); };
      const point = (x, y) => [x + side * bulge(x, y), y];
      c.save(); c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1; c.beginPath();
      const depthPx = Math.abs(back - line);
      for (let d = 7; d <= depthPx + .1; d += 7) {
        const x = line + side * d;
        for (let y = goalTop; y <= goalBottom + .1; y += 5) { const [px, py] = point(x, y); if (y === goalTop) c.moveTo(px, py); else c.lineTo(px, py); }
      }
      for (let y = goalTop; y <= goalBottom + .1; y += 7) {
        for (let d = 0; d <= depthPx + .1; d += 3) { const [px, py] = point(line + side * d, y); if (d === 0) c.moveTo(px, py); else c.lineTo(px, py); }
      }
      c.stroke();
      // Net frame: the side nets and the (bulging) back of the goal.
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 3; c.lineJoin = 'round'; c.beginPath();
      c.moveTo(line, goalTop);
      for (let d = 0; d <= depthPx + .1; d += 3) { const [px, py] = point(line + side * d, goalTop); c.lineTo(px, py); }
      for (let y = goalTop; y <= goalBottom + .1; y += 4) { const [px, py] = point(back, y); c.lineTo(px, py); }
      for (let d = depthPx; d >= -.1; d -= 3) { const [px, py] = point(line + side * d, goalBottom); c.lineTo(px, py); }
      c.stroke();
      // Posts and goal line on top of the mesh.
      c.strokeStyle = '#ffffff'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(line, goalTop); c.lineTo(line, goalBottom); c.stroke();
      c.fillStyle = '#ffffff'; for (const y of [goalTop, goalBottom]) { c.beginPath(); c.arc(line, y, world.goalPostRadius, 0, Math.PI * 2); c.fill(); }
      c.restore();
    }
  }
  smooth(entity) {
    if (entity._rx === undefined || Math.hypot(entity.x - entity._rx, entity.y - entity._ry) > 160) { entity._rx = entity.x; entity._ry = entity.y; }
    const blend = this.renderBlend ?? .33; entity._rx += (entity.x - entity._rx) * blend; entity._ry += (entity.y - entity._ry) * blend;
    return [entity._rx, entity._ry];
  }
  drawLocalMarker(c, player) {
    const [x, y] = this.smooth(player), r = player.radius;
    c.save(); c.strokeStyle = 'rgba(255,236,150,.85)'; c.lineWidth = 3; c.setLineDash([6, 5]);
    c.beginPath(); c.arc(x, y, r + 7, 0, Math.PI * 2); c.stroke(); c.restore();
  }
  drawPlayer(c, player, color) {
    const [x, y] = this.smooth(player), r = player.radius, kick = player.kickScale || 0;
    c.save(); c.translate(x, y); if (this.rotated) c.rotate(Math.PI / 2); // keep names, numbers and shadows upright
    c.fillStyle = '#0005'; c.beginPath(); c.ellipse(2, 8, r * 1.05, r * .82, 0, 0, Math.PI * 2); c.fill();
    c.scale(1 + kick * .18, 1 - kick * .1);
    c.shadowColor = color + '55'; c.shadowBlur = 15;
    const grad = c.createRadialGradient(-r * .35, -r * .42, 2, 0, 0, r * 1.2); grad.addColorStop(0, lighten(color)); grad.addColorStop(.52, color); grad.addColorStop(1, shade(color));
    c.fillStyle = grad; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
    if (player.secondaryColor) this.drawKitPattern(c, player, r, color);
    c.strokeStyle = '#ffffff70'; c.lineWidth = 1.5; c.stroke();
    const numberColor = player.numberColor || readable(color);
    const whiteDorsal = [numberColor, color, player.secondaryColor].some(value => /^#(?:fff|ffffff|f5fff8|f7f7f7|f4f3ee|f4f2e9)$/i.test(value || ''));
    const dorsalOutline = whiteDorsal ? '#000000' : readable(numberColor) === '#f5fff8' ? 'rgba(255,255,255,.98)' : 'rgba(5,12,10,.95)';
    c.beginPath(); c.arc(0, 0, r - 1, 0, Math.PI * 2); c.clip();
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    const name = String(player.name || '').toUpperCase();
    c.font = `900 ${Math.round(r * .6)}px "DM Mono",monospace`;
    const outline = player.numberOutline !== false;
    c.lineWidth = whiteDorsal ? 4.3 : 2.3; c.strokeStyle = dorsalOutline; if (outline) c.strokeText(name, 0, -r * .5, r * 1.6);
    c.fillStyle = numberColor; c.fillText(name, 0, -r * .5, r * 1.6);
    c.font = `900 ${Math.round(r * 1.15)}px "DM Mono",monospace`;
    c.lineWidth = whiteDorsal ? 5 : 2.8; if (outline) c.strokeText(String(player.number), 0, r * .32, r * 1.5);
    c.fillText(String(player.number), 0, r * .32, r * 1.5);
    c.restore();
  }
  drawKitPattern(c, player, r, primary) {
    const secondary = player.secondaryColor, pattern = player.kitPattern || 'half-vertical';
    c.save(); c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.clip();
    const stripes = horizontal => {
      const size = r / 2;
      for (let i = 0; i < 4; i += 2) {
        c.fillStyle = secondary;
        if (horizontal) c.fillRect(-r, -r + i * size, r * 2, size);
        else c.fillRect(-r + i * size, -r, size, r * 2);
      }
    };
    if (pattern === 'horizontal-stripes') stripes(true);
    else if (pattern === 'vertical-stripes') stripes(false);
    else if (pattern === 'checkerboard') {
      const size = r / 2;
      for (let row = 0; row < 4; row++) for (let column = 0; column < 4; column++) {
        if ((row + column) % 2 === 0) { c.fillStyle = secondary; c.fillRect(-r + column * size, -r + row * size, size, size); }
      }
    } else if (pattern === 'quarters') {
      c.fillStyle = secondary; c.fillRect(-r, -r, r, r); c.fillRect(0, 0, r, r);
    } else if (pattern === 'half-horizontal') {
      c.fillStyle = secondary; c.fillRect(-r, 0, r * 2, r);
    } else {
      c.fillStyle = secondary; c.fillRect(0, -r, r, r * 2);
    }
    c.restore();
  }
  drawBall(c, ball, position = null) {
    const [x, y] = position || this.smooth(ball), r = ball.radius;
    c.save(); c.translate(x, y); if (this.rotated) c.rotate(Math.PI / 2); c.fillStyle = '#0007'; c.beginPath(); c.ellipse(2, 5, r * 1.08, r * .76, 0, 0, Math.PI * 2); c.fill();
    c.scale(1 + ball.kickScale * .16, 1 - ball.kickScale * .12);
    // Flat, strong yellow ball: no shine, no seams, no outline.
    c.fillStyle = BALL_COLOR; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  drawTrajectory(c, ball) {
    const speed = Math.hypot(ball.vx, ball.vy); if (speed < 35) return;
    if (ball.curl) {
      // A curving ball: simulate the path instead of the straight-line formula.
      const ghost = new Ball(ball.x, ball.y); Object.assign(ghost, { radius: ball.radius, world: ball.world, maxSpeed: ball.maxSpeed, vx: ball.vx, vy: ball.vy, curl: ball.curl });
      c.beginPath(); c.moveTo(ghost.x, ghost.y);
      for (let step = 0; step < 36 && Math.hypot(ghost.vx, ghost.vy) > 35; step++) { ghost.update(1 / 30); c.lineTo(ghost.x, ghost.y); }
      c.setLineDash([4, 7]); c.lineWidth = 2; c.strokeStyle = 'rgba(220,245,229,.33)'; c.stroke(); c.setLineDash([]); return;
    }
    const drag = .72, t = Math.min(1.25, Math.log(1 + speed * drag / 95) / drag), steps = 18;
    c.beginPath();
    for (let i = 0; i <= steps; i++) { const time = t * i / steps, x = ball.x + ball.vx * (1 - Math.exp(-drag * time)) / drag, y = ball.y + ball.vy * (1 - Math.exp(-drag * time)) / drag; if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); }
    c.setLineDash([4, 7]); c.lineWidth = 2; c.strokeStyle = 'rgba(220,245,229,.33)'; c.stroke(); c.setLineDash([]);
  }
  drawShotPreview(c, player, ball, position, curve = 0) {
    const powered = player.powerCooldown <= 0;
    const shot = predictShot(player, ball, null, powered ? 1.45 : 1);
    if (!shot) return;
    const ghost = new Ball(ball.x, ball.y); ghost.radius = ball.radius; ghost.world = ball.world; ghost.maxSpeed = ball.maxSpeed; ghost.vx = shot.vx; ghost.vy = shot.vy;
    // Holding the curve key (Shift / C): show the bent path of the curved shot.
    ghost.curl = curveFor(curve, shot);
    const offsetX = position[0] - ball.x, offsetY = position[1] - ball.y;
    c.save(); c.beginPath(); c.moveTo(...position);
    let previousX = ghost.x, previousY = ghost.y;
    for (let step = 0; step < 30; step++) {
      previousX = ghost.x; previousY = ghost.y;
      ghost.update(1 / 30);
      const goal = isGoal(ghost);
      if (!goal) resolveBallWalls(ghost);
      c.lineTo(ghost.x + offsetX, ghost.y + offsetY);
      if (goal) break;
    }
    c.setLineDash(curve ? [3, 5] : [6, 6]); c.strokeStyle = curve ? (powered ? '#ffd56bdd' : '#9fd2ffdd') : powered ? '#ffbc70cc' : '#b2f6d6cc'; c.lineWidth = 2; c.stroke(); c.setLineDash([]);
    const angle = Math.atan2(ghost.y - previousY, ghost.x - previousX), x = ghost.x + offsetX, y = ghost.y + offsetY;
    c.beginPath(); c.moveTo(x - Math.cos(angle - .5) * 10, y - Math.sin(angle - .5) * 10); c.lineTo(x, y); c.lineTo(x - Math.cos(angle + .5) * 10, y - Math.sin(angle + .5) * 10); c.stroke(); c.restore();
  }
  drawShotRange(c, player, ball, timer) {
    const [x, y] = [player._rx ?? player.x, player._ry ?? player.y], radius = shotRangeRadius(player);
    c.save(); c.globalAlpha = Math.min(.72, timer * 1.7); c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255,150,75,.055)'; c.fill(); c.setLineDash([5, 6]); c.lineWidth = 2;
    c.strokeStyle = '#ffc27c99'; c.stroke(); c.setLineDash([]); c.restore();
  }
  updateParticles(c, dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) { const p = this.particles[i]; p.life -= dt; if (p.life <= 0) { this.particles.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.pow(.92, dt * 60); p.vy = p.vy * Math.pow(.92, dt * 60) - (p.fire ? 24 : 0) * dt; c.globalAlpha = Math.min(1, p.life / p.max); c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.fire ? p.size * (.55 + p.life / p.max * .45) : p.size, 0, Math.PI * 2); c.fill(); }
    c.globalAlpha = 1;
  }
}
function shade(hex) { const n = parseInt(hex.slice(1), 16); const r = Math.round(((n >> 16) & 255) * .63), g = Math.round(((n >> 8) & 255) * .63), b = Math.round((n & 255) * .63); return `rgb(${r},${g},${b})`; }
function lighten(hex) { const n = parseInt(hex.slice(1), 16); const f = x => Math.round(x + (255 - x) * .28); return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`; }
function readable(hex) { const n = parseInt(hex.slice(1), 16), lum = .299 * ((n >> 16) & 255) + .587 * ((n >> 8) & 255) + .114 * (n & 255); return lum > 145 ? '#0b1710' : '#f5fff8'; }
