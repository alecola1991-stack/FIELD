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
    this.renderBlend = 1 - Math.exp(-24 * (dt > 0 ? Math.min(dt, .05) : 1 / 60));
    this.effectTime = (this.effectTime || 0) + Math.min(Math.max(dt || 0, 0), .05);
    const c = this.ctx, W = WORLD; c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#0b1115'; c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(this.scale, 0, 0, this.scale, this.ox, this.oy);
    this.drawField(c, game.fieldTheme, game.competitionRound, game.cosmetics);
    if (game.trajectory) this.drawTrajectory(c, game.ball);
    if (game.shotRangeTimer > 0) this.drawShotRange(c, game.player, game.ball, game.shotRangeTimer);
    const ballPosition = this.smooth(game.ball);
    if (game.cosmetics?.shotEffect && game.cosmetics.shotEffect !== 'off') this.drawShotEffect(c, game.ball, game.cosmetics.shotEffect, ballPosition);
    if (game.bot) this.drawPlayer(c, game.bot, game.bot.color);
    this.drawPlayer(c, game.player, game.player.color, game.cosmetics?.playerEffect, game.cosmetics?.circleRelief, game.cosmetics?.playerTrail);
    this.drawBall(c, game.ball, game.cosmetics?.ballSkin, ballPosition);
    this.updateParticles(c, dt);
    if (game.goalTimer > 0) {
      c.fillStyle = `rgba(220,255,235,${Math.min(.075, game.goalTimer * .05)})`; c.fillRect(W.left, W.top, W.right - W.left, W.bottom - W.top);
      this.drawGoalEffect(c, game.goalTimer, game.cosmetics?.goalEffect, game.goalSide);
    }
  }
  drawField(c, themeName = 'arcade', round = 0, cosmetics = {}) {
    const { left, right, top, bottom, goalTop, goalBottom, goalBack } = WORLD;
    const theme = FIELD_THEMES[themeName] || FIELD_THEMES.arcade;
    const cupMatch = ['champions', 'world-cup', 'euro', 'copa-america'].includes(themeName);
    const importantMatch = cupMatch && round >= 3;
    c.fillStyle = theme.net; c.fillRect(0, 0, WORLD.width, WORLD.height);
    // Low contrast net texture outside the playing area.
    c.fillStyle = theme.net; c.fillRect(goalBack, goalTop, left - goalBack, goalBottom - goalTop); c.fillRect(right, goalTop, WORLD.width - goalBack - right, goalBottom - goalTop);
    c.save(); c.beginPath(); c.rect(left, top, right - left, bottom - top); c.clip();
    c.fillStyle = theme.grass; c.fillRect(left, top, right - left, bottom - top);
    const tint = { mint: 'rgba(40,210,133,.15)', dusk: 'rgba(105,86,210,.19)', lagoon: 'rgba(20,166,195,.17)' }[cosmetics.fieldTint];
    if (tint) { c.fillStyle = tint; c.fillRect(left, top, right - left, bottom - top); }
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
    if (entity._rx === undefined || Math.hypot(entity.x - entity._rx, entity.y - entity._ry) > 160) { entity._rx = entity.x; entity._ry = entity.y; }
    const blend = this.renderBlend ?? .33; entity._rx += (entity.x - entity._rx) * blend; entity._ry += (entity.y - entity._ry) * blend;
    return [entity._rx, entity._ry];
  }
  drawPlayer(c, player, color, effect = 'off', relief = 'off', trail = 'off') {
    const [x, y] = this.smooth(player), r = player.radius, kick = player.kickScale || 0;
    this.drawPlayerTrail(c, player, x, y, trail !== 'off' ? trail : effect === 'speed' ? 'speed' : 'off', color);
    c.save(); c.translate(x, y);
    this.drawPlayerAura(c, r, effect);
    c.fillStyle = '#0005'; c.beginPath(); c.ellipse(2, 8, r * 1.05, r * .82, 0, 0, Math.PI * 2); c.fill();
    c.scale(1 + kick * .18, 1 - kick * .1);
    c.shadowColor = color + '55'; c.shadowBlur = 15;
    const grad = c.createRadialGradient(-r * .35, -r * .42, 2, 0, 0, r * 1.2); grad.addColorStop(0, lighten(color)); grad.addColorStop(.52, color); grad.addColorStop(1, shade(color));
    c.fillStyle = grad; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
    if (player.secondaryColor) this.drawKitPattern(c, player, r, color);
    c.strokeStyle = '#ffffff70'; c.lineWidth = 1.5; c.stroke();
    this.drawPlayerRelief(c, r, relief);
    const numberColor = player.numberColor || readable(color);
    const whiteDorsal = [numberColor, color, player.secondaryColor].some(value => /^#(?:fff|ffffff|f5fff8|f7f7f7|f4f3ee|f4f2e9)$/i.test(value || ''));
    const dorsalOutline = whiteDorsal ? '#000000' : readable(numberColor) === '#f5fff8' ? 'rgba(255,255,255,.98)' : 'rgba(5,12,10,.95)';
    c.beginPath(); c.arc(0, 0, r - 1, 0, Math.PI * 2); c.clip();
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    const name = String(player.name || '').toUpperCase();
    c.font = `900 ${Math.round(r * .6)}px "DM Mono",monospace`;
    c.lineWidth = whiteDorsal ? 4.3 : 2.3; c.strokeStyle = dorsalOutline; c.strokeText(name, 0, -r * .5, r * 1.6);
    c.fillStyle = numberColor; c.fillText(name, 0, -r * .5, r * 1.6);
    c.font = `900 ${Math.round(r * 1.15)}px "DM Mono",monospace`;
    c.lineWidth = whiteDorsal ? 5 : 2.8; c.strokeText(String(player.number), 0, r * .32, r * 1.5);
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
  drawBall(c, ball, skin = 'classic', position = null) {
    const [x, y] = position || this.smooth(ball), r = ball.radius;
    c.save(); c.translate(x, y); c.fillStyle = '#0007'; c.beginPath(); c.ellipse(2, 5, r * 1.08, r * .76, 0, 0, Math.PI * 2); c.fill();
    c.rotate(ball.spin); c.scale(1 + ball.kickScale * .16, 1 - ball.kickScale * .12);
    const ballStyles = { gold: ['#f3c85e', '#704d14', '#ffd76caa'], lava: ['#f4773f', '#512019', '#ff653dcc'], ice: ['#b9edf1', '#176276', '#7feeffcc'], cosmic: ['#ab78ed', '#241451', '#c38effcc'], carbon: ['#69757a', '#172024', '#b5d1d566'], pearl: ['#f4e6ff', '#8d78bb', '#dfbcff88'], emerald: ['#83e9ad', '#125d42', '#5efba688'] };
    const [ballColor, patchColor, glow] = ballStyles[skin] || ['#e8eee9', '#23352d', '#e9f4ee70'];
    c.shadowColor = glow; c.shadowBlur = skin === 'classic' ? 9 : 16; c.fillStyle = ballColor; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
    c.fillStyle = patchColor; c.beginPath(); c.arc(0, 0, 3.3, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; c.beginPath(); c.arc(Math.cos(a) * 7, Math.sin(a) * 7, 2.1, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }
  trailPoints(entity, x, y, lifetime = .22) {
    const time = this.effectTime || 0, speed = Math.hypot(entity.vx || 0, entity.vy || 0);
    let points = (entity._cosmeticTrail || []).filter(point => time - point.time <= lifetime);
    if (speed < 35 || points.length && Math.hypot(x - points[0].x, y - points[0].y) > 100) points = [];
    // A reversal or bounce must never leave a tail ahead of the moving body.
    if (points.some(point => (point.x - x) * entity.vx + (point.y - y) * entity.vy > 2 * speed)) points = [];
    if (!points.length || Math.hypot(x - points[0].x, y - points[0].y) > 1) points.unshift({ x, y, time });
    entity._cosmeticTrail = points.slice(0, 16);
    return entity._cosmeticTrail;
  }
  drawShotEffect(c, ball, effect, position = null) {
    const [x, y] = position || [ball._rx ?? ball.x, ball._ry ?? ball.y];
    const points = this.trailPoints(ball, x, y);
    const speed = Math.hypot(ball.vx, ball.vy); if (speed < 105 || points.length < 2) return;
    const colors = { fire: '#ff9b55', neon: '#68e8ff', lightning: '#f4ef75', aurora: '#8c90ff', plasma: '#f77ee5', ice: '#a1f4ff', rainbow: '#87ffd8' };
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    for (let i = points.length - 1; i > 0; i--) {
      const older = points[i], newer = points[i - 1], fade = Math.max(0, 1 - ((this.effectTime || 0) - older.time) / .22);
      const color = effect === 'rainbow' ? `hsl(${((this.effectTime || 0) * 100 + i * 28) % 360} 95% 72%)` : colors[effect] || colors.neon;
      c.globalAlpha = fade * Math.min(.8, speed / 650); c.strokeStyle = color; c.shadowColor = color; c.shadowBlur = 8;
      c.lineWidth = (effect === 'fire' ? 9 : effect === 'lightning' ? 3 : 6) * (.25 + fade * .75);
      c.beginPath(); c.moveTo(newer.x, newer.y);
      if (effect === 'lightning') {
        const dx = older.x - newer.x, dy = older.y - newer.y, length = Math.hypot(dx, dy) || 1;
        const wobble = Math.sin(i * 3 + (this.effectTime || 0) * 35) * 3;
        c.lineTo((newer.x + older.x) / 2 - dy / length * wobble, (newer.y + older.y) / 2 + dx / length * wobble);
      }
      c.lineTo(older.x, older.y); c.stroke();
      if (effect === 'aurora' || effect === 'plasma') {
        c.globalAlpha *= .5; c.strokeStyle = '#ffffff'; c.lineWidth *= .3; c.stroke();
      }
    }
    c.restore();
  }
  drawPlayerTrail(c, player, x, y, effect, color) {
    if (!effect || effect === 'off') return;
    const points = this.trailPoints(player, x, y, .3), speed = Math.hypot(player.vx || 0, player.vy || 0);
    if (speed < 35 || points.length < 2) return;
    const tint = { speed: color, comet: '#c4a1ff', storm: '#7eeaff', sparks: '#ffc06e' }[effect] || color;
    c.save(); c.lineCap = 'round'; c.strokeStyle = tint; c.shadowColor = tint; c.shadowBlur = 6;
    for (let i = points.length - 1; i > 0; i--) {
      const fade = Math.max(0, 1 - ((this.effectTime || 0) - points[i].time) / .3);
      c.globalAlpha = fade * .45; c.lineWidth = player.radius * (.15 + fade * .65);
      c.beginPath(); c.moveTo(points[i - 1].x, points[i - 1].y); c.lineTo(points[i].x, points[i].y); c.stroke();
      if (effect !== 'speed') {
        c.globalAlpha = fade * .8; c.fillStyle = tint;
        const angle = i * 2.4 + (this.effectTime || 0) * 5, offset = 7 * (1 - fade);
        c.beginPath(); c.arc(points[i].x + Math.cos(angle) * offset, points[i].y + Math.sin(angle) * offset, 1 + fade * 1.8, 0, Math.PI * 2); c.fill();
      }
    }
    c.restore();
  }
  drawPlayerAura(c, r, effect) {
    if (!['halo', 'orbit', 'pulse', 'cosmic', 'flame'].includes(effect)) return;
    const time = this.effectTime || 0, pulse = Math.sin(time * 3.5), radius = r + 5 + pulse * 2;
    const tint = { halo: '#8effc3', orbit: '#79dfff', pulse: '#ff91ce', cosmic: '#c0a1ff', flame: '#ffb15b' }[effect];
    c.save(); c.strokeStyle = tint; c.fillStyle = tint; c.shadowColor = tint; c.shadowBlur = 9 + pulse * 3; c.lineWidth = 2;
    c.globalAlpha = .6 + pulse * .17;
    c.beginPath(); c.arc(0, 0, radius, time * .8, time * .8 + Math.PI * 1.7); c.stroke();
    if (effect === 'pulse') {
      const phase = (time * .7) % 1; c.globalAlpha = (1 - phase) * .45;
      c.beginPath(); c.arc(0, 0, r + 6 + phase * 14, 0, Math.PI * 2); c.stroke();
    } else {
      for (let i = 0; i < (effect === 'flame' ? 7 : 3); i++) {
        const angle = time * (effect === 'cosmic' ? -1.4 : 1.8) + i * Math.PI * 2 / (effect === 'flame' ? 7 : 3);
        const distance = radius + Math.sin(time * 5 + i) * 2;
        c.globalAlpha = .7; c.beginPath(); c.arc(Math.cos(angle) * distance, Math.sin(angle) * distance, effect === 'flame' ? 2.4 : 2, 0, Math.PI * 2); c.fill();
      }
    }
    c.restore();
  }
  drawPlayerRelief(c, r, relief) {
    if (!relief || relief === 'off') return;
    const colors = { raised: ['#10251c', '#d8f4e4'], gold: ['#6e4611', '#ffe39a'], chrome: ['#374552', '#e6f7ff'], obsidian: ['#05070d', '#a394dd'], prism: ['#525683', '#9af2ee'] };
    const palette = colors[relief]; if (!palette) return;
    c.save(); c.lineWidth = 4; c.strokeStyle = palette[0]; c.shadowColor = '#0009'; c.shadowBlur = 5; c.shadowOffsetY = 2;
    c.beginPath(); c.arc(0, 0, r - 1, 0, Math.PI * 2); c.stroke();
    c.shadowBlur = 0; c.shadowOffsetY = 0; c.lineWidth = 2; c.strokeStyle = palette[1];
    c.beginPath(); c.arc(0, 0, r - 2, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
    if (relief === 'prism') { c.globalAlpha = .7; c.strokeStyle = `hsl(${((this.effectTime || 0) * 40) % 360} 85% 75%)`; c.beginPath(); c.arc(0, 0, r - 2, 0, Math.PI * 2); c.stroke(); }
    c.restore();
  }
  drawGoalEffect(c, timer, effect, goalSide) {
    if (!effect || effect === 'off') return;
    const progress = Math.max(0, Math.min(1, 1 - timer / 1.25)), alpha = 1 - progress, color = effect === 'fireworks' ? '#ffb76f' : '#8effc1';
    c.save(); c.globalAlpha = alpha * .82; c.strokeStyle = color; c.lineWidth = 3;
    const x = goalSide === -1 ? WORLD.left + 24 : WORLD.right - 24;
    const radius = 18 + progress * 118; c.beginPath(); c.arc(x, WORLD.height / 2, radius, 0, Math.PI * 2); c.stroke();
    if (effect === 'fireworks') for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + progress * .5, inner = radius + 5, outer = radius + 13 + progress * 16; c.strokeStyle = ['#ffbd63', '#ff73ad', '#7ce8ff', '#b89cff'][i % 4]; c.beginPath(); c.moveTo(x + Math.cos(a) * inner, WORLD.height / 2 + Math.sin(a) * inner); c.lineTo(x + Math.cos(a) * outer, WORLD.height / 2 + Math.sin(a) * outer); c.stroke(); }
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
