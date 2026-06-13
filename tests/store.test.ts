import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "../src/state/store";
import { createEmptyPattern, getHit, totalSteps } from "../src/state/pattern";
import { defaultRoles } from "../src/generate/randomize";

function resetStore() {
  useStore.setState({
    pattern: createEmptyPattern(),
    sliceCount: 8,
    roles: defaultRoles(8),
    selectedSlice: 0,
    isPlaying: false,
    currentStep: -1,
    sampleLoaded: false,
    seedCounter: 1,
  });
}

describe("store", () => {
  beforeEach(resetStore);

  it("starts empty with defaults", () => {
    const s = useStore.getState();
    expect(s.pattern.hits).toEqual([]);
    expect(s.sliceCount).toBe(8);
  });

  it("toggles hits", () => {
    useStore.getState().toggleHit(2, 1);
    expect(getHit(useStore.getState().pattern, 2, 1)).toBeDefined();
    useStore.getState().toggleHit(2, 1);
    expect(getHit(useStore.getState().pattern, 2, 1)).toBeUndefined();
  });

  it("updateHit only affects existing hits", () => {
    useStore.getState().updateHit(0, 0, { pitch: 5 });
    expect(getHit(useStore.getState().pattern, 0, 0)).toBeUndefined();
    useStore.getState().toggleHit(0, 0);
    useStore.getState().updateHit(0, 0, { pitch: 5, ratchet: 3 });
    const h = getHit(useStore.getState().pattern, 0, 0);
    expect(h?.pitch).toBe(5);
    expect(h?.ratchet).toBe(3);
  });

  it("clamps BPM and swing", () => {
    useStore.getState().setBpm(5000);
    expect(useStore.getState().pattern.bpm).toBe(220);
    useStore.getState().setSwing(10);
    expect(useStore.getState().pattern.swing).toBe(0.75);
  });

  it("generate fills a pattern with a kick on the downbeat", () => {
    useStore.getState().generate();
    const p = useStore.getState().pattern;
    expect(p.hits.length).toBeGreaterThan(0);
    expect(getHit(p, 0, useStore.getState().roles.kick)).toBeDefined();
  });

  it("generate advances the seed so repeated calls differ", () => {
    useStore.getState().generate();
    const first = JSON.stringify(useStore.getState().pattern.hits);
    useStore.getState().generate();
    const second = JSON.stringify(useStore.getState().pattern.hits);
    expect(first).not.toEqual(second);
  });

  it("clear empties the hits but keeps tempo", () => {
    useStore.getState().setBpm(174);
    useStore.getState().generate();
    useStore.getState().clear();
    expect(useStore.getState().pattern.hits).toEqual([]);
    expect(useStore.getState().pattern.bpm).toBe(174);
  });

  it("loadPreset populates hits and respects the preset grid", () => {
    useStore.getState().loadPreset(0);
    const p = useStore.getState().pattern;
    expect(p.hits.length).toBeGreaterThan(0);
    for (const h of p.hits) expect(h.step).toBeLessThan(totalSteps(p));
  });

  it("setSliceCount recomputes default roles", () => {
    useStore.getState().setSliceCount(4);
    const s = useStore.getState();
    expect(s.sliceCount).toBe(4);
    expect(s.roles.ghosts.every((g) => g < 4)).toBe(true);
  });

  it("clamps generation params", () => {
    useStore.getState().setDensity(9);
    useStore.getState().setGhostDensity(-3);
    expect(useStore.getState().density).toBe(1);
    expect(useStore.getState().ghostDensity).toBe(0);
  });
});
