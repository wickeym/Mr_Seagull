export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private leadDelay: DelayNode | null = null;
  private noise: AudioBuffer | null = null;
  private goo: AudioBuffer | null = null;
  private splatId = 0;
  private musicTimer: number | null = null;
  private musicNext = 0;
  private step = 0;
  private muted = false;
  private started = false;
  musicOn = true;

  get ready(): boolean {
    return this.started;
  }

  async unlock(): Promise<void> {
    if (this.started) {
      await this.ctx?.resume();
      return;
    }
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.58;
    master.connect(ctx.destination);

    const music = ctx.createGain();
    music.gain.value = 0.3;
    music.connect(master);

    const sfx = ctx.createGain();
    sfx.gain.value = 1;
    sfx.connect(master);

    const delay = ctx.createDelay(0.5);
    delay.delayTime.value = 0.27;
    const delayFb = ctx.createGain();
    delayFb.gain.value = 0.28;
    const delayWet = ctx.createGain();
    delayWet.gain.value = 0.22;
    delay.connect(delayFb);
    delayFb.connect(delay);
    delay.connect(delayWet);
    delayWet.connect(music);

    this.ctx = ctx;
    this.master = master;
    this.musicGain = music;
    this.sfxGain = sfx;
    this.leadDelay = delay;
    this.noise = whiteNoise(ctx, 1);
    this.goo = gooNoise(ctx, 1.4);
    this.started = true;
    await ctx.resume();
    this.startMusic();
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.58;
  }

  private env(node: AudioNode, start: number, peak: number, attack: number, decay: number, dest?: AudioNode): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + Math.max(0.004, attack));
    g.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
    node.connect(g);
    g.connect(dest ?? this.sfxGain!);
    return g;
  }

  private tone(type: OscillatorType, freq: number, dur: number, peak = 0.2, at = 0, slide = 0): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + at;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    this.env(osc, t, peak, 0.01, dur);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private noiseBurst(dur: number, peak: number, hp = 400, lp = 1800, at = 0): void {
    if (!this.ctx || !this.noise || this.muted) return;
    const t = this.ctx.currentTime + at;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(hp, t);
    filter.Q.value = 0.7;
    src.connect(filter);
    const g = this.env(filter, t, peak, 0.005, dur);
    const low = this.ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = lp;
    g.disconnect();
    g.connect(low);
    low.connect(this.sfxGain!);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  private gooLayer(
    t: number,
    dur: number,
    peak: number,
    type: BiquadFilterType,
    f0: number,
    f1: number,
    q: number,
    buffer: AudioBuffer | null,
    dest?: AudioNode
  ): void {
    if (!this.ctx || !buffer || this.muted) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.setValueAtTime(0.82 + Math.random() * 0.18, t);
    src.playbackRate.exponentialRampToValueAtTime(0.38 + Math.random() * 0.12, t + dur);
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(f0, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    src.connect(filter);
    this.env(filter, t, peak, 0.008, dur, dest ?? this.sfxGain!);
    src.start(t);
    src.stop(t + dur + 0.08);
  }

  flap(): void {
    this.noiseBurst(0.08, 0.06, 700, 1400);
    this.tone('sine', 240, 0.07, 0.03);
  }

  drop(fat = false): void {
    if (fat) {
      this.tone('sine', 150, 0.18, 0.12, 0, 62);
      this.tone('triangle', 92, 0.22, 0.1, 0.02, 40);
      this.noiseBurst(0.14, 0.08, 220, 650);
      return;
    }
    this.tone('sine', 210, 0.14, 0.1, 0, 90);
    this.tone('triangle', 130, 0.18, 0.07, 0.02, 70);
    this.noiseBurst(0.1, 0.05, 280, 800);
  }

  splat(scale = 1): void {
    if (!this.ctx || !this.goo || this.muted || !this.sfxGain) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const s = scale;
    const v = this.splatId++ % 4;
    const spec =
      v === 0
        ? { thud: 98, flesh: 154, goo: 520, drip: 1, peak: 0.3, dur: 0.2 } // plump
        : v === 1
          ? { thud: 124, flesh: 188, goo: 760, drip: 3, peak: 0.26, dur: 0.18 } // wet
          : v === 2
            ? { thud: 146, flesh: 230, goo: 880, drip: 2, peak: 0.24, dur: 0.15 } // ripe
            : { thud: 76, flesh: 122, goo: 400, drip: 2, peak: 0.34, dur: 0.26 }; // heavy
    const jitter = 0.94 + Math.random() * 0.12;
    const thudF = spec.thud * jitter;

    const thud = ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(thudF, t);
    thud.frequency.exponentialRampToValueAtTime(Math.max(36, thudF * 0.46), t + spec.dur * s);
    this.env(thud, t, spec.peak * s, 0.012, spec.dur * s);
    thud.start(t);
    thud.stop(t + spec.dur * s + 0.04);

    const flesh = ctx.createOscillator();
    flesh.type = 'triangle';
    flesh.frequency.setValueAtTime(spec.flesh * jitter, t);
    flesh.frequency.exponentialRampToValueAtTime(48, t + spec.dur * 1.1 * s);
    this.env(flesh, t, 0.14 * s, 0.014, spec.dur * 1.05 * s);
    flesh.start(t);
    flesh.stop(t + spec.dur * s + 0.06);

    this.gooLayer(t, spec.dur * 1.15 * s, (v === 1 ? 0.3 : 0.22) * s, 'lowpass', spec.goo, 120, 0.85, this.goo);
    this.gooLayer(t + 0.012, spec.dur * 0.85 * s, 0.12 * s, 'bandpass', spec.goo * 0.7, 110, 1.05, this.goo);

    for (let i = 0; i < spec.drip; i++) {
      const at = 0.06 + i * 0.05 + Math.random() * 0.02;
      this.tone('sine', 64 + Math.random() * (v === 2 ? 80 : 44), 0.1 * s, 0.055 * s, at, 26);
    }
    if (v !== 0) {
      this.gooLayer(t + 0.11 + Math.random() * 0.03, 0.11 * s, 0.09 * s, 'lowpass', 560, 150, 1.05, this.goo);
    }
  }

  chargeReady(): void {
    this.tone('sine', 164, 0.1, 0.07, 0, 118);
    this.tone('triangle', 220, 0.12, 0.05, 0.02, 140);
  }

  hit(combo: number, fat = false): void {
    this.splat(fat ? 1.55 : 1);
    const base = 392 + Math.min(combo, 12) * 22;
    this.tone('triangle', base, 0.12, 0.08, 0.16);
    this.tone('sine', base * 1.5, 0.14, 0.06, 0.22);
  }

  miss(fat = false): void {
    this.splat(fat ? 1.45 : 1);
    this.tone('sine', 96, 0.18, 0.06, 0.12, 54);
  }

  pickup(): void {
    this.tone('sine', 659, 0.1, 0.1);
    this.tone('triangle', 880, 0.12, 0.1, 0.05);
    this.tone('sine', 1318, 0.18, 0.07, 0.1);
  }

  crash(): void {
    this.noiseBurst(0.35, 0.32, 120, 500);
    this.tone('sawtooth', 90, 0.3, 0.16, 0, 40);
    this.tone('square', 60, 0.22, 0.1);
  }

  skid(): void {
    this.noiseBurst(0.28, 0.22, 900, 2400);
    this.noiseBurst(0.4, 0.16, 400, 1400, 0.05);
    this.tone('sawtooth', 180, 0.22, 0.07, 0, 70);
    this.tone('square', 140, 0.18, 0.05, 0.04, 55);
  }

  smash(): void {
    this.noiseBurst(0.16, 0.28, 180, 700);
    this.tone('sawtooth', 110, 0.14, 0.14, 0, 48);
    this.tone('triangle', 70, 0.18, 0.1, 0.02, 32);
    this.noiseBurst(0.12, 0.12, 1600, 3800, 0.03);
  }

  ui(): void {
    this.tone('triangle', 523, 0.08, 0.08);
    this.tone('sine', 784, 0.1, 0.07, 0.05);
  }

  start(): void {
    this.tone('sawtooth', 220, 0.16, 0.08);
    this.tone('sawtooth', 277, 0.16, 0.07, 0.02);
    this.tone('triangle', 330, 0.14, 0.1, 0.08);
    this.tone('triangle', 440, 0.18, 0.1, 0.16);
    this.tone('sine', 659, 0.22, 0.08, 0.24);
  }

  over(): void {
    this.tone('sawtooth', 349, 0.28, 0.08, 0, 220);
    this.tone('triangle', 262, 0.32, 0.1, 0.12);
    this.tone('sine', 196, 0.5, 0.12, 0.28, 110);
  }

  nearMiss(fat = false): void {
    this.splat(fat ? 1.35 : 1);
    this.tone('triangle', 300, 0.08, 0.06, 0.14);
    this.tone('sine', 340, 0.1, 0.05, 0.2);
  }

  gasp(): void {
    this.tone('sine', 720, 0.07, 0.07);
    this.tone('triangle', 880, 0.09, 0.06, 0.04);
    this.noiseBurst(0.08, 0.07, 1800, 4200);
  }

  sling(): void {
    this.tone('triangle', 220, 0.07, 0.07, 0, 140);
    this.tone('sine', 160, 0.1, 0.06, 0.01, 80);
    this.noiseBurst(0.08, 0.1, 900, 2400);
  }

  pebbleHit(): void {
    this.tone('square', 150, 0.12, 0.12, 0, 70);
    this.tone('triangle', 90, 0.16, 0.1, 0.02, 40);
    this.noiseBurst(0.16, 0.22, 350, 1200);
  }

  private startMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return;
    const sixteenth = SIXTEENTH;

    const schedule = (): void => {
      if (!this.ctx) return;
      if (this.musicNext < this.ctx.currentTime + 0.04) this.musicNext = this.ctx.currentTime + 0.06;
      const start = this.musicNext;
      for (let i = 0; i < 16; i++) this.musicStep(start + i * sixteenth, this.step + i);
      this.step += 16;
      this.musicNext = start + 16 * sixteenth;
      const wait = (this.musicNext - this.ctx.currentTime - 0.14) * 1000;
      this.musicTimer = window.setTimeout(schedule, Math.max(30, wait));
    };
    schedule();
  }

  private musicStep(t: number, step: number): void {
    if (!this.ctx || !this.musicGain || this.muted || !this.musicOn) return;
    const s = ((step % 128) + 128) % 128;
    const bar = Math.floor(s / 16);
    const i = s % 16;
    const root = 110;
    const chord = CHORDS[bar]!;
    const bassRoot = BASS_ROOT[bar]!;

    if (i % 4 === 0) this.kick(t, i === 0 ? 0.42 : 0.34);
    if (i === 4 || i === 12) this.snare(t);
    if (i === 10 && bar % 2 === 1) this.snare(t, 0.12);
    this.hat(t, i % 2 === 0 ? 0.05 : 0.028, i % 4 === 2);
    if (bar === 7 && i >= 10) this.tom(t, 140 - (i - 10) * 18);

    const bassPat = BASS_PAT[i]!;
    if (bassPat) {
      const semi = bassRoot + (bassPat === 2 ? 12 : bassPat === 3 ? 7 : 0);
      this.bass(t, root * Math.pow(2, semi / 12), SIXTEENTH * 1.35);
    }

    if (i % 2 === 0) {
      const arp = chord[(i / 2) % chord.length]!;
      this.arp(t, root * 4 * Math.pow(2, arp / 12), SIXTEENTH * 1.6);
    }

    if (i === 0) this.pad(t, chord.map((n) => root * 2 * Math.pow(2, n / 12)), SIXTEENTH * 16);

    const lead = LEAD[s]!;
    if (lead !== null) {
      this.lead(t, 220 * Math.pow(2, lead / 12), SIXTEENTH * (leadHold(s) + 0.15));
    }

    if (bar % 2 === 0 && i === 0) this.stab(t, chord.map((n) => root * 4 * Math.pow(2, n / 12)));
    if (bar >= 4 && (i === 4 || i === 12)) this.cowbell(t);
  }

  private kick(t: number, peak: number): void {
    if (!this.ctx || !this.musicGain || !this.noise) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    this.env(osc, t, peak, 0.004, 0.18, this.musicGain);
    osc.start(t);
    osc.stop(t + 0.22);

    const click = this.ctx.createBufferSource();
    click.buffer = this.noise;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1500;
    click.connect(hp);
    this.env(hp, t, 0.08, 0.001, 0.03, this.musicGain);
    click.start(t);
    click.stop(t + 0.04);
  }

  private snare(t: number, peak = 0.28): void {
    if (!this.ctx || !this.musicGain || !this.noise) return;
    const body = this.ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(196, t);
    body.frequency.exponentialRampToValueAtTime(110, t + 0.08);
    this.env(body, t, peak * 0.45, 0.003, 0.1, this.musicGain);
    body.start(t);
    body.stop(t + 0.12);

    const snap = this.ctx.createBufferSource();
    snap.buffer = this.noise;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2100;
    bp.Q.value = 0.9;
    snap.connect(bp);
    this.env(bp, t, peak, 0.002, 0.11, this.musicGain);
    snap.start(t);
    snap.stop(t + 0.14);

    const gate = this.ctx.createBufferSource();
    gate.buffer = this.noise;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2800;
    gate.connect(hp);
    this.env(hp, t, peak * 0.55, 0.004, 0.2, this.musicGain);
    gate.start(t);
    gate.stop(t + 0.22);
  }

  private hat(t: number, peak: number, open: boolean): void {
    if (!this.ctx || !this.noise || !this.musicGain) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = open ? 6200 : 7800;
    src.connect(f);
    this.env(f, t, peak, 0.001, open ? 0.12 : 0.04, this.musicGain);
    src.start(t);
    src.stop(t + (open ? 0.14 : 0.05));
  }

  private tom(t: number, freq: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.12);
    this.env(osc, t, 0.16, 0.004, 0.12, this.musicGain);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  private bass(t: number, freq: number, dur: number): void {
    if (!this.ctx || !this.musicGain) return;
    const saw = this.ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = freq;
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = freq * 0.5;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(520, t);
    lp.frequency.exponentialRampToValueAtTime(280, t + dur * 0.8);
    lp.Q.value = 1.1;
    saw.connect(lp);
    this.env(lp, t, 0.16, 0.01, dur, this.musicGain);
    this.env(sub, t, 0.12, 0.01, dur, this.musicGain);
    saw.start(t);
    sub.start(t);
    saw.stop(t + dur + 0.04);
    sub.stop(t + dur + 0.04);
  }

  private arp(t: number, freq: number, dur: number): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    osc.connect(lp);
    this.env(lp, t, 0.035, 0.008, dur * 0.7, this.musicGain);
    osc.start(t);
    osc.stop(t + dur);
  }

  private pad(t: number, freqs: number[], dur: number): void {
    if (!this.ctx || !this.musicGain) return;
    for (const freq of freqs) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(900, t);
      lp.frequency.linearRampToValueAtTime(1400, t + dur * 0.6);
      osc.connect(lp);
      this.env(lp, t, 0.045, 0.08, dur * 0.9, this.musicGain);
      osc.start(t);
      osc.stop(t + dur);
    }
  }

  private lead(t: number, freq: number, dur: number): void {
    if (!this.ctx || !this.musicGain || !this.leadDelay) return;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    lp.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lp.connect(g);
    g.connect(this.musicGain);
    g.connect(this.leadDelay);
    for (const cents of [-9, 8]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq * Math.pow(2, cents / 1200);
      osc.connect(lp);
      osc.start(t);
      osc.stop(t + dur + 0.04);
    }
  }

  private stab(t: number, freqs: number[]): void {
    if (!this.ctx || !this.musicGain) return;
    for (const freq of freqs) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1800, t);
      lp.frequency.exponentialRampToValueAtTime(700, t + 0.18);
      osc.connect(lp);
      this.env(lp, t, 0.05, 0.008, 0.2, this.musicGain);
      osc.start(t);
      osc.stop(t + 0.24);
    }
  }

  private cowbell(t: number): void {
    if (!this.ctx || !this.musicGain) return;
    for (const freq of [540, 810]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 700;
      bp.Q.value = 4;
      osc.connect(bp);
      this.env(bp, t, 0.03, 0.002, 0.08, this.musicGain);
      osc.start(t);
      osc.stop(t + 0.1);
    }
  }
}

const MUSIC_BPM = 122;
const SIXTEENTH = 60 / MUSIC_BPM / 4;

const CHORDS: number[][] = [
  [0, 3, 7],
  [0, 3, 7],
  [-4, 0, 3],
  [-4, 0, 3],
  [3, 7, 10],
  [3, 7, 10],
  [-2, 2, 5],
  [-2, 2, 5]
];

const BASS_ROOT = [0, 0, -4, -4, 3, 3, -2, -2];
const BASS_PAT = [1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 2, 3, 0, 2, 0];

const R = null;
const LEAD: Array<number | null> = [
  12, R, 7, R, 8, 10, 12, R, 15, 12, 10, 8, 7, R, 5, 3, 8, R, 12, R, 8, 7, 5, R, 7, 8, 10, R, 12, R, 0, R, 12, 15, 12,
  10, 8, R, 7, R, 3, 5, 7, 8, 10, 12, 7, R, 15, R, 14, 12, 10, 8, 7, 5, 7, 8, 10, 12, 15, R, 12, R, 12, R, 7, R, 8, 10,
  12, R, 15, 12, 10, 8, 7, R, 5, 3, 8, R, 12, R, 8, 7, 5, R, 7, 8, 10, R, 12, R, 0, R, 12, 15, 19, 17, 15, 12, 10, R, 8,
  7, 5, 7, 8, 10, 12, R, 19, R, 17, 15, 12, 10, 8, 7, 12, 10, 8, 7, 5, R, 0, R
];

function leadHold(step: number): number {
  const s = ((step % 128) + 128) % 128;
  let n = 1;
  while (n < 6 && LEAD[(s + n) % 128] === null) n += 1;
  return n;
}

function whiteNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function gooNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buf.getChannelData(0);
  let acc = 0;
  for (let i = 0; i < data.length; i++) {
    acc = acc * 0.985 + (Math.random() * 2 - 1) * 0.22;
    const pop = Math.random() < 0.0012 ? (Math.random() * 2 - 1) * 0.28 : 0;
    const gurgle = Math.sin(i * 0.018 + Math.sin(i * 0.006) * 3.2);
    const cluster = Math.sin(i * 0.0015) > 0.28 ? 1 : 0.42;
    data[i] = Math.max(-1, Math.min(1, (acc * 0.92 + pop + gurgle * 0.16) * cluster));
  }
  return buf;
}
