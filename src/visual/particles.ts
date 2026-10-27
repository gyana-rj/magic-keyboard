export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
}

/** A small, capped spark system. Pure: the caller supplies the random source and the clock. */
export class Particles {
  items: Particle[] = [];

  constructor(
    private rng: () => number,
    private max = 160,
  ) {}

  /** Burst `count` sparks drifting upward from (x, y). Oldest sparks are dropped past the cap. */
  emit(x: number, y: number, count: number, size = 1.5) {
    for (let i = 0; i < count; i++) {
      this.items.push({
        x: x + (this.rng() - 0.5) * 4,
        y,
        vx: (this.rng() - 0.5) * 16,
        vy: -(14 + this.rng() * 22),
        age: 0,
        life: 0.7 + this.rng() * 0.7,
        size: size * (0.6 + this.rng() * 0.8),
      });
    }
    if (this.items.length > this.max) this.items.splice(0, this.items.length - this.max);
  }

  /** Advance by `dt` seconds (clamped, so a background tab doesn't teleport everything). */
  step(dt: number) {
    const d = Math.min(dt, 0.05);
    for (const p of this.items) {
      p.age += d;
      p.x += p.vx * d;
      p.y += p.vy * d;
      p.vy *= 1 - 1.2 * d;
    }
    this.items = this.items.filter((p) => p.age < p.life);
  }

  clear() {
    this.items = [];
  }
}
