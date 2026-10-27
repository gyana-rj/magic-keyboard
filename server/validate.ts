/** GitHub logins: 1-39 chars, alphanumeric or single hyphens, no leading/trailing hyphen. */
const USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export const FIRST_YEAR = 2008; // GitHub launched in 2008

export function isValidUsername(value: string | null): value is string {
  return value !== null && USERNAME_RE.test(value);
}

/** Returns the year, or null if missing/out of range. Defaults to the current year when absent. */
export function parseYear(value: string | null, now = new Date()): number | null {
  if (value === null || value === '') return now.getUTCFullYear();
  if (!/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return year >= FIRST_YEAR && year <= now.getUTCFullYear() ? year : null;
}
