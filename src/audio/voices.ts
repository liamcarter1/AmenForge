/**
 * Polyphonic slice playback.
 *
 * Wraps the loaded break in a Tone buffer and triggers individual slices as
 * one-shot ToneBufferSources with per-hit pitch (playbackRate), reverse, and
 * gain. A short fade in/out avoids clicks at slice edges. Browser only.
 */
import * as Tone from "tone";
import type { SliceRange } from "./slicer";
import { semitonesToRate } from "../state/pattern";

export interface TriggerOptions {
  pitch: number; // semitones
  reverse: boolean;
  gain: number; // 0..1
  /** Transport time (seconds) to start at. */
  time: number;
  /** Optional hard duration cap in seconds (for tight chops / ratchets). */
  maxDuration?: number;
  /** Chop length 0..1: scales the slice's natural length (1 = full ring-out). */
  gate?: number;
}

const EDGE_FADE = 0.003; // 3 ms

/** Build a channel-reversed copy of an AudioBuffer (for reverse playback). */
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

  /** Trigger one slice. No-op if no buffer is loaded. */
  trigger(slice: SliceRange, opts: TriggerOptions): void {
    if (!this.buffer || !this.buffer.loaded || !this.reversed) return;

    const sliceSec = (slice.end - slice.start) / this.sampleRate;
    if (sliceSec <= 0) return;
    // Gate scales the slice's natural length; maxDuration (ratchets) caps it.
    const gate = opts.gate === undefined ? 1 : Math.min(1, Math.max(0, opts.gate));
    let playSec = Math.max(0.02, sliceSec * gate);
    if (opts.maxDuration) playSec = Math.min(playSec, opts.maxDuration);

    // For reverse, play the mirrored region out of the pre-reversed buffer.
    const buf = opts.reverse ? this.reversed : this.buffer;
    const offsetSec = opts.reverse
      ? (this.totalFrames - slice.end) / this.sampleRate
      : slice.start / this.sampleRate;

    // Proportional fade-out: short (gated) chops decay smoothly instead of
    // clicking; full-length chops still get a clean ~15 ms tail.
    const fadeOut = Math.min(0.015, playSec * 0.4);
    const src = new Tone.ToneBufferSource({
      url: buf,
      playbackRate: semitonesToRate(opts.pitch),
      fadeIn: EDGE_FADE,
      fadeOut: Math.max(EDGE_FADE, fadeOut),
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

  /** Stop and dispose every active voice immediately. */
  stopAll(): void {
    for (const src of this.active) {
      try {
        src.stop();
      } catch {
        // already stopped
      }
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
