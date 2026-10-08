export class GameState {
  constructor() { this.mode = 'bot'; this.running = false; this.paused = false; this.elapsed = 0; this.scorePlayer = 0; this.scoreBot = 0; this.goalTimer = 0; this.matchOver = false; }
  start(mode) { this.mode = mode; this.running = true; this.paused = false; this.elapsed = 0; this.scorePlayer = 0; this.scoreBot = 0; this.goalTimer = 0; this.matchOver = false; }
  resetScore() { this.scorePlayer = 0; this.scoreBot = 0; }
  formatTime() { const sec = Math.floor(this.elapsed); return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`; }
}
