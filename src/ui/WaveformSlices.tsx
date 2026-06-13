/**
 * Waveform display with slice boundary markers.
 */
import { useEffect, useRef } from "react";
import type { SliceRange } from "../audio/slicer";

interface Props {
  peaks: number[];
  slices: SliceRange[];
  totalFrames: number;
  selectedSlice: number;
  onSelectSlice: (index: number) => void;
}

const WIDTH = 1040;
const HEIGHT = 120;

export function WaveformSlices({ peaks, slices, totalFrames, selectedSlice, onSelectSlice }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#1e2430";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const mid = HEIGHT / 2;
    ctx.strokeStyle = "#00e08a";
    ctx.beginPath();
    const n = peaks.length || 1;
    for (let x = 0; x < WIDTH; x++) {
      const p = peaks[Math.floor((x / WIDTH) * n)] ?? 0;
      const h = p * (HEIGHT / 2 - 2);
      ctx.moveTo(x + 0.5, mid - h);
      ctx.lineTo(x + 0.5, mid + h);
    }
    ctx.stroke();

    if (totalFrames > 0) {
      ctx.font = "10px sans-serif";
      slices.forEach((s) => {
        const x = (s.start / totalFrames) * WIDTH;
        const xEnd = (s.end / totalFrames) * WIDTH;
        if (s.index === selectedSlice) {
          ctx.fillStyle = "rgba(255,93,115,0.14)";
          ctx.fillRect(x, 0, xEnd - x, HEIGHT);
        }
        ctx.strokeStyle = "#ff5d73";
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, HEIGHT);
        ctx.stroke();
        ctx.fillStyle = "#8a93a6";
        ctx.fillText(String(s.index), x + 3, 12);
      });
    }
  }, [peaks, slices, totalFrames, selectedSlice]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (totalFrames <= 0 || slices.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const frame = frac * totalFrames;
    const found = slices.find((s) => frame >= s.start && frame < s.end) ?? slices[slices.length - 1];
    onSelectSlice(found.index);
  };

  return (
    <div className="panel">
      <h2>Break waveform · {slices.length} slices</h2>
      <canvas
        ref={ref}
        width={WIDTH}
        height={HEIGHT}
        className="waveform"
        onClick={onClick}
        aria-label="break waveform with slice markers"
      />
    </div>
  );
}
