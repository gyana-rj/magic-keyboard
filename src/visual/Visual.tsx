import { useEffect, useMemo, useRef } from 'preact/hooks';
import type { ContributionData } from '../../shared/types';
import type { Song } from '../music/types';
import type { BeatClock } from './clock';
import { drawFrame } from './draw';
import { computeLayout } from './layout';
import { PALETTES } from './palettes';
import { activePulses, buildPulses } from './pulses';

interface Props {
  data: ContributionData;
  song: Song;
  clock: BeatClock;
  playing: boolean;
}

/** Canvas heatmap of the year. While `playing`, a playhead sweeps it and cells pulse with the notes. */
export function Visual({ data, song, clock, playing }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pulses = useMemo(() => buildPulses(song), [song]);
  const palette = PALETTES[song.genre];

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;

    const render = () => {
      const width = el.clientWidth || 600;
      const layout = computeLayout(width);
      const dpr = window.devicePixelRatio || 1;
      if (el.width !== Math.round(width * dpr) || el.height !== Math.round(layout.height * dpr)) {
        el.width = Math.round(width * dpr);
        el.height = Math.round(layout.height * dpr);
        el.style.height = `${layout.height}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const beat = playing ? clock.beatAt(performance.now()) : null;
      drawFrame(ctx, {
        weeks: data.weeks,
        palette,
        layout,
        playhead: beat === null ? null : beat - song.introBeats,
        pulses: beat === null ? [] : activePulses(pulses, beat),
        reducedMotion: motion.matches,
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
  }, [data, song, clock, playing, pulses, palette]);

  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label={`Contribution graph for ${data.user}, ${data.year}: ${data.total} contributions`}
      style={{ width: '100%', display: 'block' }}
    />
  );
}
