export class Ball {
  static MAX_SPEED = 861.9;
  constructor(x, y) { this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.radius = 12; this.spin = 0; this.kickScale = 0; }
  reset(x, y) { this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.spin = 0; this.kickScale = 0; }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    const drag = Math.exp(-.72 * dt); this.vx *= drag; this.vy *= drag;
    const speed = Math.hypot(this.vx, this.vy);
    const cap = this.maxSpeed || Ball.MAX_SPEED;
    if (speed > cap) { this.vx *= cap / speed; this.vy *= cap / speed; }
    if (speed < 4) { this.vx = 0; this.vy = 0; }
    this.spin += speed * dt * .018; this.kickScale = Math.max(0, this.kickScale - dt * 2.7);
  }
}
