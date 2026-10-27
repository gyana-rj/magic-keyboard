import type { ContributionData } from '../shared/types.js';
import active from '../fixtures/active.json';
import weekend from '../fixtures/weekend.json';
import burst from '../fixtures/burst.json';
import empty from '../fixtures/empty.json';

export const FIXTURES = { active, weekend, burst, empty } as unknown as Record<
  'active' | 'weekend' | 'burst' | 'empty',
  ContributionData
>;

const NAMES = Object.keys(FIXTURES) as (keyof typeof FIXTURES)[];

/** `?user=active|weekend|burst|empty` picks a persona; any other name is hashed onto one. */
export function fixtureFor(user: string, year: number): ContributionData {
  const lower = user.toLowerCase();
  const named = NAMES.find((n) => lower === n || lower === `fixture-${n}`);
  let hash = 0;
  for (const ch of lower) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const key = named ?? NAMES[hash % NAMES.length]!;
  return { ...FIXTURES[key], user, year };
}
