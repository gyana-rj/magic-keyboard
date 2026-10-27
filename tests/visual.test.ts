import { describe, expect, it } from 'vitest';
import { FIXTURES } from '../server/fixtures';
import { composeSong } from '../src/music/mapping';
import { BeatClock } from '../src/visual/clock';
import { cellX, cellY, COLS, computeLayout, ROWS } from '../src/visual/layout';
import { PULSE_BEATS, activePulses, buildPulses } from '../src/visual/pulses';

describe('computeLayout', () => {
  it.each([320, 360, 480, 768, 1200, 2000])('fits the grid inside %ipx', (w) => {
    const l = computeLayout(w);
    const right = cellX(l, COLS - 1) + l.cell;
    const bottom = cellY(l, ROWS - 1) + l.cell;
    expect(l.cell).toBeGreaterThanOrEqual(2);
    expect(l.x0).toBeGreaterThanOrEqual(0);
    expect(right).toBeLessThanOrEqual(w);
    expect(bottom).toBeLessThanOrEqual(l.height);
    expect(l.height).toBeLessThan(w); // wide, short strip: never taller than it is wide
  });
  it('grows with the width', () => {
    expect(computeLayout(1200).cell).toBeGreaterThan(computeLayout(400).cell);
  });
});

describe('BeatClock', () => {
  it('is null until synced and after reset', () => {
    const c = new BeatClock(120);
    expect(c.beatAt(1000)).toBeNull();
    c.sync(4, 1000);
    expect(c.beatAt(1000)).toBe(4);
    c.reset();
    expect(c.beatAt(2000)).toBeNull();
  });
  it('extrapolates by tempo and re-anchors on each beat', () => {
    const c = new BeatClock(120); // 2 beats per second
    c.sync(10, 0);
    expect(c.beatAt(500)).toBeCloseTo(11);
    c.sync(11, 510); // slight drift is corrected, not accumulated
    expect(c.beatAt(510)).toBe(11);
  });
});

describe('pulses', () => {
  for (const [name, data] of Object.entries(FIXTURES)) {
    it(`${name}: exactly one pulse per active cell, at the right place`, () => {
      const song = composeSong(data);
      const pulses = buildPulses(song);
      const active = data.weeks.flat().filter((l) => l > 0).length;
      expect(pulses).toHaveLength(active);
      const seen = new Set<string>();
      for (const p of pulses) {
        expect(data.weeks[p.week]![p.day]).toBeGreaterThan(0);
        const key = `${p.week}:${p.day}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
        // fires during its own week's beat, so playhead and pulse agree
        expect(p.beat).toBeGreaterThanOrEqual(song.introBeats + p.week);
        expect(p.beat).toBeLessThan(song.introBeats + p.week + 1);
      }
      expect(pulses.map((p) => p.beat)).toEqual([...pulses.map((p) => p.beat)].sort((a, b) => a - b));
    });
  }

  it('pulse strength follows the contribution level (velocity)', () => {
    const song = composeSong(FIXTURES.active);
    const pulses = buildPulses(song);
    const byLevel = (lvl: number) =>
      pulses.filter((p) => FIXTURES.active.weeks[p.week]![p.day] === lvl).map((p) => p.vel);
    expect(Math.min(...byLevel(4))).toBeGreaterThan(Math.max(...byLevel(1)));
  });

  it('activePulses: nothing before, full at the instant, fading after, gone past the window', () => {
    const pulses = [{ beat: 10, week: 3, day: 2, vel: 1 }];
    expect(activePulses(pulses, 9.99)).toEqual([]);
    expect(activePulses(pulses, 10)[0]!.strength).toBe(1);
    const mid = activePulses(pulses, 10 + PULSE_BEATS / 2)[0]!.strength;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(activePulses(pulses, 10 + PULSE_BEATS + 0.01)).toEqual([]);
  });

  it('activePulses only returns cells inside the window, in a long song', () => {
    const song = composeSong(FIXTURES.active);
    const pulses = buildPulses(song);
    const beat = 30.2;
    for (const a of activePulses(pulses, beat)) {
      const src = pulses.find((p) => p.week === a.week && p.day === a.day)!;
      expect(src.beat).toBeLessThanOrEqual(beat);
      expect(src.beat).toBeGreaterThan(beat - PULSE_BEATS);
    }
  });
});
