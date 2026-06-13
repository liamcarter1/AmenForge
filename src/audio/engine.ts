/**
 * Realtime transport engine.
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
  private started = false;
  private stepListener: StepListener | null = null;
  audioBuffer: AudioBuffer | null = null;

  constructor() {
    this.voices.connect(this.fx.input);
    this.fx.connect(Tone.getDestination());
  }

  async unlock(): Promise<void> {
    if (!this.started) {
      await Tone.start();
      this.started = true;
    }
  }

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
    if (slices.length < 4) slices = equalSlices(audioBuffer.length, 16);
    this.slices = slices;
    return slices;
  }

  getSlices(): SliceRange[] { return this.slices; }
  setSlices(slices: SliceRange[]): void { this.slices = slices; }

  setPattern(pattern: Pattern): void {
    const wasPlaying = this.repeatId !== null;
    const tempoChanged = this.pattern?.bpm !== pattern.bpm || this.pattern?.steps !== pattern.steps;
    this.pattern = pattern;
    this.fx.apply(pattern.fx);
    Tone.getTransport().bpm.value = pattern.bpm;
    if (wasPlaying && tempoChanged) this.reschedule();
  }

  setStepListener(fn: StepListener | null): void { this.stepListener = fn; }

  auditionSlice(sliceIndex: number, pitch = 0, reverse = false): void {
    if (this.slices.length === 0) return;
    const slice = this.slices[sliceIndex % this.slices.length];
    this.voices.trigger(slice, { pitch, reverse, gain: 1, time: Tone.now() });
  }

  private stepDurationSec(p: Pattern): number {
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
      const sub = stepDur / ratchet;
      for (let j = 0; j < ratchet; j++) {
        this.voices.trigger(slice, {
          pitch: hit.pitch,
          reverse: hit.reverse,
          gain: hit.gain,
          time: time + swing + j * sub,
          maxDuration: sub * 1.8,
        });
      }
    }
    void semitonesToRate;
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

  get isPlaying(): boolean { return this.repeatId !== null; }

  dispose(): void {
    this.stop();
    this.voices.dispose();
    this.fx.dispose();
  }
}
