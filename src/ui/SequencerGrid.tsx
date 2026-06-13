/**
 * The step sequencer grid. Rows = slices, columns = steps.
 * - left click / tap: toggle a hit
 * - right click / long-press (touch): cycle the ratchet count (rolls)
 * - alt/⌥ + click: nudge pitch up a semitone on an existing hit
 */
import React, { useRef } from "react";
import type { MouseEvent } from "react";
import { useStore } from "../state/store";
import { getHit, totalSteps } from "../state/pattern";

function sliceLabel(i: number, kick: number, snare: number): string {
  if (i === kick) return "KICK";
  if (i === snare) return "SNARE";
  return `slice ${i}`;
}

export function SequencerGrid() {
  const pattern = useStore((s) => s.pattern);
  const sliceCount = useStore((s) => s.sliceCount);
  const roles = useStore((s) => s.roles);
  const currentStep = useStore((s) => s.currentStep);
  const toggleHit = useStore((s) => s.toggleHit);
  const updateHit = useStore((s) => s.updateHit);

  // Long-press state for touch ratchet cycling
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);

  const total = totalSteps(pattern);
  const cols = Array.from({ length: total }, (_, i) => i);
  const rows = Array.from({ length: sliceCount }, (_, i) => i);

  // Mouse handlers (unchanged for desktop)
  const onCell = (e: MouseEvent, step: number, slice: number) => {
    const hit = getHit(pattern, step, slice);
    if (e.altKey && hit) {
      updateHit(step, slice, { pitch: hit.pitch >= 12 ? -12 : hit.pitch + 1 });
      return;
    }
    toggleHit(step, slice);
  };

  const onContext = (e: MouseEvent, step: number, slice: number) => {
    e.preventDefault();
    const hit = getHit(pattern, step, slice);
    if (hit) updateHit(step, slice, { ratchet: hit.ratchet >= 4 ? 1 : hit.ratchet + 1 });
  };

  // Touch handlers: short tap = toggle, long press (500 ms) = cycle ratchet
  const onTouchStart = (step: number, slice: number) => (_e: React.TouchEvent) => {
    longFired.current = false;
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      longFired.current = true;
      const hit = getHit(pattern, step, slice);
      if (hit) updateHit(step, slice, { ratchet: hit.ratchet >= 4 ? 1 : hit.ratchet + 1 });
    }, 500);
  };

  const onTouchEnd = (step: number, slice: number) => (e: React.TouchEvent) => {
    e.preventDefault(); // stop synthetic click from double-firing
    if (pressTimer.current !== null) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
      if (!longFired.current) toggleHit(step, slice);
    }
  };

  const onTouchMove = () => {
    // cancel long-press if the user is scrolling the grid
    if (pressTimer.current !== null) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  return (
    <div className="panel">
      <h2>Sequencer · {pattern.steps} steps × {pattern.bars} bar(s)</h2>
      <div className="grid-wrap">
        <div className="seq-grid" role="grid" aria-label="step sequencer">
          {rows.map((slice) => (
            <div className="seq-row" key={slice}>
              <div className="seq-label" title={`slice ${slice}`}>
                {sliceLabel(slice, roles.kick, roles.snare)}
              </div>
              {cols.map((step) => {
                const hit = getHit(pattern, step, slice);
                const on = Boolean(hit);
                const isBeat = step % 4 === 0;
                const classes = [
                  "cell",
                  isBeat ? "beat" : "",
                  on ? "on" : "",
                  on && hit!.ratchet > 1 ? "ratchet" : "",
                  step === currentStep ? "playhead" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                const title = on
                  ? `step ${step} · pitch ${hit!.pitch} · x${hit!.ratchet}${hit!.reverse ? " · rev" : ""}`
                  : `step ${step}`;
                return (
                  <button
                    key={step}
                    className={classes}
                    title={title}
                    aria-pressed={on}
                    aria-label={`slice ${slice} step ${step}${on ? " on" : " off"}`}
                    onClick={(e) => onCell(e, step, slice)}
                    onContextMenu={(e) => onContext(e, step, slice)}
                    onTouchStart={onTouchStart(step, slice)}
                    onTouchEnd={onTouchEnd(step, slice)}
                    onTouchMove={onTouchMove}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="status">
        Tap toggle · long-press cycles ratchet (rolls) · desktop: right-click ratchet, ⌥-click pitch
      </p>
    </div>
  );
}
