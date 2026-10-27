import type { ApiError, ContributionData } from '../shared/types.js';
import { ApiFailure, failures } from './errors.js';
import { limitResponse, type Limiter } from './ratelimit.js';
import { isValidUsername, parseYear } from './validate.js';

/** Where contribution data comes from: GitHub in production, fixtures in dev. */
export type Source = (user: string, year: number) => Promise<ContributionData>;

const SIX_HOURS = 6 * 60 * 60;

const OK_CACHE = `public, max-age=0, s-maxage=${SIX_HOURS}, stale-while-revalidate=${SIX_HOURS * 4}`;
const NOT_FOUND_CACHE = 'public, max-age=0, s-maxage=300';

function json(body: unknown, status: number, cacheControl: string, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cacheControl, ...extra },
  });
}

function errorResponse(f: ApiFailure) {
  const body: ApiError = { error: { code: f.code, message: f.message } };
  const extra: Record<string, string> = {};
  if (f.retryAfterSeconds) extra['Retry-After'] = String(f.retryAfterSeconds);
  const cache = f.code === 'not_found' ? NOT_FOUND_CACHE : 'no-store';
  return json(body, f.status, cache, extra);
}

const ALLOWED_PARAMS = new Set(['user', 'year']);

export interface HandleOptions {
  limiter?: Limiter;
}

export async function handle(request: Request, source: Source, now = new Date(), opts: HandleOptions = {}): Promise<Response> {
  try {
    if (opts.limiter) {
      const limited = limitResponse(opts.limiter, request);
      if (limited) return limited;
    }
    const params = new URL(request.url).searchParams;
    // Strict on purpose: extra parameters could only be used to dodge the cache.
    for (const key of params.keys()) if (!ALLOWED_PARAMS.has(key)) throw failures.invalidRequest();
    const user = params.get('user');
    if (!isValidUsername(user)) throw failures.invalidUser();
    const year = parseYear(params.get('year'), now);
    if (year === null) throw failures.invalidYear();

    const data = await source(user, year);
    // A year with zero contributions is valid data (the app plays a "quiet year"), cached briefly
    // in case the user just made their contributions public.
    return json(data, 200, data.total === 0 ? NOT_FOUND_CACHE : OK_CACHE);
  } catch (err) {
    if (err instanceof ApiFailure) return errorResponse(err);
    console.error('contributions: unexpected error', err instanceof Error ? err.message : 'unknown');
    return errorResponse(failures.upstream());
  }
}
