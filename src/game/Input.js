// Curved shot keys: they never shoot by themselves; held while pressing Space they curve the shot (and show its path).
export const CURVE_KEYS = ['ShiftLeft', 'ShiftRight', 'KeyC'];
const MOVE = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
// Control schemes. "arcade": Space shoots where you push, Shift/C + Space curves.
// "classic": K shoots at goal, L passes to the teammate, J + K curved shot at goal (the game aims).
export const CONTROL_SCHEMES = Object.freeze(['arcade', 'classic']);
export const CLASSIC_KEYS = Object.freeze({ shoot: 'KeyK', pass: 'KeyL', curve: 'KeyJ' });
export class Input {
  constructor() {
    this.enabled = true; this.scheme = 'arcade'; this.padAxes = { x: 0, y: 0 }; this.padCurve = false; this.down = new Set(); this.pressed = new Set();
    this.onKeyDown = e => {
      if (!this.enabled) return;
      // Keep gameplay shortcuts out of form fields and native controls. In
      // particular, WASD must remain ordinary text when the name editor is focused.
      if (isInteractiveTarget(e.target)) return;
      if (MOVE.has(e.code) || e.code === 'Space') e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    };
    this.onKeyUp = e => this.down.delete(e.code);
    this.onBlur = () => { this.down.clear(); this.pressed.clear(); document.querySelectorAll('[data-touch-code].pressed').forEach(control => control.classList.remove('pressed')); };
    this.onPointerDown = e => {
      if (!this.enabled) return;
      const control = e.target.closest?.('[data-touch-code]');
      if (!control) return;
      e.preventDefault();
      const code = control.dataset.touchCode;
      control.setPointerCapture?.(e.pointerId);
      this.press(code);
      control.classList.add('pressed');
    };
    this.onPointerEnd = e => {
      const control = e.target.closest?.('[data-touch-code]');
      if (!control) return;
      this.release(control.dataset.touchCode);
      control.classList.remove('pressed');
    };
    window.addEventListener('keydown', this.onKeyDown); window.addEventListener('keyup', this.onKeyUp); window.addEventListener('blur', this.onBlur);
    document.addEventListener('pointerdown', this.onPointerDown);
    for (const event of ['pointerup','pointercancel','lostpointercapture']) document.addEventListener(event, this.onPointerEnd);
  }
  axes() {
    if (!this.enabled) return { x: 0, y: 0 };
    const left = this.down.has('KeyA') || this.down.has('ArrowLeft'); const right = this.down.has('KeyD') || this.down.has('ArrowRight');
    const up = this.down.has('KeyW') || this.down.has('ArrowUp'); const down = this.down.has('KeyS') || this.down.has('ArrowDown');
    const keyboard = { x: Number(right) - Number(left), y: Number(down) - Number(up) };
    const screen = keyboard.x || keyboard.y ? keyboard : (this.padAxes || { x: 0, y: 0 });
    // Controls are screen-relative: with the pitch rotated (portrait), screen up
    // moves toward the attacked goal (+x) and screen right moves toward +y.
    return this.rotated ? { x: -screen.y || 0, y: screen.x || 0 } : screen;
  }
  setScheme(scheme) { this.scheme = scheme === 'classic' ? 'classic' : 'arcade'; }
  curveHeld() {
    if (!this.enabled) return false;
    if (this.scheme === 'classic') return this.padCurve || this.down.has(CLASSIC_KEYS.curve);
    return this.padCurve || CURVE_KEYS.some(code => this.down.has(code));
  }
  // One kick per frame. Arcade: Space (curved with Shift / C held).
  // Classic: K = shot at goal (curved with J held), L = pass; `shot` tells the game to aim it.
  consumeKick() {
    if (this.scheme === 'classic') {
      const shoot = this.consume(CLASSIC_KEYS.shoot), pass = !shoot && this.consume(CLASSIC_KEYS.pass);
      this.consume('Space');
      if (shoot) return { kick: true, curve: this.curveHeld(), shot: 'goal' };
      if (pass) return { kick: true, curve: false, shot: 'pass' };
      return { kick: false, curve: false };
    }
    const space = this.consume('Space');
    return { kick: space, curve: space && this.curveHeld() };
  }
  consume(code) { const hit = this.pressed.has(code); this.pressed.delete(code); return hit; }
  press(code) { if (!this.down.has(code)) this.pressed.add(code); this.down.add(code); }
  // Keep a press queued until the next game frame consumes it. A quick touch
  // tap can start and finish between two animation frames, so clearing
  // `pressed` here would make the action (especially a shot) disappear.
  release(code) { this.down.delete(code); }
  endFrame() { this.pressed.clear(); }
}

function isInteractiveTarget(target) {
  return Boolean(target && typeof target.closest === 'function'
    && target.closest('input, textarea, select, button, a, [contenteditable="true"]'));
}
