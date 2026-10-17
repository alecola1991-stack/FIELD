export class Ball {
  static MAX_SPEED = 861.9;
  static CURL_RATE = 1.1; // initial turn rate of a curved shot (rad/s)
  static CURL_DECAY = 1.6;
  constructor(x, y) { this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.radius = 12; this.spin = 0; this.kickScale = 0; this.curl = 0; }
  reset(x, y) { this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.spin = 0; this.kickScale = 0; this.curl = 0; }
  update(dt) {
    // Curved shot: the spin (curl, rad/s) turns the velocity and fades out.
    if (this.curl) {
      const turn = this.curl * dt, cos = Math.cos(turn), sin = Math.sin(turn), vx = this.vx;
      this.vx = vx * cos - this.vy * sin; this.vy = vx * sin + this.vy * cos;
      this.curl *= Math.exp(-Ball.CURL_DECAY * dt);
      if (Math.abs(this.curl) < .02 || Math.hypot(this.vx, this.vy) < 60) this.curl = 0;
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    const drag = Math.exp(-.72 * dt); this.vx *= drag; this.vy *= drag;
    const speed = Math.hypot(this.vx, this.vy);
    const cap = this.maxSpeed || Ball.MAX_SPEED;
    if (speed > cap) { this.vx *= cap / speed; this.vy *= cap / speed; }
    if (speed < 4) { this.vx = 0; this.vy = 0; }
    this.spin += speed * dt * .018; this.kickScale = Math.max(0, this.kickScale - dt * 2.7);
  }
}
