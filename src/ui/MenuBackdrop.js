// Animated menu backgrounds. One canvas is moved into the visible screen and draws a scene for it:
// home (passing play with shots on goal), play, online, settings, champions (cups) and league.
// Runs at 30 fps, only while a menu with a scene is visible, and draws a still frame with reduced motion.
const TAU = Math.PI * 2;
const rand = (min, max) => min + Math.random() * (max - min);
const pick = list => list[Math.floor(Math.random() * list.length)];
const BALL = '#ffd400';
const KITS = [['#58acff', '#dcece2'], ['#9baeff', '#e9ecff'], ['#4876d9', '#ffe0d4'], ['#7698ed', '#f3e5b2'], ['#e8657a', '#fff1f3'], ['#5fd3a0', '#effff7']];

export class MenuBackdrop {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.width = 0; this.height = 0; this.dpr = 1; this.active = false; this.lastTime = 0; this.raf = 0; this.time = 0;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
    this.scene = 'home'; this.state = null;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const width = Math.max(1, rect.width), height = Math.max(1, rect.height);
    const changed = Math.abs(width - this.width) > 2 || Math.abs(height - this.height) > 2;
    this.width = width; this.height = height;
    this.canvas.width = Math.round(this.width * this.dpr); this.canvas.height = Math.round(this.height * this.dpr);
    if (changed && this.width > 1) this.state = this.build(this.scene);
    if (this.active) this.draw();
  }

  // Which scene to draw; the canvas follows the visible screen.
  setScene(scene, host = null) {
    if (host && this.canvas.parentElement !== host) { host.prepend(this.canvas); this.resize(); }
    if (scene !== this.scene || !this.state) { this.scene = scene; this.state = this.build(scene); }
  }

  setActive(active) {
    if (this.active === active) return;
    this.active = active; this.lastTime = 0;
    if (!active) { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; return; }
    this.draw();
    if (!this.reducedMotion) this.raf = requestAnimationFrame(time => this.frame(time));
  }

  frame(time) {
    this.raf = 0;
    if (!this.active) return;
    if (this.lastTime && time - this.lastTime < 1000 / 30) { this.raf = requestAnimationFrame(next => this.frame(next)); return; }
    const dt = this.lastTime ? Math.min((time - this.lastTime) / 1000, .05) : 0;
    this.lastTime = time; this.time += dt;
    this.update(dt); this.draw();
    this.raf = requestAnimationFrame(next => this.frame(next));
  }

  get unit() { return Math.max(10, Math.min(this.width, this.height)); }

  // ---------- scene setup ----------
  build(scene) {
    const players = count => Array.from({ length: count }, (_, i) => {
      const [color, secondary] = KITS[i % KITS.length];
      return { x: rand(.08, .92), y: rand(.12, .88), vx: rand(-.02, .02), vy: rand(-.015, .015), color, secondary, phase: rand(0, TAU), trail: [] };
    });
    switch (scene) {
      case 'play': return { players: players(6), balls: Array.from({ length: 4 }, () => this.newShot()), sparks: [] };
      case 'online': {
        const nodes = Array.from({ length: 16 }, (_, i) => ({ x: rand(.05, .95), y: rand(.08, .92), vx: rand(-.012, .012), vy: rand(-.01, .01), color: KITS[i % KITS.length][0], r: rand(.6, 1.2), phase: rand(0, TAU) }));
        return { nodes, packets: [], clock: 0 };
      }
      case 'settings': return {
        gears: Array.from({ length: 6 }, (_, i) => ({ x: rand(.06, .94), y: rand(.12, .88), size: rand(.05, .12), teeth: 8 + (i % 3) * 2, angle: rand(0, TAU), speed: rand(.08, .22) * (i % 2 ? 1 : -1) })),
        sliders: Array.from({ length: 5 }, (_, i) => ({ y: .16 + i * .17, x: rand(.05, .6), length: rand(.2, .32), value: Math.random(), speed: rand(.12, .3), phase: rand(0, TAU) })),
      };
      case 'champions': return {
        stars: Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), size: rand(.6, 2.2), phase: rand(0, TAU), speed: rand(1, 3) })),
        confetti: Array.from({ length: 46 }, () => this.newConfetti(true)),
        beams: [{ x: .18, angle: .3, speed: .25 }, { x: .82, angle: -.25, speed: -.2 }],
      };
      case 'league': return {
        bars: Array.from({ length: 10 }, (_, i) => ({ value: rand(.2, 1), target: rand(.2, 1), color: KITS[i % KITS.length][0] })), clock: 0,
        balls: Array.from({ length: 3 }, () => ({ x: Math.random(), y: rand(.15, .85), vx: rand(.03, .06) * pick([-1, 1]), spin: 0 })),
        players: players(3),
      };
      default: { // home
        const team = players(6);
        return { players: team, pass: this.newPass(team, null), goals: [], sparks: [], beams: [{ x: .25, angle: .2, speed: .18 }, { x: .75, angle: -.2, speed: -.15 }] };
      }
    }
  }

  newShot() {
    const fromLeft = Math.random() < .5, y0 = rand(.15, .85);
    return { x0: fromLeft ? -.05 : 1.05, y0, x1: fromLeft ? rand(.55, 1.1) : rand(-.1, .45), y1: rand(.1, .9), lift: rand(-.25, .25), t: rand(-.3, 0), speed: rand(.35, .6), trail: [] };
  }
  newConfetti(spread = false) {
    return { x: Math.random(), y: spread ? Math.random() : rand(-.15, -.02), vy: rand(.05, .11), vx: rand(-.02, .02), spin: rand(0, TAU), spinSpeed: rand(-4, 4), size: rand(3, 7), color: pick(['#ffd76a', '#f2c14e', '#fff2b8', '#9ec5ff', '#ffffff']) };
  }
  newPass(team, from) {
    const a = from || pick(team);
    const b = pick(team.filter(player => player !== a));
    // One in four passes is a shot at one of the goals instead.
    const shot = Math.random() < .25;
    const target = shot ? { x: a.x < .5 ? .985 : .015, y: rand(.42, .58), goal: a.x < .5 ? 1 : -1 } : b;
    return { from: a, to: target, t: 0, duration: shot ? rand(.7, 1) : rand(1.1, 1.7), lift: rand(-.12, .12), shot, trail: [] };
  }

  // ---------- update ----------
  update(dt) {
    const s = this.state; if (!s) return;
    const move = (item, minX = .04, maxX = .96, minY = .08, maxY = .92) => {
      item.x += item.vx * dt; item.y += item.vy * dt;
      if (item.x < minX || item.x > maxX) item.vx *= -1;
      if (item.y < minY || item.y > maxY) item.vy *= -1;
      item.x = Math.min(maxX, Math.max(minX, item.x)); item.y = Math.min(maxY, Math.max(minY, item.y));
    };
    switch (this.scene) {
      case 'play':
        for (const p of s.players) { move(p); p.phase += dt * 1.6; p.trail.unshift([p.x, p.y]); p.trail.length = Math.min(p.trail.length, 9); }
        s.balls.forEach((ball, i) => {
          ball.t += dt * ball.speed;
          if (ball.t > 0) { const [x, y] = this.shotPoint(ball, Math.min(1, ball.t)); ball.trail.unshift([x, y]); ball.trail.length = Math.min(ball.trail.length, 14); }
          if (ball.t >= 1.15) { this.burst(s.sparks, ...this.shotPoint(ball, 1)); s.balls[i] = this.newShot(); }
        });
        this.updateSparks(s.sparks, dt);
        break;
      case 'online':
        for (const n of s.nodes) { move(n, .03, .97, .05, .95); n.phase += dt * 2; }
        s.clock -= dt;
        if (s.clock <= 0) {
          s.clock = rand(.12, .35);
          const a = pick(s.nodes), near = s.nodes.filter(n => n !== a && this.dist(a, n) < .32);
          if (near.length) s.packets.push({ from: a, to: pick(near), t: 0, speed: rand(.7, 1.3) });
        }
        s.packets = s.packets.filter(p => (p.t += dt * p.speed) < 1);
        break;
      case 'settings':
        for (const g of s.gears) g.angle += g.speed * dt;
        for (const sl of s.sliders) { sl.phase += dt * sl.speed; sl.value = .5 + .45 * Math.sin(sl.phase * TAU / 4); }
        break;
      case 'champions':
        for (const c of s.confetti) { c.y += c.vy * dt; c.x += (c.vx + Math.sin(this.time * 1.4 + c.spin) * .01) * dt; c.spin += c.spinSpeed * dt; }
        s.confetti = s.confetti.map(c => c.y > 1.05 ? this.newConfetti() : c);
        for (const b of s.beams) b.angle = Math.sin(this.time * b.speed + b.x * 5) * .35;
        break;
      case 'league':
        s.clock -= dt;
        if (s.clock <= 0) { s.clock = rand(1.4, 2.4); for (const bar of s.bars) bar.target = Math.min(1, Math.max(.15, bar.target + rand(-.25, .25))); }
        for (const bar of s.bars) bar.value += (bar.target - bar.value) * Math.min(1, dt * 2.2);
        for (const ball of s.balls) { ball.x += ball.vx * dt; ball.spin += ball.vx * dt * 40; if (ball.x < -.05 || ball.x > 1.05) { ball.vx *= -1; ball.y = rand(.15, .85); } }
        for (const p of s.players) { move(p); p.phase += dt * 1.3; }
        break;
      default: { // home
        for (const p of s.players) {
          // Players drift, but the passer and the receiver slow down around the pass.
          const busy = p === s.pass.from || p === s.pass.to;
          p.x += p.vx * dt * (busy ? .3 : 1); p.y += p.vy * dt * (busy ? .3 : 1);
          if (p.x < .06 || p.x > .94) p.vx *= -1; if (p.y < .1 || p.y > .9) p.vy *= -1;
          p.phase += dt * 1.3;
        }
        const pass = s.pass; pass.t += dt / pass.duration;
        const [bx, by] = this.passPoint(pass, Math.min(1, pass.t));
        pass.trail.unshift([bx, by]); pass.trail.length = Math.min(pass.trail.length, 16);
        if (pass.t >= 1) {
          if (pass.shot) { s.goals.push({ side: pass.to.goal, y: pass.to.y, life: 1 }); this.burst(s.sparks, pass.to.x, pass.to.y, 22); s.pass = this.newPass(s.players, null); }
          else s.pass = this.newPass(s.players, pass.to);
        }
        s.goals = s.goals.filter(goal => (goal.life -= dt * .8) > 0);
        for (const b of s.beams) b.angle = Math.sin(this.time * b.speed + b.x * 4) * .3;
        this.updateSparks(s.sparks, dt);
      }
    }
  }

  updateSparks(sparks, dt) {
    for (let i = sparks.length - 1; i >= 0; i--) { const p = sparks[i]; p.life -= dt; if (p.life <= 0) { sparks.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .94; p.vy *= .94; }
  }
  burst(sparks, x, y, count = 14) {
    for (let i = 0; i < count; i++) { const a = rand(0, TAU), speed = rand(.03, .14); sparks.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: rand(.4, .9), max: .9, color: pick(['#ffe27a', '#ffffff', '#8fd3ff']) }); }
  }
  dist(a, b) { return Math.hypot((a.x - b.x) * this.width, (a.y - b.y) * this.height) / Math.max(this.width, this.height); }
  passPoint(pass, t) {
    const ax = pass.from.x, ay = pass.from.y, bx = pass.to.x, by = pass.to.y, e = t * t * (3 - 2 * t);
    const nx = -(by - ay), ny = bx - ax, bend = Math.sin(Math.PI * e) * pass.lift;
    return [ax + (bx - ax) * e + nx * bend, ay + (by - ay) * e + ny * bend];
  }
  shotPoint(ball, t) {
    const nx = -(ball.y1 - ball.y0), ny = ball.x1 - ball.x0, bend = Math.sin(Math.PI * t) * ball.lift;
    return [ball.x0 + (ball.x1 - ball.x0) * t + nx * bend, ball.y0 + (ball.y1 - ball.y0) * t + ny * bend];
  }

  // ---------- drawing ----------
  draw() {
    const c = this.context;
    if (!c || !this.width || !this.height || !this.state) return;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, this.width, this.height);
    const draw = { play: this.drawPlay, online: this.drawOnline, settings: this.drawSettings, champions: this.drawChampions, league: this.drawLeague }[this.scene] || this.drawHome;
    draw.call(this, c, this.state);
  }

  px(x, y) { return [x * this.width, y * this.height]; }

  drawBeams(c, beams, color) {
    for (const beam of beams) {
      const x = beam.x * this.width, length = this.height * 1.3, spread = .16;
      c.save(); c.translate(x, -20); c.rotate(beam.angle);
      const g = c.createLinearGradient(0, 0, 0, length); g.addColorStop(0, color); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.tan(spread) * length, length); c.lineTo(-Math.tan(spread) * length, length); c.closePath(); c.fill(); c.restore();
    }
  }

  drawPitchLines(c, alpha = .1) {
    const w = this.width, h = this.height, m = Math.min(w, h) * .06;
    c.save(); c.strokeStyle = `rgba(190,215,255,${alpha})`; c.lineWidth = 1.5;
    c.strokeRect(m, m, w - m * 2, h - m * 2);
    c.beginPath(); c.moveTo(w / 2, m); c.lineTo(w / 2, h - m); c.stroke();
    c.beginPath(); c.arc(w / 2, h / 2, Math.min(w, h) * .13, 0, TAU); c.stroke();
    const boxW = w * .1, boxH = h * .38;
    c.strokeRect(m, h / 2 - boxH / 2, boxW, boxH); c.strokeRect(w - m - boxW, h / 2 - boxH / 2, boxW, boxH);
    c.restore();
  }

  drawPlayer(c, p, x, y, alpha = .24) {
    const r = Math.max(14, this.unit * .032);
    c.save(); c.translate(x, y); c.globalAlpha = alpha;
    c.fillStyle = '#000'; c.beginPath(); c.ellipse(2, r * .42, r * 1.04, r * .72, 0, 0, TAU); c.fill();
    c.shadowColor = p.color; c.shadowBlur = 18;
    c.fillStyle = p.color; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.shadowBlur = 0;
    c.fillStyle = p.secondary; c.beginPath(); c.moveTo(0, -r); c.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); c.lineTo(0, r); c.closePath(); c.fill();
    c.strokeStyle = '#ffffff88'; c.lineWidth = 1.3; c.stroke();
    c.restore();
  }

  drawBall(c, x, y, alpha = .5, scale = 1) {
    const r = Math.max(7, this.unit * .013) * scale;
    c.save(); c.globalAlpha = alpha;
    c.fillStyle = BALL; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.strokeStyle = '#000000'; c.lineWidth = 1.2; c.stroke(); c.restore();
  }

  drawTrail(c, trail, color, width) {
    if (trail.length < 2) return;
    c.save(); c.lineCap = 'round';
    for (let i = 1; i < trail.length; i++) {
      const [x0, y0] = this.px(...trail[i - 1]), [x1, y1] = this.px(...trail[i]);
      c.globalAlpha = (1 - i / trail.length) * .5; c.strokeStyle = color; c.lineWidth = width * (1 - i / trail.length);
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    }
    c.restore();
  }

  drawSparks(c, sparks) {
    for (const p of sparks) { const [x, y] = this.px(p.x, p.y); c.globalAlpha = Math.max(0, p.life / p.max) * .8; c.fillStyle = p.color; c.beginPath(); c.arc(x, y, 2.2, 0, TAU); c.fill(); }
    c.globalAlpha = 1;
  }

  drawHome(c, s) {
    this.drawBeams(c, s.beams, 'rgba(160,200,255,.10)');
    this.drawPitchLines(c, .09);
    // Faint goals at both ends; they light up when a shot goes in.
    const goalH = this.height * .2, goalW = Math.max(10, this.width * .012);
    for (const side of [-1, 1]) {
      const x = side < 0 ? this.width * .015 : this.width * .985 - goalW, flash = s.goals.find(goal => goal.side === side);
      c.save(); c.strokeStyle = flash ? `rgba(255,230,140,${.2 + flash.life * .6})` : 'rgba(200,220,255,.18)'; c.lineWidth = flash ? 3 : 2;
      if (flash) { c.shadowColor = '#ffe27a'; c.shadowBlur = 24 * flash.life; }
      c.strokeRect(x, this.height / 2 - goalH / 2, goalW, goalH); c.restore();
    }
    for (const p of s.players) this.drawPlayer(c, p, ...this.px(p.x, p.y));
    const pass = s.pass;
    this.drawTrail(c, pass.trail, pass.shot ? '#ffe27a' : '#cfe3ff', pass.shot ? 6 : 4);
    const [bx, by] = this.px(...this.passPoint(pass, Math.min(1, pass.t)));
    this.drawBall(c, bx, by, .55, 1 + Math.sin(Math.PI * Math.min(1, pass.t)) * Math.abs(pass.lift) * 2.5);
    this.drawSparks(c, s.sparks);
  }

  drawPlay(c, s) {
    // Speed lines across the screen.
    c.save(); c.strokeStyle = 'rgba(170,205,255,.12)'; c.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const y = ((i * .113 + this.time * .03) % 1) * this.height, x = ((i * .37 + this.time * (.18 + i * .02)) % 1.4 - .2) * this.width;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + this.width * .12, y); c.stroke();
    }
    c.restore();
    for (const p of s.players) { this.drawTrail(c, p.trail, p.color, this.unit * .03); this.drawPlayer(c, p, ...this.px(p.x, p.y)); }
    for (const ball of s.balls) {
      if (ball.t <= 0) continue;
      // Dashed aim line, then the ball with its trail.
      c.save(); c.setLineDash([6, 8]); c.strokeStyle = 'rgba(255,226,122,.18)'; c.lineWidth = 1.5; c.beginPath();
      for (let i = 0; i <= 20; i++) { const [x, y] = this.px(...this.shotPoint(ball, i / 20)); if (i) c.lineTo(x, y); else c.moveTo(x, y); }
      c.stroke(); c.restore();
      this.drawTrail(c, ball.trail, '#ffe27a', 5);
      this.drawBall(c, ...this.px(...this.shotPoint(ball, Math.min(1, ball.t))), .55);
    }
    this.drawSparks(c, s.sparks);
  }

  drawOnline(c, s) {
    c.save(); c.lineWidth = 1.2;
    for (let i = 0; i < s.nodes.length; i++) for (let j = i + 1; j < s.nodes.length; j++) {
      const a = s.nodes[i], b = s.nodes[j], d = this.dist(a, b); if (d > .32) continue;
      c.strokeStyle = `rgba(140,190,255,${(1 - d / .32) * .28})`; c.beginPath(); c.moveTo(...this.px(a.x, a.y)); c.lineTo(...this.px(b.x, b.y)); c.stroke();
    }
    for (const p of s.packets) {
      const x = p.from.x + (p.to.x - p.from.x) * p.t, y = p.from.y + (p.to.y - p.from.y) * p.t, [px, py] = this.px(x, y);
      c.fillStyle = '#bfe3ff'; c.shadowColor = '#7fc4ff'; c.shadowBlur = 12; c.globalAlpha = .85; c.beginPath(); c.arc(px, py, 3, 0, TAU); c.fill();
    }
    c.shadowBlur = 0; c.globalAlpha = 1;
    for (const n of s.nodes) {
      const [x, y] = this.px(n.x, n.y), r = this.unit * .012 * n.r, pulse = (Math.sin(n.phase) + 1) / 2;
      c.strokeStyle = n.color; c.globalAlpha = .18 + pulse * .2; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, r * (2.2 + pulse), 0, TAU); c.stroke();
      c.globalAlpha = .5; c.fillStyle = n.color; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
    c.restore();
  }

  drawGear(c, g) {
    const [x, y] = this.px(g.x, g.y), r = g.size * this.unit, inner = r * .78, teeth = g.teeth;
    c.save(); c.translate(x, y); c.rotate(g.angle); c.strokeStyle = 'rgba(170,205,255,.22)'; c.lineWidth = 2; c.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a0 = i / teeth * TAU, a1 = (i + .5) / teeth * TAU, step = TAU / teeth / 6;
      c.lineTo(Math.cos(a0 + step) * r, Math.sin(a0 + step) * r); c.lineTo(Math.cos(a1 - step) * r, Math.sin(a1 - step) * r);
      c.lineTo(Math.cos(a1 + step) * inner, Math.sin(a1 + step) * inner); c.lineTo(Math.cos((i + 1) / teeth * TAU - step) * inner, Math.sin((i + 1) / teeth * TAU - step) * inner);
    }
    c.closePath(); c.stroke(); c.beginPath(); c.arc(0, 0, r * .3, 0, TAU); c.stroke(); c.restore();
  }

  drawSettings(c, s) {
    for (const g of s.gears) this.drawGear(c, g);
    c.save();
    for (const sl of s.sliders) {
      const x0 = sl.x * this.width, x1 = (sl.x + sl.length) * this.width, y = sl.y * this.height, knob = x0 + (x1 - x0) * sl.value;
      c.strokeStyle = 'rgba(170,205,255,.16)'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
      c.strokeStyle = 'rgba(143,240,189,.35)'; c.beginPath(); c.moveTo(x0, y); c.lineTo(knob, y); c.stroke();
      c.fillStyle = 'rgba(220,235,255,.45)'; c.beginPath(); c.arc(knob, y, 8, 0, TAU); c.fill();
    }
    c.restore();
  }

  drawChampions(c, s) {
    this.drawBeams(c, s.beams, 'rgba(255,225,140,.10)');
    c.save();
    for (const star of s.stars) {
      const [x, y] = this.px(star.x, star.y), twinkle = (Math.sin(this.time * star.speed + star.phase) + 1) / 2;
      c.globalAlpha = .15 + twinkle * .55; c.fillStyle = '#fff4c8';
      c.beginPath(); c.arc(x, y, star.size * (.6 + twinkle * .6), 0, TAU); c.fill();
      if (star.size > 1.8) { c.strokeStyle = '#fff4c8'; c.lineWidth = 1; c.globalAlpha *= .6; c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x + 6, y); c.moveTo(x, y - 6); c.lineTo(x, y + 6); c.stroke(); }
    }
    for (const piece of s.confetti) {
      const [x, y] = this.px(piece.x, piece.y);
      c.save(); c.translate(x, y); c.rotate(piece.spin); c.globalAlpha = .55; c.fillStyle = piece.color;
      c.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2 * Math.abs(Math.cos(piece.spin * 1.7)) + 1); c.restore();
    }
    // A big, faint cup outline in the background.
    const cx = this.width * .5, cy = this.height * .52, size = this.unit * .22;
    c.globalAlpha = .07 + Math.sin(this.time * .8) * .02; c.strokeStyle = '#ffe08a'; c.lineWidth = 3; c.beginPath();
    c.moveTo(cx - size * .5, cy - size * .6); c.lineTo(cx + size * .5, cy - size * .6);
    c.quadraticCurveTo(cx + size * .48, cy + size * .05, cx + size * .08, cy + size * .22); c.lineTo(cx + size * .08, cy + size * .5);
    c.lineTo(cx + size * .28, cy + size * .62); c.lineTo(cx - size * .28, cy + size * .62); c.lineTo(cx - size * .08, cy + size * .5);
    c.lineTo(cx - size * .08, cy + size * .22); c.quadraticCurveTo(cx - size * .48, cy + size * .05, cx - size * .5, cy - size * .6); c.stroke();
    c.beginPath(); c.arc(cx - size * .5, cy - size * .3, size * .2, Math.PI * .5, Math.PI * 1.5); c.arc(cx + size * .5, cy - size * .3, size * .2, -Math.PI * .5, Math.PI * .5); c.stroke();
    c.restore();
  }

  drawLeague(c, s) {
    this.drawPitchLines(c, .07);
    // Standings: rows of bars that move as the "season" goes on.
    const rows = s.bars.length, top = this.height * .14, rowH = this.height * .72 / rows, left = this.width * .06, maxW = this.width * .38;
    c.save();
    s.bars.forEach((bar, i) => {
      const y = top + i * rowH;
      c.globalAlpha = .12; c.fillStyle = '#9fc1ff'; c.fillRect(left, y, maxW, rowH * .55);
      c.globalAlpha = .28; c.fillStyle = bar.color; c.fillRect(left, y, maxW * bar.value, rowH * .55);
      c.globalAlpha = .3; c.fillStyle = '#e6efff'; c.font = `600 ${Math.max(10, rowH * .38)}px "DM Mono",monospace`; c.textBaseline = 'middle';
      c.fillText(String(i + 1).padStart(2, '0'), left - rowH * .9, y + rowH * .28);
    });
    c.restore();
    for (const p of s.players) this.drawPlayer(c, p, ...this.px(p.x, p.y), .18);
    for (const ball of s.balls) this.drawBall(c, ...this.px(ball.x, ball.y), .45);
  }
}
