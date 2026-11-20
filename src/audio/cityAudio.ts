// Procedural 100% offline Web Audio soundscape for Canary Wharf, London Docklands
export class CityAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private waterGain: GainNode | null = null;
  private started = false;
  muted = true;

  startOnGesture(): void {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.32;
      master.connect(ctx.destination);
      this.masterGain = master;

      // 1. Deep London urban traffic & Docklands breeze bed (filtered brown/pink noise)
      const bufSize = ctx.sampleRate * 4;
      const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufSize; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.028 * white) / 1.028;
        data[i] = lastOut * 3.1;
      }

      const citySrc = ctx.createBufferSource();
      citySrc.buffer = noiseBuf;
      citySrc.loop = true;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 280;

      const cityGain = ctx.createGain();
      cityGain.gain.value = 0.52;

      citySrc.connect(lowpass);
      lowpass.connect(cityGain);
      cityGain.connect(master);
      citySrc.start();

      // 2. Waterfront & Cabot Square fountain gentle water wash (bandpass noise)
      const waterSrc = ctx.createBufferSource();
      waterSrc.buffer = noiseBuf;
      waterSrc.loop = true;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 1150;
      bandpass.Q.value = 0.9;

      const waterGain = ctx.createGain();
      waterGain.gain.value = 0.06;
      this.waterGain = waterGain;

      waterSrc.connect(bandpass);
      bandpass.connect(waterGain);
      waterGain.connect(master);
      waterSrc.start();

      // 3. Subtle distant DLR electric rail resonance harmonic
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 92;
      const oscGain = ctx.createGain();
      oscGain.gain.value = 0.018;
      osc.connect(oscGain);
      oscGain.connect(master);
      osc.start();

      this.started = true;
    } catch {
      // Silent fallback if browser blocks or lacks Web Audio
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!muted && !this.started) {
      this.startOnGesture();
    }
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.32, this.ctx.currentTime, 0.12);
    }
  }

  toggle(): boolean {
    this.setMuted(!this.muted);
    return !this.muted;
  }

  updateSpatialAmbience(playerX: number, playerZ: number): void {
    if (!this.ctx || !this.waterGain || this.muted) return;
    // Boost gentle water sound near Cabot Square fountain, North Dock, Middle Dock, or Thames edge
    const distFountain = Math.hypot(playerX + 66, playerZ);
    const distNorthDock = Math.abs(playerZ + 112);
    const distMidDock = Math.abs(playerZ - 138);
    const distThames = Math.abs(playerX + 232);
    const closestWater = Math.min(distFountain, distNorthDock, distMidDock, distThames);
    const proximity = Math.max(0, 1 - closestWater / 55);
    this.waterGain.gain.setTargetAtTime(0.03 + proximity * 0.14, this.ctx.currentTime, 0.25);
  }
}
