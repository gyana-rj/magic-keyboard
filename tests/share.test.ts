import { describe, expect, it } from 'vitest';
import { FIXTURES } from '../server/fixtures';
import { composeSong } from '../src/music/mapping';
import { CARD_FORMATS, cardLayout, gridBox } from '../src/share/card';
import { buildCardModel, cardFilename, shareText, wavFilename } from '../src/share/model';
import { parseShareLocation, parseSharePath, parseShareParams, sharePath, shareUrl } from '../src/url';

const now = new Date('2026-06-01T00:00:00Z');

describe('share link', () => {
  it('parses a valid link', () => {
    expect(parseShareParams('?u=octocat&y=2024', now)).toEqual({ user: 'octocat', year: 2024 });
  });
  it('defaults the year to the current one', () => {
    expect(parseShareParams('?u=octocat', now)).toEqual({ user: 'octocat', year: 2026 });
  });
  it.each(['', '?y=2024', '?u=', '?u=-bad', '?u=a--b', '?u=has space', `?u=${'x'.repeat(40)}`, '?u=<script>'])(
    'rejects a bad or missing username: %j',
    (q) => expect(parseShareParams(q, now)).toBeNull(),
  );
  it.each(['?u=a&y=1999', '?u=a&y=2027', '?u=a&y=abc', '?u=a&y=20x5'])('rejects a bad year: %s', (q) =>
    expect(parseShareParams(q, now)).toBeNull(),
  );
  it('round-trips through sharePath', () => {
    const path = sharePath('octo-cat', 2023);
    expect(path).toBe('/u/octo-cat/2023');
    expect(parseSharePath(path, now)).toEqual({ user: 'octo-cat', year: 2023 });
    expect(shareUrl('https://x.example', 'a', 2020)).toBe('https://x.example/u/a/2020');
  });
  it('ignores unrelated params', () => {
    expect(parseShareParams('?utm_source=x&u=a&y=2020', now)).toEqual({ user: 'a', year: 2020 });
  });
});

describe('share path', () => {
  it('parses /u/:user/:year', () => {
    expect(parseSharePath('/u/octocat/2024', now)).toEqual({ user: 'octocat', year: 2024 });
    expect(parseSharePath('/u/octocat/2024/', now)).toEqual({ user: 'octocat', year: 2024 });
    expect(parseSharePath('/u/Octo-Cat/2008', now)).toEqual({ user: 'Octo-Cat', year: 2008 });
  });
  it.each(['/', '/u', '/u/octocat', '/u/octocat/24', '/u/octocat/1999', '/u/octocat/2027', '/u/-bad/2024', '/u/a--b/2024', '/u/a%2Fb/2024', '/u/%E0%A4%A/2024', '/u/octocat/2024/extra', '/x/octocat/2024'])(
    'rejects %s',
    (p) => expect(parseSharePath(p, now)).toBeNull(),
  );
  it('parseShareLocation prefers the path and still accepts the older query form', () => {
    expect(parseShareLocation({ pathname: '/u/a/2020', search: '' }, now)).toEqual({ user: 'a', year: 2020 });
    expect(parseShareLocation({ pathname: '/', search: '?u=b&y=2021' }, now)).toEqual({ user: 'b', year: 2021 });
    expect(parseShareLocation({ pathname: '/about', search: '?u=b&y=2021' }, now)).toBeNull();
    expect(parseShareLocation({ pathname: '/', search: '' }, now)).toBeNull();
  });
});

describe('card model', () => {
  it('describes each fixture with plain strings', () => {
    for (const data of Object.values(FIXTURES)) {
      const m = buildCardModel(data, composeSong(data));
      expect(m.user).toBe(data.user);
      expect(m.total).toBe(data.total.toLocaleString('en-US'));
      expect(m.streak).toMatch(/^\d+ days?$/);
      expect(m.mood).toMatch(/BPM$/);
      expect(m.headline).toContain(m.genre.toLowerCase());
    }
  });
  it('has a gentle version for a silent year', () => {
    const quiet = { ...FIXTURES.empty, total: 0, weeks: FIXTURES.empty.weeks.map((w) => w.map(() => 0 as const)) };
    const m = buildCardModel(quiet, composeSong(quiet));
    expect(m.quiet).toBe(true);
    expect(m.busiest).toBe('—');
    expect(m.streak).toBe('0 days');
    expect(m.headline).toMatch(/quiet year/i);
  });
  it('never uses forbidden branding', () => {
    for (const data of Object.values(FIXTURES)) {
      const m = buildCardModel(data, composeSong(data));
      expect(JSON.stringify(m) + shareText(m)).not.toMatch(/wrapped/i);
    }
  });
  it('makes a safe filename', () => {
    expect(cardFilename('OctoCat', 2025)).toBe('commit-symphony-octocat-2025-landscape.png');
    expect(cardFilename('OctoCat', 2025, 'story')).toBe('commit-symphony-octocat-2025-story.png');
    expect(wavFilename('OctoCat', 2025)).toBe('commit-symphony-octocat-2025.wav');
  });
});

describe('cardLayout', () => {
  for (const format of ['landscape', 'square', 'story'] as const) {
    const L = cardLayout(format);
    const { w, h } = CARD_FORMATS[format];
    it(`${format}: has the standard size and keeps every block on the card in reading order`, () => {
      expect([L.w, L.h]).toEqual([w, h]);
      const ys = [L.brand.y, L.title.y, L.headline.y, L.grid.y, L.stats.y, L.footer.y];
      expect(ys).toEqual([...ys].sort((a, b) => a - b));
      expect(L.grid.x + L.grid.width).toBeLessThanOrEqual(w);
      expect(L.stats.x + L.stats.colWidth * L.stats.cols).toBeLessThanOrEqual(w + 1);
      expect(L.footer.y).toBeLessThanOrEqual(h);
    });
    it(`${format}: the heatmap fits between the headline and the stats`, () => {
      const box = gridBox(format);
      expect(box.y).toBeGreaterThan(L.headline.y);
      expect(box.y + box.layout.height).toBeLessThan(L.stats.y - L.stats.labelSize);
      expect(box.layout.cell).toBeGreaterThanOrEqual(format === 'landscape' ? 16 : 30);
    });
    it(`${format}: the last stat ends above the footer`, () => {
      const rows = Math.ceil(3 / L.stats.cols);
      const lastBottom = L.stats.y + (rows - 1) * L.stats.rowHeight + L.stats.valueSize * 1.2;
      expect(lastBottom).toBeLessThan(L.footer.y - 10);
    });
  }
  it('the standard sizes', () => {
    expect(CARD_FORMATS.square).toMatchObject({ w: 1080, h: 1080 });
    expect(CARD_FORMATS.story).toMatchObject({ w: 1080, h: 1920 });
  });
});
