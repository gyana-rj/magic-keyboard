import { describe, expect, it } from 'vitest';
import { FIXTURES } from '../server/fixtures';
import type { Level } from '../shared/types';
import { busiestWeek, longestStreak, weekRange } from '../src/stats';

const blank = (): Level[][] => Array.from({ length: 52 }, () => Array<Level>(7).fill(0));

describe('weekRange', () => {
  it('week 0 starts on Jan 1 and ends on that week\'s Saturday', () => {
    expect(weekRange(2025, 0)).toBe('Jan 1–4'); // Jan 1 2025 is a Wednesday
  });
  it('later weeks are Sunday to Saturday', () => {
    expect(weekRange(2025, 1)).toBe('Jan 5–11');
    expect(weekRange(2025, 51)).toBe('Dec 21–27');
  });
  it('crosses month ends', () => {
    expect(weekRange(2025, 13)).toBe('Mar 30 – Apr 5');
  });
});

describe('busiestWeek', () => {
  it('returns null for an empty year', () => expect(busiestWeek(blank())).toBeNull());
  it('finds the week with the highest level sum (first on ties)', () => {
    const w = blank();
    w[9]![1] = 4;
    w[9]![2] = 3;
    w[20]![0] = 4;
    w[30]![0] = 4;
    w[30]![1] = 3;
    expect(busiestWeek(w)).toEqual({ week: 9, score: 7 });
  });
});

describe('longestStreak', () => {
  it('is 0 for an empty year and counts runs across week boundaries', () => {
    expect(longestStreak(blank(), 2025)).toBe(0);
    const w = blank();
    for (const d of [5, 6]) w[10]![d] = 1; // Fri, Sat
    for (const d of [0, 1, 2]) w[11]![d] = 2; // Sun, Mon, Tue
    w[11]![4] = 1;
    expect(longestStreak(w, 2025)).toBe(5);
  });
  it('does not join the folded December days to January', () => {
    const w = blank();
    w[0]![0] = 1; // folded-in late December (Sunday, before Jan 1 2025 which is a Wednesday)
    w[0]![3] = 1; // Jan 1
    w[0]![4] = 1; // Jan 2
    expect(longestStreak(w, 2025)).toBe(2);
  });
  it('works on every fixture and is bounded by the active days', () => {
    for (const d of Object.values(FIXTURES)) {
      const active = d.weeks.flat().filter((l) => l > 0).length;
      const s = longestStreak(d.weeks, d.year);
      expect(s).toBeGreaterThanOrEqual(active ? 1 : 0);
      expect(s).toBeLessThanOrEqual(active);
    }
  });
});
