/**
 * Generative controls.
 */
import { useStore } from "../state/store";
import { FACTORY_PRESETS } from "../generate/presets";

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function GeneratePanel() {
  const density = useStore((s) => s.density);
  const ghostDensity = useStore((s) => s.ghostDensity);
  const humanizeAmt = useStore((s) => s.humanizeAmt);
  const genSwing = useStore((s) => s.genSwing);
  const addFill = useStore((s) => s.addFill);

  const setDensity = useStore((s) => s.setDensity);
  const setGhostDensity = useStore((s) => s.setGhostDensity);
  const setHumanizeAmt = useStore((s) => s.setHumanizeAmt);
  const setGenSwing = useStore((s) => s.setGenSwing);
  const setAddFill = useStore((s) => s.setAddFill);

  const generate = useStore((s) => s.generate);
  const mutate = useStore((s) => s.mutate);
  const addFillNow = useStore((s) => s.addFillNow);
  const clear = useStore((s) => s.clear);
  const loadPreset = useStore((s) => s.loadPreset);

  return (
    <div className="panel">
      <h2>Generate · the cool stuff</h2>
      <div className="row">
        <button className="primary" onClick={generate}>✨ Musical Randomize</button>
        <button onClick={mutate}>🧬 Mutate</button>
        <button onClick={addFillNow}>🥁 Add Fill</button>
        <button className="danger" onClick={clear}>Clear</button>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <label className="control">
          <span>Density <b>{pct(density)}</b></span>
          <input type="range" min={0} max={1} step={0.05} value={density} onChange={(e) => setDensity(+e.target.value)} />
        </label>
        <label className="control">
          <span>Ghosts <b>{pct(ghostDensity)}</b></span>
          <input type="range" min={0} max={1} step={0.05} value={ghostDensity} onChange={(e) => setGhostDensity(+e.target.value)} />
        </label>
        <label className="control">
          <span>Humanize <b>{pct(humanizeAmt)}</b></span>
          <input type="range" min={0} max={1} step={0.05} value={humanizeAmt} onChange={(e) => setHumanizeAmt(+e.target.value)} />
        </label>
        <label className="control">
          <span>Gen swing <b>{pct(genSwing / 0.75)}</b></span>
          <input type="range" min={0} max={0.75} step={0.03} value={genSwing} onChange={(e) => setGenSwing(+e.target.value)} />
        </label>
        <label className="control" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={addFill} onChange={(e) => setAddFill(e.target.checked)} />
          <span>End fill</span>
        </label>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <span className="tag">presets</span>
        {FACTORY_PRESETS.map((p, i) => (
          <button key={p.name} onClick={() => loadPreset(i)}>{p.name}</button>
        ))}
      </div>
    </div>
  );
}
