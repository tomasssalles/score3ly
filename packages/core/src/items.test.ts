import { test } from "node:test";
import assert from "node:assert/strict";
import { itemKind, pageItem, pageOfItem, systemItem, systemOfItem } from "./items.ts";

test("page and system items, written and read back", () => {
  assert.equal(pageItem(12), "p12");
  assert.equal(pageOfItem(pageItem(12)), 12);
  assert.equal(systemItem(3, 2), "p3/s2");
  assert.deepEqual(systemOfItem(systemItem(3, 2)), { page: 3, index: 2 });
  assert.deepEqual(systemOfItem("p10/s11"), { page: 10, index: 11 });
});

test("an item of another kind, or malformed, is no page and no system", () => {
  assert.equal(pageOfItem("p3/s2"), null);
  assert.equal(pageOfItem(""), null);
  assert.equal(pageOfItem("3"), null);
  assert.equal(systemOfItem("p3"), null);
  assert.equal(systemOfItem("p3/s"), null);
  assert.equal(systemOfItem("p3/s2x"), null);
  assert.equal(systemOfItem(""), null);
});

test("what an item is", () => {
  assert.equal(itemKind(""), "whole");
  assert.equal(itemKind(pageItem(1)), "page");
  assert.equal(itemKind(systemItem(1, 4)), "system");
});
