const MOVE = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
export class Input {
  constructor() {
    this.down = new Set(); this.pressed = new Set();
    this.onKeyDown = e => {
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
    const left = this.down.has('KeyA') || this.down.has('ArrowLeft'); const right = this.down.has('KeyD') || this.down.has('ArrowRight');
    const up = this.down.has('KeyW') || this.down.has('ArrowUp'); const down = this.down.has('KeyS') || this.down.has('ArrowDown');
    return { x: Number(right) - Number(left), y: Number(down) - Number(up) };
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
