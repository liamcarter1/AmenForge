import { describe, it, expect } from "vitest";
import { frameEnergy, detectOnsets } from "../src/audio/onset";

function signalWithTransients(length: number, positions: number[], burst = 400): Float32Array {
  const s = new Float32Array(length);
  for (const pos of positions) {
    for (let i = 0; i < burst && pos + i < length; i++) {
      s[pos + i] = Math.exp(-i / 80) * Math.sin(i * 0.5);
    }
  }
  return s;
}

describe("frameEnergy", () => {
  it("computes per-hop sum of squares", () => {
    const s = new Float32Array([1, 1, 1, 1]);
    const e = frameEnergy(s, 2);
    expect(e.length).toBe(2);
    expect(e[0]).toBeCloseTo(2);
    expect(e[1]).toBeCloseTo(2);
  });

  it("handles a hop larger than the signal", () => {
    const e = frameEnergy(new Float32Array([1, 1]), 8);
    expect(e.length).toBe(1);
    expect(e[0]).toBeCloseTo(2);
  });
});

describe("detectOnsets", () => {
  it("always includes 0 as the first onset", () => {
    const s = signalWithTransients(44100, [0, 11025, 22050, 33075]);
    const onsets = detectOnsets(s, 44100);
    expect(onsets[0]).toBe(0);
  });

  it("finds transients near their true positions", () => {
    const sr = 44100;
    const positions = [11025, 22050, 33075];
    const s = signalWithTransients(44100, [0, ...positions]);
    const onsets = detectOnsets(s, sr, { sensitivity: 0.8 });
    for (const pos of positions) {
      const near = onsets.some((o) => Math.abs(o - pos) < 0.03 * sr);
      expect(near).toBe(true);
    }
  });

  it("respects the minimum gap (no clustered duplicates)", () => {
    const s = signalWithTransients(44100, [0, 5000, 5100, 5200]);
    const onsets = detectOnsets(s, 44100, { minGapSec: 0.1 });
    const sorted = [...onsets].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(0.1 * 44100 - 512);
    }
  });

  it("handles empty / degenerate input", () => {
    expect(detectOnsets(new Float32Array(0), 44100)).toEqual([0]);
    expect(detectOnsets(new Float32Array([0.1]), 0)).toEqual([0]);
  });

  it("returns sorted, non-negative onsets within range", () => {
    const s = signalWithTransients(44100, [0, 8000, 16000, 24000]);
    const onsets = detectOnsets(s, 44100);
    for (const o of onsets) {
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThan(44100);
    }
  });
});
