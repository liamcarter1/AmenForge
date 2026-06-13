/**
 * Deterministic, seedable PRNG (mulberry32). A seeded RNG lets the generative
 * engine be exercised reproducibly in tests while still feeling random in use.
 */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random integer in [min, max] inclusive. */
export function randInt(rng: Rng, min: number, max: number): number {
  if (max < min) [min, max] = [max, min];
  return min + Math.floor(rng() * (max - min + 1));
}

/** Pick a random element from a non-empty array. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error("pick() called on empty array");
  return items[Math.floor(rng() * items.length)];
}

/** True with the given probability (0..1). */
export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}

/**
 * Weighted choice. `weights` must be the same length as `items` and contain
 * non-negative numbers with a positive sum.
 */
export function weightedPick<T>(rng: Rng, items: readonly T[], weights: readonly number[]): T {
  if (items.length === 0 || items.length !== weights.length) {
    throw new Error("weightedPick: items and weights must be same non-zero length");
  }
  let total = 0;
  for (const w of weights) {
    if (w < 0 || !Number.isFinite(w)) throw new Error("weightedPick: weights must be finite and non-negative");
    total += w;
  }
  if (total <= 0) throw new Error("weightedPick: weights must sum to a positive value");
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}
