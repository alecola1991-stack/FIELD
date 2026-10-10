export class Sound {
  constructor(getSettings) { this.getSettings = getSettings; this.ctx = null; this.lastBump = 0; }
  play(kind) {
    const settings = this.getSettings(); if (!settings.sound || settings.volume <= 0) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext; if (!AudioCtx) return;
      this.ctx ||= new AudioCtx(); if (this.ctx.state === 'suspended') this.ctx.resume();
      const now = this.ctx.currentTime, gain = this.ctx.createGain(), osc = this.ctx.createOscillator(), vol = settings.volume / 100;
      const patterns = {
        kick: [[180, 85, .075, .13, 'triangle']], bounce: [[260, 120, .045, .055, 'triangle']],
        goal: [[390, 660, .3, .19, 'sine'], [520, 820, .22, .08, 'sine']], click: [[490, 380, .045, .04, 'triangle']],
        select: [[440, 560, .065, .045, 'sine']], win: [[392, 587, .14, .08, 'sine'], [523, 784, .24, .09, 'sine']],
        loss: [[260, 170, .23, .07, 'triangle']], trophy: [[523, 659, .12, .075, 'sine'], [659, 988, .27, .09, 'sine']],
      }[kind];
      if (!patterns) return;
      for (const [start, end, duration, amplitude, type] of patterns) {
        const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
        osc.type = type; osc.frequency.setValueAtTime(start, now); osc.frequency.exponentialRampToValueAtTime(end, now + duration);
        gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(amplitude * vol, now + .008); gain.gain.exponentialRampToValueAtTime(.0001, now + duration + .03);
        osc.connect(gain); gain.connect(this.ctx.destination); osc.start(now); osc.stop(now + duration + .04);
      }
    } catch { /* Audio is optional; gameplay works if unavailable. */ }
  }
  bump() { const now = performance.now(); if (now - this.lastBump > 130) { this.lastBump = now; this.play('bounce'); } }
}
