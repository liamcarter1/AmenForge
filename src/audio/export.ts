/**
 * Offline render → WAV export.
 *
 * Re-plays the pattern through an OfflineAudioContext (no realtime transport),
 * scheduling each hit as a plain AudioBufferSource so the bounce is
 * sample-accurate and deterministic. Each trigger plays a freshly-extracted
 * slice buffer (optionally reversed), pitched via playbackRate. Browser only.
 */
import type { Pattern } from "../state/pattern";
import { totalSteps, hitsAtStep, semitonesToRate } from "../state/pattern";
import type { SliceRange } from "./slicer";
import { encodeWav } from "./buffer";

/** Extract one slice into a standalone AudioBuffer, optionally reversed. */
function extractSlice(
  ctx: BaseAudioContext,
  source: AudioBuffer,
  slice: SliceRange,
  reverse: boolean,
): AudioBuffer {
  const len = Math.max(1, slice.end - slice.start);
  const out = ctx.createBuffer(source.numberOfChannels, len, source.sampleRate);
  for (let c = 0; c < source.numberOfChannels; c++) {
    const src = source.getChannelData(c);
    const dst = out.getChannelData(c);
    for (let i = 0; i < len; i++) {
      const idx = slice.start + i;
      dst[i] = idx < src.length ? src[reverse ? slice.end - 1 - i : idx] : 0;
    }
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

  for (let loop = 0; loop < loops; loop++) {
    const loopStart = loop * total * stepDur;
    for (let step = 0; step < total; step++) {
      const swing = step % 2 === 1 ? Math.min(0.75, pattern.swing) * 0.5 * stepDur : 0;
      const when = loopStart + step * stepDur + swing;
      for (const hit of hitsAtStep(pattern, step)) {
        const slice = slices[hit.slice % slices.length];
        const ratchet = Math.max(1, hit.ratchet);
        const sub = stepDur / ratchet;
        const buf = extractSlice(ctx, audioBuffer, slice, hit.reverse);
        const rate = semitonesToRate(hit.pitch);
        // Gate scales the slice's natural length (1 = full ring-out); rolls are
        // additionally capped so the stutters stay tight.
        const gate = Math.min(1, Math.max(0.05, pattern.gate));
        const gatedDur = Math.max(0.02, (buf.duration / rate) * gate);
        for (let j = 0; j < ratchet; j++) {
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.playbackRate.value = rate;
          const gain = ctx.createGain();
          gain.gain.value = Math.max(0, hit.gain);
          src.connect(gain).connect(ctx.destination);
          src.start(when + j * sub);
          const playDur = ratchet === 1 ? gatedDur : Math.min(sub * 1.8, gatedDur);
          src.stop(when + j * sub + playDur);
        }
      }
    }
  }

  const rendered = await ctx.startRendering();
  const channels: Float32Array[] = [];
  for (let c = 0; c < rendered.numberOfChannels; c++) channels.push(rendered.getChannelData(c));
  return { wav: encodeWav(channels, sampleRate), durationSec };
}
