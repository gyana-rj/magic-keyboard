import type { ContributionData } from '../shared/types.js';
import { ApiFailure, failures } from './errors.js';
import type { Source } from './handler.js';
import { fallbackShell, injectHead, pageMeta } from './meta.js';
import type { Limiter } from './ratelimit.js';
import { limitResponse } from './ratelimit.js';
import { summarize } from './summary.js';
import { isValidUsername, parseYear } from './validate.js';

export interface ShareDeps {
  source: Source;
  /** The built index.html (or null if unavailable). */
  template: () => Promise<string | null>;
  /** Public origin used in absolute URLs, e.g. https://symphony.example */
  origin: string;
  limiter?: Limiter;
}

const OK_CACHE = 'public, max-age=0, s-maxage=21600, stale-while-revalidate=86400';
const SHORT_CACHE = 'public, max-age=0, s-maxage=300';

function html(body: string, status: number, cache: string) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' },
  });
}

/**
 * Serves the app shell for /u/:user/:year with Open Graph + Twitter card tags filled in server-side, so
 * link previews (which never run JavaScript) show the real result. The browser then boots the app,
 * which reads the same path and loads and plays that result.
 */
export async function handleShare(request: Request, deps: ShareDeps, now = new Date()): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const user = params.get('user');
  const year = parseYear(params.get('year'), now);
  const template = await deps.template().catch(() => null);
  const render = (user: string, y: number, data: ContributionData | null, status: number, cache: string) => {
    const meta = pageMeta(deps.origin, user, y, data ? summarize(data) : null);
    return html(template ? injectHead(template, meta) : fallbackShell(meta, user, y), status, cache);
  };
  const generic = (status: number, cache: string) => {
    const meta = pageMeta(deps.origin, '', 0, null);
    return html(template ? injectHead(template, meta) : fallbackShell(meta, '', 0), status, cache);
  };

  if (!isValidUsername(user) || year === null) return generic(404, SHORT_CACHE);

  if (deps.limiter) {
    const limited = limitResponse(deps.limiter, request);
    if (limited) return generic(429, 'no-store');
  }

  try {
    const data = await deps.source(user, year);
    return render(data.user, data.year, data, 200, data.total === 0 ? SHORT_CACHE : OK_CACHE);
  } catch (err) {
    if (err instanceof ApiFailure && err.code === 'not_found') return generic(404, SHORT_CACHE);
    // Rate limits and outages: still serve the app (it will retry and explain), with the generic card.
    if (!(err instanceof ApiFailure)) console.error('share: unexpected error', err instanceof Error ? err.message : 'unknown');
    return generic(200, 'no-store');
  }
}

/** Dev helper: turn a `/u/:user/:year` request into the query form `handleShare` reads. */
export function shareRequestFromPath(request: Request): Request | null {
  const url = new URL(request.url);
  const m = /^\/u\/([^/]+)\/([^/]+)\/?$/.exec(url.pathname);
  if (!m) return null;
  const target = new URL('/api/share', url.origin);
  target.searchParams.set('user', decodeURIComponent(m[1]!));
  target.searchParams.set('year', m[2]!);
  return new Request(target);
}

export { failures };
