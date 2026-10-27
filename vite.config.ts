import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

/**
 * Serves /api/contributions in `npm run dev` without the Vercel CLI.
 * With GITHUB_TOKEN set it runs the real handler; otherwise it serves fixtures.
 */
function devApi(): Plugin {
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/contributions', async (req, res) => {
        const mod = await server.ssrLoadModule('/server/dev.ts');
        const url = new URL(req.url ?? '/', 'http://localhost');
        const response: Response = await mod.devHandle(new Request(url));
        res.statusCode = response.status;
        response.headers.forEach((v: string, k: string) => res.setHeader(k, v));
        res.end(await response.text());
      });
    },
  };
}

export default defineConfig({
  plugins: [preact(), devApi()],
  test: { include: ['tests/**/*.test.ts'] },
});
