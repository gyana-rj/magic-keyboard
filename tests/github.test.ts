import { describe, expect, it, vi } from 'vitest';
import { fetchContributions, normalizeUser, type RawUser } from '../server/github';
import { ApiFailure } from '../server/errors';

const LEVEL = ['NONE', 'FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'];

/** Build a calendar like GitHub's for `year`: Sunday-first columns, first/last partial. */
function rawUser(year: number, levelOf: (date: string) => number, languages: [string | null, number][] = []): RawUser {
  const weeks: { contributionDays: { contributionLevel: string; weekday: number; date: string }[] }[] = [];
  let total = 0;
  const d = new Date(Date.UTC(year, 0, 1));
  while (d.getUTCFullYear() === year) {
    const date = d.toISOString().slice(0, 10);
    if (weeks.length === 0 || d.getUTCDay() === 0) weeks.push({ contributionDays: [] });
    const level = levelOf(date);
    total += level;
    weeks.at(-1)!.contributionDays.push({
      contributionLevel: LEVEL[level]!,
      weekday: d.getUTCDay(),
      date,
    });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return {
    login: 'octocat',
    contributionsCollection: {
      contributionCalendar: { totalContributions: total, weeks },
      commitContributionsByRepository: languages.map(([name, n]) => ({
        repository: { primaryLanguage: name ? { name } : null },
        contributions: { totalCount: n },
      })),
    },
  };
}

describe('normalizeUser', () => {
  it('folds a 53-column year into 52 weeks of 7', () => {
    const raw = rawUser(2025, () => 1); // 2025 starts on a Wednesday -> 53 columns
    expect(raw.contributionsCollection.contributionCalendar.weeks).toHaveLength(53);
    const out = normalizeUser(raw, 2025);
    expect(out.weeks).toHaveLength(52);
    expect(out.weeks.every((w) => w.length === 7)).toBe(true);
    // Every day of the year is covered: Jan 1 (Wed) onward, with Sun-Tue of week 0 filled from Dec 28-30.
    expect(out.weeks[0]).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect(out.total).toBe(365);
  });

  it('keeps the busier level where first and last columns overlap', () => {
    const out = normalizeUser(rawUser(2025, (d) => (d === '2025-12-31' ? 4 : d === '2025-01-01' ? 2 : 0)), 2025);
    expect(out.weeks[0]![3]).toBe(4); // both are Wednesdays
  });

  it('maps levels and handles a zero year', () => {
    const out = normalizeUser(rawUser(2024, () => 0), 2024);
    expect(out.total).toBe(0);
    expect(out.weeks.flat().every((l) => l === 0)).toBe(true);
  });

  it('ranks top languages by commit weight, ignoring unknowns', () => {
    const raw = rawUser(2025, () => 0, [['Go', 5], ['TypeScript', 20], [null, 99], ['Go', 10], ['Rust', 1], ['C', 2]]);
    expect(normalizeUser(raw, 2025).topLanguages).toEqual(['TypeScript', 'Go', 'C']);
  });
});

describe('fetchContributions', () => {
  const ok = (data: unknown, init: ResponseInit = {}) =>
    vi.fn(async () => new Response(JSON.stringify(data), { status: 200, ...init })) as unknown as typeof fetch;
  const opts = { user: 'octocat', year: 2025, token: 't' };

  it('fails without a token, without calling GitHub', async () => {
    const f = vi.fn();
    await expect(fetchContributions({ ...opts, token: undefined, fetchImpl: f as never })).rejects.toMatchObject({
      code: 'server_misconfigured',
    });
    expect(f).not.toHaveBeenCalled();
  });

  it('sends the token only in the Authorization header', async () => {
    const f = ok({ data: { user: rawUser(2025, () => 1) } });
    await fetchContributions({ ...opts, token: 'secret', fetchImpl: f });
    const [, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret');
    expect(String(init.body)).not.toContain('secret');
  });

  it('maps GraphQL NOT_FOUND to not_found', async () => {
    const f = ok({ data: { user: null }, errors: [{ type: 'NOT_FOUND' }] });
    await expect(fetchContributions({ ...opts, fetchImpl: f })).rejects.toMatchObject({ code: 'not_found', status: 404 });
  });

  it('maps rate limiting (HTTP 403 and GraphQL error) to rate_limited', async () => {
    const http = vi.fn(async () => new Response('{}', { status: 403, headers: { 'retry-after': '120' } })) as unknown as typeof fetch;
    await expect(fetchContributions({ ...opts, fetchImpl: http })).rejects.toMatchObject({
      code: 'rate_limited',
      status: 429,
      retryAfterSeconds: 120,
    });
    const gql = ok({ errors: [{ type: 'RATE_LIMITED' }] });
    await expect(fetchContributions({ ...opts, fetchImpl: gql })).rejects.toMatchObject({ code: 'rate_limited' });
  });

  it('maps network and 5xx failures to upstream_error', async () => {
    const boom = vi.fn(async () => { throw new Error('down'); }) as unknown as typeof fetch;
    await expect(fetchContributions({ ...opts, fetchImpl: boom })).rejects.toBeInstanceOf(ApiFailure);
    const five = vi.fn(async () => new Response('x', { status: 503 })) as unknown as typeof fetch;
    await expect(fetchContributions({ ...opts, fetchImpl: five })).rejects.toMatchObject({ code: 'upstream_error' });
  });
});
