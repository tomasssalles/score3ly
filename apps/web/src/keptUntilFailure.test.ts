import { test } from "node:test";
import assert from "node:assert/strict";
import { keptUntilFailure } from "./keptUntilFailure.ts";

test("a load is made once and kept, but a failed one is tried again", async () => {
  let loads = 0;
  let failNext = true;
  const get = keptUntilFailure(async () => {
    loads++;
    if (failNext) {
      failNext = false;
      throw new Error("no WASM");
    }
    return "toolkit";
  });
  await assert.rejects(get(), /no WASM/);
  assert.equal(await get(), "toolkit");
  assert.equal(await get(), "toolkit");
  assert.equal(loads, 2);
});
