import { describe, it, expect } from "vitest";
import { generatePattern, mutatePattern, defaultRoles, DEFAULT_GENERATE_OPTIONS } from "../src/generate/randomize";
import { getHit, totalSteps } from "../src/state/pattern";

function opts(over: Partial<Parameters<typeof generatePattern>[0]> = {}) {
  return {
    ...DEFAULT_GENERATE_OPTIONS,
    seed: 1,
    steps: 16,
    bars: 1,
    bpm: 170,
    roles: defaultRoles(8),
    ...over,
  };
}

describe("defaultRoles", () => {
  it("assigns kick=0, snare=1, rest ghosts", () => {
    const r = defaultRoles(8);
    expect(r.kick).toBe(0);
    expect(r.snare).toBe(1);
    expect(r.ghosts).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it("degrades gracefully for tiny slice counts", () => {
    const r1 = defaultRoles(1);
    expect(r1.kick).toBe(0);
    expect(r1.snare).toBe(0);
    expect(r1.ghosts.length).toBeGreaterThan(0);
  });
});

describe("generatePattern", () => {
  it("is fully deterministic for a given seed", () => {
    const a = generatePattern(opts({ seed: 123 }));
    const b = generatePattern(opts({ seed: 123 }));
    expect(a.hits).toEqual(b.hits);
  });

  it("different seeds usually differ", () => {
    const a = generatePattern(opts({ seed: 1 }));
    const b = generatePattern(opts({ seed: 2 }));
    expect(a.hits).not.toEqual(b.hits);
  });

  it("anchors a kick on the downbeat (step 0)", () => {
    const p = generatePattern(opts({ seed: 5 }));
    expect(getHit(p, 0, defaultRoles(8).kick)).toBeDefined();
  });

  it("places a snare on the backbeat (step 4 in a 16-grid)", () => {
    const roles = defaultRoles(8);
    const p = generatePattern(opts({ seed: 8, roles }));
    expect(getHit(p, 4, roles.snare)).toBeDefined();
    expect(getHit(p, 12, roles.snare)).toBeDefined();
  });

  it("never references a slice outside the pool", () => {
    const p = generatePattern(opts({ seed: 99 }));
    for (const h of p.hits) {
      expect(h.slice).toBeGreaterThanOrEqual(0);
      expect(h.slice).toBeLessThan(8);
      expect(h.step).toBeGreaterThanOrEqual(0);
      expect(h.step).toBeLessThan(totalSteps(p));
    }
  });

  it("produces hits across multiple bars", () => {
    const p = generatePattern(opts({ seed: 3, bars: 2 }));
    expect(totalSteps(p)).toBe(32);
    expect(p.hits.some((h) => h.step >= 16)).toBe(true);
  });

  it("density 0 still yields the structural kick+snare skeleton", () => {
    const p = generatePattern(opts({ seed: 1, density: 0, ghostDensity: 0, addFill: false }));
    expect(p.hits.length).toBeGreaterThan(0);
    expect(getHit(p, 0, 0)).toBeDefined();
  });
});

describe("mutatePattern", () => {
  it("changes the pattern but keeps it valid", () => {
    const base = generatePattern(opts({ seed: 10 }));
    const mut = mutatePattern(base, 555, defaultRoles(8), 0.5);
    expect(mut.hits).not.toEqual(base.hits);
    for (const h of mut.hits) {
      expect(h.step).toBeLessThan(totalSteps(mut));
      expect(h.pitch).toBeLessThanOrEqual(24);
      expect(h.pitch).toBeGreaterThanOrEqual(-24);
    }
  });

  it("is deterministic for a given seed", () => {
    const base = generatePattern(opts({ seed: 10 }));
    const a = mutatePattern(base, 7, defaultRoles(8), 0.3);
    const b = mutatePattern(base, 7, defaultRoles(8), 0.3);
    expect(a.hits).toEqual(b.hits);
  });
});
