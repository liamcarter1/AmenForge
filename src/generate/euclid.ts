/**
 * Euclidean rhythm generator (Bjorklund's algorithm).
 */

export function euclid(pulses: number, steps: number): boolean[] {
  const n = Math.max(0, Math.floor(steps));
  if (n === 0) return [];
  let k = Math.floor(pulses);
  if (k <= 0) return new Array(n).fill(false);
  if (k >= n) return new Array(n).fill(true);

  const counts: number[] = [];
  const remainders: number[] = [];
  let divisor = n - k;
  remainders.push(k);
  let level = 0;
  for (;;) {
    counts.push(Math.floor(divisor / remainders[level]));
    remainders.push(divisor % remainders[level]);
    divisor = remainders[level];
    level += 1;
    if (remainders[level] <= 1) break;
  }
  counts.push(divisor);

  const pattern: boolean[] = [];
  const build = (lvl: number): void => {
    if (lvl === -1) {
      pattern.push(false);
    } else if (lvl === -2) {
      pattern.push(true);
    } else {
      for (let i = 0; i < counts[lvl]; i++) build(lvl - 1);
      if (remainders[lvl] !== 0) build(lvl - 2);
    }
  };
  build(level);

  const first = pattern.indexOf(true);
  const rotated = first > 0 ? pattern.slice(first).concat(pattern.slice(0, first)) : pattern;
  if (rotated.length !== n) {
    const fixed = new Array(n).fill(false);
    for (let i = 0; i < Math.min(n, rotated.length); i++) fixed[i] = rotated[i];
    return fixed;
  }
  return rotated;
}

/** Rotate a boolean pattern right by `offset` steps (wraps). */
export function rotate(pattern: boolean[], offset: number): boolean[] {
  const n = pattern.length;
  if (n === 0) return [];
  const o = ((offset % n) + n) % n;
  if (o === 0) return pattern.slice();
  return pattern.slice(n - o).concat(pattern.slice(0, n - o));
}

/** Convenience: the step indices where onsets occur. */
export function euclidHits(pulses: number, steps: number, offset = 0): number[] {
  const pat = rotate(euclid(pulses, steps), offset);
  const out: number[] = [];
  for (let i = 0; i < pat.length; i++) if (pat[i]) out.push(i);
  return out;
}
