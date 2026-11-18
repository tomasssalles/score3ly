import assert from "node:assert/strict";
import { test } from "node:test";
import { optionGroups } from "./pickerOptions.ts";

const shape = (r: ReturnType<typeof optionGroups>) => ({
  groups: r.groups.map((g) => g.map((i) => `${i.label}${i.note ? ` (${i.note})` : ""}${i.current ? " *" : ""}`)),
  headings: r.headings,
});

test("options without groups are one group; the value is the current one", () => {
  const r = optionGroups([{ id: "a", label: "A" }, { id: "b", label: "B", note: "deleted" }], "b", () => {});
  assert.deepEqual(shape(r), { groups: [["A", "B (deleted) *"]], headings: undefined });
});

test("consecutive options of a group number form a group, headed by its heading", () => {
  const r = optionGroups(
    [
      { id: "all", label: "All" },
      { id: "m1", label: "Model 1", group: 1 },
      { id: "m2", label: "Model 2", group: 1 },
      { id: "c1", label: "Config 1", group: 2 },
    ],
    "all",
    () => {},
    { 1: "By model", 2: "Configs" },
  );
  assert.deepEqual(shape(r), { groups: [["All *"], ["Model 1", "Model 2"], ["Config 1"]], headings: ["", "By model", "Configs"] });
});

test("a group number met again after another starts a new group", () => {
  const r = optionGroups([{ id: "a", label: "A", group: 1 }, { id: "b", label: "B" }, { id: "c", label: "C", group: 1 }], "x", () => {});
  assert.deepEqual(shape(r).groups, [["A"], ["B"], ["C"]]);
});

test("picking an option calls onChange with its id; items are keyed by id", () => {
  const picked: string[] = [];
  const r = optionGroups([{ id: "a", label: "Same" }, { id: "b", label: "Same" }], "a", (id) => picked.push(id));
  r.groups[0][1].onSelect!();
  assert.deepEqual(picked, ["b"]);
  assert.deepEqual(r.groups[0].map((i) => i.key), ["a", "b"]);
});
