import type { ContributionData } from '../../shared/types';
import type { Song } from '../music/types';
import { drawFrame } from '../visual/draw';
import { computeLayout } from '../visual/layout';
import { PALETTES } from '../visual/palettes';
import { buildCardModel } from './model';

export const CARD_W = 1200;
export const CARD_H = 630;
const PAD = 56;
const FONT = `ui-rounded, 'SF Pro Rounded', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;

/** Fixed positions (px) of each block on the card; kept as data so they can be tested for overlap. */
export interface CardLayout {
  brand: { y: number };
  title: { y: number; maxWidth: number };
  headline: { y: number };
  grid: { x: number; y: number; width: number };
  stats: { y: number; colWidth: number };
  footer: { y: number };
}

export function cardLayout(): CardLayout {
  const inner = CARD_W - 2 * PAD;
  return {
    brand: { y: PAD + 14 },
    title: { y: 168, maxWidth: inner },
    headline: { y: 212 },
    grid: { x: PAD, y: 236, width: inner },
    stats: { y: 470, colWidth: inner / 3 },
    footer: { y: CARD_H - PAD + 8 },
  };
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

/** Draws the share card (1200x630, the standard link-preview size) and returns its canvas. */
export function renderCard(data: ContributionData, song: Song, host: string): HTMLCanvasElement {
  const m = buildCardModel(data, song);
  const palette = PALETTES[song.genre];
  const L = cardLayout();
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;

  // Background: deep night with soft genre-colored glows.
  ctx.fillStyle = '#090913';
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  for (const [x, y, r, color, a] of [
    [0, 0, 620, palette.levels[2], 0.5],
    [CARD_W, CARD_H * 0.2, 520, palette.levels[3], 0.28],
  ] as const) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(9,9,19,0)');
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
  }
  ctx.globalAlpha = 1;

  ctx.textBaseline = 'alphabetic';

  // Brand + genre pill.
  mark(ctx, PAD, L.brand.y - 22, 28, palette.accent, palette.levels[3]);
  ctx.fillStyle = 'rgba(243,241,251,0.75)';
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText('Commit Symphony', PAD + 44, L.brand.y);
  ctx.font = `700 20px ${FONT}`;
  const pill = m.genre.toUpperCase();
  const pw = ctx.measureText(pill).width + 36;
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(CARD_W - PAD - pw, L.brand.y - 28, pw, 42, 21);
  ctx.stroke();
  ctx.fillStyle = palette.accent;
  ctx.fillText(pill, CARD_W - PAD - pw + 18, L.brand.y);

  // Title: @user + year, shrunk to fit long names.
  const who = `@${m.user}`;
  const yr = ` ${m.year}`;
  const size = fit(ctx, who + yr, 800, 76, L.title.maxWidth);
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.fillStyle = '#f3f1fb';
  ctx.fillText(who, PAD, L.title.y);
  const whoW = ctx.measureText(who).width;
  ctx.fillStyle = palette.accent;
  ctx.fillText(yr, PAD + whoW, L.title.y);

  ctx.fillStyle = 'rgba(243,241,251,0.7)';
  fit(ctx, m.headline, 500, 24, L.title.maxWidth);
  ctx.fillText(m.headline, PAD, L.headline.y);

  // Heatmap: reuse the live renderer with everything lit (beat = null).
  const layout = computeLayout(L.grid.width, 0);
  const grid = document.createElement('canvas');
  grid.width = layout.width;
  grid.height = layout.height;
  drawFrame(grid.getContext('2d')!, {
    weeks: data.weeks,
    palette,
    layout,
    beat: null,
    introBeats: song.introBeats,
    cellBeats: [],
    pulses: [],
    particles: [],
    reducedMotion: true,
  });
  ctx.drawImage(grid, L.grid.x, L.grid.y);

  // Stats.
  const stats: [string, string][] = [
    ['CONTRIBUTIONS', m.total],
    ['BUSIEST WEEK', m.busiest],
    ['LONGEST STREAK', m.streak],
  ];
  stats.forEach(([label, value], i) => {
    const x = PAD + i * L.stats.colWidth;
    ctx.fillStyle = 'rgba(167,163,192,0.9)';
    ctx.font = `700 18px ${FONT}`;
    ctx.fillText(label.split('').join(' '), x, L.stats.y);
    ctx.fillStyle = '#f3f1fb';
    fit(ctx, value, 800, 52, L.stats.colWidth - 24);
    ctx.fillText(value, x, L.stats.y + 58);
  });

  // Footer.
  ctx.font = `500 20px ${FONT}`;
  ctx.fillStyle = 'rgba(167,163,192,0.9)';
  ctx.fillText(`${m.mood}  ·  your year, as a song, for GitHub users`, PAD, L.footer.y);
  ctx.textAlign = 'right';
  ctx.fillStyle = palette.accent;
  ctx.fillText(host, CARD_W - PAD, L.footer.y);
  ctx.textAlign = 'left';

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the image.'))), 'image/png'),
  );
}
