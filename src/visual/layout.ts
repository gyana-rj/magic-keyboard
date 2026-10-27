export const COLS = 52;
export const ROWS = 7;
/** Below this width the year wraps into two stacked 26-week bands so cells stay tappable-size. */
export const NARROW = 640;
/** Space above the grid for particles to rise into. */
const HEADROOM = 22;

export interface Layout {
  cell: number;
  gap: number;
  x0: number;
  y0: number;
  width: number;
  height: number;
  bands: number;
  /** Weeks per band. */
  perBand: number;
  bandHeight: number;
  bandGap: number;
}

/** Fits the 52x7 grid into `width` CSS pixels; the height follows from the cell size. */
export function computeLayout(width: number, pad = 8): Layout {
  const bands = width < NARROW ? 2 : 1;
  const perBand = COLS / bands;
  const gap = width < 480 ? 1 : 2;
  const cell = Math.max(2, Math.floor((width - 2 * pad - gap * (perBand - 1)) / perBand));
  const gridW = perBand * cell + (perBand - 1) * gap;
  const bandHeight = ROWS * cell + (ROWS - 1) * gap;
  const bandGap = bands > 1 ? Math.max(8, cell) : 0;
  return {
    cell,
    gap,
    x0: Math.floor((width - gridW) / 2),
    y0: pad + HEADROOM,
    width,
    height: pad + HEADROOM + bands * bandHeight + (bands - 1) * bandGap + pad,
    bands,
    perBand,
    bandHeight,
    bandGap,
  };
}

export const bandOf = (l: Layout, week: number) => Math.min(l.bands - 1, Math.floor(week / l.perBand));

export function cellX(l: Layout, week: number): number {
  return l.x0 + (week % l.perBand) * (l.cell + l.gap);
}

export function cellY(l: Layout, week: number, day: number): number {
  return l.y0 + bandOf(l, week) * (l.bandHeight + l.bandGap) + day * (l.cell + l.gap);
}
