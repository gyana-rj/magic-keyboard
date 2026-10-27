import { describe, expect, it } from 'vitest';
import { FIXTURES, fixtureFor } from '../server/fixtures';
import { DAYS, WEEKS } from '../shared/types';

describe('fixtures', () => {
  for (const [name, data] of Object.entries(FIXTURES)) {
    it(`${name} is a valid 52x7 dataset`, () => {
      expect(data.weeks).toHaveLength(WEEKS);
      for (const week of data.weeks) {
        expect(week).toHaveLength(DAYS);
        for (const level of week) expect([0, 1, 2, 3, 4]).toContain(level);
      }
      const active = data.weeks.flat().filter((l) => l > 0).length;
      expect(data.total).toBeGreaterThanOrEqual(active);
      expect(data.topLanguages.length).toBeGreaterThan(0);
    });
  }

  it('personas have the intended shape', () => {
    const sum = (rows: number[][]) => rows.flat().reduce((s, l) => s + l, 0);
    const { active, weekend, burst, empty } = FIXTURES;
    const weekendShare = (d: typeof weekend) =>
      sum(d.weeks.map((w) => [w[0]!, w[6]!])) / sum(d.weeks);
    expect(weekendShare(weekend)).toBeGreaterThan(0.8);
    expect(sum(active.weeks)).toBeGreaterThan(sum(weekend.weeks));
    expect(burst.weeks.slice(20).flat().every((l) => l === 0)).toBe(true);
    expect(empty.total).toBeLessThan(15);
  });

  it('fixtureFor echoes the requested user and year', () => {
    const d = fixtureFor('someone', 2020);
    expect(d.user).toBe('someone');
    expect(d.year).toBe(2020);
  });
});
