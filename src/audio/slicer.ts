/**
 * Slice-boundary maths — pure, no audio dependencies.
 */

export interface SliceRange {
  index: number;
  start: number;
  end: number;
}

export function equalSlices(totalFrames: number, count: number): SliceRange[] {
  const n = Math.max(1, Math.floor(count));
  const total = Math.max(0, Math.floor(totalFrames));
  if (total === 0) return [];
  const size = total / n;
  const out: SliceRange[] = [];
  for (let i = 0; i < n; i++) {
    const start = Math.round(i * size);
    const end = i === n - 1 ? total : Math.round((i + 1) * size);
    if (end > start) out.push({ index: out.length, start, end });
  }
  return out;
}

export function slicesFromOnsets(onsets: number[], totalFrames: number, minFrames = 256): SliceRange[] {
  const total = Math.max(0, Math.floor(totalFrames));
  if (total === 0) return [];
  const sorted = [...new Set(onsets.map((o) => Math.max(0, Math.min(total, Math.floor(o)))))].sort(
    (a, b) => a - b,
  );
  if (sorted.length === 0 || sorted[0] !== 0) sorted.unshift(0);

  const boundaries: number[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - boundaries[boundaries.length - 1] >= minFrames && sorted[i] < total) {
      boundaries.push(sorted[i]);
    }
  }

  const out: SliceRange[] = [];
  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i];
    const end = i + 1 < boundaries.length ? boundaries[i + 1] : total;
    if (end > start) out.push({ index: out.length, start, end });
  }
  return out;
}

export function sliceDurationSec(slice: SliceRange, sampleRate: number): number {
  if (sampleRate <= 0) return 0;
  return (slice.end - slice.start) / sampleRate;
}

export function inferRoles(sliceCount: number, brightness?: number[]): {
  kick: number;
  snare: number;
  ghosts: number[];
} {
  if (sliceCount <= 0) return { kick: 0, snare: 0, ghosts: [0] };
  if (sliceCount === 1) return { kick: 0, snare: 0, ghosts: [0] };
  let kick = 0;
  let snare = 1;
  if (brightness && brightness.length === sliceCount) {
    let minB = Infinity;
    let maxB = -Infinity;
    for (let i = 0; i < sliceCount; i++) {
      if (brightness[i] < minB) { minB = brightness[i]; kick = i; }
      if (brightness[i] > maxB) { maxB = brightness[i]; snare = i; }
    }
    if (snare === kick) snare = (kick + 1) % sliceCount;
  }
  const ghosts: number[] = [];
  for (let i = 0; i < sliceCount; i++) if (i !== kick && i !== snare) ghosts.push(i);
  return { kick, snare, ghosts: ghosts.length ? ghosts : [kick] };
}
