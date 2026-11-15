/**
 * Sound manager for playing notification chimes (TTS voice reading disabled).
 */
export class AlertSoundPlayer {
  private static audioCtx: AudioContext | null = null;

  private static initAudio() {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch((err) => {
          console.warn("AudioContext resume failed or blocked by gesture:", err);
        });
      }
    } catch (e) {
      console.warn("AudioContext initialization failed:", e);
    }
  }

  /**
   * Play a crisp notification chime
   */
  public static playChime() {
    try {
      this.initAudio();
      const ctx = this.audioCtx;
      if (!ctx) return;

      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.12);

      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.15, now + 0.04);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046.5, now + 0.06);
      osc2.frequency.exponentialRampToValueAtTime(1568, now + 0.18);

      gain2.gain.setValueAtTime(0, now + 0.06);
      gain2.gain.linearRampToValueAtTime(0.12, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.06);
      osc2.stop(now + 0.45);
    } catch (e) {
      console.warn("Chime playback failed:", e);
    }
  }

  public static stop() {
    // No-op (TTS disabled)
  }

  public static trigger(_type: 'notice' | 'accident' | 'general', _detail?: string) {
    this.playChime();
  }
}
