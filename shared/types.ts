/** Contribution intensity: 0 = none … 4 = busiest (GitHub's quartile levels). */
export type Level = 0 | 1 | 2 | 3 | 4;

/** Normalized API payload. weeks[week 0..51][weekday 0..6, Sunday first]. */
export interface ContributionData {
  user: string;
  year: number;
  weeks: Level[][];
  total: number;
  topLanguages: string[];
}

export type ApiErrorCode =
  | 'invalid_user'
  | 'invalid_year'
  | 'invalid_request'
  | 'not_found'
  | 'rate_limited'
  | 'upstream_error'
  | 'server_misconfigured';

export interface ApiError {
  error: { code: ApiErrorCode; message: string };
}

export const WEEKS = 52;
export const DAYS = 7;
