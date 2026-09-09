import type { GameSettings } from './SaveSystem';

export type SoundName = 'jump' | 'land' | 'fish' | 'star' | 'click' | 'bell' |
  'door' | 'checkpoint' | 'victory' | 'meow' | 'stumble' | 'feather' | 'key';

const MELODY: ReadonlyArray<number | null> = [
  523.25, null, 659.25, 587.33, null, 493.88, 440, null,
  392, null, 523.25, 493.88, 440, null, 392, null,
  440, null, 523.25, 587.33, null, 659.25, 587.33, null,
  523.25, null, 493.88, 440, 392, null, 329.63, null,
];

/** Original, tiny synth cues: no fetched audio, autoplay, or persistent background sound. */
export class AudioSystem {
  private context: AudioContext | undefined;
  private musicBus: GainNode | undefined;
  private sfxBus: GainNode | undefined;
  private settings: GameSettings;
  private musicRequested = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  private step = 0;
  private voices = 0;
  private destroyed = false;
  private away = false;

  constructor(settings: Partial<GameSettings> = {}) {
    this.settings = { music: 0.25, sfx: 0.65, reducedMotion: false, ...settings };
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('focus', this.onFocus);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  get isUnlocked(): boolean { return this.context?.state === 'running'; }

  async unlock(): Promise<void> {
    if (this.destroyed) return;
    try {
      if (!this.context) {
        const Ctor = globalThis.AudioContext ??
          (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.context = new Ctor();
        this.musicBus = this.context.createGain();
        this.sfxBus = this.context.createGain();
        this.musicBus.connect(this.context.destination);
        this.sfxBus.connect(this.context.destination);
        this.setSettings(this.settings);
      }
      if (this.context.state === 'suspended') await this.context.resume();
      if (this.musicRequested && !this.away) this.startMusic();
    } catch {
      // Browsers may reject audio until a fresh gesture; the next unlock can retry.
    }
  }

  setSettings(settings: Partial<GameSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.settings.music = this.volume(this.settings.music);
    this.settings.sfx = this.volume(this.settings.sfx);
    const time = this.context?.currentTime ?? 0;
    this.musicBus?.gain.setTargetAtTime(this.settings.music * 0.11, time, 0.025);
    this.sfxBus?.gain.setTargetAtTime(this.settings.sfx * 0.13, time, 0.025);
  }

  private volume(value: number): number { return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0; }

  startMusic(): void {
    this.musicRequested = true;
    if (!this.isUnlocked || this.timer || this.away || this.destroyed) return;
    this.musicTick();
    this.timer = setInterval(() => this.musicTick(), 420);
  }

  stopMusic(): void {
    this.musicRequested = false;
    this.stopTimer();
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private musicTick(): void {
    if (this.settings.music <= 0 || !this.isUnlocked || document.hidden || this.away) return;
    const note = MELODY[this.step % MELODY.length];
    if (note) this.note(note, 0.34, 'triangle', 'music', 0, 0.55);
    if (this.step % 4 === 0) {
      const bass = [130.81, 110, 146.83, 98][Math.floor(this.step / 8) % 4] ?? 130.81;
      this.note(bass, 1.3, 'sine', 'music', 0, 0.65);
      this.note(bass * 1.5, 0.95, 'triangle', 'music', 0.025, 0.2);
    }
    this.step++;
  }

  play(name: SoundName): void {
    if (!this.isUnlocked || this.settings.sfx <= 0 || this.away) return;
    switch (name) {
      case 'jump': this.note(320, 0.16, 'triangle', 'sfx', 0, 0.7, 620); break;
      case 'land': this.note(105, 0.09, 'triangle', 'sfx', 0, 0.5, 72); break;
      case 'fish': this.arpeggio([660, 880], 0.075); break;
      case 'feather': this.arpeggio([784, 1046], 0.07); break;
      case 'key': this.arpeggio([587, 740, 1175], 0.09); break;
      case 'star': this.arpeggio([523, 659, 784, 1046], 0.1); break;
      case 'click': this.note(660, 0.055, 'triangle', 'sfx', 0, 0.4); break;
      case 'bell':
        this.note(1318, 0.6, 'sine', 'sfx', 0, 0.6);
        this.note(1975, 0.4, 'sine', 'sfx', 0, 0.25);
        break;
      case 'door': this.note(160, 0.25, 'triangle', 'sfx', 0, 0.45, 245); break;
      case 'checkpoint': this.arpeggio([392, 523, 659, 784], 0.11); break;
      case 'victory': this.arpeggio([523, 659, 784, 1046, 784, 1046], 0.13); break;
      case 'meow': this.note(600, 0.22, 'triangle', 'sfx', 0, 0.45, 350); break;
      case 'stumble': this.note(230, 0.2, 'triangle', 'sfx', 0, 0.45, 110); break;
    }
  }

  private arpeggio(notes: number[], interval: number): void {
    notes.forEach((frequency, index) => this.note(frequency, 0.18, 'triangle', 'sfx', index * interval, 0.6));
  }

  private note(frequency: number, duration: number, type: OscillatorType, channel: 'music' | 'sfx',
    delay = 0, volume = 0.5, finalFrequency?: number): void {
    const ctx = this.context;
    const bus = channel === 'music' ? this.musicBus : this.sfxBus;
    if (!ctx || !bus || this.voices >= 18 || this.destroyed) return;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    const time = ctx.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    if (finalFrequency) oscillator.frequency.exponentialRampToValueAtTime(finalFrequency, time + duration);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(volume, time + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + duration);
    oscillator.connect(envelope);
    envelope.connect(bus);
    this.voices++;
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
      this.voices--;
    };
    oscillator.start(time);
    oscillator.stop(time + duration + 0.02);
  }

  private onBlur = (): void => {
    this.away = true;
    this.stopTimer();
    void this.context?.suspend().catch(() => undefined);
  };

  private onFocus = (): void => {
    if (document.hidden || this.destroyed) return;
    this.away = false;
    if (this.context) void this.unlock();
  };

  private onVisibilityChange = (): void => {
    if (document.hidden) this.onBlur();
    else this.onFocus();
  };

  destroy(): void {
    this.destroyed = true;
    this.stopTimer();
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('focus', this.onFocus);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    void this.context?.close().catch(() => undefined);
  }
}
