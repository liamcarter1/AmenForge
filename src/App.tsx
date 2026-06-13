/**
 * AmenForge root. Owns the imperative AudioEngine, mirrors store ⇄ engine,
 * and orchestrates load / play / export. The store stays audio-free; this
 * component is the single bridge between React state and the Web Audio graph.
 */
import { useEffect, useRef, useState } from "react";
import { useStore } from "./state/store";
import { AudioEngine } from "./audio/engine";
import { toMono } from "./audio/buffer";
import { inferRoles } from "./audio/slicer";
import { renderPatternToWav } from "./audio/export";
import { TransportBar } from "./ui/TransportBar";
import { WaveformSlices } from "./ui/WaveformSlices";
import { PadBank } from "./ui/PadBank";
import { SequencerGrid } from "./ui/SequencerGrid";
import { GeneratePanel } from "./ui/GeneratePanel";
import { FxPanel } from "./ui/FxPanel";

const DEFAULT_SAMPLE_URL = "/samples/amen.wav";
const WAVE_POINTS = 1040;

function computePeaks(buffer: AudioBuffer): number[] {
  const mono = toMono(buffer);
  const peaks = new Array<number>(WAVE_POINTS).fill(0);
  const block = Math.max(1, Math.floor(mono.length / WAVE_POINTS));
  for (let i = 0; i < WAVE_POINTS; i++) {
    let max = 0;
    const start = i * block;
    const end = Math.min(start + block, mono.length);
    for (let j = start; j < end; j++) max = Math.max(max, Math.abs(mono[j]));
    peaks[i] = max;
  }
  return peaks;
}

export function App() {
  const engineRef = useRef<AudioEngine | null>(null);
  if (engineRef.current === null) engineRef.current = new AudioEngine();
  const engine = engineRef.current;

  const pattern = useStore((s) => s.pattern);
  const selectedSlice = useStore((s) => s.selectedSlice);
  const sampleLoaded = useStore((s) => s.sampleLoaded);
  const statusMessage = useStore((s) => s.statusMessage);

  const [peaks, setPeaks] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  // Wire the engine's step callback into the store once.
  // NOTE: we intentionally do NOT dispose the engine in this cleanup. The
  // engine is a page-lifetime singleton, and React StrictMode double-invokes
  // effects in dev (mount → cleanup → mount). Disposing here tears down the
  // audio graph on that simulated unmount and leaves a dead, silent engine.
  useEffect(() => {
    engine.setStepListener((step) => useStore.getState().setCurrentStep(step));
    return () => {
      engine.setStepListener(null);
    };
  }, [engine]);

  // Mirror every pattern change into the engine (incl. FX, tempo).
  useEffect(() => {
    engine.setPattern(pattern);
  }, [engine, pattern]);

  const afterLoad = (slices: number) => {
    const buf = engine.audioBuffer;
    const store = useStore.getState();
    const ranges = engine.getSlices();
    const roleGuess = inferRoles(ranges.length);
    store.setSliceCount(ranges.length, roleGuess);
    store.setSampleLoaded(true);
    store.setStatus(`Loaded break · ${slices} slices detected. Hit Play or Generate.`);
    if (buf) setPeaks(computePeaks(buf));
    // re-push pattern now that slices exist
    engine.setPattern(useStore.getState().pattern);
  };

  const loadDefault = async () => {
    setBusy(true);
    try {
      await engine.unlock();
      const ranges = await engine.loadSampleFromUrl(DEFAULT_SAMPLE_URL);
      afterLoad(ranges.length);
    } catch (err) {
      useStore.getState().setStatus(`Could not load default break: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const loadFile = async (file: File) => {
    setBusy(true);
    try {
      await engine.unlock();
      const arr = await file.arrayBuffer();
      const ranges = await engine.loadSampleFromArrayBuffer(arr);
      afterLoad(ranges.length);
    } catch (err) {
      useStore.getState().setStatus(`Could not load file: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const play = async () => {
    await engine.play();
    useStore.getState().setPlaying(true);
  };

  const stop = () => {
    engine.stop();
    useStore.getState().setPlaying(false);
  };

  const audition = (sliceIndex: number) => {
    void engine.unlock().then(() => engine.auditionSlice(sliceIndex));
  };

  const exportWav = async () => {
    const buf = engine.audioBuffer;
    if (!buf) return;
    setBusy(true);
    try {
      const { wav } = await renderPatternToWav(buf, engine.getSlices(), useStore.getState().pattern, 2);
      const blob = new Blob([wav], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "amenforge-beat.wav";
      a.click();
      URL.revokeObjectURL(url);
      useStore.getState().setStatus("Exported amenforge-beat.wav");
    } catch (err) {
      useStore.getState().setStatus(`Export failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <h1>
        Amen<span className="accent">Forge</span>
      </h1>
      <p className="subtitle">Chop the Amen break, sequence it, and generatively mangle it into jungle.</p>

      <TransportBar
        onPlay={play}
        onStop={stop}
        onLoadDefault={loadDefault}
        onLoadFile={loadFile}
        onExport={exportWav}
        busy={busy}
      />

      {sampleLoaded && (
        <WaveformSlices
          peaks={peaks}
          slices={engine.getSlices()}
          totalFrames={engine.audioBuffer?.length ?? 0}
          selectedSlice={selectedSlice}
          onSelectSlice={(i) => {
            useStore.getState().selectSlice(i);
            audition(i);
          }}
        />
      )}

      <GeneratePanel />
      <SequencerGrid />
      <PadBank onAudition={audition} />
      <FxPanel />

      <p className="status">{statusMessage}</p>
    </div>
  );
}
