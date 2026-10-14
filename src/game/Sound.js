import { MENU_PLAYLIST, goalExcitement } from './MenuPlaylist.js';
import { MenuMusic } from './MenuMusic.js';
export function audioLevel(value,fallback=100) { const number=Number(value); return Math.max(0,Math.min(100,Number.isFinite(number)?number:fallback))/100; }
const SOUND_PATTERNS = {
        kick: [[180, 85, .075, .13, 'triangle']], bounce: [[260, 120, .045, .055, 'triangle']],
        goal: [[390, 660, .3, .19, 'sine'], [520, 820, .22, .08, 'sine']], click: [[490, 380, .045, .04, 'triangle']],
        select: [[440, 560, .065, .045, 'sine']], win: [[392, 587, .14, .08, 'sine'], [523, 784, .24, .09, 'sine']],
        loss: [[260, 170, .23, .07, 'triangle']], trophy: [[523, 659, .12, .075, 'sine'], [659, 988, .27, .09, 'sine']],
      };

export class Sound {
  constructor(getSettings) { this.getSettings = getSettings; this.ctx = null; this.lastBump = 0; this.scene = 'menu'; this.track = 0; this.excitement = 0;
    this.timer = setInterval(() => this.tick(), 100);
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
  }
  unlock() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext; if(!AudioCtx)return;
      if(!this.ctx) {
        this.ctx=new AudioCtx(); this.master=this.ctx.createGain();this.music=this.ctx.createGain();this.crowd=this.ctx.createGain();
        this.master.gain.value=0;this.music.gain.value=0;this.crowd.gain.value=0;
        this.music.connect(this.master);this.crowd.connect(this.master);this.master.connect(this.ctx.destination);
        this.menuPlayer = new MenuMusic(this.ctx, this.music, () => this.nextTrack());
        this.menuPlayer.audio.id='menu-recording-audio';this.menuPlayer.audio.hidden=true;document.body.append(this.menuPlayer.audio);
        this.menuPlayer.sync(false,MENU_PLAYLIST[this.track]);
        const buffer=this.ctx.createBuffer(1,this.ctx.sampleRate*2,this.ctx.sampleRate), data=buffer.getChannelData(0);let seed=1721;
        for(let i=0;i<data.length;i++){seed=(1664525*seed+1013904223)>>>0;data[i]=(seed/4294967296*2-1)*.7;}
        this.crowdSource=this.ctx.createBufferSource();this.crowdSource.buffer=buffer;this.crowdSource.loop=true;
        const filter=this.ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=700;filter.Q.value=.45;
        this.crowdSource.connect(filter);filter.connect(this.crowd);this.crowdSource.start();
      }
      this.menuPlayer?.unlock();
      if(this.ctx.state==='suspended')this.ctx.resume().then(()=>this.tick()).catch(()=>{});else this.tick();
    } catch {}
  }
  setScene(scene) { this.scene=scene; if(scene!=='menu')this.menuPlayer?.sync(false,MENU_PLAYLIST[this.track]);this.tick(); }
  updateAmbience(ball,world,active=true) { this.excitement=active?goalExcitement(ball,world):0;this.matchActive=active; }
  nextTrack() { this.track=(this.track+1)%MENU_PLAYLIST.length;this.tick(); }
  tick() {
    const label=document.getElementById('music-track-name');if(label && label.textContent!==MENU_PLAYLIST[this.track].name)label.textContent=MENU_PLAYLIST[this.track].name;
    if(!this.ctx || this.ctx.state!=='running')return;
    const settings=this.getSettings(), now=this.ctx.currentTime, audible=settings.sound && document.visibilityState!=='hidden';
    this.master.gain.setTargetAtTime(audible?audioLevel(settings.volume,45):0,now,.08);
    const menu=audible && this.scene==='menu' && settings.musicEnabled!==false && Number(settings.musicVolume??35)>0;
    this.music.gain.setTargetAtTime(menu?audioLevel(settings.musicVolume??35,35):0,now,.15);
    const crowd=audible && this.scene==='game' && this.matchActive && settings.ambienceEnabled!==false;
    this.crowd.gain.setTargetAtTime(crowd?(audioLevel(settings.ambienceVolume??50,50))*(.07+.34*this.excitement+(now<(this.cheerUntil||0)?.15:0)):0,now,.22);
    this.menuPlayer?.sync(menu,MENU_PLAYLIST[this.track]);
  }

  play(kind) {
    const settings = this.getSettings(); if (!settings.sound || settings.volume <= 0) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext; if (!AudioCtx) return;
      this.unlock(); if (!this.ctx) return; if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      const now = this.ctx.currentTime, vol = audioLevel(settings.effectsVolume??100,100);
      if(kind==='goal')this.cheerUntil=now+1.5;
      const patterns = SOUND_PATTERNS[kind];
      if (!patterns) return;
      for (const [start, end, duration, amplitude, type] of patterns) {
        const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
        osc.type = type; osc.frequency.setValueAtTime(start, now); osc.frequency.exponentialRampToValueAtTime(end, now + duration);
        gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(amplitude * vol, now + .008); gain.gain.exponentialRampToValueAtTime(.0001, now + duration + .03);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
        osc.connect(gain); gain.connect(this.master); osc.start(now); osc.stop(now + duration + .04);
      }
    } catch { /* Audio is optional; gameplay works if unavailable. */ }
  }
  bump() { const now = performance.now(); if (now - this.lastBump > 130) { this.lastBump = now; this.play('bounce'); } }
}
