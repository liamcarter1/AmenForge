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
  /** Chop length 0..1: scales the playable slot (1 = sustain through it). */
  gate?: number;
  /**
   * Seconds until the next scheduled hit. When provided, gate scales THIS slot
   * (not the slice's own length) and the source reads continuously past
   * slice.end into the following break audio — so gate = 1 plays gaplessly and
   * the chops reconstruct the original break instead of leaving silent gaps.
   */
  slotSec?: number;
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
    const gate = opts.gate === undefined ? 1 : Math.min(1, Math.max(0, opts.gate));
    // With a slot (time to next hit), gate scales the slot and the chop sustains
    // into the following audio — gaplessly reconstructing the break at gate 1.
    // Without one (audition, ratchet sub-hits), gate scales the slice's own length.
    const sustaining = opts.slotSec !== undefined && opts.slotSec > 0;
    const base = sustaining ? (opts.slotSec as number) : sliceSec;
    let playSec = Math.max(0.02, base * gate);
    // Sustained chops bleed a touch past their slot so the fade-out overlaps the
    // next chop's onset — a short crossfade instead of an audible seam. Scaled by
    // gate so tight stabs (low gate) keep their gap and don't smear together.
    const tail = sustaining ? Math.min(0.012, base * 0.25) * gate : 0;
    playSec += tail;
    if (opts.maxDuration) playSec = Math.min(playSec, opts.maxDuration);

    // For reverse, play the mirrored region out of the pre-reversed buffer.
    const buf = opts.reverse ? this.reversed : this.buffer;
    const offsetSec = opts.reverse
      ? (this.totalFrames - slice.end) / this.sampleRate
      : slice.start / this.sampleRate;
    // Never read past the end of the buffer (sustain stops at the sample's end).
    const availableSec = Math.max(0, this.totalFrames / this.sampleRate - offsetSec);
    if (availableSec > 0) playSec = Math.min(playSec, availableSec);

    // Fade-out: sustained chops use the crossfade tail so consecutive chops blend
    // seamlessly; gated stabs decay over their tail; both stay click-free.
    const fadeOut = sustaining ? Math.max(EDGE_FADE, tail) : Math.min(0.015, playSec * 0.4);
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
