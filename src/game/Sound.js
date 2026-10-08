export class Sound {
  constructor(getSettings) { this.getSettings = getSettings; this.ctx = null; this.lastBump = 0; }
  play(kind) {
    const settings = this.getSettings(); if (!settings.sound || settings.volume <= 0) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext; if (!AudioCtx) return;
      this.ctx ||= new AudioCtx(); if (this.ctx.state === 'suspended') this.ctx.resume();
      const now = this.ctx.currentTime, gain = this.ctx.createGain(), osc = this.ctx.createOscillator(), vol = settings.volume / 100;
      const tones = { kick: [180, 85, .075, .13], bounce: [260, 120, .045, .055], goal: [390, 660, .3, .19], click: [490, 380, .045, .04] }[kind];
      if (!tones) return;
      osc.type = kind === 'goal' ? 'sine' : 'triangle'; osc.frequency.setValueAtTime(tones[0], now); osc.frequency.exponentialRampToValueAtTime(tones[1], now + tones[2]);
      gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(tones[3] * vol, now + .008); gain.gain.exponentialRampToValueAtTime(.0001, now + tones[2] + .03);
      osc.connect(gain); gain.connect(this.ctx.destination); osc.start(now); osc.stop(now + tones[2] + .04);
    } catch { /* Audio is optional; gameplay works if unavailable. */ }
  }
  bump() { const now = performance.now(); if (now - this.lastBump > 130) { this.lastBump = now; this.play('bounce'); } }
}
