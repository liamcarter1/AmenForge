import { describe, it, expect } from "vitest";
import { generateFill, applyFill, DEFAULT_FILL_OPTIONS } from "../src/generate/fills";
import { createEmptyPattern, setHit, makeHit, totalSteps } from "../src/state/pattern";
import { mulberry32 } from "../src/util/rng";

describe("generateFill", () => {
  it("creates one hit per step over the fill length", () => {
    const fill = generateFill(12, 4, 1, mulberry32(1));
    expect(fill.length).toBe(4);
    expect(fill.map((h) => h.step)).toEqual([12, 13, 14, 15]);
    expect(fill.every((h) => h.slice === 1)).toBe(true);
  });

  it("ramps ratchet from start to end", () => {
    const fill = generateFill(0, 5, 0, mulberry32(1), { startRatchet: 2, endRatchet: 6 });
    expect(fill[0].ratchet).toBe(2);
    expect(fill[fill.length - 1].ratchet).toBe(6);
    for (let i = 1; i < fill.length; i++) expect(fill[i].ratchet).toBeGreaterThanOrEqual(fill[i - 1].ratchet);
  });

  it("sweeps pitch upward across the fill", () => {
    const fill = generateFill(0, 5, 0, mulberry32(1), { pitchSweep: 12 });
    expect(fill[0].pitch).toBe(0);
    expect(fill[fill.length - 1].pitch).toBe(12);
  });

  it("clamps ratchet to the legal max", () => {
    const fill = generateFill(0, 3, 0, mulberry32(1), { startRatchet: 10, endRatchet: 20 });
    expect(fill.every((h) => h.ratchet <= 8)).toBe(true);
  });

  it("returns empty for non-positive length", () => {
    expect(generateFill(0, 0, 0, mulberry32(1))).toEqual([]);
  });

  it("exposes sane defaults", () => {
    expect(DEFAULT_FILL_OPTIONS.startRatchet).toBeLessThan(DEFAULT_FILL_OPTIONS.endRatchet);
  });
});

describe("applyFill", () => {
  it("replaces the last N steps and keeps earlier hits", () => {
    let p = createEmptyPattern({ steps: 16, bars: 1 });
    p = setHit(p, makeHit({ step: 0, slice: 0 }));
    p = setHit(p, makeHit({ step: 8, slice: 0 }));
    p = setHit(p, makeHit({ step: 15, slice: 0 }));
    const out = applyFill(p, 1, 4, mulberry32(1));
    const total = totalSteps(out);
    const fillStart = total - 4;
    expect(out.hits.some((h) => h.step === 0)).toBe(true);
    expect(out.hits.some((h) => h.step === 8)).toBe(true);
    const inFill = out.hits.filter((h) => h.step >= fillStart);
    expect(inFill.length).toBeGreaterThanOrEqual(4);
    expect(inFill.every((h) => h.slice === 1)).toBe(true);
  });

  it("clamps fill length to the pattern size", () => {
    const p = createEmptyPattern({ steps: 16, bars: 1 });
    const out = applyFill(p, 0, 999, mulberry32(1));
    expect(out.hits.every((h) => h.step < totalSteps(out))).toBe(true);
  });
});
