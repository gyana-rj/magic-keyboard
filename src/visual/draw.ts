import type { Level } from '../../shared/types';
import { bandOf, cellX, cellY, COLS, ROWS, type Layout } from './layout';
import type { Palette } from './palettes';
import type { Particle } from './particles';
import type { ActivePulse } from './pulses';

export interface Frame {
  weeks: Level[][];
  palette: Palette;
  layout: Layout;
  /** Song position in beats, or null when stopped (whole graph shown, no sweep). */
  beat: number | null;
  introBeats: number;
  /** Beat each cell lights up at (see cellBeats). */
  cellBeats: number[][];
  pulses: ActivePulse[];
  particles: Particle[];
  /** Honors prefers-reduced-motion: columns light a week at a time, no glow, pulses or particles. */
  reducedMotion: boolean;
}

const UNLIT_ALPHA = 0.3;
const TRAIL_WEEKS = 7;

export function drawFrame(ctx: CanvasRenderingContext2D, f: Frame) {
  const { layout: l, palette, weeks, beat, pulses, particles, reducedMotion } = f;
  const pitch = l.cell + l.gap;
  const radius = Math.min(3, l.cell / 3);
  const pos = beat === null ? null : beat - f.introBeats; // fractional week position

  ctx.clearRect(0, 0, l.width, l.height);

  const cellPath = (x: number, y: number, size: number) => {
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, radius);
  };

  // Base graph. Each cell lights when its own note plays, so it fills in the order you hear it.
  for (let w = 0; w < COLS; w++) {
    for (let d = 0; d < ROWS; d++) {
      const lit = pos === null || (reducedMotion ? pos >= w : (beat as number) >= (f.cellBeats[w]?.[d] ?? 0));
      ctx.globalAlpha = lit ? 1 : UNLIT_ALPHA;
      ctx.fillStyle = palette.levels[weeks[w]?.[d] ?? 0]!;
      cellPath(cellX(l, w), cellY(l, w, d), l.cell);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // Pulses: the cell whose note just fired swells and glows, then settles.
  if (!reducedMotion) {
    ctx.fillStyle = palette.accent;
    ctx.shadowColor = palette.accent;
    for (const p of pulses) {
      const grow = p.strength * l.cell * 0.55;
      ctx.globalAlpha = Math.min(1, 0.2 + p.strength);
      ctx.shadowBlur = p.strength * l.cell * 2.2;
      cellPath(cellX(l, p.week) - grow / 2, cellY(l, p.week, p.day) - grow / 2, l.cell + grow);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // Glowing column sweep with a trailing wash; steps once per beat under reduced motion.
  if (pos !== null && pos >= 0) {
    const at = Math.min(COLS, reducedMotion ? Math.floor(pos) : pos);
    const band = at >= COLS ? l.bands - 1 : bandOf(l, at);
    const inBand = at - band * l.perBand;
    const x = l.x0 + inBand * pitch - l.gap / 2;
    const top = l.y0 + band * (l.bandHeight + l.bandGap) - 4;
    const h = l.bandHeight + 8;
    if (reducedMotion) {
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = palette.accent;
      ctx.fillRect(Math.round(x), top, pitch, h);
    } else {
      const left = Math.max(l.x0 - l.gap / 2, x - TRAIL_WEEKS * pitch);
      const g = ctx.createLinearGradient(left, 0, x, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, palette.accent);
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = g;
      ctx.fillRect(left, top, x - left, h);
      ctx.globalAlpha = 1;
      ctx.shadowColor = palette.accent;
      ctx.shadowBlur = 14;
    }
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = palette.accent;
    ctx.fillRect(Math.round(x), top, 2, h);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // Sparks from loud notes.
  if (!reducedMotion && particles.length) {
    ctx.fillStyle = palette.accent;
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life) * 0.8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
