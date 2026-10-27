export type GenreId = 'lofi' | 'synthwave' | 'chiptune' | 'house' | 'ambient';
export type ModeName = 'ionian' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'aeolian';
export type Voice = 'lead' | 'pad' | 'bass' | 'kick' | 'snare' | 'hat' | 'sparkle';
/** Weekly intensity: 0 = empty week, 1-3 = quiet to busy (relative to the person's own year). */
export type Tier = 0 | 1 | 2 | 3;

/** One sound. `beat` and `dur` are in beats from the start of the song. Drums have no `midi`. */
export interface NoteEvent {
  beat: number;
  dur: number;
  voice: Voice;
  midi?: number;
  vel: number;
  /** The contribution-graph cell [week 0-51, weekday 0-6] a lead note stands for (drives the visual). */
  cell?: [week: number, day: number];
}

/** Plain-JSON description of a song. Contains no audio and no functions. */
export interface Song {
  version: 1;
  user: string;
  year: number;
  seed: number;
  genre: GenreId;
  bpm: number;
  rootPc: number;
  mode: ModeName;
  scale: number[];
  /** Chord root scale degrees, one per bar, cycled. */
  progression: number[];
  introBeats: number;
  weekBeats: number;
  outroBeats: number;
  totalBeats: number;
  tiers: Tier[];
  events: NoteEvent[];
}
