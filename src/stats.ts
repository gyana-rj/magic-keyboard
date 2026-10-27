import type { Level } from '../shared/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = 86_400_000;

const jan1 = (year: number) => Date.UTC(year, 0, 1);
const fmt = (t: number) => `${MONTHS[new Date(t).getUTCMonth()]} ${new Date(t).getUTCDate()}`;
const sameMonth = (a: number, b: number) => new Date(a).getUTCMonth() === new Date(b).getUTCMonth();

/** Calendar date range of graph column `week` (0-51; week 0 starts on Jan 1), e.g. "Mar 9–15" or "Mar 30 – Apr 5". */
export function weekRange(year: number, week: number): string {
  const k = new Date(jan1(year)).getUTCDay();
  const start = week === 0 ? jan1(year) : jan1(year) + (7 * week - k) * DAY;
  const end = start + (week === 0 ? 6 - k : 6) * DAY;
  return sameMonth(start, end) ? `${fmt(start)}–${new Date(end).getUTCDate()}` : `${fmt(start)} – ${fmt(end)}`;
}

/** Week with the most activity (sum of levels; the API gives levels, not counts). Null for an empty year. */
export function busiestWeek(weeks: Level[][]): { week: number; score: number } | null {
  let best = { week: -1, score: 0 };
  weeks.forEach((w, i) => {
    const score = w.reduce<number>((s, l) => s + l, 0);
    if (score > best.score) best = { week: i, score };
  });
  return best.week < 0 ? null : best;
}

/**
 * Longest run of consecutive days with any contribution. Columns are Sunday-first and week 0 also
 * holds the folded-in last days of December (weekdays before Jan 1's), so those are put at the end.
 * Within a day or two of New Year's the result is approximate.
 */
export function longestStreak(weeks: Level[][], year: number): number {
  const k = new Date(jan1(year)).getUTCDay();
  const days: number[] = [];
  const first = weeks[0] ?? [];
  for (let d = k; d < 7; d++) days.push(first[d] ?? 0);
  for (let w = 1; w < weeks.length; w++) for (let d = 0; d < 7; d++) days.push(weeks[w]?.[d] ?? 0);
  for (let d = 0; d < k; d++) days.push(first[d] ?? 0);
  let best = 0;
  let run = 0;
  for (const level of days) {
    run = level > 0 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}
