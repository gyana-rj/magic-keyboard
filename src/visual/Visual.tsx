import { useEffect, useMemo, useRef } from 'preact/hooks';
import type { ContributionData } from '../../shared/types';
import { mulberry32 } from '../music/prng';
import type { Song } from '../music/types';
import type { BeatClock } from './clock';
import { drawFrame } from './draw';
import { cellX, cellY, computeLayout } from './layout';
import { PALETTES } from './palettes';
import { Particles } from './particles';
import { activePulses, buildPulses, cellBeats, pulsesBetween } from './pulses';

interface Props {
  data: ContributionData;
  song: Song;
  clock: BeatClock;
  playing: boolean;
}

/** Notes at or above this velocity (contribution level 3-4) throw sparks. */
const LOUD = 0.7;

/** Canvas heatmap of the year. While `playing`, cells light as their notes sound under a sweeping glow. */
export function Visual({ data, song, clock, playing }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pulses = useMemo(() => buildPulses(song), [song]);
  const beats = useMemo(() => cellBeats(song, pulses), [song, pulses]);
  const palette = PALETTES[song.genre];

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sparks = new Particles(mulberry32(song.seed));
    let raf = 0;
    let lastBeat: number | null = null;
    let lastTime = performance.now();

    const render = () => {
      const now = performance.now();
      const width = el.clientWidth || 600;
      const layout = computeLayout(width);
      const dpr = window.devicePixelRatio || 1;
      if (el.width !== Math.round(width * dpr) || el.height !== Math.round(layout.height * dpr)) {
        el.width = Math.round(width * dpr);
        el.height = Math.round(layout.height * dpr);
        el.style.height = `${layout.height}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const beat = playing ? (clock.beatAt(now) ?? -1) : null; // -1: about to start, nothing lit yet
      const reduced = motion.matches;
      if (beat !== null && !reduced) {
        if (lastBeat !== null && beat > lastBeat) {
          for (const p of pulsesBetween(pulses, lastBeat, beat)) {
            if (p.vel >= LOUD) {
              sparks.emit(cellX(layout, p.week) + layout.cell / 2, cellY(layout, p.week, p.day), p.vel > 0.9 ? 4 : 2, layout.cell / 4 + 0.8);
            }
          }
        }
        sparks.step((now - lastTime) / 1000);
      } else {
        sparks.clear();
      }
      lastBeat = beat;
      lastTime = now;

      drawFrame(ctx, {
        weeks: data.weeks,
        palette,
        layout,
        beat,
        introBeats: song.introBeats,
        cellBeats: beats,
        pulses: beat === null || reduced ? [] : activePulses(pulses, beat),
        particles: sparks.items,
        reducedMotion: reduced,
      });
    };

    const loop = () => {
      render();
      raf = requestAnimationFrame(loop);
    };
    if (playing) loop();
    else render();

    const ro = new ResizeObserver(() => !playing && render());
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [data, song, clock, playing, pulses, beats, palette]);

  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label={`Contribution graph for ${data.user}, ${data.year}: ${data.total} contributions`}
      style={{ width: '100%', display: 'block' }}
    />
  );
}
