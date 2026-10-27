import { handle } from '../server/handler.js';
import { fetchContributions } from '../server/github.js';

/** GET /api/contributions?user=<login>&year=<yyyy>. The token never leaves the server. */
export function GET(request: Request): Promise<Response> {
  const token = process.env.GITHUB_TOKEN;
  return handle(request, (user, year) => fetchContributions({ user, year, token }));
}
