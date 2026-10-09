const COLORS = ['#65e6a5', '#eafff0', '#f2c96d', '#87c8ff', '#ff9278', '#c9a4ff'];

export class Confetti {
  constructor() { this.canvas = null; this.frame = 0; }

  play() {
    this.stop();
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {
      position: 'fixed', inset: '0', width: '100vw', height: '100vh',
      pointerEvents: 'none', zIndex: '20',
    });
    document.body.append(canvas);
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
    const duration = reducedMotion ? 900 : 2600;
    const count = reducedMotion ? 32 : 105;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize(); window.addEventListener('resize', resize);
    const pieces = Array.from({ length: count }, () => ({
      x: window.innerWidth * (.12 + Math.random() * .76), y: -20 - Math.random() * window.innerHeight * .35,
      vx: (Math.random() - .5) * 210, vy: 100 + Math.random() * 240,
      size: 4 + Math.random() * 7, angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - .5) * 8, color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
    let previous = 0;
    const started = performance.now();
    const draw = now => {
      if (this.canvas !== canvas) return;
      const elapsed = now - started;
      const dt = Math.min(.04, previous ? (now - previous) / 1000 : 0);
      previous = now;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const fade = Math.min(1, (duration - elapsed) / 500);
      for (const piece of pieces) {
        piece.x += piece.vx * dt; piece.y += piece.vy * dt; piece.vy += 280 * dt;
        piece.vx *= .997; piece.angle += piece.spin * dt;
        ctx.save(); ctx.translate(piece.x, piece.y); ctx.rotate(piece.angle);
        ctx.globalAlpha = fade; ctx.fillStyle = piece.color;
        ctx.fillRect(-piece.size / 2, -piece.size * .32, piece.size, piece.size * .64);
        ctx.restore();
      }
      if (elapsed < duration) this.frame = requestAnimationFrame(draw);
      else this.stop();
    };
    this.resize = resize;
    this.frame = requestAnimationFrame(draw);
  }

  stop() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    if (this.resize) window.removeEventListener('resize', this.resize);
    this.resize = null;
    this.canvas?.remove(); this.canvas = null;
  }
}
