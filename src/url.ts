import { isValidUsername, parseYear } from '../server/validate';

export interface ShareParams {
  user: string;
  year: number;
}

/** Reads `?u=<login>&y=<yyyy>`. Returns null unless the username is valid; a missing year means this year. */
export function parseShareParams(search: string, now = new Date()): ShareParams | null {
  const q = new URLSearchParams(search);
  const user = q.get('u');
  if (!isValidUsername(user)) return null;
  const year = parseYear(q.get('y'), now);
  return year === null ? null : { user, year };
}

/** Path + query for a song, e.g. `/?u=octocat&y=2025`. */
export function sharePath(user: string, year: number): string {
  return `/?u=${encodeURIComponent(user)}&y=${year}`;
}

export function shareUrl(origin: string, user: string, year: number): string {
  return origin + sharePath(user, year);
}
