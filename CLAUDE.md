# CLAUDE.md — AmenForge

## Project Overview

AmenForge is a browser-based jungle/breakbeat workstation. The user loads a drum break (default: the Amen break at `public/samples/amen.wav`), the app auto-slices it via onset detection, and they sequence slices on a step grid — then use the generative engine to produce authentic jungle patterns (Musical Randomize, Euclidean rhythms, Markov chops, fills, mutate), mangle with FX, and export to WAV.

**Stack:** React 19 + TypeScript + Vite 8 + Tone.js 15 + Zustand 5 + Vitest 4

## Quick Start

```bash
cd amenforge
npm install
npm run dev        # http://localhost:5173
npm test           # 115 tests, all pure/Node-testable logic
npm run build      # tsc --noEmit + vite build
```

## Architecture

```
amen.wav (public/samples/) → AudioEngine.loadSampleFromUrl()
  → decodeAudioData() → detectOnsets() → slicesFromOnsets()
  → SliceVoices (per-hit AudioBufferSource) → FxChain → Tone.destination

Zustand store (audio-free) ← React UI components
  ↕
App.tsx (the bridge) → AudioEngine (imperative singleton)
```

### Key Design Rule: Audio / Logic Separation

The entire `src/generate/` directory and `src/state/` are **free of any Tone.js or Web Audio imports**. All generative logic is pure functions over plain data: unit-testable in Node (Vitest), musically critical code (Markov probabilities, Euclidean patterns, swing maths) independently verifiable.

`App.tsx` is the single bridge that subscribes to pattern changes and calls `engine.setPattern(pattern)`.

## Pattern Data Model (`src/state/pattern.ts`)

```ts
interface Hit {
  step: number;     // 0..(totalSteps-1)
  slice: number;    // index into slice pool
  pitch: number;    // semitones; drives AudioBufferSource.playbackRate
  reverse: boolean; // plays from the pre-reversed buffer
  gain: number;     // 0..1 (ghost notes ≈ 0.18-0.35)
  ratchet: number;  // sub-retriggers within the step (rolls)
}

interface Pattern {
  bpm: number; steps: number; bars: number; swing: number;
  hits: Hit[];
  fx: { reverb: number; delay: number; crush: number; filter: number };
}
```

Patterns are **immutable** (all mutations return new objects). `PATTERN_LIMITS` defines all field bounds; `clamp()` is canonical. Serialise/deserialise via `serializePattern` / `deserializePattern` — the latter is hostile-input safe.

## Generative Engine (`src/generate/`)

### Euclidean rhythms (`euclid.ts`)
`euclid(k, n)` uses canonical Bjorklund (not bucket approximation), always returns a pulse at index 0. Exhaustively verified for all k/n up to 16 in tests.

### Markov model (`markov.ts`)
First-order Markov chain over slice indices. Trained on `TRAINING_SEQUENCES` in `presets.ts` (8 hand-crafted jungle sequences). Seeded RNG (`mulberry32`) makes generation deterministic.

### Musical Randomize (`randomize.ts:generatePattern`)
1. Kick anchored on strong beats (downbeat + Euclidean spread)
2. Snare locked to backbeat (beats 2 & 4)
3. Remaining steps filled via Markov walk at configurable `density`
4. Ghost notes at `ghostDensity`
5. Velocity humanisation at `humanize`
6. Optional accelerating fill on final beat

### Fill generator (`fills.ts`)
`generateFill` ramps `ratchet` from `startRatchet` to `endRatchet` and sweeps `pitch` by `pitchSweep` semitones. Ratchet clamped to [1, 8].

### Mutate (`randomize.ts:mutatePattern`)
Nudges current pattern: repitches hits, flips reverse flags, removes/adds ghost hits. Deterministic per seed.

## Audio Engine (`src/audio/`)

### Onset detection (`onset.ts`)
Energy-flux peak-picker on mono mixdown. Threshold = `mean(flux) + sensitivity × std(flux)`. Falls back to `equalSlices(n=16)` if fewer than 4 transients detected.

### Slice playback (`voices.ts`)
`SliceVoices` holds forward buffer and precomputed reversed copy. **Tone 15 `ToneBufferSource` has no `.reverse` property** — reverse playback uses mirrored region: `offsetSec = (totalFrames - slice.end) / sampleRate`. 3 ms fade-in/out prevents clicks.

### Ratchets
N retriggers inside one step. Step duration divided by N; each retrigger gets `maxDuration = sub * 1.8`. Swing on first retrigger only.

### FX chain (`fx.ts`)
`input → Filter (lowpass) → BitCrusher → FeedbackDelay → Reverb → output`

**Gotcha:** `new Tone.BitCrusher({ bits: 16, wet: 0 })` throws a type error — `wet` is not in `BitCrusherWorkletOptions`. Always set `crusher.wet.value = 0` separately after construction.

### Transport (`engine.ts`)
`transport.scheduleRepeat` drives step clock. Swing: `swing * 0.5 * stepDuration` on odd steps. `Tone.getDraw().schedule` defers playhead updates to the animation frame.

### WAV export (`export.ts`)
`renderPatternToWav` uses `OfflineAudioContext`. Sample-accurate, includes swing and ratchets. Returns PCM16 stereo WAV.

## Zustand Store (`src/state/store.ts`)

Audio-free. Key actions: `toggleHit`, `updateHit`, `generate`, `mutate`, `addFillNow`, `loadPreset`, `setSliceCount`. `App.tsx` subscribes to `pattern` changes and calls `engine.setPattern(pattern)`.

## Known Gotchas

- **Tone 15**: `ToneBufferSource` has no `.reverse` — precompute reversed buffer.
- **Tone 15**: `BitCrusher` constructor does not accept `wet` in options — set `.wet.value` after construction.
- **Float32 precision in tests**: Use `toBeCloseTo()` not `toEqual()` for Float32-derived values.
- **Reversed buffer offset**: `(totalFrames - slice.end) / sampleRate` (mirror of forward offset).
- **Swing only affects odd steps** (MPC-style 16th-note swing).
- **Zustand**: Use `create<AppState>((set) => ({...}))` — unused `get` causes TS error.

## Testing

```bash
npm test              # run once (115 tests)
npm run test:watch    # watch mode
npm run typecheck     # tsc --noEmit
```

All test files in `tests/`. Pure logic tests use Node; UI tests use jsdom. Tone.js audio modules covered by typecheck + production build.

## Development Patterns

### Adding a new generative algorithm
1. `src/generate/my-algo.ts` — pure function, accepts `Rng` from `util/rng.ts`
2. Wire into `randomize.ts` or expose as standalone store action
3. Add store action in `store.ts`
4. Write tests
5. Add button in `GeneratePanel.tsx`

### Adding a new FX
1. Add Tone node to `FxChain` in `fx.ts`
2. Add field to `FxParams` in `pattern.ts`
3. Add to `setFx` in store
4. Add slider in `FxPanel.tsx`

### Modifying the Amen break sample
Swap `public/samples/amen.wav` — no code change needed. `DEFAULT_SAMPLE_URL = '/samples/amen.wav'` in `App.tsx`.
