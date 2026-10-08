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
    this.onBlur = () => { this.down.clear(); this.pressed.clear(); };
    window.addEventListener('keydown', this.onKeyDown); window.addEventListener('keyup', this.onKeyUp); window.addEventListener('blur', this.onBlur);
  }
  axes() {
    const left = this.down.has('KeyA') || this.down.has('ArrowLeft'); const right = this.down.has('KeyD') || this.down.has('ArrowRight');
    const up = this.down.has('KeyW') || this.down.has('ArrowUp'); const down = this.down.has('KeyS') || this.down.has('ArrowDown');
    return { x: Number(right) - Number(left), y: Number(down) - Number(up) };
  }
  consume(code) { const hit = this.pressed.has(code); this.pressed.delete(code); return hit; }
  endFrame() { this.pressed.clear(); }
}

function isInteractiveTarget(target) {
  return Boolean(target && typeof target.closest === 'function'
    && target.closest('input, textarea, select, button, a, [contenteditable="true"]'));
}
