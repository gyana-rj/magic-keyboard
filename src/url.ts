import { isValidUsername, parseYear } from '../server/validate';

export interface ShareParams {
  user: string;
  year: number;
}

const PATH_RE = /^\/u\/([^/]+)\/(\d{4})\/?$/;

/** Reads `/u/<login>/<yyyy>`. Null unless the username is valid and the year in range. */
export function parseSharePath(pathname: string, now = new Date()): ShareParams | null {
  const m = PATH_RE.exec(pathname);
  if (!m) return null;
  let user: string;
  try {
    user = decodeURIComponent(m[1]!);
  } catch {
    return null;
  }
  if (!isValidUsername(user)) return null;
  const year = parseYear(m[2]!, now);
  return year === null ? null : { user, year };
}

/** Reads the older `?u=<login>&y=<yyyy>` form (kept so links already shared keep working). */
export function parseShareParams(search: string, now = new Date()): ShareParams | null {
  const q = new URLSearchParams(search);
  const user = q.get('u');
  if (!isValidUsername(user)) return null;
  const year = parseYear(q.get('y'), now);
  return year === null ? null : { user, year };
}

/** The current location as a share target: `/u/<login>/<yyyy>` first, then the legacy query form. */
export function parseShareLocation(loc: { pathname: string; search: string }, now = new Date()): ShareParams | null {
  return parseSharePath(loc.pathname, now) ?? (loc.pathname === '/' ? parseShareParams(loc.search, now) : null);
}

/** Path for a song, e.g. `/u/octocat/2025`. */
export function sharePath(user: string, year: number): string {
  return `/u/${encodeURIComponent(user)}/${year}`;
}

export function shareUrl(origin: string, user: string, year: number): string {
  return origin + sharePath(user, year);
}
