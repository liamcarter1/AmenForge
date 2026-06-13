/**
 * Master FX sliders.
 */
import { useStore } from "../state/store";

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function FxPanel() {
  const fx = useStore((s) => s.pattern.fx);
  const setFx = useStore((s) => s.setFx);

  return (
    <div className="panel">
      <h2>Master FX</h2>
      <div className="row">
        <label className="control">
          <span>Filter <b>{pct(fx.filter)}</b></span>
          <input type="range" min={0} max={1} step={0.02} value={fx.filter} onChange={(e) => setFx({ filter: +e.target.value })} />
        </label>
        <label className="control">
          <span>Bitcrush <b>{pct(fx.crush)}</b></span>
          <input type="range" min={0} max={1} step={0.02} value={fx.crush} onChange={(e) => setFx({ crush: +e.target.value })} />
        </label>
        <label className="control">
          <span>Delay <b>{pct(fx.delay)}</b></span>
          <input type="range" min={0} max={1} step={0.02} value={fx.delay} onChange={(e) => setFx({ delay: +e.target.value })} />
        </label>
        <label className="control">
          <span>Reverb <b>{pct(fx.reverb)}</b></span>
          <input type="range" min={0} max={1} step={0.02} value={fx.reverb} onChange={(e) => setFx({ reverb: +e.target.value })} />
        </label>
      </div>
    </div>
  );
}
