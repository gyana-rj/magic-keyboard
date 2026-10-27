/** Per-client request limiter. Part of the abuse protection; see docs/PLAN.md. */
export interface Limiter {
  /** Counts one request for `key`. */
  hit(key: string, now?: number): { allowed: boolean; retryAfterSeconds: number };
}

/**
 * Fixed-window counter held in memory. On serverless this is per warm instance (a best-effort second line
 * of defense behind the CDN cache and the firewall rule in front of the function), but it is bounded in size.
 */
export function createLimiter(opts: { limit: number; windowMs: number; maxKeys?: number }): Limiter {
  const { limit, windowMs, maxKeys = 5000 } = opts;
  const windows = new Map<string, { start: number; count: number }>();
  return {
    hit(key, now = Date.now()) {
      let w = windows.get(key);
      if (!w || now - w.start >= windowMs) {
        if (windows.size >= maxKeys) {
          for (const [k, v] of windows) if (now - v.start >= windowMs) windows.delete(k);
          if (windows.size >= maxKeys) windows.delete(windows.keys().next().value as string); // oldest
        }
        w = { start: now, count: 0 };
        windows.set(key, w);
      }
      w.count++;
      return w.count > limit
        ? { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((w.start + windowMs - now) / 1000)) }
        : { allowed: true, retryAfterSeconds: 0 };
    },
  };
}

/** Best-effort client IP. Vercel sets these headers itself (a client cannot forge the leftmost value). */
export function clientKey(request: Request): string {
  const h = request.headers;
  const raw = h.get('x-vercel-forwarded-for') ?? h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? '';
  return raw.split(',')[0]?.trim().slice(0, 64) || 'unknown';
}

/** Null if the request may proceed, otherwise a 429 Response with Retry-After. */
export function limitResponse(limiter: Limiter, request: Request): Response | null {
  const r = limiter.hit(clientKey(request));
  if (r.allowed) return null;
  return new Response(
    JSON.stringify({ error: { code: 'rate_limited', message: "You're going a little fast. Take a breath and try again in a moment." } }),
    {
      status: 429,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': String(r.retryAfterSeconds) },
    },
  );
}
