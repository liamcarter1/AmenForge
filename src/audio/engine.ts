/**
 * Realtime transport engine.
 *
 * Owns the Tone transport, the slice voices, and the master FX chain. Walks
 * the current Pattern step-by-step, applying swing (off-beats nudged later)
 * and ratchet expansion (a hit retriggers N times inside its step). The engine
 * reads a Pattern snapshot; the React layer pushes new snapshots via
 * setPattern(). Browser only.
 */
import * as Tone from "tone";
import type { Pattern } from "../state/pattern";
import { totalSteps, hitsAtStep, semitonesToRate } from "../state/pattern";
import type { SliceRange } from "./slicer";
import { slicesFromOnsets, equalSlices } from "./slicer";
import { detectOnsets } from "./onset";
import { toMono } from "./buffer";
import { SliceVoices } from "./voices";
import { FxChain } from "./fx";

export type StepListener = (step: number) => void;

export class AudioEngine {
  private voices = new SliceVoices();
  private fx = new FxChain();
  private pattern: Pattern | null = null;
  private slices: SliceRange[] = [];
  private repeatId: number | null = null;
  private stepIndex = 0;
  private stepListener: StepListener | null = null;
  audioBuffer: AudioBuffer | null = null;

  constructor() {
    this.voices.connect(this.fx.input);
    this.fx.connect(Tone.getDestination());
  }

  /** Resume the audio context — must be called from a user gesture. */
  async unlock(): Promise<void> {
    // Always attempt to start/resume: a single boolean guard can get stuck
    // "true" after a resume that didn't actually take, leaving the context
    // suspended (Chrome: "AudioContext was not allowed to start"). Tone.start()
    // and resume() are both idempotent, so calling on every gesture is safe.
    await Tone.start();
    const ctx = Tone.getContext();
    if (ctx.state !== "running") {
      try {
        await ctx.resume();
      } catch {
        // resume() can reject if not invoked from a user gesture; ignored.
      }
    }
  }

  /** Decode an audio file and auto-slice it via onset detection. */
  async loadSampleFromUrl(url: string): Promise<SliceRange[]> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load sample: ${res.status} ${res.statusText}`);
    const arr = await res.arrayBuffer();
    return this.loadSampleFromArrayBuffer(arr);
  }

  async loadSampleFromArrayBuffer(arr: ArrayBuffer): Promise<SliceRange[]> {
    const audioBuffer = await Tone.getContext().decodeAudioData(arr.slice(0));
    return this.setAudioBuffer(audioBuffer);
  }

  setAudioBuffer(audioBuffer: AudioBuffer): SliceRange[] {
    this.audioBuffer = audioBuffer;
    this.voices.setBuffer(audioBuffer);
    const mono = toMono(audioBuffer);
    const onsets = detectOnsets(mono, audioBuffer.sampleRate);
    let slices = slicesFromOnsets(onsets, audioBuffer.length);
    // Fall back to even division if detection found too few transients.
    if (slices.length < 4) slices = equalSlices(audioBuffer.length, 16);
    this.slices = slices;
    return slices;
  }

  getSlices(): SliceRange[] {
    return this.slices;
  }

  setSlices(slices: SliceRange[]): void {
    this.slices = slices;
  }

  setPattern(pattern: Pattern): void {
    const wasPlaying = this.repeatId !== null;
    const tempoChanged = this.pattern?.bpm !== pattern.bpm || this.pattern?.steps !== pattern.steps;
    this.pattern = pattern;
    this.fx.apply(pattern.fx);
    Tone.getTransport().bpm.value = pattern.bpm;
    if (wasPlaying && tempoChanged) this.reschedule();
  }

  setStepListener(fn: StepListener | null): void {
    this.stepListener = fn;
  }

  /** Audition a single slice immediately (pad press). */
  auditionSlice(sliceIndex: number, pitch = 0, reverse = false): void {
    if (this.slices.length === 0) return;
    const slice = this.slices[sliceIndex % this.slices.length];
    this.voices.trigger(slice, { pitch, reverse, gain: 1, time: Tone.now() });
  }

  private stepDurationSec(p: Pattern): number {
    // One bar = 4 beats; a step is (4 / steps) beats.
    const secPerBeat = 60 / p.bpm;
    return (secPerBeat * 4) / p.steps;
  }

  private triggerStep(step: number, time: number, stepDur: number): void {
    const p = this.pattern;
    if (!p || this.slices.length === 0) return;
    const swing = step % 2 === 1 ? Math.min(0.75, p.swing) * 0.5 * stepDur : 0;
    for (const hit of hitsAtStep(p, step)) {
      const slice = this.slices[hit.slice % this.slices.length];
      const ratchet = Math.max(1, hit.ratchet);
      if (ratchet === 1) {
        // Single hit: the chop plays for `gate` × its natural length (the slice
        // shown in the waveform). gate = 1 rings out fully; lower = tighter.
        this.voices.trigger(slice, {
          pitch: hit.pitch,
          reverse: hit.reverse,
          gain: hit.gain,
          time: time + swing,
          gate: p.gate,
        });
      } else {
        // Ratchet roll: tight retriggers, also capped so the stutters stay distinct.
        const sub = stepDur / ratchet;
        for (let j = 0; j < ratchet; j++) {
          this.voices.trigger(slice, {
            pitch: hit.pitch,
            reverse: hit.reverse,
            gain: hit.gain,
            time: time + swing + j * sub,
            maxDuration: sub * 1.8,
            gate: p.gate,
          });
        }
      }
    }
    // Drive the playback rate hint (so reverse/pitch read clean even at edges).
    void semitonesToRate; // referenced for clarity; per-hit rate set in voices
  }

  private reschedule(): void {
    const transport = Tone.getTransport();
    if (this.repeatId !== null) {
      transport.clear(this.repeatId);
      this.repeatId = null;
    }
    const p = this.pattern;
    if (!p) return;
    const stepDur = this.stepDurationSec(p);
    const total = totalSteps(p);
    this.repeatId = transport.scheduleRepeat((time) => {
      const step = this.stepIndex % total;
      this.triggerStep(step, time, stepDur);
      if (this.stepListener) Tone.getDraw().schedule(() => this.stepListener?.(step), time);
      this.stepIndex += 1;
    }, stepDur);
  }

  async play(): Promise<void> {
    await this.unlock();
    if (!this.pattern) return;
    this.stepIndex = 0;
    this.reschedule();
    Tone.getTransport().start();
  }

  stop(): void {
    const transport = Tone.getTransport();
    transport.stop();
    if (this.repeatId !== null) {
      transport.clear(this.repeatId);
      this.repeatId = null;
    }
    this.voices.stopAll();
    this.stepIndex = 0;
    if (this.stepListener) this.stepListener(-1);
  }

  get isPlaying(): boolean {
    return this.repeatId !== null;
  }

  dispose(): void {
    this.stop();
    this.voices.dispose();
    this.fx.dispose();
  }
}
