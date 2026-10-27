// Generates fixtures/*.json deterministically. Run: npm run fixtures
// Daily commit counts are simulated per persona, then bucketed into GitHub-style
// quartile levels (relative to the person's own busiest days).
import { mkdirSync, writeFileSync } from 'node:fs';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// count ~ roughly lognormal, scaled by `mean`
const draw = (r, mean) => Math.max(1, Math.round(mean * Math.exp((r() - 0.5) * 2.2)));

function toLevels(counts) {
  const nz = counts.flat().filter((c) => c > 0).sort((a, b) => a - b);
  const q = (p) => nz[Math.min(nz.length - 1, Math.floor(p * nz.length))] ?? 0;
  const [q1, q2, q3] = [q(0.25), q(0.5), q(0.75)];
  return counts.map((week) =>
    week.map((c) => (c === 0 ? 0 : c <= q1 ? 1 : c <= q2 ? 2 : c <= q3 ? 3 : 4)),
  );
}

// p(week, day) -> probability of contributing; mean(week, day) -> typical count
const personas = {
  active: {
    seed: 11,
    langs: ['TypeScript', 'Go', 'Python'],
    p: (w, d) => {
      const base = d === 0 || d === 6 ? 0.3 : 0.9;
      const holiday = w >= 50 || (w >= 33 && w <= 34) ? 0.25 : 1;
      return base * holiday;
    },
    mean: (w, d) => (d === 0 || d === 6 ? 3 : 7) * (w > 20 && w < 30 ? 1.5 : 1),
  },
  weekend: {
    seed: 23,
    langs: ['Rust', 'Python'],
    p: (w, d) => {
      const away = (w >= 20 && w <= 25) || (w >= 40 && w <= 43);
      if (away) return 0.05;
      return d === 0 || d === 6 ? 0.85 : 0.04;
    },
    mean: (w, d) => (d === 0 || d === 6 ? 6 : 2),
  },
  burst: {
    seed: 37,
    langs: ['JavaScript', 'HTML'],
    p: (w, d) => (w >= 9 && w <= 16 ? (d === 0 || d === 6 ? 0.8 : 0.97) : w === 8 ? 0.3 : 0),
    mean: (w) => (w >= 11 && w <= 14 ? 14 : 6),
  },
  empty: {
    seed: 41,
    langs: ['Shell'],
    p: (w, d) => ([4, 17, 18, 30, 44].includes(w) && d === 3 ? 1 : w === 51 && d === 5 ? 1 : 0),
    mean: () => 1,
  },
};

mkdirSync(new URL('../fixtures/', import.meta.url), { recursive: true });

for (const [name, cfg] of Object.entries(personas)) {
  const r = rng(cfg.seed);
  const counts = Array.from({ length: 52 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => (r() < cfg.p(w, d) ? draw(r, cfg.mean(w, d)) : 0)),
  );
  const data = {
    user: `fixture-${name}`,
    year: 2025,
    weeks: toLevels(counts),
    total: counts.flat().reduce((s, c) => s + c, 0),
    topLanguages: cfg.langs,
  };
  writeFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), JSON.stringify(data) + '\n');
  console.log(name.padEnd(8), 'total', String(data.total).padStart(5), 'active days', counts.flat().filter(Boolean).length);
}
