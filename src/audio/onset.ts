/**
 * Transient / onset detection — pure DSP over a mono Float32Array.
 */

export interface OnsetOptions {
  hopSize: number;
  sensitivity: number;
  minGapSec: number;
}

export const DEFAULT_ONSET_OPTIONS: OnsetOptions = {
  hopSize: 512,
  sensitivity: 1.4,
  minGapSec: 0.04,
};

export function frameEnergy(samples: Float32Array, hopSize: number): Float32Array {
  const hop = Math.max(1, Math.floor(hopSize));
  const frames = Math.ceil(samples.length / hop);
  const out = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const start = f * hop;
    const end = Math.min(start + hop, samples.length);
    for (let i = start; i < end; i++) sum += samples[i] * samples[i];
    out[f] = sum;
  }
  return out;
}

function mean(a: Float32Array): number {
  if (a.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return s / a.length;
}

function std(a: Float32Array, m: number): number {
  if (a.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - m;
    s += d * d;
  }
  return Math.sqrt(s / a.length);
}

export function detectOnsets(
  samples: Float32Array,
  sampleRate: number,
  options: Partial<OnsetOptions> = {},
): number[] {
  const opt = { ...DEFAULT_ONSET_OPTIONS, ...options };
  if (samples.length === 0 || sampleRate <= 0) return [0];

  const energy = frameEnergy(samples, opt.hopSize);
  if (energy.length < 2) return [0];

  const flux = new Float32Array(energy.length);
  flux[0] = 0;
  for (let i = 1; i < energy.length; i++) {
    flux[i] = Math.max(0, energy[i] - energy[i - 1]);
  }

  const m = mean(flux);
  const sd = std(flux, m);
  const threshold = m + opt.sensitivity * sd;
  const minGapFrames = Math.max(1, Math.round((opt.minGapSec * sampleRate) / opt.hopSize));

  const onsets: number[] = [0];
  let lastFrame = -minGapFrames;
  for (let i = 1; i < flux.length - 1; i++) {
    const isPeak = flux[i] > threshold && flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1];
    if (isPeak && i - lastFrame >= minGapFrames) {
      const sample = i * opt.hopSize;
      if (sample > 0) onsets.push(sample);
      lastFrame = i;
    }
  }
  return onsets;
}
