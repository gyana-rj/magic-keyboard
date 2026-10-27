import type { ContributionData } from '../../shared/types';
import type { Song } from '../music/types';
import { drawFrame } from '../visual/draw';
import { computeLayout } from '../visual/layout';
import { PALETTES } from '../visual/palettes';
import { buildCardModel } from './model';

export type CardFormat = 'landscape' | 'square' | 'story';

export const CARD_FORMATS: Record<CardFormat, { w: number; h: number; label: string; hint: string }> = {
  landscape: { w: 1200, h: 630, label: 'Landscape', hint: '1200×630 · link previews, X, LinkedIn' },
  square: { w: 1080, h: 1080, label: 'Square', hint: '1080×1080 · Instagram, WhatsApp' },
  story: { w: 1080, h: 1920, label: 'Story', hint: '1080×1920 · Stories, Reels, Shorts' },
};

const FONT = `ui-rounded, 'SF Pro Rounded', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;

/** Fixed positions (px) of each block, kept as data so they can be tested for overlap and bounds. */
export interface CardLayout {
  w: number;
  h: number;
  pad: number;
  brand: { y: number };
  title: { y: number; size: number };
  headline: { y: number; size: number };
  grid: { x: number; y: number; width: number; bands: 1 | 2 };
  stats: { x: number; y: number; colWidth: number; rowHeight: number; cols: number; valueSize: number; labelSize: number };
  footer: { y: number };
}

export function cardLayout(format: CardFormat): CardLayout {
  const { w, h } = CARD_FORMATS[format];
  switch (format) {
    case 'landscape': {
      const pad = 56;
      const inner = w - 2 * pad;
      return {
        w, h, pad,
        brand: { y: pad + 14 },
        title: { y: 168, size: 76 },
        headline: { y: 212, size: 24 },
        grid: { x: pad, y: 236, width: inner, bands: 1 },
        stats: { x: pad, y: 470, colWidth: inner / 3, rowHeight: 0, cols: 3, valueSize: 52, labelSize: 18 },
        footer: { y: h - pad + 8 },
      };
    }
    case 'square': {
      const pad = 64;
      const inner = w - 2 * pad;
      return {
        w, h, pad,
        brand: { y: pad + 36 },
        title: { y: 232, size: 92 },
        headline: { y: 288, size: 28 },
        grid: { x: pad, y: 340, width: inner, bands: 2 },
        stats: { x: pad, y: 938, colWidth: inner / 3, rowHeight: 0, cols: 3, valueSize: 52, labelSize: 18 },
        footer: { y: h - 50 },
      };
    }
    case 'story': {
      const pad = 64;
      const inner = w - 2 * pad;
      return {
        w, h, pad,
        brand: { y: 120 },
        title: { y: 360, size: 104 },
        headline: { y: 424, size: 32 },
        grid: { x: pad, y: 560, width: inner, bands: 2 },
        stats: { x: pad, y: 1290, colWidth: inner, rowHeight: 170, cols: 1, valueSize: 76, labelSize: 22 },
        footer: { y: h - 70 },
      };
    }
  }
}

/** Where the heatmap sits on a card, and its internal layout (also used by the video frames). */
export function gridBox(format: CardFormat) {
  const L = cardLayout(format);
  return { x: L.grid.x, y: L.grid.y, layout: computeLayout(L.grid.width, 0, L.grid.bands) };
}

/** Shrinks the font until `text` fits `maxWidth`. */
function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, start: number, maxWidth: number): number {
  let size = start;
  ctx.font = `${weight} ${size}px ${FONT}`;
  while (size > 24 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${FONT}`;
  }
  return size;
}

function mark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, from: string, to: string) {
  const heights = [0.45, 0.75, 0.55, 1, 0.65, 0.85, 0.35];
  const g = ctx.createLinearGradient(0, y, 0, y + size);
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  ctx.fillStyle = g;
  heights.forEach((h, i) => {
    ctx.beginPath();
    ctx.roundRect(x + i * (size / 7), y + size * (1 - h), size / 11, size * h, size / 22);
    ctx.fill();
  });
}

/**
 * Draws a share card and returns its canvas. With `grid: false` the heatmap area is left empty, so the video
 * export can animate its own graph there.
 */
export function renderCard(
  data: ContributionData,
  song: Song,
  host: string,
  format: CardFormat = 'landscape',
  opts: { grid?: boolean } = {},
): HTMLCanvasElement {
  const m = buildCardModel(data, song);
  const palette = PALETTES[song.genre];
  const L = cardLayout(format);
  const inner = L.w - 2 * L.pad;
  const canvas = document.createElement('canvas');
  canvas.width = L.w;
  canvas.height = L.h;
  const ctx = canvas.getContext('2d')!;
  const tall = L.h > L.w;

  // Background: deep night with soft genre-colored glows.
  ctx.fillStyle = '#090913';
  ctx.fillRect(0, 0, L.w, L.h);
  const glow = Math.max(L.w, L.h) * (tall ? 0.45 : 0.52);
  for (const [x, y, r, color, a] of [
    [0, 0, glow, palette.levels[2], 0.5],
    [L.w, L.h * 0.2, glow * 0.85, palette.levels[3], 0.28],
  ] as const) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(9,9,19,0)');
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, L.w, L.h);
  }
  ctx.globalAlpha = 1;
  ctx.textBaseline = 'alphabetic';

  // Brand + genre pill.
  const k = tall ? 1.25 : 1;
  mark(ctx, L.pad, L.brand.y - 22 * k, 28 * k, palette.accent, palette.levels[3]);
  ctx.fillStyle = 'rgba(243,241,251,0.75)';
  ctx.font = `700 ${22 * k}px ${FONT}`;
  ctx.fillText('Commit Symphony', L.pad + 44 * k, L.brand.y);
  ctx.font = `700 ${20 * k}px ${FONT}`;
  const pill = m.genre.toUpperCase();
  const pw = ctx.measureText(pill).width + 36 * k;
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(L.w - L.pad - pw, L.brand.y - 28 * k, pw, 42 * k, 21 * k);
  ctx.stroke();
  ctx.fillStyle = palette.accent;
  ctx.fillText(pill, L.w - L.pad - pw + 18 * k, L.brand.y);

  // Title: @user + year, shrunk to fit long names.
  const who = `@${m.user}`;
  const yr = ` ${m.year}`;
  const size = fit(ctx, who + yr, 800, L.title.size, inner);
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.fillStyle = '#f3f1fb';
  ctx.fillText(who, L.pad, L.title.y);
  const whoW = ctx.measureText(who).width;
  ctx.fillStyle = palette.accent;
  ctx.fillText(yr, L.pad + whoW, L.title.y);

  ctx.fillStyle = 'rgba(243,241,251,0.7)';
  fit(ctx, m.headline, 500, L.headline.size, inner);
  ctx.fillText(m.headline, L.pad, L.headline.y);

  // Heatmap: the live renderer with everything lit (beat = null).
  if (opts.grid !== false) {
    const box = gridBox(format);
    const grid = document.createElement('canvas');
    grid.width = box.layout.width;
    grid.height = box.layout.height;
    drawFrame(grid.getContext('2d')!, {
      weeks: data.weeks,
      palette,
      layout: box.layout,
      beat: null,
      introBeats: song.introBeats,
      cellBeats: [],
      pulses: [],
      particles: [],
      reducedMotion: true,
    });
    ctx.drawImage(grid, box.x, box.y);
  }

  // Stats: a row of three, or stacked on the tall story card.
  const S = L.stats;
  const stats: [string, string][] = [
    ['CONTRIBUTIONS', m.total],
    ['BUSIEST WEEK', m.busiest],
    ['LONGEST STREAK', m.streak],
  ];
  stats.forEach(([label, value], i) => {
    const x = S.x + (i % S.cols) * S.colWidth;
    const y = S.y + Math.floor(i / S.cols) * S.rowHeight;
    ctx.fillStyle = 'rgba(167,163,192,0.9)';
    ctx.font = `700 ${S.labelSize}px ${FONT}`;
    ctx.fillText(label.split('').join(' '), x, y);
    ctx.fillStyle = '#f3f1fb';
    fit(ctx, value, 800, S.valueSize, S.colWidth - 24);
    ctx.fillText(value, x, y + S.valueSize * 1.1);
  });

  // Footer.
  ctx.font = `500 ${20 * k}px ${FONT}`;
  ctx.fillStyle = 'rgba(167,163,192,0.9)';
  const footer = tall ? `${m.mood}  ·  for GitHub users` : `${m.mood}  ·  your year, as a song, for GitHub users`;
  ctx.fillText(footer, L.pad, L.footer.y);
  ctx.textAlign = 'right';
  ctx.fillStyle = palette.accent;
  ctx.fillText(host, L.w - L.pad, L.footer.y);
  ctx.textAlign = 'left';

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the image.'))), 'image/png'),
  );
}
