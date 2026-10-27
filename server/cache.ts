import { ApiFailure } from './errors.js';
import type { Source } from './handler.js';

export interface CacheOptions {
  /** Successful results (matches the 6h CDN cache). */
  ttlMs?: number;
  /** "No such user" and zero-activity answers. */
  notFoundTtlMs?: number;
  /** Rate limits and outages: remembered briefly so we don't hammer GitHub while it is unhappy. */
  transientTtlMs?: number;
  max?: number;
}

type Entry = { expires: number; value?: Awaited<ReturnType<Source>>; failure?: ApiFailure };

/**
 * Wraps a data source with a small in-memory cache and de-duplication of simultaneous identical requests.
 * Keys are the lower-cased user and year, so changing a query string or letter case can't force new GitHub calls.
 * The CDN cache sits in front of this; this layer covers cache-busting and the gaps between CDN regions.
 */
export function cachedSource(source: Source, opts: CacheOptions = {}, clock: () => number = Date.now): Source {
  const { ttlMs = 6 * 3600_000, notFoundTtlMs = 5 * 60_000, transientTtlMs = 30_000, max = 500 } = opts;
  const entries = new Map<string, Entry>();
  const inflight = new Map<string, ReturnType<Source>>();

  return (user, year) => {
    const key = `${user.toLowerCase()}:${year}`;
    const hit = entries.get(key);
    if (hit && hit.expires > clock()) {
      entries.delete(key);
      entries.set(key, hit); // refresh recency
      return hit.failure ? Promise.reject(hit.failure) : Promise.resolve(hit.value!);
    }
    const running = inflight.get(key);
    if (running) return running;

    const remember = (e: Entry) => {
      entries.set(key, e);
      while (entries.size > max) entries.delete(entries.keys().next().value as string);
    };
    const p = source(user, year).then(
      (value) => {
        remember({ expires: clock() + (value.total === 0 ? notFoundTtlMs : ttlMs), value });
        return value;
      },
      (err) => {
        if (err instanceof ApiFailure && err.code !== 'server_misconfigured' && err.code !== 'invalid_user' && err.code !== 'invalid_year') {
          remember({ expires: clock() + (err.code === 'not_found' ? notFoundTtlMs : transientTtlMs), failure: err });
        }
        throw err;
      },
    );
    inflight.set(key, p);
    const done = () => inflight.delete(key);
    p.then(done, done);
    return p;
  };
}
