# AmenForge

A browser-based jungle/breakbeat workstation built around the Amen break.
Load a drum break, chop it into slices, sequence them on a step grid, then use the generative engine to produce cutting-edge jungle patterns — and bounce to WAV.

Built with **React 19 · TypeScript · Vite 8 · Tone.js 15 · Zustand 5**

---

## Quick Start

```bash
npm install
npm run dev      # → http://localhost:5173
```

Click **Load Amen break**, then **Play** — or hit **✨ Musical Randomize** to generate a pattern immediately.

No API keys, no backend, no build step required to develop.

---

## Features

### The Slicer
The app decodes the audio file, runs an **energy-flux onset detector** to find the real kick/snare/hat transients, and builds a slice pool from those boundaries. No blind equal-division — the hits actually line up.

### The Step Sequencer
A step grid where **rows = slices** and **columns = steps** (8–32 steps, 1–8 bars).

| Interaction | Effect |
|---|---|
| Left-click | Toggle hit on/off |
| Right-click | Cycle ratchet count 1→2→3→4 (stutter rolls) |
| ⌥/Alt + click | Nudge pitch up a semitone |

### The Generative Engine

| Control | What it does |
|---|---|
| **✨ Musical Randomize** | Full generation: kick anchored on downbeats, snare on backbeats, remaining steps filled via Markov chain, ghost notes, humanised velocity, optional fill |
| **🧬 Mutate** | Nudges the current pattern (repitch, reverse, add/remove ghost hits) without wholesale regeneration |
| **🥁 Add Fill** | Drops an accelerating stutter roll on the last beat |
| **Density** | How densely the Markov walker fills non-structural steps |
| **Ghosts** | Probability of quiet ghost hits on empty steps |
| **Humanize** | Velocity jitter amount |
| **Gen swing** | Swing applied to the generated pattern |
| **End fill** | Toggle the automatic fill on Musical Randomize |

Four **factory presets**: Amen (straight), Think Roller, Double-Kick Stepper, Half-Time Crush.

### Live Pads
16 pads triggerable by **mouse click** or **computer keyboard** (`1-8`, `q-i`). Kick and snare pads are colour-coded.

### Master FX

| Knob | Effect |
|---|---|
| Filter | Lowpass 120 Hz → 18 kHz (exponential) |
| Bitcrush | 16-bit clean → 4-bit gnarly |
| Delay | Feedback delay wet mix |
| Reverb | Room reverb wet mix |

### WAV Export
Offline render via `OfflineAudioContext` — deterministic, sample-accurate, includes swing and ratchets.

---

## Architecture

```
amen.wav (public/samples/)
  → decodeAudioData()
  → detectOnsets()       energy-flux transient detector
  → slicesFromOnsets()   slice pool [start, end) sample ranges
  → SliceVoices          polyphonic AudioBufferSource playback
  → FxChain              filter → bitcrush → delay → reverb
  → Tone.destination

Zustand store (audio-free)  ←→  React UI
         ↕ (App.tsx is the bridge)
     AudioEngine (imperative singleton, owns Tone transport)
```

## File Structure

```
amenforge/
  public/
    samples/amen.wav          136 BPM Amen break (24-bit / 48 kHz stereo)
  src/
    util/rng.ts               Seeded PRNG (mulberry32)
    state/
      pattern.ts              Pattern + Hit data model; immutable helpers
      store.ts                Zustand state + all actions
    generate/
      euclid.ts               Bjorklund Euclidean generator
      markov.ts               Markov slice-sequencer
      humanize.ts             Swing, velocity jitter, ghost notes
      fills.ts                Accelerating roll / fill generator
      randomize.ts            Musical Randomize orchestrator + mutate
      presets.ts              Factory patterns + Markov training data
    audio/
      onset.ts                Energy-flux onset detector (pure DSP)
      slicer.ts               Slice boundary maths + role inference
      buffer.ts               Mono mixdown + PCM16 WAV encoder
      voices.ts               Polyphonic slice voices (pitch/reverse/ratchet)
      fx.ts                   Master FX chain
      engine.ts               Realtime transport + scheduling
      export.ts               Offline WAV render
    ui/
      SequencerGrid.tsx
      PadBank.tsx
      WaveformSlices.tsx
      TransportBar.tsx
      GeneratePanel.tsx
      FxPanel.tsx
    App.tsx
    main.tsx
    styles.css
  tests/                      12 test files, 115 tests
  CLAUDE.md
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc --noEmit` + production build |
| `npm run typecheck` | TypeScript check only |
| `npm test` | Vitest (115 tests) |
| `npm run test:watch` | Vitest watch mode |

## Test Coverage

115 unit tests across 12 files, all pure Node (no browser required).

## Browser Requirements

Web Audio API + AudioWorklet. Works in Chrome, Firefox, Safari, Edge. Click **Load** or **Play** to unlock the audio context.

## Sample Note

`public/samples/amen.wav` is from the MIT-licensed [`schollz/amen`](https://github.com/schollz/amen) project. For personal use. The loader is abstracted behind `DEFAULT_SAMPLE_URL` in `App.tsx` — swap in your own break with one line.
