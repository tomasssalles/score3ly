import { test } from "node:test";
import assert from "node:assert/strict";
import { keyOf } from "./keys.ts";
import { configError, configOf, pageOfItem, pageRecipe, resolveConfig, stageKey } from "./rasterize.ts";

test("a stored config gets defaults for what it lacks", () => {
  assert.deepEqual(configOf(null), { pages: "", dpi: 300 });
  assert.deepEqual(configOf({ pages: "2" }), { pages: "2", dpi: 300 });
});

test("a config is checked before the PDF is known, and resolved against it", () => {
  assert.equal(configError({ pages: "1-3", dpi: 150 }), null);
  assert.ok(configError({ pages: "x", dpi: 300 }));
  assert.ok(configError({ pages: "", dpi: 1200 }));
  assert.ok(configError({ pages: "", dpi: 150.5 }));
  assert.deepEqual(resolveConfig({ pages: "", dpi: 300 }, 3), { config: { pages: "1-3", dpi: 300 }, pages: [1, 2, 3] });
  assert.deepEqual(resolveConfig({ pages: "3,1", dpi: 300 }, 3), { config: { pages: "1, 3", dpi: 300 }, pages: [1, 3] });
  assert.ok("error" in resolveConfig({ pages: "4", dpi: 300 }, 3));
});

test("the same pages written differently give the same stage key; another PDF or resolution doesn't", async () => {
  const pdf = "a".repeat(64);
  const all = resolveConfig({ pages: "", dpi: 300 }, 3);
  const listed = resolveConfig({ pages: "1, 2, 3", dpi: 300 }, 3);
  assert.ok("config" in all && "config" in listed);
  assert.equal(await stageKey(all.config, pdf, "6.4.299"), await stageKey(listed.config, pdf, "6.4.299"));
  assert.notEqual(await stageKey(all.config, pdf, "6.4.299"), await stageKey(all.config, "b".repeat(64), "6.4.299"));
  assert.notEqual(await stageKey(all.config, pdf, "6.4.299"), await stageKey({ ...all.config, dpi: 150 }, pdf, "6.4.299"));
});

test("a page's recipe says everything its image depends on", async () => {
  const recipe = pageRecipe("a".repeat(64), 2, 300, "6.4.299");
  assert.deepEqual(recipe, { step: "rasterize", version: 1, pdf: "a".repeat(64), page: 2, dpi: 300, pdfjs: "6.4.299" });
  assert.notEqual(await keyOf(recipe), await keyOf({ ...recipe, page: 3 }));
  assert.equal(pageOfItem("p12"), 12);
  assert.equal(pageOfItem("p3/s2"), null);
});
