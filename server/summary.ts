import type { ContributionData } from '../shared/types.js';
import { GENRES, genreForData } from '../src/music/genres.js';
import { busiestWeek, weekRange } from '../src/stats.js';

/** The few facts the link preview talks about. Pure; shared by the page meta tags and the OG image. */
export interface Summary {
  user: string;
  year: number;
  total: number;
  totalText: string;
  genreId: ReturnType<typeof genreForData>;
  genre: string;
  busiest: string | null;
}

export function summarize(data: ContributionData): Summary {
  const genreId = genreForData(data.topLanguages, data.total);
  const best = busiestWeek(data.weeks);
  return {
    user: data.user,
    year: data.year,
    total: data.total,
    totalText: data.total.toLocaleString('en-US'),
    genreId,
    genre: GENRES[genreId].label,
    busiest: best ? weekRange(data.year, best.week) : null,
  };
}
