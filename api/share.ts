import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runtime } from '../server/runtime.js';
import { handleShare } from '../server/share.js';

/**
 * /u/:user/:year (see vercel.json): the app's index.html with Open Graph and Twitter tags filled in for
 * that result. Reads the built page from dist/ (bundled via `includeFiles`), falling back to fetching it
 * from the deployment; if neither works, handleShare serves a tiny redirect page that still has the tags.
 */
async function loadTemplate(origin: string): Promise<string | null> {
  try {
    return await readFile(join(process.cwd(), 'dist', 'index.html'), 'utf8');
  } catch {
    try {
      const res = await fetch(`${origin}/index.html`);
      return res.ok ? await res.text() : null;
    } catch {
      return null;
    }
  }
}

export function GET(request: Request): Promise<Response> {
  const origin = runtime.origin(request);
  return handleShare(request, {
    source: runtime.source,
    limiter: runtime.limiter,
    origin,
    template: () => loadTemplate(origin),
  });
}
