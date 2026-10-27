import type { ApiErrorCode } from '../shared/types.js';

export class ApiFailure extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly status: number,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

export const failures = {
  invalidUser: () =>
    new ApiFailure('invalid_user', 400, 'That does not look like a valid GitHub username.'),
  invalidYear: () =>
    new ApiFailure('invalid_year', 400, 'Pick a year between 2008 and the current year.'),
  notFound: (user: string) =>
    new ApiFailure('not_found', 404, `We could not find a GitHub user named "${user}".`),
  rateLimited: (retryAfterSeconds?: number) =>
    new ApiFailure(
      'rate_limited',
      429,
      'We are fetching a lot of songs right now. Please try again in a few minutes.',
      retryAfterSeconds,
    ),
  upstream: () =>
    new ApiFailure('upstream_error', 502, 'GitHub is not answering right now. Please try again shortly.'),
  misconfigured: () =>
    new ApiFailure('server_misconfigured', 500, 'The server is not set up to reach GitHub yet.'),
};
