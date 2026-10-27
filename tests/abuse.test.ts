import { describe, expect, it, vi } from 'vitest';
import { cachedSource } from '../server/cache';
import { ApiFailure, failures } from '../server/errors';
import { FIXTURES } from '../server/fixtures';
import { handle, type Source } from '../server/handler';
import { clientKey, createLimiter, limitResponse } from '../server/ratelimit';
import { createRuntime, publicOrigin } from '../server/runtime';

const now = new Date('2026-06-01T00:00:00Z');
const data = (user: string, year: number, total = 100) => ({ ...FIXTURES.active, user, year, total });

describe('rate limiter', () => {
  it('allows up to the limit, then blocks with a Retry-After', () => {
    const l = createLimiter({ limit: 3, windowMs: 60_000 });
    for (let i = 0; i < 3; i++) expect(l.hit('ip', 1000).allowed).toBe(true);
    const blocked = l.hit('ip', 11_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(50);
  });
  it('starts a fresh window and keeps clients apart', () => {
    const l = createLimiter({ limit: 1, windowMs: 1000 });
    expect(l.hit('a', 0).allowed).toBe(true);
    expect(l.hit('a', 500).allowed).toBe(false);
    expect(l.hit('b', 500).allowed).toBe(true);
    expect(l.hit('a', 1000).allowed).toBe(true);
  });
  it('stays bounded under a flood of distinct keys', () => {
    const l = createLimiter({ limit: 1, windowMs: 60_000, maxKeys: 100 });
    for (let i = 0; i < 10_000; i++) l.hit(`ip${i}`, i);
    // the oldest were evicted, so an early key is counted fresh again
    expect(l.hit('ip0', 10_001).allowed).toBe(true);
  });
  it('takes the client from proxy headers, leftmost first', () => {
    expect(clientKey(new Request('http://x', { headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2' } }))).toBe('1.1.1.1');
    expect(clientKey(new Request('http://x', { headers: { 'x-vercel-forwarded-for': '3.3.3.3', 'x-forwarded-for': '1.1.1.1' } }))).toBe('3.3.3.3');
    expect(clientKey(new Request('http://x', { headers: { 'x-real-ip': '4.4.4.4' } }))).toBe('4.4.4.4');
    expect(clientKey(new Request('http://x'))).toBe('unknown');
    expect(clientKey(new Request('http://x', { headers: { 'x-forwarded-for': 'x'.repeat(500) } })).length).toBeLessThanOrEqual(64);
  });
  it('limitResponse gives a friendly 429 JSON error', async () => {
    const l = createLimiter({ limit: 0, windowMs: 60_000 });
    const res = limitResponse(l, new Request('http://x'))!;
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect((await res.json()).error.code).toBe('rate_limited');
  });
});

describe('API handler protections', () => {
  const ok: Source = async (u, y) => data(u, y);
  const call = (qs: string, opts = {}, source = ok) => handle(new Request(`http://x/api/contributions?${qs}`), source, now, opts);

  it('rejects unknown parameters, which could only be used to dodge the cache', async () => {
    const source = vi.fn(ok);
    for (const qs of ['user=a&year=2025&cb=123', 'user=a&_=1', 'user=a&year=2025&user2=b']) {
      const res = await call(qs, {}, source);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('invalid_request');
    }
    expect(source).not.toHaveBeenCalled();
  });
  it('rate limits before doing any work', async () => {
    const limiter = createLimiter({ limit: 2, windowMs: 60_000 });
    const source = vi.fn(ok);
    const req = () => handle(new Request('http://x/api/contributions?user=a&year=2025', { headers: { 'x-forwarded-for': '5.5.5.5' } }), source, now, { limiter });
    expect((await req()).status).toBe(200);
    expect((await req()).status).toBe(200);
    const blocked = await req();
    expect(blocked.status).toBe(429);
    expect(source).toHaveBeenCalledTimes(2);
  });
  it('caches successes at the CDN and never caches errors for long', async () => {
    expect((await call('user=a&year=2025')).headers.get('cache-control')).toContain('s-maxage=21600');
    const err = await call('user=a&year=2025', {}, async () => { throw failures.upstream(); });
    expect(err.headers.get('cache-control')).toBe('no-store');
  });
});

describe('in-function cache', () => {
  it('serves repeats from memory, case-insensitively, until the TTL passes', async () => {
    let t = 0;
    const source = vi.fn(async (u: string, y: number) => data(u, y));
    const c = cachedSource(source, { ttlMs: 1000 }, () => t);
    await c('Octocat', 2025);
    await c('octocat', 2025);
    await c('OCTOCAT', 2025);
    expect(source).toHaveBeenCalledTimes(1);
    await c('octocat', 2024); // a different year is a different entry
    expect(source).toHaveBeenCalledTimes(2);
    t = 1001;
    await c('octocat', 2025);
    expect(source).toHaveBeenCalledTimes(3);
  });
  it('shares one in-flight request between simultaneous callers', async () => {
    let release!: () => void;
    const source = vi.fn(() => new Promise<ReturnType<typeof data>>((r) => (release = () => r(data('a', 2025)))));
    const c = cachedSource(source as unknown as Source);
    const all = Promise.all([c('a', 2025), c('a', 2025), c('A', 2025)]);
    release();
    await all;
    expect(source).toHaveBeenCalledTimes(1);
  });
  it('remembers not-found for 5 minutes and transient failures for 30 seconds', async () => {
    let t = 0;
    const nf = vi.fn(async () => { throw failures.notFound('x'); });
    const c1 = cachedSource(nf as Source, {}, () => t);
    await expect(c1('x', 2025)).rejects.toMatchObject({ code: 'not_found' });
    await expect(c1('x', 2025)).rejects.toMatchObject({ code: 'not_found' });
    expect(nf).toHaveBeenCalledTimes(1);
    t = 5 * 60_000 + 1;
    await expect(c1('x', 2025)).rejects.toBeInstanceOf(ApiFailure);
    expect(nf).toHaveBeenCalledTimes(2);

    t = 0;
    const rl = vi.fn(async () => { throw failures.rateLimited(10); });
    const c2 = cachedSource(rl as Source, {}, () => t);
    await expect(c2('x', 2025)).rejects.toBeDefined();
    await expect(c2('x', 2025)).rejects.toBeDefined();
    expect(rl).toHaveBeenCalledTimes(1);
    t = 31_000;
    await expect(c2('x', 2025)).rejects.toBeDefined();
    expect(rl).toHaveBeenCalledTimes(2);
  });
  it('never caches a missing-token error, and remembers silent years only briefly', async () => {
    const mis = vi.fn(async () => { throw failures.misconfigured(); });
    const c = cachedSource(mis as Source);
    await expect(c('a', 2025)).rejects.toBeDefined();
    await expect(c('a', 2025)).rejects.toBeDefined();
    expect(mis).toHaveBeenCalledTimes(2);

    let t = 0;
    const quiet = vi.fn(async (u: string, y: number) => data(u, y, 0));
    const q = cachedSource(quiet, {}, () => t);
    await q('a', 2025);
    t = 5 * 60_000 + 1;
    await q('a', 2025);
    expect(quiet).toHaveBeenCalledTimes(2);
  });
  it('is bounded (least recently used goes first)', async () => {
    const source = vi.fn(async (u: string, y: number) => data(u, y));
    const c = cachedSource(source, { max: 2 });
    await c('a', 2025);
    await c('b', 2025);
    await c('a', 2025); // refresh a
    await c('c', 2025); // evicts b
    await c('a', 2025);
    expect(source).toHaveBeenCalledTimes(3);
    await c('b', 2025);
    expect(source).toHaveBeenCalledTimes(4);
  });
});

describe('runtime', () => {
  it('only accepts an http(s) PUBLIC_URL and strips any path', () => {
    expect(publicOrigin('https://symphony.example/some/path')).toBe('https://symphony.example');
    expect(publicOrigin('javascript:alert(1)')).toBeNull();
    expect(publicOrigin('not a url')).toBeNull();
    expect(publicOrigin(undefined)).toBeNull();
  });
  it('uses PUBLIC_URL when set and the request origin otherwise', () => {
    const req = new Request('https://preview-abc.vercel.app/api/og');
    expect(createRuntime({ PUBLIC_URL: 'https://symphony.example' }).origin(req)).toBe('https://symphony.example');
    expect(createRuntime({}).origin(req)).toBe('https://preview-abc.vercel.app');
  });
});
