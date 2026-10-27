import { describe, expect, it } from 'vitest';
import { handle, type Source } from '../server/handler';
import { failures } from '../server/errors';
import { FIXTURES } from '../server/fixtures';

const now = new Date('2026-06-01T00:00:00Z');
const call = (qs: string, source: Source) => handle(new Request(`http://x/api/contributions?${qs}`), source, now);
const good: Source = async (user, year) => ({ ...FIXTURES.active, user, year });

describe('handler', () => {
  it('returns normalized data with ~6h edge caching', async () => {
    const res = await call('user=octocat&year=2025', good);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('s-maxage=21600');
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(['topLanguages', 'total', 'user', 'weeks', 'year']);
    expect(body.user).toBe('octocat');
  });

  it('rejects bad usernames and years before touching the source', async () => {
    const never: Source = async () => { throw new Error('should not be called'); };
    for (const [qs, code] of [
      ['year=2025', 'invalid_user'],
      ['user=-bad&year=2025', 'invalid_user'],
      ['user=octocat&year=1999', 'invalid_year'],
      ['user=octocat&year=abc', 'invalid_year'],
    ] as const) {
      const res = await call(qs, never);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe(code);
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
  });

  it('maps failures to friendly, correctly cached errors', async () => {
    const nf = await call('user=ghost&year=2025', async () => { throw failures.notFound('ghost'); });
    expect(nf.status).toBe(404);
    expect((await nf.json()).error.message).toContain('ghost');
    expect(nf.headers.get('cache-control')).toContain('s-maxage=300');

    const rl = await call('user=a&year=2025', async () => { throw failures.rateLimited(90); });
    expect(rl.status).toBe(429);
    expect(rl.headers.get('retry-after')).toBe('90');
    expect(rl.headers.get('cache-control')).toBe('no-store');
  });

  it('does not leak unexpected error details', async () => {
    const res = await call('user=a&year=2025', async () => { throw new Error('token ghp_secret leaked'); });
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain('ghp_secret');
  });

  it('serves a zero-contribution year as valid data with short caching', async () => {
    const res = await call('user=a&year=2025', async (user, year) => ({ ...FIXTURES.empty, user, year, total: 0, weeks: FIXTURES.empty.weeks.map((w) => w.map(() => 0 as const)) }));
    expect(res.status).toBe(200);
    expect((await res.json()).total).toBe(0);
    expect(res.headers.get('cache-control')).toContain('s-maxage=300');
  });
});
