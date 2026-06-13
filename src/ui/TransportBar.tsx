/**
 * Transport + global pattern controls: load, play/stop, BPM, swing, gate, grid
 * size, and WAV export.
 */
import { useStore } from "../state/store";

interface Props {
  onPlay: () => void;
  onStop: () => void;
  onLoadDefault: () => void;
  onLoadFile: (file: File) => void;
  onExport: () => void;
  busy: boolean;
}

export function TransportBar({ onPlay, onStop, onLoadDefault, onLoadFile, onExport, busy }: Props) {
  const isPlaying = useStore((s) => s.isPlaying);
  const sampleLoaded = useStore((s) => s.sampleLoaded);
  const pattern = useStore((s) => s.pattern);
  const setBpm = useStore((s) => s.setBpm);
  const setSwing = useStore((s) => s.setSwing);
  const setGate = useStore((s) => s.setGate);
  const setSteps = useStore((s) => s.setSteps);
  const setBars = useStore((s) => s.setBars);

  return (
    <div className="panel">
      <div className="row">
        <button onClick={onLoadDefault} disabled={busy}>
          ⤓ Load Amen break
        </button>
        <label className="control" style={{ minWidth: "auto" }}>
          <span>or your own</span>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onLoadFile(f);
            }}
          />
        </label>

        {isPlaying ? (
          <button className="primary" onClick={onStop}>
            ■ Stop
          </button>
        ) : (
          <button className="primary" onClick={onPlay} disabled={!sampleLoaded || busy}>
            ▶ Play
          </button>
        )}

        <button onClick={onExport} disabled={!sampleLoaded || busy}>
          ⬇ Export WAV
        </button>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <label className="control">
          <span>
            BPM <b>{pattern.bpm}</b>
          </span>
          <input type="range" min={60} max={220} step={1} value={pattern.bpm} onChange={(e) => setBpm(+e.target.value)} />
        </label>
        <label className="control">
          <span>
            Swing <b>{Math.round((pattern.swing / 0.75) * 100)}%</b>
          </span>
          <input type="range" min={0} max={0.75} step={0.03} value={pattern.swing} onChange={(e) => setSwing(+e.target.value)} />
        </label>
        <label className="control">
          <span>
            Gate <b>{Math.round(pattern.gate * 100)}%</b>
          </span>
          <input type="range" min={0.05} max={1} step={0.05} value={pattern.gate} onChange={(e) => setGate(+e.target.value)} />
        </label>
        <label className="control">
          <span>Steps</span>
          <select value={pattern.steps} onChange={(e) => setSteps(+e.target.value)}>
            {[8, 12, 16, 24, 32].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="control">
          <span>Bars</span>
          <select value={pattern.bars} onChange={(e) => setBars(+e.target.value)}>
            {[1, 2, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
