import { useEffect, useRef } from 'preact/hooks';
import type { ContributionData } from '../../shared/types';
import type { Song } from '../music/types';
import type { BeatClock } from './clock';
import { drawFrame } from './draw';
import { computeLayout } from './layout';
import { GridScene } from './scene';

interface Props {
  data: ContributionData;
  song: Song;
  clock: BeatClock;
  playing: boolean;
}

/** Canvas heatmap of the year. While `playing`, cells light as their notes sound under a sweeping glow. */
export function Visual({ data, song, clock, playing }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const scene = new GridScene(data, song);
    let raf = 0;

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
      drawFrame(ctx, scene.frame(layout, beat, now, motion.matches));
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
  }, [data, song, clock, playing]);

  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label={`Contribution graph for ${data.user}, ${data.year}: ${data.total} contributions`}
      style={{ width: '100%', display: 'block' }}
    />
  );
}
