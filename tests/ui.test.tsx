import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { GeneratePanel } from "../src/ui/GeneratePanel";
import { SequencerGrid } from "../src/ui/SequencerGrid";
import { useStore } from "../src/state/store";
import { createEmptyPattern, getHit } from "../src/state/pattern";
import { defaultRoles } from "../src/generate/randomize";

beforeEach(() => {
  useStore.setState({
    pattern: createEmptyPattern(),
    sliceCount: 8,
    roles: defaultRoles(8),
    selectedSlice: 0,
    currentStep: -1,
    seedCounter: 1,
  });
});
afterEach(cleanup);

describe("GeneratePanel", () => {
  it("renders the headline controls", () => {
    render(<GeneratePanel />);
    expect(screen.getByText(/Musical Randomize/i)).toBeInTheDocument();
    expect(screen.getByText(/Mutate/i)).toBeInTheDocument();
    expect(screen.getByText(/Add Fill/i)).toBeInTheDocument();
  });

  it("Musical Randomize generates hits into the store", () => {
    render(<GeneratePanel />);
    expect(useStore.getState().pattern.hits.length).toBe(0);
    fireEvent.click(screen.getByText(/Musical Randomize/i));
    expect(useStore.getState().pattern.hits.length).toBeGreaterThan(0);
  });

  it("Clear empties the pattern", () => {
    render(<GeneratePanel />);
    fireEvent.click(screen.getByText(/Musical Randomize/i));
    fireEvent.click(screen.getByText(/^Clear$/i));
    expect(useStore.getState().pattern.hits.length).toBe(0);
  });
});

describe("SequencerGrid", () => {
  it("renders a cell per step per slice", () => {
    render(<SequencerGrid />);
    const cells = screen.getAllByRole("button");
    expect(cells.length).toBe(16 * 8);
  });

  it("clicking a cell toggles a hit in the store", () => {
    render(<SequencerGrid />);
    const cell = screen.getByLabelText("slice 0 step 0 off");
    fireEvent.click(cell);
    expect(getHit(useStore.getState().pattern, 0, 0)).toBeDefined();
  });

  it("labels kick and snare rows from roles", () => {
    render(<SequencerGrid />);
    expect(screen.getByText("KICK")).toBeInTheDocument();
    expect(screen.getByText("SNARE")).toBeInTheDocument();
  });
});
