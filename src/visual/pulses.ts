import type { Song } from '../music/types';

export interface Pulse {
  beat: number;
  week: number;
  day: number;
  /** Note velocity 0-1: how hard the cell lights up. */
  vel: number;
}

export interface ActivePulse {
  week: number;
  day: number;
  /** 0-1: 1 at the instant the note fires, fading to 0. */
  strength: number;
}

/** How long a cell glows after its note fires, in beats. */
export const PULSE_BEATS = 0.75;

/** One pulse per lead note that stands for a graph cell, sorted by time. */
export function buildPulses(song: Song): Pulse[] {
  const out: Pulse[] = [];
  for (const e of song.events) {
    if (e.voice === 'lead' && e.cell) {
      // octave-doubled notes share a cell and start; keep only the louder primary
      const last = out[out.length - 1];
      if (last && last.week === e.cell[0] && last.day === e.cell[1] && last.beat === e.beat) continue;
      out.push({ beat: e.beat, week: e.cell[0], day: e.cell[1], vel: e.vel });
    }
  }
  return out;
}

/** Pulses still glowing at `beat` (binary search, so this stays cheap at 60 fps). */
export function activePulses(pulses: Pulse[], beat: number, decay = PULSE_BEATS): ActivePulse[] {
  let lo = 0;
  let hi = pulses.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pulses[mid]!.beat < beat - decay) lo = mid + 1;
    else hi = mid;
  }
  const out: ActivePulse[] = [];
  for (let i = lo; i < pulses.length && pulses[i]!.beat <= beat; i++) {
    const p = pulses[i]!;
    const age = (beat - p.beat) / decay;
    out.push({ week: p.week, day: p.day, strength: p.vel * (1 - age) ** 2 });
  }
  return out;
}
