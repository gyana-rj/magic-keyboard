import { describe, expect, it } from 'vitest';
import { FIXTURES } from '../server/fixtures';
import { composeSong } from '../src/music/mapping';
import { CARD_H, CARD_W, cardLayout } from '../src/share/card';
import { buildCardModel, cardFilename, shareText } from '../src/share/model';
import { parseShareParams, sharePath, shareUrl } from '../src/url';

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
    expect(path).toBe('/?u=octo-cat&y=2023');
    expect(parseShareParams(path.slice(1), now)).toEqual({ user: 'octo-cat', year: 2023 });
    expect(shareUrl('https://x.example', 'a', 2020)).toBe('https://x.example/?u=a&y=2020');
  });
  it('ignores unrelated params', () => {
    expect(parseShareParams('?utm_source=x&u=a&y=2020', now)).toEqual({ user: 'a', year: 2020 });
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
    expect(cardFilename('OctoCat', 2025)).toBe('commit-symphony-octocat-2025.png');
  });
});

describe('cardLayout', () => {
  const L = cardLayout();
  it('keeps every block on the card and in reading order', () => {
    const ys = [L.brand.y, L.title.y, L.headline.y, L.grid.y, L.stats.y, L.footer.y];
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(L.grid.x + L.grid.width).toBeLessThanOrEqual(CARD_W);
    expect(L.footer.y).toBeLessThanOrEqual(CARD_H);
    expect(L.stats.colWidth * 3 + L.grid.x).toBeLessThanOrEqual(CARD_W);
  });
  it('leaves room for the heatmap between headline and stats', () => {
    // 52 columns across the grid width -> square cells; seven rows must fit above the stats
    const cell = Math.floor((L.grid.width - 2 * 2 * 25) / 52); // matches computeLayout: gap 2, no padding
    const gridH = 7 * cell + 6 * 2 + 22 /* headroom */;
    expect(L.grid.y + gridH).toBeLessThan(L.stats.y - 18);
  });
});
