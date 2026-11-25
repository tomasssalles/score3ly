import { test } from "node:test";
import assert from "node:assert/strict";
import { keyOf } from "@score3ly/core";
import { PAGE_IMAGE_VERSION } from "@score3ly/imaging";
import { configError, configOf, resolveConfig, stageKey } from "./rasterize.ts";
import { IMAGE_VERSIONS, pageRecipe, straightRecipe } from "./recipes.ts";

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
  assert.deepEqual(recipe, { step: "rasterize", version: 1, pdf: "a".repeat(64), page: 2, dpi: 300, pdfjs: "6.4.299", pageImage: PAGE_IMAGE_VERSION });
  assert.notEqual(await keyOf(recipe), await keyOf({ ...recipe, page: 3 }));
});

// B7 (code review): a change of our page image code (imaging's pdfPages.ts) changes the page images' recipe, and so
// their keys, and the key of the stage whose outputs those recipes are: an image made by the new code is never served
// from, or checked against, what the old code made under the same key.
test("a change of the page image code changes the page recipe's key and rasterize's stage key", async () => {
  const recipe = pageRecipe("a".repeat(64), 2, 300, "6.4.299");
  assert.equal(recipe.pageImage, PAGE_IMAGE_VERSION);
  assert.notEqual(await keyOf(recipe), await keyOf({ ...recipe, pageImage: PAGE_IMAGE_VERSION + 1 }));
  // The recipe as it was before the version was in it: another key.
  const { pageImage: _, ...before } = recipe;
  assert.notEqual(await keyOf(recipe), await keyOf(before));
  const config = { pages: "1-3", dpi: 300 };
  assert.equal(
    await stageKey(config, "a".repeat(64), "6.4.299"),
    await keyOf({ step: "rasterize", version: 1, libraries: { pdfjs: "6.4.299", pageImage: PAGE_IMAGE_VERSION }, config, inputs: ["a".repeat(64)] }),
  );
});

// B8, dec. 6 (code review): a straightened page is the page, the angle and the rotation code. The deskew decision's
// version isn't in it (the angle is the decision, made by `layout`, whose stage key holds that version): a change of
// the rule changes no image and no request for the same angle.
test("a straightened page's recipe has no deskew version", () => {
  const page = pageRecipe("a".repeat(64), 2, 300, "6.4.299");
  assert.deepEqual(straightRecipe(page, 1.25), { page, angle: 1.25, rotate: IMAGE_VERSIONS.rotate });
});
