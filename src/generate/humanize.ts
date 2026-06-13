/**
 * Groove / humanisation helpers.
 */
import type { Hit } from "../state/pattern";
import { makeHit, clamp } from "../state/pattern";
import type { Rng } from "../util/rng";
import { chance, randInt } from "../util/rng";

export function swingOffsetForStep(step: number, swing: number): number {
  const s = clamp(swing, 0, 0.75);
  if (step % 2 === 0) return 0;
  return s * 0.5;
}

export function humanizeVelocity(hits: Hit[], amount: number, rng: Rng): Hit[] {
  const a = clamp(amount, 0, 1);
  if (a === 0) return hits.map((h) => ({ ...h }));
  return hits.map((h) => {
    const jitter = (rng() * 2 - 1) * a * 0.4;
    return { ...h, gain: clamp(h.gain + jitter, 0.05, 1) };
  });
}

export function addGhostNotes(
  hits: Hit[],
  totalSteps: number,
  ghostSlices: number[],
  density: number,
  rng: Rng,
): Hit[] {
  if (ghostSlices.length === 0 || density <= 0) return hits.map((h) => ({ ...h }));
  const occupied = new Set(hits.map((h) => h.step));
  const out = hits.map((h) => ({ ...h }));
  for (let step = 0; step < totalSteps; step++) {
    if (occupied.has(step)) continue;
    if (chance(rng, density)) {
      const slice = ghostSlices[randInt(rng, 0, ghostSlices.length - 1)];
      out.push(makeHit({ step, slice, gain: 0.18 + rng() * 0.15, ratchet: 1 }));
    }
  }
  return out;
}
