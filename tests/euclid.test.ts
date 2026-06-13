import { describe, it, expect } from "vitest";
import { euclid, rotate, euclidHits } from "../src/generate/euclid";

const countTrue = (a: boolean[]) => a.filter(Boolean).length;

describe("euclid", () => {
  it("produces canonical tresillo E(3,8)", () => {
    expect(euclid(3, 8)).toEqual([true, false, false, true, false, false, true, false]);
  });

  it("produces canonical cinquillo E(5,8)", () => {
    expect(countTrue(euclid(5, 8))).toBe(5);
    expect(euclid(5, 8)[0]).toBe(true);
  });

  it("E(4,16) places 4 evenly spaced hits starting at 0", () => {
    const p = euclid(4, 16);
    expect(countTrue(p)).toBe(4);
    expect(euclidHits(4, 16)).toEqual([0, 4, 8, 12]);
  });

  it("always lands a pulse on index 0", () => {
    for (let k = 1; k <= 8; k++) {
      expect(euclid(k, 8)[0]).toBe(true);
    }
  });

  it("has the correct number of pulses for many (k,n)", () => {
    for (let n = 1; n <= 16; n++) {
      for (let k = 0; k <= n; k++) {
        expect(countTrue(euclid(k, n))).toBe(k);
        expect(euclid(k, n).length).toBe(n);
      }
    }
  });

  it("handles k=0 (silence) and k>=n (all on)", () => {
    expect(euclid(0, 8)).toEqual(new Array(8).fill(false));
    expect(euclid(8, 8)).toEqual(new Array(8).fill(true));
    expect(euclid(20, 8)).toEqual(new Array(8).fill(true));
  });

  it("handles n=0 gracefully", () => {
    expect(euclid(3, 0)).toEqual([]);
  });
});

describe("rotate", () => {
  it("rotates right and wraps", () => {
    expect(rotate([true, false, false, false], 1)).toEqual([false, true, false, false]);
    expect(rotate([true, false, false, false], 4)).toEqual([true, false, false, false]);
  });

  it("handles negative offsets", () => {
    expect(rotate([true, false, false, false], -1)).toEqual([false, false, false, true]);
  });

  it("returns empty for empty", () => {
    expect(rotate([], 3)).toEqual([]);
  });
});

describe("euclidHits", () => {
  it("returns onset indices and respects offset", () => {
    expect(euclidHits(3, 8)).toEqual([0, 3, 6]);
    expect(euclidHits(3, 8, 1)).toEqual([1, 4, 7]);
  });
});
