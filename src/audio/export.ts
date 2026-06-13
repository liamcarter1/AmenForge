/**
 * Offline render → WAV export.
 *
 * Re-plays the pattern through an OfflineAudioContext (no realtime transport),
 * scheduling each hit as a plain AudioBufferSource so the bounce is
 * sample-accurate and deterministic. Each trigger plays a freshly-extracted
 * slice buffer (optionally reversed), pitched via playbackRate. Browser only.
 */
import type { Pattern } from "../state/pattern";
import { totalSteps, hitsAtStep, stepsToNextHit, semitonesToRate } from "../state/pattern";
import type { SliceRange } from "./slicer";
import { encodeWav } from "./buffer";

const EDGE_FADE = 0.003; // 3 ms, matches the realtime voices

/** Build a channel-reversed copy of the full buffer (for reverse playback). */
function makeReversedBuffer(ctx: BaseAudioContext, source: AudioBuffer): AudioBuffer {
  const out = ctx.createBuffer(source.numberOfChannels, source.length, source.sampleRate);
  for (let c = 0; c < source.numberOfChannels; c++) {
    const src = source.getChannelData(c);
    const dst = out.getChannelData(c);
    const n = src.length;
    for (let i = 0; i < n; i++) dst[i] = src[n - 1 - i];
  }
  return out;
}

export interface RenderResult {
  wav: ArrayBuffer;
  durationSec: number;
}

/**
 * Render `pattern` over its full length (steps × bars) plus a short tail.
 * Returns a PCM16 WAV ArrayBuffer.
 */
export async function renderPatternToWav(
  audioBuffer: AudioBuffer,
  slices: SliceRange[],
  pattern: Pattern,
  repeats = 1,
): Promise<RenderResult> {
  if (slices.length === 0) throw new Error("renderPatternToWav: no slices");
  const sampleRate = audioBuffer.sampleRate;
  const secPerBeat = 60 / pattern.bpm;
  const stepDur = (secPerBeat * 4) / pattern.steps;
  const total = totalSteps(pattern);
  const loops = Math.max(1, Math.floor(repeats));
  // Generous tail so a full-length chop on the final step rings out rather than
  // being clipped at the render boundary.
  const tail = 1.0;
  const durationSec = total * stepDur * loops + tail;
  const frames = Math.ceil(durationSec * sampleRate);

  const OfflineCtor =
    (globalThis as unknown as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext;
  if (!OfflineCtor) throw new Error("OfflineAudioContext unavailable in this environment");
  const ctx = new OfflineCtor(audioBuffer.numberOfChannels, frames, sampleRate);

  // Read forward from the source and reverse from a pre-mirrored copy, both full
  // length — so a sustained chop can bleed past its slice.end into the following
  // break audio, exactly like the realtime engine (src/audio/voices.ts).
  const forward = audioBuffer;
  const reversed = makeReversedBuffer(ctx, audioBuffer);
  const totalFrames = audioBuffer.length;
  const totalDurSec = totalFrames / sampleRate;
  const gate = Math.min(1, Math.max(0.05, pattern.gate));

  /** Schedule one voice: full buffer read from `offsetSec` for `playSec`, with
   *  short gain ramps for click-free (cross-)fades. Mirrors voices.trigger(). */
  const scheduleVoice = (
    slice: SliceRange,
    hit: { reverse: boolean; pitch: number; gain: number },
    at: number,
    playSec: number,
    fadeOut: number,
  ): void => {
    const buf = hit.reverse ? reversed : forward;
    const offsetSec = hit.reverse ? (totalFrames - slice.end) / sampleRate : slice.start / sampleRate;
    const avail = Math.max(0, totalDurSec - offsetSec);
    const dur = Math.min(playSec, avail);
    if (dur <= 0) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = semitonesToRate(hit.pitch);
    const gain = ctx.createGain();
    const peak = Math.max(0, hit.gain);
    const fadeIn = Math.min(EDGE_FADE, dur * 0.5);
    const fo = Math.min(fadeOut, dur - fadeIn);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(peak, at + fadeIn);
    if (fo > 0) gain.gain.setValueAtTime(peak, at + dur - fo);
    gain.gain.linearRampToValueAtTime(0, at + dur);
    src.connect(gain).connect(ctx.destination);
    src.start(at, offsetSec);
    src.stop(at + dur);
  };

  for (let loop = 0; loop < loops; loop++) {
    const loopStart = loop * total * stepDur;
    for (let step = 0; step < total; step++) {
      const swing = step % 2 === 1 ? Math.min(0.75, pattern.swing) * 0.5 * stepDur : 0;
      const when = loopStart + step * stepDur + swing;
      const slotSec = stepsToNextHit(pattern, step) * stepDur;
      for (const hit of hitsAtStep(pattern, step)) {
        const slice = slices[hit.slice % slices.length];
        const sliceSec = (slice.end - slice.start) / sampleRate;
        const ratchet = Math.max(1, hit.ratchet);
        if (ratchet === 1) {
          // Single hit sustains across its slot (gate × time-to-next-hit) with a
          // crossfade tail so chops reconstruct the break gaplessly at gate 1.
          const tail = Math.min(0.012, slotSec * 0.25) * gate;
          const playSec = Math.max(0.02, slotSec * gate) + tail;
          scheduleVoice(slice, hit, when, playSec, Math.max(EDGE_FADE, tail));
        } else {
          // Ratchet roll: tight retriggers of the slice, each capped so the
          // stutters stay distinct (gate scales the slice's own length here).
          const sub = stepDur / ratchet;
          const playSec = Math.min(Math.max(0.02, sliceSec * gate), sub * 1.8);
          const fadeOut = Math.min(0.015, playSec * 0.4);
          for (let j = 0; j < ratchet; j++) {
            scheduleVoice(slice, hit, when + j * sub, playSec, fadeOut);
          }
        }
      }
    }
  }

  const rendered = await ctx.startRendering();
  const channels: Float32Array[] = [];
  for (let c = 0; c < rendered.numberOfChannels; c++) channels.push(rendered.getChannelData(c));
  return { wav: encodeWav(channels, sampleRate), durationSec };
}
