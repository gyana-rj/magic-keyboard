import { describe, expect, it } from 'vitest';
import { FIXTURES } from '../server/fixtures';
import { composeSong } from '../src/music/mapping';
import { BeatClock } from '../src/visual/clock';
import { GridScene } from '../src/visual/scene';
import { cellX, cellY, COLS, computeLayout, ROWS } from '../src/visual/layout';
import { Particles } from '../src/visual/particles';
import { PULSE_BEATS, activePulses, buildPulses, cellBeats, pulsesBetween } from '../src/visual/pulses';
import { mulberry32 } from '../src/music/prng';

describe('computeLayout', () => {
  it.each([320, 360, 480, 639, 640, 768, 1200, 2000])('keeps every cell inside %ipx', (w) => {
    const l = computeLayout(w);
    for (let week = 0; week < COLS; week++) {
      for (const day of [0, ROWS - 1]) {
        const x = cellX(l, week);
        const y = cellY(l, week, day);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x + l.cell).toBeLessThanOrEqual(w);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y + l.cell).toBeLessThanOrEqual(l.height);
      }
    }
    expect(l.cell).toBeGreaterThanOrEqual(2);
  });
  it('wraps into two bands on phones so cells stay big enough to see', () => {
    const phone = computeLayout(375);
    expect(phone.bands).toBe(2);
    expect(phone.cell).toBeGreaterThanOrEqual(10);
    expect(computeLayout(1000).bands).toBe(1);
    // week 26 starts the second band, directly under week 0
    expect(cellX(phone, 26)).toBe(cellX(phone, 0));
    expect(cellY(phone, 26, 0)).toBeGreaterThan(cellY(phone, 0, 6));
  });
  it('grows with the width', () => {
    expect(computeLayout(1200).cell).toBeGreaterThan(computeLayout(700).cell);
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

describe('cell timing', () => {
  it('lights every cell during its own week, active cells at their note', () => {
    const song = composeSong(FIXTURES.active);
    const pulses = buildPulses(song);
    const beats = cellBeats(song, pulses);
    expect(beats).toHaveLength(52);
    for (let w = 0; w < 52; w++) {
      for (let d = 0; d < 7; d++) {
        expect(beats[w]![d]).toBeGreaterThanOrEqual(song.introBeats + w);
        expect(beats[w]![d]).toBeLessThan(song.introBeats + w + 1);
      }
    }
    // a strum: within an active week, cells light at different times
    const w = FIXTURES.active.weeks.findIndex((wk) => wk.filter((l) => l > 0).length >= 4);
    expect(new Set(beats[w]!.filter((_, d) => FIXTURES.active.weeks[w]![d]! > 0)).size).toBeGreaterThan(1);
  });

  it('pulsesBetween returns each pulse exactly once across consecutive frames', () => {
    const pulses = buildPulses(composeSong(FIXTURES.weekend));
    let seen = 0;
    let from = 0;
    for (const to of [3.3, 9, 9, 17.5, 30, 60]) {
      seen += pulsesBetween(pulses, from, to).length;
      from = to;
    }
    expect(seen).toBe(pulses.length);
  });
});

describe('Particles', () => {
  it('emits, rises, fades out, and respects the cap', () => {
    const p = new Particles(mulberry32(1), 10);
    p.emit(100, 100, 6);
    p.emit(100, 100, 6);
    expect(p.items.length).toBe(10);
    const y0 = p.items[0]!.y;
    p.step(0.1);
    expect(p.items[0]!.y).toBeLessThan(y0); // rises
    for (let i = 0; i < 40; i++) p.step(0.05);
    expect(p.items).toHaveLength(0);
  });
  it('is deterministic for a given seed', () => {
    const run = () => {
      const p = new Particles(mulberry32(42));
      p.emit(10, 10, 5);
      p.step(0.016);
      return p.items;
    };
    expect(run()).toEqual(run());
  });
});

describe('GridScene', () => {
  const data = FIXTURES.active;
  const song = composeSong(data);
  const layout = computeLayout(1000);

  it('is dim before the song starts and fully lit after it ends', () => {
    const scene = new GridScene(data, song);
    const before = scene.frame(layout, -1, 0, false);
    expect(before.pulses).toEqual([]);
    expect(before.beat).toBe(-1);
    const stopped = scene.frame(layout, null, 10, false);
    expect(stopped.beat).toBeNull();
  });

  it('throws sparks only for loud notes and only while animating', () => {
    const scene = new GridScene(data, song);
    let now = 0;
    let max = 0;
    for (let beat = 0; beat < song.totalBeats; beat += 0.1) {
      now += 50;
      max = Math.max(max, scene.frame(layout, beat, now, false).particles.length);
    }
    expect(max).toBeGreaterThan(0);

    const calm = new GridScene(data, song);
    now = 0;
    let calmMax = 0;
    for (let beat = 0; beat < song.totalBeats; beat += 0.1) {
      now += 50;
      const f = calm.frame(layout, beat, now, true); // reduced motion
      calmMax = Math.max(calmMax, f.particles.length, f.pulses.length);
    }
    expect(calmMax).toBe(0);
  });

  it('is deterministic: same song, same sparks', () => {
    const run = () => {
      const s = new GridScene(data, song);
      let last = s.frame(layout, 0, 0, false);
      for (let i = 1; i <= 120; i++) last = s.frame(layout, i * 0.2, i * 100, false);
      return last.particles.map((p) => [Math.round(p.x), Math.round(p.y)]);
    };
    expect(run()).toEqual(run());
  });

  it('reset clears sparks', () => {
    const s = new GridScene(data, song);
    for (let i = 0; i < 60; i++) s.frame(layout, 2 + i * 0.2, i * 50, false);
    s.reset();
    expect(s.frame(layout, null, 99999, false).particles).toHaveLength(0);
  });
});
