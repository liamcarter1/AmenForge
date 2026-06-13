/**
 * First-order Markov model over slice indices.
 */
import type { Rng } from "../util/rng";
import { weightedPick, pick } from "../util/rng";
import { TRAINING_SEQUENCES } from "./presets";

export interface MarkovModel {
  transitions: Map<number, Map<number, number>>;
  vocab: number[];
}

export function trainMarkov(sequences: number[][] = TRAINING_SEQUENCES): MarkovModel {
  const transitions = new Map<number, Map<number, number>>();
  const vocabSet = new Set<number>();

  for (const seq of sequences) {
    for (let i = 0; i < seq.length; i++) {
      vocabSet.add(seq[i]);
      if (i === 0) continue;
      const from = seq[i - 1];
      const to = seq[i];
      let row = transitions.get(from);
      if (!row) {
        row = new Map();
        transitions.set(from, row);
      }
      row.set(to, (row.get(to) ?? 0) + 1);
    }
  }
  return { transitions, vocab: [...vocabSet].sort((a, b) => a - b) };
}

export function nextSlice(model: MarkovModel, current: number, rng: Rng): number {
  const row = model.transitions.get(current);
  if (!row || row.size === 0) {
    if (model.vocab.length === 0) return 0;
    return pick(rng, model.vocab);
  }
  const items = [...row.keys()];
  const weights = items.map((k) => row.get(k) as number);
  return weightedPick(rng, items, weights);
}

export function generateSequence(
  model: MarkovModel,
  length: number,
  sliceCount: number,
  rng: Rng,
  start?: number,
): number[] {
  if (length <= 0 || sliceCount <= 0) return [];
  const out: number[] = [];
  let current = start ?? (model.vocab.length ? pick(rng, model.vocab) : 0);
  for (let i = 0; i < length; i++) {
    out.push(current % sliceCount);
    current = nextSlice(model, current, rng);
  }
  return out;
}
