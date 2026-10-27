import type { ContributionData } from '../../shared/types';
import { GENRES } from '../music/genres';
import { keyName } from '../music/scales';
import type { Song } from '../music/types';
import { busiestWeek, longestStreak, weekRange } from '../stats';

/** Everything the share card (and the stats under the player) say, as plain strings. */
export interface CardModel {
  user: string;
  year: number;
  total: string;
  busiest: string;
  streak: string;
  genre: string;
  /** e.g. "D dorian · 110 BPM" */
  mood: string;
  headline: string;
  quiet: boolean;
}

export function buildCardModel(data: ContributionData, song: Song): CardModel {
  const genre = GENRES[song.genre].label;
  const best = busiestWeek(data.weeks);
  const streak = longestStreak(data.weeks, data.year);
  const quiet = data.total === 0;
  return {
    user: data.user,
    year: data.year,
    total: data.total.toLocaleString('en-US'),
    busiest: best ? weekRange(data.year, best.week) : '—',
    streak: `${streak} ${streak === 1 ? 'day' : 'days'}`,
    genre,
    mood: `${keyName(song.rootPc)} ${song.mode} · ${song.bpm} BPM`,
    headline: quiet
      ? `A quiet year, set to a gentle ${song.bpm} BPM ${genre.toLowerCase()} track`
      : `${data.total.toLocaleString('en-US')} contributions, set to a ${song.bpm} BPM ${genre.toLowerCase()} track`,
    quiet,
  };
}

export function cardFilename(user: string, year: number, format: 'landscape' | 'square' | 'story' = 'landscape'): string {
  return `commit-symphony-${user.toLowerCase()}-${year}-${format}.png`;
}

export function wavFilename(user: string, year: number): string {
  return `commit-symphony-${user.toLowerCase()}-${year}.wav`;
}

/** Text shared alongside the link. */
export function shareText(m: CardModel): string {
  return `Listen to my ${m.year} as a 30-second ${m.genre.toLowerCase()} song.`;
}
