/**
 * Pad bank for auditioning slices live.
 */
import { useEffect, useState, useCallback } from "react";
import { useStore } from "../state/store";

const KEY_MAP = "12345678qwertyui".split("");

interface Props {
  onAudition: (sliceIndex: number) => void;
}

export function PadBank({ onAudition }: Props) {
  const sliceCount = useStore((s) => s.sliceCount);
  const selectedSlice = useStore((s) => s.selectedSlice);
  const selectSlice = useStore((s) => s.selectSlice);
  const roles = useStore((s) => s.roles);
  const [flash, setFlash] = useState<number | null>(null);

  const hit = useCallback(
    (i: number) => {
      if (i < 0 || i >= sliceCount) return;
      selectSlice(i);
      onAudition(i);
      setFlash(i);
      window.setTimeout(() => setFlash((f) => (f === i ? null : f)), 110);
    },
    [sliceCount, selectSlice, onAudition],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const idx = KEY_MAP.indexOf(e.key.toLowerCase());
      if (idx >= 0 && idx < sliceCount) hit(idx);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hit, sliceCount]);

  const pads = Array.from({ length: sliceCount }, (_, i) => i);

  return (
    <div className="panel">
      <h2>Pads · play slices live</h2>
      <div className="pads">
        {pads.map((i) => {
          const role = i === roles.kick ? "kick" : i === roles.snare ? "snare" : "";
          const cls = ["pad", role, i === selectedSlice ? "selected" : "", flash === i ? "flash" : ""]
            .filter(Boolean)
            .join(" ");
          return (
            <button key={i} className={cls} onClick={() => hit(i)} aria-label={`pad slice ${i}`}>
              <span className="key">{KEY_MAP[i]?.toUpperCase() ?? "·"}</span>
              <span>{i === roles.kick ? "kick" : i === roles.snare ? "snare" : `sl ${i}`}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
