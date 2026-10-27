/**
 * Turns the player's once-per-beat events into a smooth continuous beat position for
 * requestAnimationFrame. Each onBeat re-anchors it, so drift cannot accumulate.
 */
export class BeatClock {
  private anchor: { beat: number; at: number } | null = null;

  constructor(private bpm: number) {}

  setBpm(bpm: number) {
    this.bpm = bpm;
  }

  /** Call from the player's onBeat. `at` is performance.now()-style milliseconds. */
  sync(beat: number, at: number) {
    this.anchor = { beat, at };
  }

  reset() {
    this.anchor = null;
  }

  /** Current beat (fractional), or null when nothing is playing. */
  beatAt(now: number): number | null {
    if (!this.anchor) return null;
    return this.anchor.beat + ((now - this.anchor.at) / 1000) * (this.bpm / 60);
  }
}
