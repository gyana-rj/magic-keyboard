import { handle } from '../server/handler.js';
import { runtime } from '../server/runtime.js';

/** GET /api/contributions?user=<login>&year=<yyyy>. The token never leaves the server. */
export function GET(request: Request): Promise<Response> {
  return handle(request, runtime.source, new Date(), { limiter: runtime.limiter });
}
