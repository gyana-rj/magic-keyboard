import { handleOg } from '../server/og.js';
import { runtime } from '../server/runtime.js';

/** GET /api/og?user=<login>&year=<yyyy>: the 1200x630 link-preview image (PNG). */
export function GET(request: Request): Promise<Response> {
  const origin = runtime.origin(request);
  return handleOg(request, { source: runtime.source, limiter: runtime.limiter, host: new URL(origin).host });
}
