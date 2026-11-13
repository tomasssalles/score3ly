import { test } from "node:test";
import assert from "node:assert/strict";
import type { ListedProject, PipelinePosition } from "./api.ts";
import { HOME_CARDS, positionState, recentProjects } from "./home.ts";
import { stateLabel } from "./pipeline.ts";

const NOW = Date.parse("2026-11-13T12:00:00Z");
const at = (position: Partial<PipelinePosition> & { step: string }): PipelinePosition => ({
  status: "planned",
  heartbeatAt: null,
  carried: false,
  ...position,
});
const label = (position: PipelinePosition | null) => stateLabel(positionState(position, NOW));

test("a card says where the pipeline is, as the panel's head does", () => {
  assert.equal(label(null), "Done");
  assert.equal(label(at({ step: "rasterize" })), "Rasterize (not started)");
  assert.equal(label(at({ step: "fix_layout", status: "wip" })), "Fix layout (WIP)");
  assert.equal(label(at({ step: "layout", status: "failed" })), "Layout failed");
  assert.equal(label(at({ step: "layout", status: "stopped" })), "Layout failed");
  assert.equal(label(at({ step: "extract", status: "running", heartbeatAt: "2026-11-13T11:59:00Z" })), "Extract…");
  assert.equal(label(at({ step: "extract", status: "running", heartbeatAt: "2026-11-13T11:50:00Z" })), "Extract interrupted");
  assert.equal(label(at({ step: "extract", status: "running" })), "Extract interrupted");
  // A finished manual stage carried through a re-run waits for its turn.
  assert.equal(label(at({ step: "fix_skew", status: "done", carried: true })), "Fix skew (not started)");
});

test("the home shows the most recently opened projects, as many as fit", () => {
  const projects = Array.from({ length: HOME_CARDS + 3 }, (_, i) => ({ id: String(i) }) as ListedProject);
  assert.deepEqual(
    recentProjects(projects).map((p) => p.id),
    projects.slice(0, HOME_CARDS).map((p) => p.id),
  );
});
