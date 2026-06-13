import { describe, it, expect } from "vitest";
import { trainMarkov, nextSlice, generateSequence } from "../src/generate/markov";
import { mulberry32 } from "../src/util/rng";

describe("trainMarkov", () => {
  it("builds transitions from sequences", () => {
    const m = trainMarkov([[0, 1, 2], [0, 1, 0]]);
    expect(m.transitions.get(0)?.get(1)).toBe(2);
    expect(m.transitions.get(1)?.get(2)).toBe(1);
    expect(m.transitions.get(1)?.get(0)).toBe(1);
    expect(m.vocab).toEqual([0, 1, 2]);
  });

  it("trains on the built-in sequences by default", () => {
    const m = trainMarkov();
    expect(m.vocab.length).toBeGreaterThan(1);
    expect(m.transitions.size).toBeGreaterThan(0);
  });
});

describe("nextSlice", () => {
  it("is deterministic for a given seed", () => {
    const m = trainMarkov();
    const a = mulberry32(5);
    const b = mulberry32(5);
    expect(nextSlice(m, 0, a)).toBe(nextSlice(m, 0, b));
  });

  it("falls back to uniform vocab pick for an unseen state", () => {
    const m = trainMarkov([[0, 1, 2]]);
    const v = nextSlice(m, 99, mulberry32(1));
    expect(m.vocab).toContain(v);
  });

  it("only returns states that were actually transitioned to", () => {
    const m = trainMarkov([[0, 5, 0, 5]]);
    for (let i = 0; i < 20; i++) {
      expect(nextSlice(m, 0, mulberry32(i))).toBe(5);
    }
  });
});

describe("generateSequence", () => {
  it("produces the requested length, all within slice bounds", () => {
    const m = trainMarkov();
    const seq = generateSequence(m, 32, 8, mulberry32(3));
    expect(seq.length).toBe(32);
    for (const s of seq) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(8);
    }
  });

  it("is reproducible with the same seed", () => {
    const m = trainMarkov();
    const a = generateSequence(m, 16, 8, mulberry32(42));
    const b = generateSequence(m, 16, 8, mulberry32(42));
    expect(a).toEqual(b);
  });

  it("handles degenerate inputs", () => {
    const m = trainMarkov();
    expect(generateSequence(m, 0, 8, mulberry32(1))).toEqual([]);
    expect(generateSequence(m, 5, 0, mulberry32(1))).toEqual([]);
  });
});
