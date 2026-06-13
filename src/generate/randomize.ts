/**
 * "Musical randomize" — the one-click generator.
 */
import type { Hit, Pattern } from "../state/pattern";
import { createEmptyPattern, makeHit, totalSteps, clamp } from "../state/pattern";
import { mulberry32, chance } from "../util/rng";
import type { Rng } from "../util/rng";
import { euclidHits } from "./euclid";
import { trainMarkov, nextSlice, type MarkovModel } from "./markov";
import { humanizeVelocity, addGhostNotes } from "./humanize";
import { applyFill } from "./fills";

export interface SliceRoles {
  kick: number;
  snare: number;
  ghosts: number[];
  all: number[];
}

export interface GenerateOptions {
  seed: number;
  steps: number;
  bars: number;
  bpm: number;
  density: number;
  swing: number;
  ghostDensity: number;
  humanize: number;
  addFill: boolean;
  roles: SliceRoles;
  model?: MarkovModel;
}

export const DEFAULT_GENERATE_OPTIONS: Omit<GenerateOptions, "seed" | "roles"> = {
  steps: 16,
  bars: 1,
  bpm: 170,
  density: 0.45,
  swing: 0.12,
  ghostDensity: 0.25,
  humanize: 0.5,
  addFill: true,
};

export function defaultRoles(sliceCount: number): SliceRoles {
  const all = Array.from({ length: Math.max(1, sliceCount) }, (_, i) => i);
  const kick = 0;
  const snare = all.length > 1 ? 1 : 0;
  const ghosts = all.filter((i) => i !== kick && i !== snare);
  return { kick, snare, ghosts: ghosts.length ? ghosts : [kick], all };
}

function strongBeats(steps: number, bars: number): number[] {
  const out: number[] = [];
  const quarter = Math.max(1, Math.round(steps / 4));
  for (let b = 0; b < bars; b++) {
    const base = b * steps;
    out.push(base);
    out.push(base + quarter * 2);
  }
  return out;
}

function backBeats(steps: number, bars: number): number[] {
  const out: number[] = [];
  const quarter = Math.max(1, Math.round(steps / 4));
  for (let b = 0; b < bars; b++) {
    const base = b * steps;
    out.push(base + quarter);
    out.push(base + quarter * 3);
  }
  return out;
}

export function generatePattern(opts: GenerateOptions): Pattern {
  const steps = clamp(Math.floor(opts.steps), 4, 32);
  const bars = clamp(Math.floor(opts.bars), 1, 8);
  const rng: Rng = mulberry32(opts.seed);
  const model = opts.model ?? trainMarkov();
  const roles = opts.roles;
  const total = steps * bars;

  const pattern = createEmptyPattern({ steps, bars, bpm: opts.bpm, swing: opts.swing });
  const occupied = new Set<number>();
  const hits: Hit[] = [];

  const place = (step: number, hit: Hit) => {
    if (step < 0 || step >= total || occupied.has(step)) return;
    occupied.add(step);
    hits.push(hit);
  };

  for (const s of strongBeats(steps, bars)) {
    place(s, makeHit({ step: s, slice: roles.kick, gain: 1 }));
  }
  const extraKicks = euclidHits(Math.max(2, Math.round(steps / 5)), steps);
  for (let b = 0; b < bars; b++) {
    for (const e of extraKicks) {
      const s = b * steps + e;
      if (chance(rng, 0.5)) place(s, makeHit({ step: s, slice: roles.kick, gain: 0.7 }));
    }
  }

  for (const s of backBeats(steps, bars)) {
    place(s, makeHit({ step: s, slice: roles.snare, gain: 0.95 }));
  }

  let current = roles.snare;
  const density = clamp(opts.density, 0, 1);
  for (let step = 0; step < total; step++) {
    current = nextSlice(model, current, rng);
    if (occupied.has(step)) continue;
    if (chance(rng, density)) {
      const slice = current % roles.all.length;
      const ratchet = chance(rng, 0.15) ? 2 : 1;
      place(step, makeHit({ step, slice, gain: 0.6 + rng() * 0.3, ratchet }));
    }
  }

  let result: Pattern = { ...pattern, hits };

  result = { ...result, hits: addGhostNotes(result.hits, total, roles.ghosts, opts.ghostDensity, rng) };
  result = { ...result, hits: humanizeVelocity(result.hits, opts.humanize, rng) };

  if (opts.addFill) {
    const fillSteps = Math.max(2, Math.round(steps / 4));
    result = applyFill(result, roles.snare, fillSteps, rng, {});
  }

  return result;
}

export function mutatePattern(p: Pattern, seed: number, roles: SliceRoles, intensity = 0.2): Pattern {
  const rng = mulberry32(seed);
  const total = totalSteps(p);
  const hits = p.hits.map((h) => ({ ...h }));
  const numChanges = Math.max(1, Math.round(total * clamp(intensity, 0, 1)));

  for (let i = 0; i < numChanges; i++) {
    const action = rng();
    if (action < 0.35 && hits.length > 0) {
      const idx = Math.floor(rng() * hits.length);
      hits[idx] = { ...hits[idx], pitch: clamp(hits[idx].pitch + (chance(rng, 0.5) ? 1 : -1) * 2, -24, 24) };
    } else if (action < 0.6 && hits.length > 0) {
      const idx = Math.floor(rng() * hits.length);
      hits[idx] = { ...hits[idx], reverse: !hits[idx].reverse };
    } else if (action < 0.8 && hits.length > 0) {
      const quiet = hits.map((h, j) => ({ h, j })).filter((x) => x.h.gain < 0.5);
      if (quiet.length) hits.splice(quiet[Math.floor(rng() * quiet.length)].j, 1);
    } else {
      const step = Math.floor(rng() * total);
      if (!hits.some((h) => h.step === step)) {
        const slice = roles.ghosts.length ? roles.ghosts[Math.floor(rng() * roles.ghosts.length)] : roles.kick;
        hits.push(makeHit({ step, slice, gain: 0.2 + rng() * 0.2 }));
      }
    }
  }
  return { ...p, hits };
}
