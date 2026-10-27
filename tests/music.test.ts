import { describe, expect, it } from 'vitest';
import { FIXTURES } from '../server/fixtures';
import { DAYS, WEEKS, type ContributionData, type Level } from '../shared/types';
import { GENRES, genreForLanguages } from '../src/music/genres';
import { MAX_POLYPHONY, composeSong, maxPolyphony, songSeconds, weekTiers } from '../src/music/mapping';
import { mulberry32 } from '../src/music/prng';
import { pitchClasses } from '../src/music/scales';
import type { Song } from '../src/music/types';

const fixtures = Object.entries(FIXTURES);
const MONO_VOICES = ['bass', 'kick', 'snare', 'hat', 'sparkle'];

function randomData(i: number): ContributionData {
  const r = mulberry32(i * 7919 + 1);
  const density = r();
  const langs = ['TypeScript', 'Rust', 'Go', 'Python', 'Haskell', 'Brainfuck'];
  return {
    user: `user-${i}`,
    year: 2010 + (i % 16),
    weeks: Array.from({ length: WEEKS }, () =>
      Array.from({ length: DAYS }, () => (r() < density ? Math.ceil(r() * 4) : 0) as Level),
    ),
    total: 1 + Math.floor(r() * 3000),
    topLanguages: [langs[Math.floor(r() * langs.length)]!],
  };
}

function checkSong(song: Song) {
  const pcs = pitchClasses(song.rootPc, song.scale);
  const [lo, hi] = GENRES[song.genre].bpm;
  expect(song.bpm).toBeGreaterThanOrEqual(100);
  expect(song.bpm).toBeLessThanOrEqual(120);
  expect(song.bpm).toBeGreaterThanOrEqual(lo);
  expect(song.bpm).toBeLessThanOrEqual(hi);
  expect(song.totalBeats).toBe(song.introBeats + 52 + song.outroBeats);
  expect(song.tiers).toHaveLength(WEEKS);
  const coreSeconds = (song.weekBeats * 60) / song.bpm; // the 52 weeks themselves
  expect(coreSeconds).toBeGreaterThanOrEqual(26);
  expect(coreSeconds).toBeLessThanOrEqual(31.2);
  expect(songSeconds(song)).toBeLessThan(33.5); // plus intro, outro and ring
  expect(maxPolyphony(song)).toBeLessThanOrEqual(MAX_POLYPHONY);

  // Plain checks collected into one assertion: this runs for thousands of events per song.
  const problems: string[] = [];
  const seen = new Set<string>();
  let prev = -1;
  for (const e of song.events) {
    const tag = `${e.voice}@${e.beat}`;
    if (e.beat < prev) problems.push(`unsorted ${tag}`);
    prev = e.beat;
    if (e.beat < 0 || e.beat >= song.totalBeats) problems.push(`out of range ${tag}`);
    if (!(e.dur > 0)) problems.push(`bad dur ${tag}`);
    if (!(e.vel > 0 && e.vel <= 1)) problems.push(`bad vel ${tag}`);
    const pitched = ['lead', 'pad', 'bass', 'sparkle'].includes(e.voice);
    if ((e.midi !== undefined) !== pitched) problems.push(`midi mismatch ${tag}`);
    if (e.midi !== undefined) {
      if (e.midi < 36 || e.midi > 96) problems.push(`register ${tag} ${e.midi}`);
      if (!pcs.has(e.midi % 12)) problems.push(`out of scale ${tag} ${e.midi}`);
    }
    // Mono instruments can't start two notes at the same instant.
    if (MONO_VOICES.includes(e.voice)) {
      if (seen.has(tag)) problems.push(`duplicate ${tag}`);
      seen.add(tag);
    }
  }
  // Never dead silence: a pad is sounding at every beat of the song.
  const pads = song.events.filter((e) => e.voice === 'pad');
  for (let b = 0; b < song.totalBeats; b++) {
    if (!pads.some((e) => e.beat <= b && b < e.beat + e.dur)) problems.push(`no pad at beat ${b}`);
  }
  expect(problems).toEqual([]);
}

describe('composeSong', () => {
  it('is deterministic and case-insensitive on the username', () => {
    const d = FIXTURES.active;
    expect(composeSong(d)).toEqual(composeSong(d));
    const a = composeSong({ ...d, user: 'OctoCat' });
    const b = composeSong({ ...d, user: 'octocat' });
    expect({ ...a, user: '' }).toEqual({ ...b, user: '' });
  });

  it('is plain JSON (survives a round trip unchanged)', () => {
    const song = composeSong(FIXTURES.burst);
    expect(JSON.parse(JSON.stringify(song))).toEqual(song);
  });

  it('varies with user and year', () => {
    const base = composeSong({ ...FIXTURES.active, user: 'alice' });
    const other = composeSong({ ...FIXTURES.active, user: 'bob' });
    const nextYear = composeSong({ ...FIXTURES.active, user: 'alice', year: 2024 });
    expect(other.seed).not.toBe(base.seed);
    expect(nextYear.seed).not.toBe(base.seed);
    // across many users the key/mode/tempo are not all the same
    const keys = new Set(Array.from({ length: 40 }, (_, i) => {
      const s = composeSong({ ...FIXTURES.active, user: `u${i}` });
      return `${s.rootPc}${s.mode}${s.bpm}`;
    }));
    expect(keys.size).toBeGreaterThan(10);
  });

  for (const [name, data] of fixtures) {
    it(`fixture "${name}" produces a valid, musical song`, () => checkSong(composeSong(data)));
  }

  it('holds up on 300 random-looking datasets', () => {
    for (let i = 0; i < 300; i++) checkSong(composeSong(randomData(i)));
  });

  it('handles a year with no contributions: all pads, ambient, still valid', () => {
    const quiet: ContributionData = {
      user: 'quiet',
      year: 2024,
      weeks: Array.from({ length: WEEKS }, () => Array<Level>(DAYS).fill(0)),
      total: 0,
      topLanguages: [],
    };
    const song = composeSong(quiet);
    checkSong(song);
    expect(song.genre).toBe('ambient');
    expect(song.events.some((e) => e.voice === 'kick' || e.voice === 'bass' && e.beat < 54)).toBe(false);
  });

  it('keeps simultaneous notes bounded even for a maxed-out year', () => {
    const full: ContributionData = {
      ...FIXTURES.active,
      weeks: Array.from({ length: WEEKS }, () => Array<Level>(DAYS).fill(4)),
    };
    const song = composeSong(full);
    expect(maxPolyphony(song)).toBeLessThanOrEqual(MAX_POLYPHONY);
    expect(song.tiers.every((t) => t === 3)).toBe(true);
  });

  it('has an intro and an outro that resolves to the tonic', () => {
    const song = composeSong(FIXTURES.weekend);
    expect(song.events.filter((e) => e.beat < song.introBeats && e.voice === 'lead').length).toBeGreaterThanOrEqual(4);
    const outro = song.events.filter((e) => e.beat === song.introBeats + 52 && e.voice === 'pad');
    expect(outro).toHaveLength(3);
    expect(outro.map((e) => e.midi! % 12).sort()).toContain(song.rootPc);
  });

  it('drum and bass intensity follows the weekly total', () => {
    const song = composeSong(FIXTURES.active);
    const hits = (w: number) =>
      song.events.filter(
        (e) => ['kick', 'snare', 'hat', 'bass'].includes(e.voice) && e.beat >= 2 + w && e.beat < 3 + w,
      ).length;
    const weeksByTier = (t: number) => song.tiers.map((x, i) => (x === t ? i : -1)).filter((i) => i >= 0);
    const avg = (ws: number[]) => ws.reduce((s, w) => s + hits(w), 0) / Math.max(1, ws.length);
    for (const w of weeksByTier(0)) expect(hits(w)).toBe(0);
    expect(avg(weeksByTier(3))).toBeGreaterThan(avg(weeksByTier(1)));
  });
});

describe('weekTiers', () => {
  it('marks empty weeks 0 and scales the rest to the year', () => {
    const weeks = [[0, 0], [1, 0], [2, 2], [4, 4]] as number[][];
    expect(weekTiers(weeks)).toEqual([0, 1, 2, 3]);
  });
});

describe('genres', () => {
  it('picks the preset from the top language, first match wins', () => {
    expect(genreForLanguages(['TypeScript', 'Go'])).toBe('synthwave');
    expect(genreForLanguages(['Rust'])).toBe('chiptune');
    expect(genreForLanguages(['Go'])).toBe('house');
    expect(genreForLanguages(['Haskell'])).toBe('ambient');
    expect(genreForLanguages(['Python'])).toBe('lofi');
    expect(genreForLanguages(['Unknown', 'Go'])).toBe('house');
  });
  it('falls back for unknown or missing languages', () => {
    expect(genreForLanguages(['Brainfuck'])).toBe('lofi');
    expect(genreForLanguages([])).toBe('lofi');
  });
  it('every preset tempo is within 100-120 BPM', () => {
    for (const g of Object.values(GENRES)) {
      expect(g.bpm[0]).toBeGreaterThanOrEqual(100);
      expect(g.bpm[1]).toBeLessThanOrEqual(120);
    }
  });
});
