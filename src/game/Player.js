export class Player {
  constructor({ x, y, name, number = 0, color = '#65e6a5', secondaryColor = null, radius = 22, speed = 305, isBot = false }) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.name = name; this.number = number; this.color = color; this.secondaryColor = secondaryColor;
    this.radius = radius; this.maxSpeed = speed; this.isBot = isBot; this.faceX = isBot ? -1 : 1; this.faceY = 0;
    this.shotCooldown = 0; this.powerCooldown = 0; this.powerFlash = 0; this.kickScale = 0; this.boost = 0;
  }
  move(dx, dy, dt, speedMultiplier = 1) {
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      dx /= len; dy /= len;
      this.faceX = dx; this.faceY = dy;
      const accel = 1850;
      this.vx += dx * accel * dt; this.vy += dy * accel * dt;
    }
    const speed = Math.hypot(this.vx, this.vy);
    const cap = this.maxSpeed * speedMultiplier;
    if (speed > cap) { this.vx = this.vx / speed * cap; this.vy = this.vy / speed * cap; }
    const drag = Math.exp(-(len ? 2.2 : 5.5) * dt);
    this.vx *= drag; this.vy *= drag;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.shotCooldown = Math.max(0, this.shotCooldown - dt);
    this.kickScale = Math.max(0, this.kickScale - dt * 3.4);
    this.boost = Math.max(0, this.boost - dt * 2.5);
  }
  stop() { this.vx = 0; this.vy = 0; }
}
