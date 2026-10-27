import { cachedSource } from './cache.js';
import { fetchContributions } from './github.js';
import { createLimiter } from './ratelimit.js';

/** Requests per client per minute that reach the functions (CDN cache hits never get here). */
export const LIMIT_PER_MINUTE = 30;

/** An absolute http(s) origin from PUBLIC_URL, or null. */
export function publicOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.origin : null;
  } catch {
    return null;
  }
}

/**
 * Per-instance singletons shared by the API functions: the token (read only here, on the server), the cached
 * GitHub source and the rate limiter. PUBLIC_URL pins the origin used in share links and OG tags.
 */
export function createRuntime(env: Record<string, string | undefined> = process.env) {
  const token = env.GITHUB_TOKEN;
  return {
    source: cachedSource((user, year) => fetchContributions({ user, year, token })),
    limiter: createLimiter({ limit: LIMIT_PER_MINUTE, windowMs: 60_000 }),
    origin: (request: Request) => publicOrigin(env.PUBLIC_URL) ?? new URL(request.url).origin,
  };
}

export const runtime = createRuntime();
