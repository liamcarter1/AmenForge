import { describe, it, expect } from "vitest";
import { equalSlices, slicesFromOnsets, sliceDurationSec, inferRoles } from "../src/audio/slicer";

describe("equalSlices", () => {
  it("divides the buffer into N contiguous slices covering the whole range", () => {
    const slices = equalSlices(1600, 4);
    expect(slices.length).toBe(4);
    expect(slices[0].start).toBe(0);
    expect(slices[3].end).toBe(1600);
    for (let i = 1; i < slices.length; i++) expect(slices[i].start).toBe(slices[i - 1].end);
    expect(slices.map((s) => s.index)).toEqual([0, 1, 2, 3]);
  });

  it("handles non-divisible lengths (last slice absorbs remainder)", () => {
    const slices = equalSlices(1000, 3);
    expect(slices[slices.length - 1].end).toBe(1000);
  });

  it("returns empty for zero-length buffers", () => {
    expect(equalSlices(0, 8)).toEqual([]);
  });
});

describe("slicesFromOnsets", () => {
  it("creates slices between consecutive onsets and to the end", () => {
    const slices = slicesFromOnsets([0, 1000, 2000], 3000, 1);
    expect(slices.length).toBe(3);
    expect(slices[0]).toMatchObject({ start: 0, end: 1000 });
    expect(slices[2]).toMatchObject({ start: 2000, end: 3000 });
  });

  it("prepends a 0 boundary if missing", () => {
    const slices = slicesFromOnsets([500, 1500], 2000, 1);
    expect(slices[0].start).toBe(0);
  });

  it("merges onsets closer than minFrames", () => {
    const slices = slicesFromOnsets([0, 100, 200, 2000], 4000, 512);
    expect(slices[0].start).toBe(0);
    expect(slices.some((s) => s.start === 100 || s.start === 200)).toBe(false);
  });

  it("de-duplicates and sorts unsorted onsets", () => {
    const slices = slicesFromOnsets([2000, 0, 1000, 1000], 3000, 1);
    expect(slices.map((s) => s.start)).toEqual([0, 1000, 2000]);
  });

  it("returns empty for zero-length buffers", () => {
    expect(slicesFromOnsets([0, 100], 0)).toEqual([]);
  });
});

describe("sliceDurationSec", () => {
  it("converts sample span to seconds", () => {
    expect(sliceDurationSec({ index: 0, start: 0, end: 22050 }, 44100)).toBeCloseTo(0.5);
  });

  it("guards against zero sample rate", () => {
    expect(sliceDurationSec({ index: 0, start: 0, end: 100 }, 0)).toBe(0);
  });
});

describe("inferRoles", () => {
  it("defaults to kick=0, snare=1 without brightness data", () => {
    const r = inferRoles(8);
    expect(r.kick).toBe(0);
    expect(r.snare).toBe(1);
    expect(r.ghosts).toContain(7);
  });

  it("uses brightness: darkest -> kick, brightest -> snare", () => {
    const brightness = [0.9, 0.1, 0.5, 0.95];
    const r = inferRoles(4, brightness);
    expect(r.kick).toBe(1);
    expect(r.snare).toBe(3);
    expect(r.ghosts).not.toContain(1);
    expect(r.ghosts).not.toContain(3);
  });

  it("handles single-slice and empty pools", () => {
    expect(inferRoles(1).kick).toBe(0);
    expect(inferRoles(0).ghosts.length).toBeGreaterThan(0);
  });
});
