/**
 * Fill / roll generator.
 */
import type { Hit, Pattern } from "../state/pattern";
import { makeHit, totalSteps, clamp } from "../state/pattern";
import type { Rng } from "../util/rng";

export interface FillOptions {
  startRatchet: number;
  endRatchet: number;
  pitchSweep: number;
  reverseAlternate: boolean;
}

export const DEFAULT_FILL_OPTIONS: FillOptions = {
  startRatchet: 2,
  endRatchet: 6,
  pitchSweep: 5,
  reverseAlternate: false,
};

export function generateFill(
  startStep: number,
  length: number,
  slice: number,
  rng: Rng,
  opts: Partial<FillOptions> = {},
): Hit[] {
  const o = { ...DEFAULT_FILL_OPTIONS, ...opts };
  if (length <= 0) return [];
  const hits: Hit[] = [];
  for (let i = 0; i < length; i++) {
    const t = length === 1 ? 1 : i / (length - 1);
    const ratchet = Math.round(o.startRatchet + (o.endRatchet - o.startRatchet) * t);
    const pitch = Math.round(o.pitchSweep * t);
    const reverse = o.reverseAlternate && i % 2 === 1;
    hits.push(
      makeHit({
        step: startStep + i,
        slice,
        pitch,
        reverse,
        ratchet: clamp(ratchet, 1, 8),
        gain: 0.85 + rng() * 0.15,
      }),
    );
  }
  return hits;
}

export function applyFill(
  p: Pattern,
  slice: number,
  fillSteps: number,
  rng: Rng,
  opts: Partial<FillOptions> = {},
): Pattern {
  const total = totalSteps(p);
  const len = clamp(Math.floor(fillSteps), 1, total);
  const startStep = total - len;
  const kept = p.hits.filter((h) => h.step < startStep);
  const fill = generateFill(startStep, len, slice, rng, opts);
  return { ...p, hits: [...kept, ...fill] };
}
