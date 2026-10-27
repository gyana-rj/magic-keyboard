import type { Summary } from './summary.js';

export const SITE = 'Commit Symphony';
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

export interface PageMeta {
  title: string;
  description: string;
  url: string;
  image: string;
  imageAlt: string;
}

const GENERIC_DESCRIPTION =
  'Turn your GitHub contribution graph into a 30-second song, with a synced visual and a shareable card. Free and open source.';

/** Title, description and URLs for a result (or the generic site card when there is no data). */
export function pageMeta(origin: string, user: string, year: number, s: Summary | null): PageMeta {
  const url = `${origin}/u/${encodeURIComponent(user)}/${year}`;
  const image = `${origin}/api/og?user=${encodeURIComponent(user)}&year=${year}`;
  if (!s) {
    return { title: SITE, description: GENERIC_DESCRIPTION, url: `${origin}/`, image: `${origin}/api/og`, imageAlt: `${SITE}: your year in code, as a song` };
  }
  const genre = s.genre.toLowerCase();
  const description =
    s.total === 0
      ? `A quiet ${year}, turned into a gentle ${genre} song. Press play to listen.`
      : `${s.totalText} contributions in ${year}, turned into a 30-second ${genre} song.` +
        (s.busiest ? ` Busiest week: ${s.busiest}.` : '') +
        ' Press play to listen.';
  return {
    title: `@${s.user}'s ${year} as a song · ${SITE}`,
    description,
    url,
    image,
    imageAlt: `@${s.user}'s ${year} contribution graph, ${s.totalText} contributions, ${genre} track`,
  };
}

/** Open Graph + Twitter card tags (all values escaped). */
export function metaTags(m: PageMeta): string {
  const t = (name: string, content: string | number) => `<meta name="${name}" content="${esc(String(content))}">`;
  const p = (property: string, content: string | number) => `<meta property="${property}" content="${esc(String(content))}">`;
  return [
    `<link rel="canonical" href="${esc(m.url)}">`,
    t('description', m.description),
    p('og:type', 'website'),
    p('og:site_name', SITE),
    p('og:title', m.title),
    p('og:description', m.description),
    p('og:url', m.url),
    p('og:image', m.image),
    p('og:image:width', OG_WIDTH),
    p('og:image:height', OG_HEIGHT),
    p('og:image:alt', m.imageAlt),
    t('twitter:card', 'summary_large_image'),
    t('twitter:title', m.title),
    t('twitter:description', m.description),
    t('twitter:image', m.image),
    t('twitter:image:alt', m.imageAlt),
  ].join('\n    ');
}

/** Puts the meta tags into the built index.html: swaps the title, drops its stock description, adds the tags. */
export function injectHead(template: string, m: PageMeta): string {
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(m.title)}</title>`)
    .replace(/<meta\s+name=["']description["'][^>]*>\s*/gi, '');
  const tags = `    ${metaTags(m)}\n  `;
  html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${tags}</head>`) : tags + html;
  return html;
}

/**
 * Used only if the built index.html cannot be read: a tiny page that still carries the tags for crawlers and
 * sends people on to the app via the older `?u=&y=` link form.
 */
export function fallbackShell(m: PageMeta, user: string, year: number): string {
  const app = `/?u=${encodeURIComponent(user)}&y=${year}`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(m.title)}</title>
    ${metaTags(m)}
    <meta http-equiv="refresh" content="0;url=${esc(app)}">
  </head>
  <body>
    <p><a href="${esc(app)}">Open ${esc(SITE)}</a></p>
    <script>location.replace(${JSON.stringify(app).replace(/</g, '\\u003c')})</script>
  </body>
</html>`;
}
