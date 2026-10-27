import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { ApiFailure, failures } from '../server/errors';
import { FIXTURES } from '../server/fixtures';
import type { Source } from '../server/handler';
import { esc, fallbackShell, injectHead, pageMeta } from '../server/meta';
import { buildOgSvg, handleOg, ogModel, renderPng } from '../server/og';
import { createLimiter } from '../server/ratelimit';
import { handleShare, shareRequestFromPath } from '../server/share';
import { summarize } from '../server/summary';
import { parseSharePath } from '../src/url';

const now = new Date('2026-06-01T00:00:00Z');
const ORIGIN = 'https://symphony.example';
const TEMPLATE = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>Commit Symphony</title><meta name="description" content="old description"></head><body><div id="app"></div><script type="module" src="/assets/app.js"></script></body></html>`;
const good: Source = async (user, year) => ({ ...FIXTURES.active, user, year });

/** The (unescaped) content of a <meta> tag, by name or property. */
function meta(html: string, key: string): string | undefined {
  const re = new RegExp(`<meta\\s+(?:name|property)="${key.replace(/[:]/g, ':')}"\\s+content="([^"]*)"`);
  const m = re.exec(html);
  return m?.[1]?.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
const share = (qs: string, deps: Partial<Parameters<typeof handleShare>[1]> = {}) =>
  handleShare(new Request(`${ORIGIN}/api/share?${qs}`), { source: good, template: async () => TEMPLATE, origin: ORIGIN, ...deps }, now);

describe('/u/:user/:year (share page)', () => {
  it('renders Open Graph and Twitter meta server-side, in the real app shell', async () => {
    const res = await share('user=octocat&year=2025');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');

    expect(meta(html, 'og:type')).toBe('website');
    expect(meta(html, 'og:site_name')).toBe('Commit Symphony');
    expect(meta(html, 'og:title')).toBe("@octocat's 2025 as a song · Commit Symphony");
    expect(meta(html, 'og:description')).toContain('2,189 contributions in 2025');
    expect(meta(html, 'og:description')).toContain('synthwave song');
    expect(meta(html, 'og:url')).toBe(`${ORIGIN}/u/octocat/2025`);
    expect(meta(html, 'og:image')).toBe(`${ORIGIN}/api/og?user=octocat&year=2025`);
    expect(meta(html, 'og:image:width')).toBe('1200');
    expect(meta(html, 'og:image:height')).toBe('630');
    expect(meta(html, 'og:image:alt')).toContain('@octocat');
    expect(meta(html, 'twitter:card')).toBe('summary_large_image');
    expect(meta(html, 'twitter:title')).toBe(meta(html, 'og:title'));
    expect(meta(html, 'twitter:image')).toBe(meta(html, 'og:image'));
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/u/octocat/2025">`);
    expect(html).toContain("<title>@octocat&#39;s 2025 as a song · Commit Symphony</title>");

    // the page is still the app, and the stock description was replaced, not duplicated
    expect(html).toContain('<div id="app"></div>');
    expect(html).toContain('src="/assets/app.js"');
    expect(html).not.toContain('old description');
    expect(html.match(/name="description"/g)).toHaveLength(1);
  });

  it('is CDN-cacheable for ~6h', async () => {
    const res = await share('user=octocat&year=2025');
    expect(res.headers.get('cache-control')).toContain('s-maxage=21600');
  });

  it('uses the canonical login from GitHub in all URLs', async () => {
    const res = await share('user=octocat&year=2025', { source: async (_u, y) => ({ ...FIXTURES.active, user: 'Octocat', year: y }) });
    expect(meta(await res.text(), 'og:url')).toBe(`${ORIGIN}/u/Octocat/2025`);
  });

  it('talks about a silent year gently and caches it briefly', async () => {
    const quiet: Source = async (user, year) => ({ ...FIXTURES.empty, user, year, total: 0, weeks: FIXTURES.empty.weeks.map((w) => w.map(() => 0 as const)) });
    const res = await share('user=quiet&year=2025', { source: quiet });
    expect(meta(await res.text(), 'og:description')).toMatch(/quiet 2025.*ambient/);
    expect(res.headers.get('cache-control')).toContain('s-maxage=300');
  });

  it('unknown user: 404 with the generic card, and still the app (which explains)', async () => {
    const res = await share('user=ghost&year=2025', { source: async () => { throw failures.notFound('ghost'); } });
    const html = await res.text();
    expect(res.status).toBe(404);
    expect(meta(html, 'og:image')).toBe(`${ORIGIN}/api/og`);
    expect(meta(html, 'og:title')).toBe('Commit Symphony');
    expect(html).toContain('<div id="app"></div>');
  });

  it.each(['user=-bad&year=2025', 'user=octocat&year=1999', 'user=octocat&year=abc', 'year=2025', 'user=<script>&year=2025'])(
    'invalid input %s never reaches GitHub',
    async (qs) => {
      const source = vi.fn(good);
      const res = await share(qs, { source });
      expect(res.status).toBe(404);
      expect(source).not.toHaveBeenCalled();
    },
  );

  it('GitHub rate limit or outage: still serves the app with generic meta, uncached', async () => {
    for (const err of [failures.rateLimited(30), failures.upstream(), new Error('boom')]) {
      const res = await share('user=octocat&year=2025', { source: async () => { throw err; } });
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(meta(await res.text(), 'og:title')).toBe('Commit Symphony');
    }
  });

  it('rate limits per client', async () => {
    const limiter = createLimiter({ limit: 2, windowMs: 60_000 });
    const req = () => handleShare(new Request(`${ORIGIN}/api/share?user=a&year=2025`, { headers: { 'x-forwarded-for': '1.2.3.4' } }), { source: good, template: async () => TEMPLATE, origin: ORIGIN, limiter }, now);
    expect((await req()).status).toBe(200);
    expect((await req()).status).toBe(200);
    expect((await req()).status).toBe(429);
  });

  it('escapes everything it injects', async () => {
    const hostile: Source = async (_u, year) => ({ ...FIXTURES.active, user: `"><script>alert(1)</script>`, year });
    const html = await (await share('user=octocat&year=2025', { source: hostile })).text();
    expect(html).not.toContain('<script>alert(1)');
    expect(html).toContain('&lt;script&gt;');
    expect(esc(`a&b<c>"d'`)).toBe('a&amp;b&lt;c&gt;&quot;d&#39;');
  });

  it('falls back to a tiny redirect page that still carries the tags if the template is missing', async () => {
    for (const template of [async () => null, async () => { throw new Error('no file'); }]) {
      const html = await (await share('user=octocat&year=2025', { template })).text();
      expect(meta(html, 'og:image')).toBe(`${ORIGIN}/api/og?user=octocat&year=2025`);
      expect(html).toContain('location.replace("/?u=octocat\\u0026y=2025")'.replace('\\u0026', '&'));
      expect(html).toContain('http-equiv="refresh"');
    }
    const m = pageMeta(ORIGIN, 'x', 2025, summarize({ ...FIXTURES.active, user: 'x', year: 2025 }));
    expect(fallbackShell(m, 'x', 2025)).toContain('<meta name="twitter:card" content="summary_large_image">');
  });

  it('dev helper maps the path form onto the query form', () => {
    const r = shareRequestFromPath(new Request(`${ORIGIN}/u/octocat/2025`))!;
    expect(new URL(r.url).searchParams.get('user')).toBe('octocat');
    expect(new URL(r.url).searchParams.get('year')).toBe('2025');
    expect(shareRequestFromPath(new Request(`${ORIGIN}/nope`))).toBeNull();
  });

  it('injectHead works without a closing head tag', () => {
    const out = injectHead('<title>x</title><body>hi</body>', pageMeta(ORIGIN, '', 0, null));
    expect(out).toContain('og:title');
  });
});

describe('vercel.json routing', () => {
  const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'));
  it('rewrites /u/:user/:year to the share function with both params', () => {
    expect(cfg.rewrites).toContainEqual({ source: '/u/:user/:year', destination: '/api/share?user=:user&year=:year' });
  });
  it('the rewrite and the client agree on the path shape', () => {
    expect(parseSharePath('/u/octocat/2025', now)).not.toBeNull();
  });
  it('bundles the built index.html into the share function', () => {
    expect(cfg.functions['api/share.ts'].includeFiles).toBe('dist/index.html');
  });
  it('lets crawlers fetch the OG image', () => {
    expect(readFileSync('public/robots.txt', 'utf8')).toContain('Allow: /api/og');
  });
});

describe('OG image', () => {
  const png = (b: Uint8Array) => [...b.slice(0, 8)].map((x) => x.toString(16)).join(' ');
  const size = (b: Uint8Array) => ({ w: new DataView(b.buffer, b.byteOffset).getUint32(16), h: new DataView(b.buffer, b.byteOffset).getUint32(20) });

  it('the SVG shows the name, year, genre, total and the whole grid', () => {
    const svg = buildOgSvg(ogModel({ ...FIXTURES.active, user: 'octocat', year: 2025 }, 'symphony.example'));
    expect(svg).toContain('@octocat');
    expect(svg).toContain('2025');
    expect(svg).toContain('SYNTHWAVE');
    expect(svg).toContain('2,189 contributions');
    expect(svg).toContain('symphony.example');
    expect(svg.match(/rx="3"/g)).toHaveLength(52 * 7);
    expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)/); // nothing external to fetch
  });

  it('shrinks long names and escapes text', () => {
    const long = buildOgSvg(ogModel({ ...FIXTURES.active, user: 'a'.repeat(39), year: 2025 }, 'h'));
    const fontSize = Number(/font-size="(\d+)" fill="#f3f1fb">@a+/.exec(long)![1]);
    expect(fontSize).toBeLessThan(84);
    const evil = buildOgSvg(ogModel({ ...FIXTURES.active, user: '<b>&', year: 2025 }, '"h"'));
    expect(evil).not.toContain('<b>');
    expect(evil).toContain('&lt;b&gt;&amp;');
  });

  it('renders a real 1200x630 PNG with the embedded font', async () => {
    const res = await handleOg(new Request(`${ORIGIN}/api/og?user=octocat&year=2025`), { source: good, host: 'symphony.example' }, now);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toContain('s-maxage=21600');
    expect(png(bytes)).toBe('89 50 4e 47 d a 1a a');
    expect(size(bytes)).toEqual({ w: 1200, h: 630 });
    expect(bytes.length).toBeGreaterThan(20_000);
  }, 20_000);

  it('text comes from the embedded font, not from fonts that happen to be installed', async () => {
    const { Resvg } = await import('@resvg/resvg-js');
    const svg = buildOgSvg(ogModel({ ...FIXTURES.active, user: 'octocat', year: 2025 }, 'h'));
    const withFont = await renderPng(svg);
    // the same SVG with system fonts off and no embedded font has no text at all, so it encodes smaller
    const noFont = new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng();
    expect(withFont.length).toBeGreaterThan(noFont.length + 3000);
  }, 20_000);

  it('never returns a broken image: failures get the generic card', async () => {
    const render = vi.fn(async (svg: string) => new TextEncoder().encode(svg.includes('Your year in code') ? 'GENERIC' : 'USER'));
    const call = (qs: string, source: Source) => handleOg(new Request(`${ORIGIN}/api/og${qs}`), { source, host: 'h', render }, now);
    const generic = async (r: Response) => new TextDecoder().decode(await r.arrayBuffer());

    const nf = await call('?user=ghost&year=2025', async () => { throw failures.notFound('ghost'); });
    expect([nf.status, await generic(nf)]).toEqual([404, 'GENERIC']);
    const down = await call('?user=a&year=2025', async () => { throw new ApiFailure('upstream_error', 502, 'x'); });
    expect([down.status, down.headers.get('cache-control'), await generic(down)]).toEqual([200, 'no-store', 'GENERIC']);
    const bad = await call('?user=-bad&year=2025', good);
    expect([bad.status, await generic(bad)]).toEqual([400, 'GENERIC']);
    const site = await call('', good);
    expect([site.status, await generic(site)]).toEqual([200, 'GENERIC']);
    const ok = await call('?user=octocat&year=2025', good);
    expect(await generic(ok)).toBe('USER');
  });

  it('rate limits per client', async () => {
    const limiter = createLimiter({ limit: 1, windowMs: 60_000 });
    const render = async () => new Uint8Array([1]);
    const req = () => handleOg(new Request(`${ORIGIN}/api/og?user=a&year=2025`, { headers: { 'x-real-ip': '9.9.9.9' } }), { source: good, host: 'h', limiter, render }, now);
    expect((await req()).status).toBe(200);
    expect((await req()).status).toBe(429);
  });
});
