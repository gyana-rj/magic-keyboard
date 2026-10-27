import type { GenreId, ModeName } from './types';

/**
 * Patterns are one bar of 4 beats in 8th-note steps (8 chars). Drums: x = hit, o = soft hit,
 * . = rest. Bass: x = chord root, 5 = fifth, o = root an octave up. Each week is one beat, so a
 * week plays 2 steps of the bar.
 */
export interface Genre {
  id: GenreId;
  label: string;
  bpm: [min: number, max: number];
  modes: ModeName[];
  drums: { kick: string; snare: string; hat: string };
  bass: string;
  /** Longest a bass note may ring, in beats. */
  bassMaxDur: number;
  languages: string[];
}

export const GENRES: Record<GenreId, Genre> = {
  lofi: {
    id: 'lofi',
    label: 'Lo-fi',
    bpm: [104, 110],
    modes: ['dorian', 'aeolian', 'mixolydian'],
    drums: { kick: 'x.....x.', snare: '..x...x.', hat: 'o.o.o.o.' },
    bass: 'x.....5.',
    bassMaxDur: 1.5,
    languages: ['python', 'ruby', 'php', 'shell', 'perl', 'r', 'jupyter notebook'],
  },
  synthwave: {
    id: 'synthwave',
    label: 'Synthwave',
    bpm: [108, 118],
    modes: ['aeolian', 'dorian'],
    drums: { kick: 'x.x.x.x.', snare: '..x...x.', hat: 'xoxoxoxo' },
    bass: 'xxxxxxxx',
    bassMaxDur: 0.45,
    languages: ['typescript', 'javascript', 'swift', 'dart', 'vue', 'html', 'css', 'scss'],
  },
  chiptune: {
    id: 'chiptune',
    label: 'Chiptune',
    bpm: [112, 120],
    modes: ['ionian', 'mixolydian', 'aeolian'],
    drums: { kick: 'x.x...x.', snare: '..x...x.', hat: 'o.o.o.o.' },
    bass: 'x5ox5o5x',
    bassMaxDur: 0.45,
    languages: ['c', 'c++', 'rust', 'zig', 'assembly', 'lua', 'nim', 'objective-c'],
  },
  house: {
    id: 'house',
    label: 'House',
    bpm: [116, 120],
    modes: ['aeolian', 'dorian'],
    drums: { kick: 'x.x.x.x.', snare: '..x...x.', hat: '.o.o.o.o' },
    bass: '.x.x.x.x',
    bassMaxDur: 0.45,
    languages: ['go', 'java', 'kotlin', 'c#', 'scala', 'groovy', 'dockerfile'],
  },
  ambient: {
    id: 'ambient',
    label: 'Ambient',
    bpm: [104, 108],
    modes: ['lydian', 'ionian', 'dorian'],
    drums: { kick: 'x.......', snare: '........', hat: '..o...o.' },
    bass: 'x.......',
    bassMaxDur: 4,
    languages: ['haskell', 'elixir', 'clojure', 'ocaml', 'erlang', 'common lisp', 'emacs lisp', 'f#', 'tex'],
  },
};

export const FALLBACK_GENRE: GenreId = 'lofi';

/** The most-used language that has a preset wins; otherwise the fallback preset. */
export function genreForLanguages(topLanguages: string[]): GenreId {
  for (const lang of topLanguages) {
    const key = lang.toLowerCase();
    for (const g of Object.values(GENRES)) if (g.languages.includes(key)) return g.id;
  }
  return FALLBACK_GENRE;
}
