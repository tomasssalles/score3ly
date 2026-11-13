import { test } from "node:test";
import assert from "node:assert/strict";
import type { ListedProject, PipelinePosition } from "./api.ts";
import { cardsThatFit, HOME_CARDS, positionState, recentProjects } from "./home.ts";
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

test("the home shows the most recently opened projects, as many as fit, at most 6", () => {
  const projects = Array.from({ length: HOME_CARDS + 3 }, (_, i) => ({ id: String(i) }) as ListedProject);
  assert.equal(HOME_CARDS, 6);
  assert.deepEqual(
    recentProjects(projects).map((p) => p.id),
    projects.slice(0, HOME_CARDS).map((p) => p.id),
  );
  assert.deepEqual(recentProjects(projects, 3).map((p) => p.id), ["0", "1", "2"]);
});

test("as many cards as fit: whole rows, at least one, at most 6", () => {
  // A phone: one column, cards 120 px high with 12 px between them.
  assert.equal(cardsThatFit(500, 120, 12, 1), 3);
  assert.equal(cardsThatFit(516, 120, 12, 1), 4); // 4 × 120 + 3 × 12 = 516
  assert.equal(cardsThatFit(50, 120, 12, 1), 1);
  // A wide screen: three columns, two rows.
  assert.equal(cardsThatFit(600, 120, 12, 3), 6);
  assert.equal(cardsThatFit(200, 120, 12, 3), 3);
});
