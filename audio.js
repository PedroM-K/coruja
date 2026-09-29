// Procedural Audio Synthesizer for Oblívio RPG Web App
// Generates dice rolls, clicks, and hit effects directly with Web Audio API (offline-friendly, 0 external files)

class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
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
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.04);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {
      // Audio might fail if user hasn't interacted yet
    }
  }

  // Dice roll clatter sound (multiple tumbling impacts)
  playDiceRoll() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const bounces = 4 + Math.floor(Math.random() * 3);
      
      for (let i = 0; i < bounces; i++) {
        const timeOffset = now + (i * 0.06) + (Math.random() * 0.03);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        filter.type = 'bandpass';
        filter.frequency.value = 800 + Math.random() * 600;
        filter.Q.value = 3;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150 + Math.random() * 200, timeOffset);
        osc.frequency.exponentialRampToValueAtTime(80, timeOffset + 0.05);

        const volume = (1 - (i / bounces) * 0.6) * 0.15;
        gain.gain.setValueAtTime(volume, timeOffset);
        gain.gain.exponentialRampToValueAtTime(0.001, timeOffset + 0.05);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(timeOffset);
        osc.stop(timeOffset + 0.05);
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
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.25);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {}
  }

  // Sucesso Extremo fanfare / chime
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
        const t = now + idx * 0.08;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + 0.4);
      });
    } catch (e) {}
  }

  // Falha Extrema dark dissonance
  playFailure() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;

      const freqs = [185.00, 138.59, 98.00];
      const now = this.ctx.currentTime;
      
      freqs.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + idx * 0.09;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.35);

        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + 0.4);
      });
    } catch (e) {}
  }
}

window.soundFX = new SoundFX();
