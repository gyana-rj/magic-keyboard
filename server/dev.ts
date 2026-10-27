import { GET } from '../api/contributions.js';
import { handle, type Source } from './handler.js';
import { fixtureFor } from './fixtures.js';
import { handleOg } from './og.js';
import { runtime } from './runtime.js';
import { handleShare, shareRequestFromPath } from './share.js';

/** Dev only (see vite.config.ts): the real source when GITHUB_TOKEN is set, fixtures otherwise. No rate limiting. */
const source: Source = (user, year) =>
  process.env.GITHUB_TOKEN ? runtime.source(user, year) : Promise.resolve(fixtureFor(user, year));

export function devHandle(request: Request): Promise<Response> {
  if (process.env.GITHUB_TOKEN) return GET(request);
  return handle(request, source);
}

export function devOg(request: Request): Promise<Response> {
  return handleOg(request, { source, host: new URL(request.url).host });
}

/** `/u/:user/:year` with the same meta tags as production; `template` is Vite's transformed index.html. */
export function devShare(request: Request, template: string): Promise<Response> {
  const asQuery = shareRequestFromPath(request);
  if (!asQuery) return Promise.resolve(new Response('Not found', { status: 404 }));
  return handleShare(asQuery, { source, template: async () => template, origin: new URL(request.url).origin });
}
