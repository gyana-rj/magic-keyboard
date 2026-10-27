import type { ModeName } from './types';

export const MODES: Record<ModeName, number[]> = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
};

const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const keyName = (pc: number) => NOTE_NAMES[((pc % 12) + 12) % 12]!;

/**
 * MIDI note for a scale degree. Degrees past 6 wrap into the next octave, so degree 7 is
 * the tonic one octave up. This is the only way the composer makes pitches, which is what
 * guarantees every note is in the scale.
 */
export function noteAt(rootPc: number, intervals: number[], degree: number, octave: number): number {
  const wrap = Math.floor(degree / 7);
  const idx = ((degree % 7) + 7) % 7;
  return 12 * (octave + 1 + wrap) + rootPc + intervals[idx]!;
}

export function pitchClasses(rootPc: number, intervals: number[]): Set<number> {
  return new Set(intervals.map((i) => (rootPc + i) % 12));
}
