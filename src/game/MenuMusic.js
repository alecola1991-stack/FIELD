// Decode one recording at a time. Large recordings are bundled in small parts
// to remain compatible with the integrity validator in older portable launchers.
export class MenuMusic {
  constructor(context, destination, onEnded, audio = new Audio(), fetcher = fetch, urls = URL) {
    this.audio = audio; this.fetcher = fetcher.bind(globalThis); this.urls = urls; this.active = false; this.pending = false;
    this.blocked = false; this.failed = false; this.loading = false; this.revision = 0;
    audio.preload = 'metadata';
    this.source = context.createMediaElementSource(audio); this.source.connect(destination);
    audio.addEventListener('ended', () => { if (this.active) onEnded(); });
    audio.addEventListener('error', () => { this.failed = true; });
  }
  unlock() { this.blocked = false; }
  async loadParts(track, revision) {
    try {
      const buffers = await Promise.all((track.parts || [track.src]).map(async url => {
        const response = await this.fetcher(url, { signal: this.abort.signal });
        if (!response.ok) throw new Error('Audio download failed');
        return response.arrayBuffer();
      }));
      if (revision !== this.revision) return;
      this.objectURL = this.urls.createObjectURL(new Blob(buffers, { type: 'audio/mpeg' }));
      this.audio.src = this.objectURL; this.audio.load(); this.loading = false;
      this.sync(this.active, track);
    } catch (error) {
      if (revision === this.revision) { this.loading = false; this.failed = error?.name !== 'AbortError'; }
    }
  }
  sync(active, track) {
    this.active = active;
    if (this.url !== track.src) {
      this.audio.pause(); this.abort?.abort();
      if (this.objectURL) this.urls.revokeObjectURL(this.objectURL);
      this.objectURL = null; this.url = track.src; this.failed = false; this.revision++;
      this.loading = true; this.loadStarted = false;
      this.abort = new AbortController();
    }
    if (this.loading && active && !this.loadStarted) { this.loadStarted = true; this.loadParts(track, this.revision); }
    if (!active) { this.audio.pause(); return; }
    if (this.loading || !this.audio.paused || this.pending || this.blocked || this.failed) return;
    this.pending = true; const revision = this.revision;
    Promise.resolve().then(() => {
      if (this.active && revision === this.revision) return this.audio.play();
    }).catch(error => {
      if (revision !== this.revision) return;
      if (error?.name === 'NotAllowedError') this.blocked = true;
      else if (error?.name !== 'AbortError') this.failed = true;
    }).finally(() => { this.pending = false; if (!this.active) this.audio.pause(); });
  }
}
