import type { ContributionData } from '../../shared/types';
import { mulberry32 } from '../music/prng';
import type { Song } from '../music/types';
import type { Frame } from './draw';
import { cellX, cellY, type Layout } from './layout';
import { PALETTES } from './palettes';
import { Particles } from './particles';
import { activePulses, buildPulses, cellBeats, pulsesBetween, type Pulse } from './pulses';

/** Notes at or above this velocity (contribution level 3-4) throw sparks. */
const LOUD = 0.7;

/**
 * The animated graph's state: pulses, cell timing and sparks. The on-page canvas and the video export both
 * ask it for a Frame at a given beat, so what you see on the page is exactly what ends up in the video.
 */
export class GridScene {
  private readonly pulses: Pulse[];
  private readonly beats: number[][];
  private readonly sparks: Particles;
  private lastBeat: number | null = null;
  private lastTime: number | null = null;

  constructor(
    private readonly data: ContributionData,
    private readonly song: Song,
  ) {
    this.pulses = buildPulses(song);
    this.beats = cellBeats(song, this.pulses);
    this.sparks = new Particles(mulberry32(song.seed));
  }

  /** `beat` is null when stopped (whole graph shown). `now` is a monotonic time in ms. */
  frame(layout: Layout, beat: number | null, now: number, reducedMotion: boolean): Frame {
    const animate = beat !== null && !reducedMotion;
    if (animate) {
      if (this.lastBeat !== null && beat > this.lastBeat) {
        for (const p of pulsesBetween(this.pulses, this.lastBeat, beat)) {
          if (p.vel >= LOUD) {
            this.sparks.emit(cellX(layout, p.week) + layout.cell / 2, cellY(layout, p.week, p.day), p.vel > 0.9 ? 4 : 2, layout.cell / 4 + 0.8);
          }
        }
      }
      this.sparks.step(this.lastTime === null ? 0 : (now - this.lastTime) / 1000);
    } else {
      this.sparks.clear();
    }
    this.lastBeat = beat;
    this.lastTime = now;

    return {
      weeks: this.data.weeks,
      palette: PALETTES[this.song.genre],
      layout,
      beat,
      introBeats: this.song.introBeats,
      cellBeats: this.beats,
      pulses: animate ? activePulses(this.pulses, beat) : [],
      particles: this.sparks.items,
      reducedMotion,
    };
  }

  reset() {
    this.lastBeat = null;
    this.lastTime = null;
    this.sparks.clear();
  }
}
