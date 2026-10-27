import { DAYS, WEEKS, type ContributionData, type Level } from '../shared/types.js';
import { failures } from './errors.js';

const ENDPOINT = 'https://api.github.com/graphql';

const QUERY = /* GraphQL */ `
  query ($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      login
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              contributionLevel
              weekday
              date
            }
          }
        }
        commitContributionsByRepository(maxRepositories: 25) {
          repository {
            primaryLanguage {
              name
            }
          }
          contributions {
            totalCount
          }
        }
      }
    }
  }
`;

const LEVELS: Record<string, Level> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

export interface RawDay {
  contributionLevel: string;
  weekday: number;
  date: string;
}

export interface RawUser {
  login: string;
  contributionsCollection: {
    contributionCalendar: {
      totalContributions: number;
      weeks: { contributionDays: RawDay[] }[];
    };
    commitContributionsByRepository: {
      repository: { primaryLanguage: { name: string } | null };
      contributions: { totalCount: number };
    }[];
  };
}

/**
 * GitHub returns calendar-aligned (Sunday-first) columns: a year is 53 of them,
 * the first and last partial. Fold the last column into the first so we get
 * exactly 52 weeks; where both hold the same weekday the busier level wins.
 */
export function normalizeUser(raw: RawUser, year: number): ContributionData {
  const cal = raw.contributionsCollection.contributionCalendar;
  const columns: Level[][] = cal.weeks.map((week) => {
    const col: Level[] = Array<Level>(DAYS).fill(0);
    for (const day of week.contributionDays) {
      if (!day.date.startsWith(String(year))) continue;
      col[day.weekday] = LEVELS[day.contributionLevel] ?? 0;
    }
    return col;
  });

  if (columns.length > WEEKS) {
    const extra = columns.splice(WEEKS);
    const first = columns[0];
    if (first) {
      for (const col of extra) {
        col.forEach((lvl, d) => {
          first[d] = Math.max(first[d] ?? 0, lvl) as Level;
        });
      }
    }
  }
  while (columns.length < WEEKS) columns.push(Array<Level>(DAYS).fill(0));

  return {
    user: raw.login,
    year,
    weeks: columns,
    total: cal.totalContributions,
    topLanguages: topLanguages(raw),
  };
}

function topLanguages(raw: RawUser, limit = 3): string[] {
  const weight = new Map<string, number>();
  for (const repo of raw.contributionsCollection.commitContributionsByRepository) {
    const name = repo.repository.primaryLanguage?.name;
    if (name) weight.set(name, (weight.get(name) ?? 0) + repo.contributions.totalCount);
  }
  return [...weight.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name]) => name);
}

function retryAfter(res: Response): number | undefined {
  const header = res.headers.get('retry-after');
  if (header && Number.isFinite(Number(header))) return Number(header);
  const reset = Number(res.headers.get('x-ratelimit-reset'));
  if (reset) return Math.max(1, reset - Math.floor(Date.now() / 1000));
  return undefined;
}

export interface FetchOptions {
  user: string;
  year: number;
  token: string | undefined;
  fetchImpl?: typeof fetch;
}

export async function fetchContributions(opts: FetchOptions): Promise<ContributionData> {
  const { user, year, token, fetchImpl = fetch } = opts;
  if (!token) throw failures.misconfigured();

  let res: Response;
  try {
    res = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'commit-symphony',
      },
      body: JSON.stringify({
        query: QUERY,
        variables: { login: user, from: `${year}-01-01T00:00:00Z`, to: `${year}-12-31T23:59:59Z` },
      }),
    });
  } catch {
    throw failures.upstream();
  }

  if (res.status === 429 || res.status === 403) throw failures.rateLimited(retryAfter(res));
  if (res.status === 401) throw failures.misconfigured();
  if (!res.ok) throw failures.upstream();

  const body = (await res.json().catch(() => null)) as {
    data?: { user: RawUser | null } | null;
    errors?: { type?: string }[];
  } | null;
  if (!body) throw failures.upstream();

  const types = body.errors?.map((e) => e.type) ?? [];
  if (types.includes('RATE_LIMITED')) throw failures.rateLimited(retryAfter(res));
  if (types.includes('NOT_FOUND') || (body.data && body.data.user === null)) {
    throw failures.notFound(user);
  }
  if (!body.data?.user) throw failures.upstream();

  return normalizeUser(body.data.user, year);
}
