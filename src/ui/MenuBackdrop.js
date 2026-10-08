export class MenuBackdrop {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.width = 0; this.height = 0; this.dpr = 1; this.active = false; this.lastTime = 0; this.raf = 0;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
    this.entities = [
      { type: 'player', x: .075, y: .24, vx: .018, vy: .008, color: '#65e6a5', secondary: '#dcece2', phase: .2 },
      { type: 'ball', x: .19, y: .77, vx: .014, vy: -.009, spin: .1 },
      { type: 'player', x: .88, y: .19, vx: -.013, vy: .012, color: '#9baeff', secondary: '#e9ecff', phase: 1.3 },
      { type: 'ball', x: .94, y: .65, vx: -.018, vy: .006, spin: .7 },
      { type: 'player', x: .13, y: .9, vx: .011, vy: -.008, color: '#f19676', secondary: '#ffe0d4', phase: 2.1 },
      { type: 'ball', x: .78, y: .86, vx: -.012, vy: -.011, spin: 1.4 },
      { type: 'player', x: .96, y: .92, vx: -.01, vy: -.007, color: '#d5bf78', secondary: '#f3e5b2', phase: 2.8 },
    ];
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    this.width = Math.max(1, rect.width); this.height = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.width * this.dpr); this.canvas.height = Math.round(this.height * this.dpr);
    if (this.active) this.draw();
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
    const dt = this.lastTime ? Math.min((time - this.lastTime) / 1000, .04) : 0;
    this.lastTime = time;
    this.update(dt); this.draw();
    this.raf = requestAnimationFrame(next => this.frame(next));
  }

  update(dt) {
    for (const entity of this.entities) {
      entity.x += entity.vx * dt; entity.y += entity.vy * dt;
      if (entity.x < .045 || entity.x > .955) entity.vx *= -1;
      if (entity.y < .08 || entity.y > .92) entity.vy *= -1;
      if (entity.type === 'ball') entity.spin += dt * 1.5;
      else entity.phase += dt * 1.3;
    }
  }

  draw() {
    const c = this.context;
    if (!c || !this.width || !this.height) return;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, this.width, this.height);
    for (const entity of this.entities) {
      const x = entity.x * this.width, y = entity.y * this.height;
      if (entity.type === 'player') this.drawPlayer(c, entity, x, y);
      else this.drawBall(c, entity, x, y);
    }
  }

  drawPlayer(c, entity, x, y) {
    const r = Math.max(16, Math.min(this.width, this.height) * .035);
    c.save(); c.translate(x, y); c.globalAlpha = .2;
    c.fillStyle = '#000'; c.beginPath(); c.ellipse(2, r * .42, r * 1.04, r * .72, 0, 0, Math.PI * 2); c.fill();
    c.shadowColor = entity.color; c.shadowBlur = 18;
    c.fillStyle = entity.color; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
    c.fillStyle = entity.secondary; c.beginPath(); c.moveTo(0, -r); c.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); c.lineTo(0, r); c.closePath(); c.fill();
    c.strokeStyle = '#ffffff88'; c.lineWidth = 1.3; c.stroke();
    c.rotate(entity.phase); c.fillStyle = '#f2fff7'; c.globalAlpha = .35; c.beginPath(); c.arc(0, -r * .66, 2.2, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  drawBall(c, entity, x, y) {
    const r = Math.max(8, Math.min(this.width, this.height) * .015);
    c.save(); c.translate(x, y); c.globalAlpha = .18;
    c.fillStyle = '#000'; c.beginPath(); c.ellipse(2, r * .55, r * 1.15, r * .7, 0, 0, Math.PI * 2); c.fill();
    c.rotate(entity.spin); c.shadowColor = '#e8f4ed'; c.shadowBlur = 12;
    c.fillStyle = '#dce8e0'; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
    c.fillStyle = '#31443a';
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      c.beginPath(); c.arc(Math.cos(angle) * r * .48, Math.sin(angle) * r * .48, r * .16, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
}
