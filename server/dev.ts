import { GET } from '../api/contributions.js';
import { handle } from './handler.js';
import { fixtureFor } from './fixtures.js';

/** Dev only (see vite.config.ts): real handler when GITHUB_TOKEN is set, fixtures otherwise. */
export function devHandle(request: Request): Promise<Response> {
  if (process.env.GITHUB_TOKEN) return GET(request);
  return handle(request, async (user, year) => fixtureFor(user, year));
}
