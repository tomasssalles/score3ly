import { test } from "node:test";
import assert from "node:assert/strict";
import type { StageStatus } from "./pipeline.ts";
import { eventsBetween, plainText, toastText, type Snapshot } from "./toasts.ts";

// A snapshot from "id:Title:status" items (a "c" after the status: carried; "i": interrupted) and dropped cards.
function snap(items: string[], dropped: string[] = []): Snapshot {
  return {
    stages: items.map((item) => {
      const [id, title, status, flags = ""] = item.split(":");
      return { id, title, status: status as StageStatus, carried: flags.includes("c"), interrupted: flags.includes("i") };
    }),
    dropped: dropped.map((title, i) => ({ id: i + 1, title })),
  };
}

const text = (before: Snapshot, after: Snapshot) => {
  const segments = toastText(eventsBetween(before, after));
  return segments && plainText(segments);
};

test("a stage done and the next started, or waiting for the user", () => {
  const before = snap(["a:Layout:running", "b:Analyze:planned"]);
  assert.equal(text(before, snap(["a:Layout:done", "b:Analyze:running"])), "Layout done. Starting Analyze");
  assert.equal(text(before, snap(["a:Layout:done", "b:Analyze:ready"])), "Layout done. Analyze ready");
  // The moment's events joined: ready first, then started, in Auto mode.
  const events = [
    ...eventsBetween(before, snap(["a:Layout:done", "b:Analyze:ready"])),
    ...eventsBetween(snap(["a:Layout:done", "b:Analyze:ready"]), snap(["a:Layout:done", "b:Analyze:running"])),
  ];
  assert.equal(plainText(toastText(events)!), "Layout done. Starting Analyze");
  // The stage names are bold.
  assert.deepEqual(toastText(eventsBetween(before, snap(["a:Layout:done", "b:Analyze:running"]))), [
    { text: "Layout", bold: true },
    { text: " done" },
    { text: ". " },
    { text: "Starting " },
    { text: "Analyze", bold: true },
  ]);
});

test("carried manual stages kept or dropped are named on the way", () => {
  const before = snap(["s:Skew detection:running", "f:Fix skew:planned:c", "l:Layout:planned"]);
  assert.equal(
    text(before, snap(["s:Skew detection:done", "f:Fix skew:done", "l:Layout:running"])),
    "Skew detection done. Fix skew applied. Starting Layout",
  );
  assert.equal(
    text(before, snap(["s:Skew detection:done", "l:Layout:running"], ["Fix skew"])),
    "Skew detection done. Fix skew dropped (inputs changed). Starting Layout",
  );
  assert.equal(text(before, snap(["s:Skew detection:done", "l:Layout:ready"], ["Fix skew"])), "Skew detection done. Fix skew dropped (inputs changed). Layout ready");
  // Kept, but still in progress: the pipeline waits there.
  assert.equal(text(before, snap(["s:Skew detection:done", "f:Fix skew:wip", "l:Layout:planned"])), "Skew detection done. Fix skew ready");
});

test("failures, interruptions and the end", () => {
  assert.equal(text(snap(["a:Layout:running"]), snap(["a:Layout:failed"])), "Layout failed. Pipeline stopped");
  assert.equal(text(snap(["a:Layout:running"]), snap(["a:Layout:failed:i"])), "Layout interrupted. Pipeline stopped");
  assert.equal(text(snap(["a:Layout:done", "b:Engrave:running"]), snap(["a:Layout:done", "b:Engrave:done"])), "Pipeline done");
});

test("nothing to say: no change, or the first look at a pipeline", () => {
  const same = snap(["a:Layout:done", "b:Analyze:ready"]);
  assert.equal(text(same, same), null);
  assert.equal(text(snap([]), same), null);
});
