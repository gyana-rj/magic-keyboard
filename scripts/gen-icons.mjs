// Generates the favicon and app icons in public/ from one SVG design (seven bars, one per weekday).
// Needs Playwright with Chromium (see CLAUDE.md for the browser setup): node scripts/gen-icons.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Playwright is not a project dependency; load it from wherever it is installed (local or global via NODE_PATH).
const { chromium } = createRequire(import.meta.url)('playwright');

const HEIGHTS = [0.45, 0.75, 0.55, 1, 0.65, 0.85, 0.35];

/** rounded: app-icon tile with rounded corners; otherwise a full-bleed square (apple-touch, maskable). */
function svg({ rounded, safe = 0.7 }) {
  const size = 64;
  const area = size * safe; // the bars live inside this box
  const barW = area / (HEIGHTS.length * 1.65 - 0.65);
  const gap = barW * 0.65;
  const x0 = (size - (HEIGHTS.length * barW + (HEIGHTS.length - 1) * gap)) / 2;
  const bars = HEIGHTS.map((h, i) => {
    const bh = area * h;
    return `<rect x="${(x0 + i * (barW + gap)).toFixed(2)}" y="${((size + area) / 2 - bh).toFixed(2)}" width="${barW.toFixed(2)}" height="${bh.toFixed(2)}" rx="${(barW / 2).toFixed(2)}" fill="url(#b)"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a1646"/><stop offset="1" stop-color="#090913"/></linearGradient>
<linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffa35f"/><stop offset="1" stop-color="#c46bff"/></linearGradient>
</defs>
<rect width="${size}" height="${size}" rx="${rounded ? 14 : 0}" fill="url(#bg)"/>
${bars}
</svg>
`;
}

mkdirSync('public', { recursive: true });
writeFileSync('public/favicon.svg', svg({ rounded: true, safe: 0.62 }));

const browser = await chromium.launch();
const page = await browser.newPage();
async function png(file, markup, px) {
  await page.setViewportSize({ width: px, height: px });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${px}px;height:${px}px}</style>${markup}`);
  await page.screenshot({ path: file, omitBackground: true });
}
await png('public/icon-192.png', svg({ rounded: true, safe: 0.62 }), 192);
await png('public/icon-512.png', svg({ rounded: true, safe: 0.62 }), 512);
await png('public/icon-maskable-512.png', svg({ rounded: false, safe: 0.5 }), 512); // maskable: keep inside the central 80% safe zone
await png('public/apple-touch-icon.png', svg({ rounded: false, safe: 0.58 }), 180);
await png('/tmp/favicon-32.png', svg({ rounded: true, safe: 0.66 }), 32);
await browser.close();

// favicon.ico: an ICO container holding one 32x32 PNG
const img = readFileSync('/tmp/favicon-32.png');
const head = Buffer.alloc(22);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4); // ICONDIR: type 1, one image
head.writeUInt8(32, 6); head.writeUInt8(32, 7); head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12);
head.writeUInt32LE(img.length, 14); head.writeUInt32LE(22, 18);
writeFileSync('public/favicon.ico', Buffer.concat([head, img]));

writeFileSync('public/site.webmanifest', JSON.stringify({
  name: 'Commit Symphony',
  short_name: 'Symphony',
  description: 'Turn your GitHub year into a 30-second song.',
  start_url: '/',
  display: 'standalone',
  background_color: '#090913',
  theme_color: '#090913',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2) + '\n');
console.log('icons written to public/');
