import type { ContributionData, Level } from '../shared/types.js';
import { PALETTES, type Palette } from '../src/visual/palettes.js';
import { INTER_EXTRABOLD_B64, INTER_REGULAR_B64 } from './fontData.js';
import { ApiFailure } from './errors.js';
import type { Source } from './handler.js';
import { esc, OG_HEIGHT, OG_WIDTH, SITE } from './meta.js';
import { limitResponse, type Limiter } from './ratelimit.js';
import { summarize, type Summary } from './summary.js';
import { isValidUsername, parseYear } from './validate.js';

const PAD = 56;
const FONT = "Inter, 'Helvetica Neue', Arial, sans-serif";

export interface OgModel {
  title: string;
  /** Year shown in the accent color (empty for the generic card). */
  year: string;
  subtitle: string;
  genre: string;
  weeks: Level[][];
  palette: Palette;
  host: string;
}

/** A calm, deterministic decorative graph for the generic card. */
function decorativeWeeks(): Level[][] {
  return Array.from({ length: 52 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const v = Math.sin(w * 0.37 + d * 1.3) + Math.sin(w * 0.11 - d * 0.7);
      return (v > 1.2 ? 4 : v > 0.7 ? 3 : v > 0.2 ? 2 : v > -0.5 ? 1 : 0) as Level;
    }),
  );
}

export function ogModel(data: ContributionData | null, host: string): OgModel {
  if (!data) {
    return {
      title: SITE,
      year: '',
      subtitle: 'Your year in code, as a song.',
      genre: '',
      weeks: decorativeWeeks(),
      palette: PALETTES.synthwave,
      host,
    };
  }
  const s: Summary = summarize(data);
  return {
    title: `@${s.user}`,
    year: String(s.year),
    subtitle: s.total === 0 ? 'A quiet year, set to a gentle track' : `${s.totalText} contributions · ${s.genre}`,
    genre: s.genre,
    weeks: data.weeks,
    palette: PALETTES[s.genreId],
    host,
  };
}

/** Rough text width for Inter ExtraBold (no font metrics needed on the server). */
const approxWidth = (text: string, size: number) => text.length * size * 0.6;

/** The 1200x630 card as an SVG string (the PNG is this, rasterized). No external references. */
export function buildOgSvg(m: OgModel): string {
  const { palette: p } = m;
  const inner = OG_WIDTH - 2 * PAD;
  const gap = 2;
  const cell = Math.floor((inner - 51 * gap) / 52);
  const gridW = 52 * cell + 51 * gap;
  const gx = Math.round((OG_WIDTH - gridW) / 2);
  const gy = 318;

  let size = 84;
  const label = m.title + (m.year ? `  ${m.year}` : '');
  while (size > 36 && approxWidth(label, size) > inner) size -= 2;

  const cells: string[] = [];
  for (let w = 0; w < 52; w++) {
    for (let d = 0; d < 7; d++) {
      const fill = p.levels[m.weeks[w]?.[d] ?? 0]!;
      cells.push(`<rect x="${gx + w * (cell + gap)}" y="${gy + d * (cell + gap)}" width="${cell}" height="${cell}" rx="3" fill="${fill}"/>`);
    }
  }

  const bars = [0.45, 0.75, 0.55, 1, 0.65, 0.85, 0.35]
    .map((h, i) => `<rect x="${PAD + i * 4}" y="${PAD + 4 + 28 * (1 - h)}" width="2.6" height="${28 * h}" rx="1.3" fill="url(#mark)"/>`)
    .join('');

  const pill = m.genre
    ? (() => {
        const text = m.genre.toUpperCase();
        const w = Math.round(text.length * 13.5 + 40);
        return `<rect x="${OG_WIDTH - PAD - w}" y="${PAD - 4}" width="${w}" height="42" rx="21" fill="none" stroke="${p.accent}" stroke-width="2"/>
  <text x="${OG_WIDTH - PAD - w / 2}" y="${PAD + 24}" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="20" letter-spacing="1.5" fill="${p.accent}">${esc(text)}</text>`;
      })()
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <defs>
    <radialGradient id="g1" cx="0" cy="0" r="620" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${p.levels[2]}" stop-opacity="0.55"/><stop offset="1" stop-color="#090913" stop-opacity="0"/></radialGradient>
    <radialGradient id="g2" cx="${OG_WIDTH}" cy="130" r="520" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${p.levels[3]}" stop-opacity="0.3"/><stop offset="1" stop-color="#090913" stop-opacity="0"/></radialGradient>
    <linearGradient id="mark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.accent}"/><stop offset="1" stop-color="${p.levels[3]}"/></linearGradient>
  </defs>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="#090913"/>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#g1)"/>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#g2)"/>
  ${bars}
  <text x="${PAD + 44}" y="${PAD + 26}" font-family="${FONT}" font-weight="800" font-size="22" fill="#f3f1fb" fill-opacity="0.75">${esc(SITE)}</text>
  ${pill}
  <text x="${PAD}" y="188" font-family="${FONT}" font-weight="800" font-size="${size}" fill="#f3f1fb">${esc(m.title)}${m.year ? `<tspan dx="${Math.round(size * 0.28)}" fill="${p.accent}">${esc(m.year)}</tspan>` : ''}</text>
  <text x="${PAD}" y="252" font-family="${FONT}" font-size="30" fill="#f3f1fb" fill-opacity="0.72">${esc(m.subtitle)}</text>
  ${cells.join('\n  ')}
  <text x="${PAD}" y="${OG_HEIGHT - 44}" font-family="${FONT}" font-size="22" fill="#a7a3c0">Your year, as a song · for GitHub users</text>
  <text x="${OG_WIDTH - PAD}" y="${OG_HEIGHT - 44}" text-anchor="end" font-family="${FONT}" font-size="22" fill="${p.accent}">${esc(m.host)}</text>
</svg>`;
}

/** Rasterizes the SVG with Resvg and the embedded Inter subset (no system fonts, so output is identical everywhere). */
export async function renderPng(svg: string): Promise<Uint8Array> {
  const { Resvg } = await import('@resvg/resvg-js');
  const options = {
    fitTo: { mode: 'width' as const, value: OG_WIDTH },
    font: {
      // fontBuffers is supported by resvg-js but missing from its type definitions
      fontBuffers: [Buffer.from(INTER_REGULAR_B64, 'base64'), Buffer.from(INTER_EXTRABOLD_B64, 'base64')],
      loadSystemFonts: false,
      defaultFontFamily: 'Inter',
    },
  };
  return new Resvg(svg, options as ConstructorParameters<typeof Resvg>[1]).render().asPng();
}

export interface OgDeps {
  source: Source;
  host: string;
  limiter?: Limiter;
  /** Swappable for tests. */
  render?: (svg: string) => Promise<Uint8Array>;
}

const OK_CACHE = 'public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400';
const SHORT_CACHE = 'public, max-age=300, s-maxage=300';

function png(bytes: Uint8Array, status: number, cache: string) {
  return new Response(bytes as BodyInit, { status, headers: { 'Content-Type': 'image/png', 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' } });
}

/** GET /api/og?user=&year= → a 1200x630 PNG. Anything that goes wrong yields the generic card, never a broken image. */
export async function handleOg(request: Request, deps: OgDeps, now = new Date()): Promise<Response> {
  const render = deps.render ?? renderPng;
  const generic = async (status: number, cache: string) => png(await render(buildOgSvg(ogModel(null, deps.host))), status, cache);
  const params = new URL(request.url).searchParams;
  const user = params.get('user');

  if (user === null) return generic(200, OK_CACHE); // the site-wide card
  const year = parseYear(params.get('year'), now);
  if (!isValidUsername(user) || year === null) return generic(400, 'no-store');
  if (deps.limiter && limitResponse(deps.limiter, request)) return generic(429, 'no-store');

  try {
    const data = await deps.source(user, year);
    return png(await render(buildOgSvg(ogModel(data, deps.host))), 200, data.total === 0 ? SHORT_CACHE : OK_CACHE);
  } catch (err) {
    if (err instanceof ApiFailure && err.code === 'not_found') return generic(404, SHORT_CACHE);
    return generic(200, 'no-store');
  }
}
