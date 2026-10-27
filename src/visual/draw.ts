import type { Level } from '../../shared/types';
import { cellX, cellY, COLS, ROWS, type Layout } from './layout';
import type { Palette } from './palettes';
import type { ActivePulse } from './pulses';

export interface Frame {
  weeks: Level[][];
  palette: Palette;
  layout: Layout;
  /** Fractional week position of the playhead (0-52), or null when stopped (whole graph shown). */
  playhead: number | null;
  pulses: ActivePulse[];
  /** Honors prefers-reduced-motion: no sliding playhead, no pulse scaling or glow. */
  reducedMotion: boolean;
}

const UNPLAYED_ALPHA = 0.28;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, s, s, r);
}

export function drawFrame(ctx: CanvasRenderingContext2D, f: Frame) {
  const { layout: l, palette, weeks, playhead, pulses, reducedMotion } = f;
  ctx.clearRect(0, 0, l.width, l.height);
  const radius = Math.min(2, l.cell / 3);
  const playedUpTo = playhead === null ? COLS : Math.floor(playhead) + 1;

  // Base graph: columns the song has not reached yet are dimmed, so the graph "fills in" as it plays.
  for (let w = 0; w < COLS; w++) {
    ctx.globalAlpha = w < playedUpTo ? 1 : UNPLAYED_ALPHA;
    for (let d = 0; d < ROWS; d++) {
      ctx.fillStyle = palette.levels[weeks[w]?.[d] ?? 0]!;
      roundRect(ctx, cellX(l, w), cellY(l, d), l.cell, radius);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // Pulses: the cell whose note just fired glows and swells, then settles.
  if (!reducedMotion) {
    for (const p of pulses) {
      const grow = p.strength * l.cell * 0.5;
      const x = cellX(l, p.week) - grow / 2;
      const y = cellY(l, p.day) - grow / 2;
      ctx.globalAlpha = Math.min(1, 0.25 + p.strength);
      ctx.fillStyle = palette.accent;
      ctx.shadowColor = palette.accent;
      ctx.shadowBlur = p.strength * l.cell * 2;
      roundRect(ctx, x, y, l.cell + grow, radius);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // Playhead: a thin line gliding across the weeks (stepping per beat when motion is reduced).
  if (playhead !== null) {
    const pos = Math.min(COLS, Math.max(0, reducedMotion ? Math.floor(playhead) : playhead));
    const x = l.x0 + pos * (l.cell + l.gap) - l.gap / 2;
    ctx.fillStyle = palette.accent;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(Math.round(x), l.y0 - 4, 2, ROWS * (l.cell + l.gap) + 4);
    ctx.globalAlpha = 1;
  }
}
