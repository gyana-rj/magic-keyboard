import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

/**
 * Serves the API routes in `npm run dev` without the Vercel CLI: /api/contributions, /api/og and the
 * /u/:user/:year share page (with real meta tags). With GITHUB_TOKEN set it uses the real handler;
 * otherwise it serves fixtures.
 */
function devApi(): Plugin {
  const send = async (res: import('node:http').ServerResponse, response: Response) => {
    res.statusCode = response.status;
    response.headers.forEach((v: string, k: string) => res.setHeader(k, v));
    res.end(Buffer.from(await response.arrayBuffer()));
  };
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      const origin = (req: import('node:http').IncomingMessage) => `http://${req.headers.host ?? 'localhost'}`;
      server.middlewares.use('/api/contributions', async (req, res) => {
        const mod = await server.ssrLoadModule('/server/dev.ts');
        await send(res, await mod.devHandle(new Request(new URL(req.url ?? '/', origin(req)))));
      });
      server.middlewares.use('/api/og', async (req, res) => {
        const mod = await server.ssrLoadModule('/server/dev.ts');
        await send(res, await mod.devOg(new Request(new URL(req.url ?? '/', origin(req)))));
      });
      server.middlewares.use('/u', async (req, res, next) => {
        const mod = await server.ssrLoadModule('/server/dev.ts');
        const url = new URL(`/u${req.url ?? '/'}`, origin(req));
        const html = await server.transformIndexHtml(url.pathname, readFileSync('index.html', 'utf8'));
        const response: Response = await mod.devShare(new Request(url), html);
        if (response.status === 404 && !/^\/u\/[^/]+\/\d{4}\/?$/.test(url.pathname)) return next();
        await send(res, response);
      });
    },
  };
}

/** /about is a second, static page; in dev and preview there is no `cleanUrls`, so map it by hand. */
function aboutRoute(): Plugin {
  const rewrite = (req: { url?: string }, _res: unknown, next: () => void) => {
    if (req.url && /^\/about\/?(\?.*)?$/.test(req.url)) req.url = '/about.html';
    next();
  };
  return {
    name: 'about-route',
    configureServer: (server) => void server.middlewares.use(rewrite),
    configurePreviewServer: (server) => void server.middlewares.use(rewrite),
  };
}

export default defineConfig({
  plugins: [preact(), devApi(), aboutRoute()],
  build: {
    rollupOptions: { input: { main: resolve(import.meta.dirname, 'index.html'), about: resolve(import.meta.dirname, 'about.html') } },
  },
  test: { include: ['tests/**/*.test.ts'] },
});
