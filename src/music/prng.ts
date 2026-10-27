/** FNV-1a, 32-bit. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: small, fast, good enough for musical variation. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** GitHub logins are case-insensitive, so "Octocat" and "octocat" get the same song. */
export function seedFor(user: string, year: number): number {
  return hashString(`${user.toLowerCase()}:${year}`);
}

/** Independent stream per (seed, label), so changing one week never shifts another. */
export function subRng(seed: number, ...parts: (string | number)[]): () => number {
  return mulberry32(hashString(`${seed}:${parts.join(':')}`));
}
