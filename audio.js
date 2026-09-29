// Procedural Audio Synthesizer for Oblívio RPG Web App
// Generates dice rolls, clicks, and hit effects directly with Web Audio API (offline-friendly, 0 external files)

class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch (e) {
      // Audio might fail if user hasn't interacted yet
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  // Soft UI click
  playClick() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.04);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {}
  }

  // Ethereal grimoire page whoosh / tab switch
  playWhoosh() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.12;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.exponentialRampToValueAtTime(1200, now + 0.06);
      filter.frequency.exponentialRampToValueAtTime(300, now + 0.12);
      filter.Q.value = 2.5;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(now);
      noise.stop(now + 0.12);
    } catch (e) {}
  }

  // Dice roll clatter sound (multiple tumbling impacts)
  playDiceRoll() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const bounces = 5 + Math.floor(Math.random() * 3);
      
      for (let i = 0; i < bounces; i++) {
        const timeOffset = now + (i * 0.055) + (Math.random() * 0.025);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        filter.type = 'bandpass';
        filter.frequency.value = 900 + Math.random() * 700;
        filter.Q.value = 3.5;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140 + Math.random() * 220, timeOffset);
        osc.frequency.exponentialRampToValueAtTime(75, timeOffset + 0.045);

        const volume = (1 - (i / bounces) * 0.55) * 0.16;
        gain.gain.setValueAtTime(volume, timeOffset);
        gain.gain.exponentialRampToValueAtTime(0.001, timeOffset + 0.045);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(timeOffset);
        osc.stop(timeOffset + 0.045);
      }
    } catch (e) {}
  }

  // Hit / Body location roll impact
  playHit() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      
      // Low punch osc
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.3);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);

      // Noise slap
      const bufferSize = this.ctx.sampleRate * 0.05;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.15, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      noise.connect(nGain);
      nGain.connect(this.ctx.destination);
      noise.start(now);
      noise.stop(now + 0.05);
    } catch (e) {}
  }

  // Sucesso Extremo / Sucesso fanfare / golden chime
  playSuccess() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      const now = this.ctx.currentTime;
      
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + idx * 0.07;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + 0.45);
      });
    } catch (e) {}
  }

  // Falha Extrema dark dissonance
  playFailure() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;

      const freqs = [185.00, 138.59, 98.00, 73.42];
      const now = this.ctx.currentTime;
      
      freqs.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + idx * 0.08;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.65, t + 0.45);

        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + 0.5);
      });
    } catch (e) {}
  }
}

window.soundFX = new SoundFX();

// Auto unlock on first user click anywhere
window.addEventListener('click', () => {
  if (window.soundFX) window.soundFX.init();
}, { once: true });
