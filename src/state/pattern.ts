/**
 * The Pattern data model — the single source of truth that the sequencer,
 * generative engine, and audio engine all read from and write to.
 *
 * A Pattern is a list of Hits on a step grid. Each Hit triggers one slice of
 * the loaded break at a given step, with per-hit pitch / reverse / gain and an
 * optional `ratchet` count for rolls (the slice retriggers N times inside its
 * step). Keeping this as plain serialisable data (no class, no audio refs)
 * means it can be saved, shared by URL, diffed, and unit-tested trivially.
 */

export interface Hit {
  /** Step index, 0 .. (steps-1). */
  step: number;
  /** Index into the slice pool. */
  slice: number;
  /** Pitch offset in semitones; drives playbackRate. */
  pitch: number;
  /** Play the slice reversed. */
  reverse: boolean;
  /** Linear gain 0..1 (ghost notes use low gain). */
  gain: number;
  /** Sub-retriggers within the step for rolls (1 = a single hit). */
  ratchet: number;
}

export interface FxParams {
  reverb: number; // 0..1 wet
  delay: number; // 0..1 wet
  crush: number; // 0..1 amount
  filter: number; // 0..1 (0 = closed lowpass, 1 = open)
}

export interface Pattern {
  bpm: number;
  steps: number; // steps per bar
  bars: number;
  swing: number; // 0..1, MPC-style off-beat delay
  hits: Hit[];
  fx: FxParams;
}

export const PATTERN_LIMITS = {
  bpm: { min: 60, max: 220 },
  steps: { min: 4, max: 32 },
  bars: { min: 1, max: 8 },
  swing: { min: 0, max: 0.75 },
  pitch: { min: -24, max: 24 },
  gain: { min: 0, max: 1 },
  ratchet: { min: 1, max: 8 },
} as const;

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function defaultFx(): FxParams {
  return { reverb: 0, delay: 0, crush: 0, filter: 1 };
}

export function createEmptyPattern(partial: Partial<Pattern> = {}): Pattern {
  return {
    bpm: clamp(partial.bpm ?? 170, PATTERN_LIMITS.bpm.min, PATTERN_LIMITS.bpm.max),
    steps: clamp(partial.steps ?? 16, PATTERN_LIMITS.steps.min, PATTERN_LIMITS.steps.max),
    bars: clamp(partial.bars ?? 1, PATTERN_LIMITS.bars.min, PATTERN_LIMITS.bars.max),
    swing: clamp(partial.swing ?? 0, PATTERN_LIMITS.swing.min, PATTERN_LIMITS.swing.max),
    hits: partial.hits ? partial.hits.map(normaliseHit) : [],
    fx: { ...defaultFx(), ...partial.fx },
  };
}

/** Total number of steps across all bars. */
export function totalSteps(p: Pattern): number {
  return p.steps * p.bars;
}

export function makeHit(partial: Partial<Hit> & Pick<Hit, "step" | "slice">): Hit {
  return normaliseHit({
    step: partial.step,
    slice: partial.slice,
    pitch: partial.pitch ?? 0,
    reverse: partial.reverse ?? false,
    gain: partial.gain ?? 1,
    ratchet: partial.ratchet ?? 1,
  });
}

/** Coerce a possibly-untrusted hit into valid ranges. */
export function normaliseHit(h: Hit): Hit {
  return {
    step: Math.max(0, Math.floor(h.step)),
    slice: Math.max(0, Math.floor(h.slice)),
    pitch: clamp(Math.round(h.pitch), PATTERN_LIMITS.pitch.min, PATTERN_LIMITS.pitch.max),
    reverse: Boolean(h.reverse),
    gain: clamp(h.gain, PATTERN_LIMITS.gain.min, PATTERN_LIMITS.gain.max),
    ratchet: clamp(Math.round(h.ratchet), PATTERN_LIMITS.ratchet.min, PATTERN_LIMITS.ratchet.max),
  };
}

function hitKey(step: number, slice: number): string {
  return `${step}:${slice}`;
}

export function toggleHit(p: Pattern, step: number, slice: number, defaults: Partial<Hit> = {}): Pattern {
  const key = hitKey(step, slice);
  const exists = p.hits.some((h) => hitKey(h.step, h.slice) === key);
  const hits = exists
    ? p.hits.filter((h) => hitKey(h.step, h.slice) !== key)
    : [...p.hits, makeHit({ step, slice, ...defaults })];
  return { ...p, hits };
}

/** Replace (or insert) a hit, keyed by step+slice. Returns a new pattern. */
export function setHit(p: Pattern, hit: Hit): Pattern {
  const key = hitKey(hit.step, hit.slice);
  const others = p.hits.filter((h) => hitKey(h.step, h.slice) !== key);
  return { ...p, hits: [...others, normaliseHit(hit)] };
}

export function getHit(p: Pattern, step: number, slice: number): Hit | undefined {
  const key = hitKey(step, slice);
  return p.hits.find((h) => hitKey(h.step, h.slice) === key);
}

/** All hits scheduled on a given step, sorted by slice. */
export function hitsAtStep(p: Pattern, step: number): Hit[] {
  return p.hits.filter((h) => h.step === step).sort((a, b) => a.slice - b.slice);
}

export function clearPattern(p: Pattern): Pattern {
  return { ...p, hits: [] };
}

const PATTERN_VERSION = 1;

interface SerialisedPattern extends Pattern {
  v: number;
}

export function serializePattern(p: Pattern): string {
  const out: SerialisedPattern = { v: PATTERN_VERSION, ...p };
  return JSON.stringify(out);
}

export function deserializePattern(json: string): Pattern {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return createEmptyPattern();
  }
  if (typeof raw !== "object" || raw === null) return createEmptyPattern();
  const obj = raw as Record<string, unknown>;
  const hits = Array.isArray(obj.hits)
    ? (obj.hits as unknown[])
        .filter((h): h is Record<string, unknown> => typeof h === "object" && h !== null)
        .filter((h) => typeof h.step === "number" && typeof h.slice === "number")
        .map((h) =>
          normaliseHit({
            step: h.step as number,
            slice: h.slice as number,
            pitch: typeof h.pitch === "number" ? h.pitch : 0,
            reverse: Boolean(h.reverse),
            gain: typeof h.gain === "number" ? h.gain : 1,
            ratchet: typeof h.ratchet === "number" ? (h.ratchet as number) : 1,
          }),
        )
    : [];
  const fx = (typeof obj.fx === "object" && obj.fx !== null ? obj.fx : {}) as Partial<FxParams>;
  return createEmptyPattern({
    bpm: typeof obj.bpm === "number" ? obj.bpm : undefined,
    steps: typeof obj.steps === "number" ? obj.steps : undefined,
    bars: typeof obj.bars === "number" ? obj.bars : undefined,
    swing: typeof obj.swing === "number" ? obj.swing : undefined,
    hits,
    fx: {
      reverb: typeof fx.reverb === "number" ? clamp(fx.reverb, 0, 1) : 0,
      delay: typeof fx.delay === "number" ? clamp(fx.delay, 0, 1) : 0,
      crush: typeof fx.crush === "number" ? clamp(fx.crush, 0, 1) : 0,
      filter: typeof fx.filter === "number" ? clamp(fx.filter, 0, 1) : 1,
    },
  });
}

/** Semitone offset -> playback rate multiplier (equal temperament). */
export function semitonesToRate(semitones: number): number {
  return Math.pow(2, semitones / 12);
}
