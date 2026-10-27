import { describe, expect, it } from 'vitest';
import { isValidUsername, parseYear } from '../server/validate';

describe('isValidUsername', () => {
  it.each(['octocat', 'a', 'a-b', 'A1-b2', 'x'.repeat(39)])('accepts %s', (u) =>
    expect(isValidUsername(u)).toBe(true),
  );
  it.each(['', '-a', 'a-', 'a--b', 'a_b', 'a b', 'x'.repeat(40), 'a/b', '../etc'])(
    'rejects %j',
    (u) => expect(isValidUsername(u)).toBe(false),
  );
  it('rejects null', () => expect(isValidUsername(null)).toBe(false));
});

describe('parseYear', () => {
  const now = new Date('2026-06-01T00:00:00Z');
  it('defaults to the current year', () => expect(parseYear(null, now)).toBe(2026));
  it('accepts valid years', () => expect(parseYear('2020', now)).toBe(2020));
  it.each(['2007', '2027', 'abc', '20', '2020.5', '-2020'])('rejects %s', (y) =>
    expect(parseYear(y, now)).toBeNull(),
  );
});
