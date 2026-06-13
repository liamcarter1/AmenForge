/**
 * Global UI/application state (Zustand).
 *
 * Deliberately free of any Tone/audio imports so it stays unit-testable in
 * Node and decoupled from the engine. The React layer subscribes to this store
 * and mirrors relevant changes into the AudioEngine (which lives outside the
 * store as an imperative singleton).
 */
import { create } from "zustand";
import type { Pattern, Hit, FxParams } from "./pattern";
import {
  createEmptyPattern,
  toggleHit as toggleHitPure,
  setHit as setHitPure,
  getHit,
  clearPattern,
  clamp,
  PATTERN_LIMITS,
} from "./pattern";
import {
  generatePattern,
  mutatePattern,
  defaultRoles,
  DEFAULT_GENERATE_OPTIONS,
  type SliceRoles,
} from "../generate/randomize";
import { applyFill } from "../generate/fills";
import { FACTORY_PRESETS } from "../generate/presets";
import { mulberry32 } from "../util/rng";

export interface AppState {
  pattern: Pattern;
  sliceCount: number;
  roles: SliceRoles;
  selectedSlice: number;

  // transport / status mirrored from the engine
  isPlaying: boolean;
  currentStep: number;
  sampleLoaded: boolean;
  statusMessage: string;

  // generation controls
  density: number;
  ghostDensity: number;
  humanizeAmt: number;
  genSwing: number;
  addFill: boolean;
  seedCounter: number;

  // actions
  setPattern: (p: Pattern) => void;
  toggleHit: (step: number, slice: number) => void;
  updateHit: (step: number, slice: number, patch: Partial<Hit>) => void;
  setBpm: (bpm: number) => void;
  setSwing: (swing: number) => void;
  setGate: (gate: number) => void;
  setFx: (patch: Partial<FxParams>) => void;
  setSteps: (steps: number) => void;
  setBars: (bars: number) => void;

  setSliceCount: (count: number, roles?: Partial<SliceRoles>) => void;
  setRoles: (roles: SliceRoles) => void;
  selectSlice: (i: number) => void;

  generate: () => void;
  mutate: () => void;
  addFillNow: () => void;
  clear: () => void;
  loadPreset: (index: number) => void;

  setPlaying: (v: boolean) => void;
  setCurrentStep: (step: number) => void;
  setSampleLoaded: (v: boolean) => void;
  setStatus: (msg: string) => void;

  setDensity: (v: number) => void;
  setGhostDensity: (v: number) => void;
  setHumanizeAmt: (v: number) => void;
  setGenSwing: (v: number) => void;
  setAddFill: (v: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  pattern: createEmptyPattern(),
  sliceCount: 8,
  roles: defaultRoles(8),
  selectedSlice: 0,

  isPlaying: false,
  currentStep: -1,
  sampleLoaded: false,
  statusMessage: "Load the break to begin.",

  density: DEFAULT_GENERATE_OPTIONS.density,
  ghostDensity: DEFAULT_GENERATE_OPTIONS.ghostDensity,
  humanizeAmt: DEFAULT_GENERATE_OPTIONS.humanize,
  genSwing: DEFAULT_GENERATE_OPTIONS.swing,
  addFill: DEFAULT_GENERATE_OPTIONS.addFill,
  seedCounter: 1,

  setPattern: (p) => set({ pattern: p }),

  toggleHit: (step, slice) => set((s) => ({ pattern: toggleHitPure(s.pattern, step, slice) })),

  updateHit: (step, slice, patch) =>
    set((s) => {
      const existing = getHit(s.pattern, step, slice);
      if (!existing) return {};
      return { pattern: setHitPure(s.pattern, { ...existing, ...patch }) };
    }),

  setBpm: (bpm) =>
    set((s) => ({ pattern: { ...s.pattern, bpm: clamp(bpm, PATTERN_LIMITS.bpm.min, PATTERN_LIMITS.bpm.max) } })),

  setSwing: (swing) =>
    set((s) => ({ pattern: { ...s.pattern, swing: clamp(swing, PATTERN_LIMITS.swing.min, PATTERN_LIMITS.swing.max) } })),

  setGate: (gate) =>
    set((s) => ({ pattern: { ...s.pattern, gate: clamp(gate, PATTERN_LIMITS.gate.min, PATTERN_LIMITS.gate.max) } })),

  setFx: (patch) => set((s) => ({ pattern: { ...s.pattern, fx: { ...s.pattern.fx, ...patch } } })),

  setSteps: (steps) =>
    set((s) => ({
      pattern: { ...s.pattern, steps: clamp(steps, PATTERN_LIMITS.steps.min, PATTERN_LIMITS.steps.max) },
    })),

  setBars: (bars) =>
    set((s) => ({ pattern: { ...s.pattern, bars: clamp(bars, PATTERN_LIMITS.bars.min, PATTERN_LIMITS.bars.max) } })),

  setSliceCount: (count, rolePatch) =>
    set(() => {
      const c = clamp(Math.floor(count), 1, 32);
      const roles = { ...defaultRoles(c), ...rolePatch };
      return { sliceCount: c, roles };
    }),

  setRoles: (roles) => set({ roles }),
  selectSlice: (i) => set({ selectedSlice: Math.max(0, i) }),

  generate: () =>
    set((s) => {
      const seed = mulberry32(s.seedCounter)() * 1e9;
      const pattern = generatePattern({
        seed: Math.floor(seed),
        steps: s.pattern.steps,
        bars: s.pattern.bars,
        bpm: s.pattern.bpm,
        density: s.density,
        swing: s.genSwing,
        ghostDensity: s.ghostDensity,
        humanize: s.humanizeAmt,
        addFill: s.addFill,
        roles: s.roles,
      });
      return { pattern, seedCounter: s.seedCounter + 1, statusMessage: "Generated a fresh pattern." };
    }),

  mutate: () =>
    set((s) => {
      const seed = Math.floor(mulberry32(s.seedCounter + 7)() * 1e9);
      return {
        pattern: mutatePattern(s.pattern, seed, s.roles, 0.2),
        seedCounter: s.seedCounter + 1,
        statusMessage: "Mutated the current pattern.",
      };
    }),

  addFillNow: () =>
    set((s) => {
      const seed = Math.floor(mulberry32(s.seedCounter + 13)() * 1e9);
      const fillSteps = Math.max(2, Math.round(s.pattern.steps / 4));
      return {
        pattern: applyFill(s.pattern, s.roles.snare, fillSteps, mulberry32(seed)),
        seedCounter: s.seedCounter + 1,
        statusMessage: "Dropped a fill on the last beat.",
      };
    }),

  clear: () => set((s) => ({ pattern: clearPattern(s.pattern), statusMessage: "Cleared." })),

  loadPreset: (index) =>
    set((s) => {
      const preset = FACTORY_PRESETS[index];
      if (!preset) return {};
      const steps = preset.steps.length;
      const hits: Hit[] = [];
      preset.steps.forEach((slice, step) => {
        if (slice >= 0) hits.push({ step, slice: slice % s.sliceCount, pitch: 0, reverse: false, gain: 1, ratchet: 1 });
      });
      return {
        pattern: createEmptyPattern({ steps, bars: 1, bpm: preset.bpm, gate: s.pattern.gate, hits, fx: s.pattern.fx }),
        statusMessage: `Loaded preset: ${preset.name}`,
      };
    }),

  setPlaying: (v) => set({ isPlaying: v }),
  setCurrentStep: (step) => set({ currentStep: step }),
  setSampleLoaded: (v) => set({ sampleLoaded: v }),
  setStatus: (msg) => set({ statusMessage: msg }),

  setDensity: (v) => set({ density: clamp(v, 0, 1) }),
  setGhostDensity: (v) => set({ ghostDensity: clamp(v, 0, 1) }),
  setHumanizeAmt: (v) => set({ humanizeAmt: clamp(v, 0, 1) }),
  setGenSwing: (v) => set({ genSwing: clamp(v, 0, 0.75) }),
  setAddFill: (v) => set({ addFill: v }),
}));

// re-export for convenience in tests/components
export { getHit };
