/**
 * Polyphonic slice playback.
 */
import * as Tone from "tone";
import type { SliceRange } from "./slicer";
import { semitonesToRate } from "../state/pattern";

export interface TriggerOptions {
  pitch: number;
  reverse: boolean;
  gain: number;
  time: number;
  maxDuration?: number;
}

const EDGE_FADE = 0.003;

function makeReversedBuffer(source: AudioBuffer): AudioBuffer {
  const ctx = Tone.getContext();
  const out = ctx.createBuffer(source.numberOfChannels, source.length, source.sampleRate);
  for (let c = 0; c < source.numberOfChannels; c++) {
    const src = source.getChannelData(c);
    const dst = out.getChannelData(c);
    const n = src.length;
    for (let i = 0; i < n; i++) dst[i] = src[n - 1 - i];
  }
  return out;
}

export class SliceVoices {
  readonly output: Tone.Gain;
  private buffer: Tone.ToneAudioBuffer | null = null;
  private reversed: Tone.ToneAudioBuffer | null = null;
  private sampleRate = 44100;
  private totalFrames = 0;
  private active = new Set<Tone.ToneBufferSource>();

  constructor() {
    this.output = new Tone.Gain(1);
  }

  setBuffer(audioBuffer: AudioBuffer): void {
    this.buffer?.dispose();
    this.reversed?.dispose();
    this.buffer = new Tone.ToneAudioBuffer(audioBuffer);
    this.reversed = new Tone.ToneAudioBuffer(makeReversedBuffer(audioBuffer));
    this.sampleRate = audioBuffer.sampleRate;
    this.totalFrames = audioBuffer.length;
  }

  get loaded(): boolean {
    return this.buffer !== null && this.buffer.loaded;
  }

  get rate(): number {
    return this.sampleRate;
  }

  trigger(slice: SliceRange, opts: TriggerOptions): void {
    if (!this.buffer || !this.buffer.loaded || !this.reversed) return;

    const sliceSec = (slice.end - slice.start) / this.sampleRate;
    if (sliceSec <= 0) return;
    const playSec = opts.maxDuration ? Math.min(sliceSec, opts.maxDuration) : sliceSec;

    const buf = opts.reverse ? this.reversed : this.buffer;
    const offsetSec = opts.reverse
      ? (this.totalFrames - slice.end) / this.sampleRate
      : slice.start / this.sampleRate;

    const src = new Tone.ToneBufferSource({
      url: buf,
      playbackRate: semitonesToRate(opts.pitch),
      fadeIn: EDGE_FADE,
      fadeOut: EDGE_FADE,
    });
    const gain = new Tone.Gain(Math.max(0, opts.gain));
    src.connect(gain);
    gain.connect(this.output);

    src.onended = () => {
      this.active.delete(src);
      src.dispose();
      gain.dispose();
    };
    this.active.add(src);
    src.start(opts.time, offsetSec, playSec);
  }

  stopAll(): void {
    for (const src of this.active) {
      try { src.stop(); } catch { /* already stopped */ }
    }
  }

  connect(destination: Tone.InputNode): void {
    this.output.connect(destination);
  }

  dispose(): void {
    this.stopAll();
    this.buffer?.dispose();
    this.reversed?.dispose();
    this.output.dispose();
  }
}
