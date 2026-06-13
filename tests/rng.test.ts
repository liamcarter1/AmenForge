import { describe, it, expect } from "vitest";
import { mulberry32, randInt, pick, chance, weightedPick } from "../src/util/rng";

describe("mulberry32", () => {
  it("is deterministic for a given seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("produces values in [0, 1)", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("different seeds give different streams", () => {
    const a = mulberry32(1)();
    const b = mulberry32(2)();
    expect(a).not.toEqual(b);
  });
});

describe("randInt", () => {
  it("stays within inclusive bounds", () => {
    const r = mulberry32(99);
    for (let i = 0; i < 500; i++) {
      const v = randInt(r, 3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("handles reversed bounds", () => {
    const r = mulberry32(5);
    const v = randInt(r, 9, 3);
    expect(v).toBeGreaterThanOrEqual(3);
    expect(v).toBeLessThanOrEqual(9);
  });

  it("returns the single value when min === max", () => {
    const r = mulberry32(5);
    expect(randInt(r, 4, 4)).toBe(4);
  });
});

describe("pick", () => {
  it("returns an element from the array", () => {
    const r = mulberry32(3);
    const items = ["a", "b", "c"];
    for (let i = 0; i < 50; i++) expect(items).toContain(pick(r, items));
  });

  it("throws on empty array", () => {
    expect(() => pick(mulberry32(1), [])).toThrow();
  });
});

describe("chance", () => {
  it("p=0 is always false, p=1 always true", () => {
    const r = mulberry32(11);
    for (let i = 0; i < 20; i++) {
      expect(chance(r, 0)).toBe(false);
      expect(chance(r, 1)).toBe(true);
    }
  });

  it("p=0.5 is roughly balanced", () => {
    const r = mulberry32(123);
    let trues = 0;
    const N = 5000;
    for (let i = 0; i < N; i++) if (chance(r, 0.5)) trues++;
    expect(trues / N).toBeGreaterThan(0.45);
    expect(trues / N).toBeLessThan(0.55);
  });
});

describe("weightedPick", () => {
  it("respects weights (zero-weight items never chosen)", () => {
    const r = mulberry32(77);
    const items = ["x", "y", "z"];
    const weights = [1, 0, 3];
    const counts: Record<string, number> = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 4000; i++) counts[weightedPick(r, items, weights)]++;
    expect(counts.y).toBe(0);
    expect(counts.z).toBeGreaterThan(counts.x);
  });

  it("throws on mismatched / empty / invalid weights", () => {
    const r = mulberry32(1);
    expect(() => weightedPick(r, ["a"], [1, 2])).toThrow();
    expect(() => weightedPick(r, [], [])).toThrow();
    expect(() => weightedPick(r, ["a", "b"], [0, 0])).toThrow();
    expect(() => weightedPick(r, ["a"], [-1])).toThrow();
  });
});
