import { describe, it, expect } from "vitest";
import { swingOffsetForStep, humanizeVelocity, addGhostNotes } from "../src/generate/humanize";
import { makeHit } from "../src/state/pattern";
import { mulberry32 } from "../src/util/rng";

describe("swingOffsetForStep", () => {
  it("leaves on-beats (even steps) unshifted", () => {
    expect(swingOffsetForStep(0, 0.5)).toBe(0);
    expect(swingOffsetForStep(2, 0.5)).toBe(0);
  });

  it("delays off-beats (odd steps) proportionally to swing", () => {
    expect(swingOffsetForStep(1, 0)).toBe(0);
    expect(swingOffsetForStep(1, 0.5)).toBeCloseTo(0.25);
  });

  it("clamps swing to the legal range", () => {
    expect(swingOffsetForStep(1, 5)).toBeCloseTo(0.375);
  });
});

describe("humanizeVelocity", () => {
  it("leaves gains untouched at amount 0", () => {
    const hits = [makeHit({ step: 0, slice: 0, gain: 0.8 })];
    const out = humanizeVelocity(hits, 0, mulberry32(1));
    expect(out[0].gain).toBe(0.8);
  });

  it("keeps gains within [0.05, 1]", () => {
    const hits = Array.from({ length: 50 }, (_, i) => makeHit({ step: i, slice: 0, gain: i % 2 ? 1 : 0.05 }));
    const out = humanizeVelocity(hits, 1, mulberry32(9));
    for (const h of out) {
      expect(h.gain).toBeGreaterThanOrEqual(0.05);
      expect(h.gain).toBeLessThanOrEqual(1);
    }
  });

  it("does not mutate the input", () => {
    const hits = [makeHit({ step: 0, slice: 0, gain: 0.5 })];
    humanizeVelocity(hits, 1, mulberry32(1));
    expect(hits[0].gain).toBe(0.5);
  });
});

describe("addGhostNotes", () => {
  it("only adds to empty steps and preserves existing hits", () => {
    const hits = [makeHit({ step: 0, slice: 0 }), makeHit({ step: 4, slice: 1 })];
    const out = addGhostNotes(hits, 16, [2, 3], 1, mulberry32(1));
    expect(out.length).toBe(16);
    expect(out.find((h) => h.step === 0)?.gain).toBe(1);
    expect(out.find((h) => h.step === 4)?.gain).toBe(1);
    const ghosts = out.filter((h) => h.step !== 0 && h.step !== 4);
    for (const g of ghosts) {
      expect(g.gain).toBeLessThan(0.4);
      expect([2, 3]).toContain(g.slice);
    }
  });

  it("adds nothing at density 0 or with no ghost slices", () => {
    const hits = [makeHit({ step: 0, slice: 0 })];
    expect(addGhostNotes(hits, 16, [2], 0, mulberry32(1)).length).toBe(1);
    expect(addGhostNotes(hits, 16, [], 1, mulberry32(1)).length).toBe(1);
  });

  it("is deterministic for a seed", () => {
    const hits = [makeHit({ step: 0, slice: 0 })];
    const a = addGhostNotes(hits, 16, [2, 3], 0.5, mulberry32(7));
    const b = addGhostNotes(hits, 16, [2, 3], 0.5, mulberry32(7));
    expect(a).toEqual(b);
  });
});
