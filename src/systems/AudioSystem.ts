export class AudioSystem {
  private audioContext: AudioContext | null = null;

  public prime(): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (!this.audioContext) {
      const Context = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) {
        return;
      }

      this.audioContext = new Context();
      return;
    }

    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
  }

  public playSplat(strength = 1): void {
    if (!this.audioContext) {
      return;
    }

    const now = this.audioContext.currentTime;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(170, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.14);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.14 * strength, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    osc.connect(gain).connect(this.audioContext.destination);
    osc.start(now);
    osc.stop(now + 0.18);

    const noise = this.audioContext.createBufferSource();
    noise.buffer = this.makeNoiseBuffer(this.audioContext, 0.12);

    const noiseFilter = this.audioContext.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(650, now);

    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.06 * strength, now + 0.01);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);

    noise.connect(noiseFilter).connect(noiseGain).connect(this.audioContext.destination);
    noise.start(now);
    noise.stop(now + 0.14);
  }

  private makeNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
    const frameCount = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < frameCount; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }

    return buffer;
  }
}
