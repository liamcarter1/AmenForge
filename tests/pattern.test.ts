import { describe, it, expect } from "vitest";
import {
  createEmptyPattern,
  makeHit,
  normaliseHit,
  toggleHit,
  setHit,
  getHit,
  hitsAtStep,
  stepsToNextHit,
  clearPattern,
  totalSteps,
  serializePattern,
  deserializePattern,
  semitonesToRate,
  clamp,
  PATTERN_LIMITS,
} from "../src/state/pattern";

describe("createEmptyPattern", () => {
  it("uses sensible defaults", () => {
    const p = createEmptyPattern();
    expect(p.bpm).toBe(170);
    expect(p.steps).toBe(16);
    expect(p.bars).toBe(1);
    expect(p.hits).toEqual([]);
    expect(p.fx.filter).toBe(1);
  });

  it("clamps out-of-range overrides", () => {
    const p = createEmptyPattern({ bpm: 9999, steps: 1, bars: 99 });
    expect(p.bpm).toBe(PATTERN_LIMITS.bpm.max);
    expect(p.steps).toBe(PATTERN_LIMITS.steps.min);
    expect(p.bars).toBe(PATTERN_LIMITS.bars.max);
  });
});

describe("stepsToNextHit", () => {
  it("returns the gap (in steps) to the next hit, wrapping the loop", () => {
    let p = createEmptyPattern({ steps: 16 });
    p = setHit(p, makeHit({ step: 0, slice: 0 }));
    p = setHit(p, makeHit({ step: 4, slice: 1 }));
    p = setHit(p, makeHit({ step: 6, slice: 2 }));
    expect(stepsToNextHit(p, 0)).toBe(4); // 0 -> 4
    expect(stepsToNextHit(p, 4)).toBe(2); // 4 -> 6
    expect(stepsToNextHit(p, 6)).toBe(10); // 6 -> wrap to 0 (16 - 6)
    expect(stepsToNextHit(p, 1)).toBe(3); // mid-gap -> next hit at 4
  });

  it("gives a lone hit the whole loop", () => {
    let p = createEmptyPattern({ steps: 16 });
    p = setHit(p, makeHit({ step: 3, slice: 0 }));
    expect(stepsToNextHit(p, 3)).toBe(16);
  });

  it("returns 1 when consecutive steps both have hits", () => {
    let p = createEmptyPattern({ steps: 16 });
    p = setHit(p, makeHit({ step: 5, slice: 0 }));
    p = setHit(p, makeHit({ step: 6, slice: 1 }));
    expect(stepsToNextHit(p, 5)).toBe(1);
  });
});

describe("clamp", () => {
  it("clamps and maps NaN to min", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(clamp(NaN, 2, 10)).toBe(2);
  });
});

describe("normaliseHit", () => {
  it("coerces fields into valid ranges", () => {
    const h = normaliseHit({ step: 3.9, slice: -2, pitch: 100, reverse: 1 as unknown as boolean, gain: 5, ratchet: 99 });
    expect(h.step).toBe(3);
    expect(h.slice).toBe(0);
    expect(h.pitch).toBe(PATTERN_LIMITS.pitch.max);
    expect(h.reverse).toBe(true);
    expect(h.gain).toBe(1);
    expect(h.ratchet).toBe(PATTERN_LIMITS.ratchet.max);
  });
});

describe("toggle / set / get hits", () => {
  it("toggles a hit on and off", () => {
    let p = createEmptyPattern();
    p = toggleHit(p, 0, 0);
    expect(getHit(p, 0, 0)).toBeDefined();
    p = toggleHit(p, 0, 0);
    expect(getHit(p, 0, 0)).toBeUndefined();
  });

  it("toggle does not mutate the input pattern", () => {
    const p = createEmptyPattern();
    const p2 = toggleHit(p, 1, 1);
    expect(p.hits.length).toBe(0);
    expect(p2.hits.length).toBe(1);
  });

  it("setHit replaces an existing hit keyed by step+slice", () => {
    let p = createEmptyPattern();
    p = setHit(p, makeHit({ step: 2, slice: 1, pitch: 3 }));
    p = setHit(p, makeHit({ step: 2, slice: 1, pitch: -5 }));
    expect(p.hits.length).toBe(1);
    expect(getHit(p, 2, 1)?.pitch).toBe(-5);
  });

  it("hitsAtStep returns sorted slices", () => {
    let p = createEmptyPattern();
    p = setHit(p, makeHit({ step: 4, slice: 3 }));
    p = setHit(p, makeHit({ step: 4, slice: 1 }));
    p = setHit(p, makeHit({ step: 5, slice: 0 }));
    const at4 = hitsAtStep(p, 4);
    expect(at4.map((h) => h.slice)).toEqual([1, 3]);
  });

  it("clearPattern removes all hits but keeps settings", () => {
    let p = createEmptyPattern({ bpm: 174 });
    p = toggleHit(p, 0, 0);
    p = clearPattern(p);
    expect(p.hits).toEqual([]);
    expect(p.bpm).toBe(174);
  });
});

describe("totalSteps", () => {
  it("multiplies steps by bars", () => {
    expect(totalSteps(createEmptyPattern({ steps: 16, bars: 2 }))).toBe(32);
  });
});

describe("serialization", () => {
  it("round-trips a pattern", () => {
    let p = createEmptyPattern({ bpm: 168, steps: 16, bars: 2, swing: 0.3 });
    p = setHit(p, makeHit({ step: 0, slice: 0, pitch: 5, reverse: true, gain: 0.7, ratchet: 3 }));
    p = setHit(p, makeHit({ step: 8, slice: 1 }));
    const json = serializePattern(p);
    const back = deserializePattern(json);
    expect(back.bpm).toBe(168);
    expect(back.bars).toBe(2);
    expect(back.swing).toBeCloseTo(0.3);
    expect(back.hits.length).toBe(2);
    const h = getHit(back, 0, 0);
    expect(h?.pitch).toBe(5);
    expect(h?.reverse).toBe(true);
    expect(h?.ratchet).toBe(3);
  });

  it("returns a valid default pattern on garbage input", () => {
    expect(deserializePattern("not json").hits).toEqual([]);
    expect(deserializePattern("null").bpm).toBe(170);
    expect(deserializePattern("[1,2,3]").hits).toEqual([]);
  });

  it("drops malformed hits and clamps fields from hostile input", () => {
    const json = JSON.stringify({
      bpm: 1000,
      steps: 16,
      hits: [
        { step: 0, slice: 0, pitch: 999 },
        { step: "bad", slice: 0 },
        { nothing: true },
        42,
      ],
    });
    const p = deserializePattern(json);
    expect(p.bpm).toBe(PATTERN_LIMITS.bpm.max);
    expect(p.hits.length).toBe(1);
    expect(p.hits[0].pitch).toBe(PATTERN_LIMITS.pitch.max);
  });
});

describe("semitonesToRate", () => {
  it("maps 0 -> 1, +12 -> 2, -12 -> 0.5", () => {
    expect(semitonesToRate(0)).toBeCloseTo(1);
    expect(semitonesToRate(12)).toBeCloseTo(2);
    expect(semitonesToRate(-12)).toBeCloseTo(0.5);
  });
});
