import { DAYS, WEEKS, type ContributionData } from '../../shared/types';
import { GENRES, genreForLanguages } from './genres';
import { mulberry32, seedFor, subRng } from './prng';
import { MODES, noteAt } from './scales';
import type { NoteEvent, Song, Tier, Voice } from './types';

export const INTRO_BEATS = 2;
export const OUTRO_BEATS = 2;
/** No more than this many sounds are ever active at once (player sizes its voices from it). */
export const MAX_POLYPHONY = 14;

const BEATS_PER_BAR = 4;
const LEAD_VEL = [0, 0.25, 0.45, 0.7, 0.95];
const TIER_VEL = [0, 0.55, 0.75, 0.9];
/** Chord-root scale degrees per bar; cycled over the 13 bars. */
const PROGRESSIONS = [
  [0, 4, 5, 3],
  [0, 5, 3, 4],
  [0, 3, 4, 3],
  [5, 3, 0, 4],
  [0, 2, 3, 4],
];

const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

/** Weekly intensity relative to the year's own busy weeks (90th percentile, so one outlier doesn't flatten the rest). */
export function weekTiers(weeks: number[][]): Tier[] {
  const sums = weeks.map((w) => w.reduce((s, l) => s + l, 0));
  const nonzero = sums.filter((s) => s > 0).sort((a, b) => a - b);
  const ref = nonzero.length ? nonzero[Math.min(nonzero.length - 1, Math.floor(nonzero.length * 0.9))]! : 1;
  return sums.map((s): Tier => {
    if (s === 0) return 0;
    const rel = Math.min(1, s / ref);
    return rel <= 1 / 3 ? 1 : rel <= 2 / 3 ? 2 : 3;
  });
}

/** data -> song. Pure and deterministic: same user + year (+ data) always gives the same song. */
export function composeSong(data: ContributionData): Song {
  const seed = seedFor(data.user, data.year);
  const rng = mulberry32(seed);

  // A year with no contributions gets the calmest preset regardless of language.
  const genre = GENRES[data.total === 0 ? 'ambient' : genreForLanguages(data.topLanguages)];
  const bpm = genre.bpm[0] + Math.floor(rng() * (genre.bpm[1] - genre.bpm[0] + 1));
  const mode = genre.modes[Math.floor(rng() * genre.modes.length)]!;
  const rootPc = Math.floor(rng() * 12);
  const progression = PROGRESSIONS[Math.floor(rng() * PROGRESSIONS.length)]!;
  const scale = MODES[mode];
  const tiers = weekTiers(data.weeks);

  const events: NoteEvent[] = [];
  const add = (voice: Voice, beat: number, dur: number, vel: number, midi?: number, cell?: [number, number]) => {
    const e: NoteEvent = { beat: r4(beat), dur: r4(dur), voice, vel: r4(Math.min(1, vel)) };
    if (midi !== undefined) e.midi = midi;
    if (cell) e.cell = cell;
    events.push(e);
  };
  const pitch = (degree: number, octave: number) => noteAt(rootPc, scale, degree, octave);
  const chordRoot = (weekOrBar: number, perBar: boolean) =>
    progression[(perBar ? weekOrBar : Math.floor(weekOrBar / BEATS_PER_BAR)) % progression.length]!;

  const weekStart = INTRO_BEATS;
  const outroStart = INTRO_BEATS + WEEKS;
  const totalBeats = outroStart + OUTRO_BEATS;

  // Intro: first chord swells under a rising arpeggio.
  const first = chordRoot(0, true);
  for (const off of [0, 2, 4]) add('pad', 0, INTRO_BEATS, 0.25, pitch(first + off, 3));
  [0, 2, 4, 7].forEach((off, i) => add('lead', i * 0.5, 0.45, 0.3 + i * 0.1, pitch(first + off, 4)));

  // Pads: one chord per bar, never silent. Quieter when the bar is busy, fuller when it is empty.
  const bars = WEEKS / BEATS_PER_BAR;
  for (let bar = 0; bar < bars; bar++) {
    const busy = tiers.slice(bar * BEATS_PER_BAR, (bar + 1) * BEATS_PER_BAR).reduce<number>((s, t) => s + t, 0) / (3 * BEATS_PER_BAR);
    const root = chordRoot(bar, true);
    for (const off of [0, 2, 4]) {
      add('pad', weekStart + bar * BEATS_PER_BAR, BEATS_PER_BAR, 0.2 + 0.25 * (1 - busy), pitch(root + off, 3));
    }
  }

  for (let w = 0; w < WEEKS; w++) {
    const beat = weekStart + w;
    const tier = tiers[w]!;
    const days = data.weeks[w] ?? [];
    const wr = subRng(seed, 'week', w);
    const barPos = w % BEATS_PER_BAR;

    // Lead: each active weekday is its scale degree, strummed across the beat.
    const order = Array.from({ length: DAYS }, (_, d) => d);
    if (wr() < 0.5) order.reverse();
    const octave = wr() < 0.25 ? 5 : 4;
    order.forEach((d, i) => {
      const level = days[d] ?? 0;
      if (level === 0) return;
      const t = beat + i * 0.125;
      add('lead', t, 0.35, LEAD_VEL[level]!, pitch(d, octave), [w, d]);
      if (level >= 3) add('lead', t, 0.35, LEAD_VEL[level]! * 0.7, pitch(d, octave - 1));
    });

    // Empty weeks: a soft, sparse bell over the pad instead of silence.
    if (tier === 0 && wr() < 0.6) {
      add('sparkle', beat + (wr() < 0.5 ? 0 : 0.5), 0.9, 0.18, pitch(Math.floor(wr() * 7), 5));
    }

    // Drums: intensity follows the weekly tier.
    if (tier > 0) {
      const velBase = TIER_VEL[tier]!;
      const drum = (voice: 'kick' | 'snare' | 'hat', pattern: string, minTier: number, dur: number) => {
        if (tier < minTier) return;
        for (let half = 0; half < 2; half++) {
          const c = pattern[barPos * 2 + half];
          if (c === 'x' || c === 'o') add(voice, beat + half * 0.5, dur, velBase * (c === 'o' ? 0.6 : 1));
        }
      };
      drum('kick', genre.drums.kick, 1, 0.2);
      drum('hat', genre.drums.hat, 2, 0.1);
      drum('snare', genre.drums.snare, 3, 0.15);
      if (tier === 3 && barPos === BEATS_PER_BAR - 1) {
        add('hat', beat + 0.25, 0.1, velBase * 0.5);
        add('hat', beat + 0.75, 0.1, velBase * 0.5);
      }

      // Bass: root/fifth pattern; a quiet week only plays on the beat.
      const root = chordRoot(w, false);
      for (let half = 0; half < 2; half++) {
        const step = barPos * 2 + half;
        const c = genre.bass[step];
        if (!c || c === '.' || (tier === 1 && half === 1)) continue;
        let gap = 1;
        while (step + gap < 8 && genre.bass[step + gap] === '.') gap++;
        const degree = c === '5' ? root + 4 : root;
        const oct = c === 'o' ? 3 : 2;
        add('bass', beat + half * 0.5, Math.min(genre.bassMaxDur, gap * 0.5 * 0.9), velBase * 0.9, pitch(degree, oct));
      }
    }
  }

  // Outro: resolve to the tonic chord and let it ring.
  for (const off of [0, 2, 4]) add('pad', outroStart, 3, 0.4, pitch(off, 3));
  add('bass', outroStart, 3, 0.6, pitch(0, 2));
  add('lead', outroStart, 2.5, 0.5, pitch(0, 5));

  events.sort((a, b) => a.beat - b.beat);

  return {
    version: 1,
    user: data.user,
    year: data.year,
    seed,
    genre: genre.id,
    bpm,
    rootPc,
    mode,
    scale,
    progression,
    introBeats: INTRO_BEATS,
    weekBeats: WEEKS,
    outroBeats: OUTRO_BEATS,
    totalBeats,
    tiers,
    events,
  };
}

/** Seconds until the last note has finished (includes the outro's ringing chord). */
export function songSeconds(song: Song): number {
  const end = song.events.reduce((m, e) => Math.max(m, e.beat + e.dur), song.totalBeats);
  return (end * 60) / song.bpm;
}

/** Highest number of simultaneously sounding events (events are sorted by start). */
export function maxPolyphony(song: Song): number {
  let active: number[] = []; // end beats of sounding events
  let max = 0;
  for (const e of song.events) {
    active = active.filter((end) => end > e.beat + 1e-6);
    active.push(e.beat + e.dur);
    max = Math.max(max, active.length);
  }
  return max;
}
