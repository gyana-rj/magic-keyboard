export const COLS = 52;
export const ROWS = 7;

export interface Layout {
  cell: number;
  gap: number;
  x0: number;
  y0: number;
  width: number;
  height: number;
}

/** Fits the 52x7 grid into `width` CSS pixels; the height follows from the cell size. */
export function computeLayout(width: number, pad = 8): Layout {
  const gap = width < 480 ? 1 : 2;
  const cell = Math.max(2, Math.floor((width - 2 * pad - gap * (COLS - 1)) / COLS));
  const gridW = COLS * cell + (COLS - 1) * gap;
  const gridH = ROWS * cell + (ROWS - 1) * gap;
  return {
    cell,
    gap,
    x0: Math.floor((width - gridW) / 2),
    y0: pad,
    width,
    height: gridH + 2 * pad,
  };
}

export function cellX(l: Layout, week: number): number {
  return l.x0 + week * (l.cell + l.gap);
}

export function cellY(l: Layout, day: number): number {
  return l.y0 + day * (l.cell + l.gap);
}
