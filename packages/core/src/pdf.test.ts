import { test } from "node:test";
import assert from "node:assert/strict";
import { loadPdf, PDFJS_DATA, PDFJS_FOLDERS } from "./pdf.ts";

test("the URLs of pdf.js's data files are the folders the plugin serves", () => {
  assert.deepEqual(PDFJS_DATA, {
    wasmUrl: "/pdfjs/wasm/",
    cMapUrl: "/pdfjs/cmaps/",
    standardFontDataUrl: "/pdfjs/standard_fonts/",
    iccUrl: "/pdfjs/iccs/",
  });
  assert.deepEqual(Object.keys(PDFJS_FOLDERS), Object.keys(PDFJS_DATA));
});

test("loadPdf opens the bytes with the data files, and destroys the document once its signal aborts", async () => {
  const given: unknown[] = [];
  let destroyed = 0;
  const getDocument = (source: unknown) => {
    given.push(source);
    return { promise: Promise.resolve("doc"), destroy: () => void destroyed++ };
  };
  const data = new Uint8Array([1, 2, 3]);
  const controller = new AbortController();
  assert.equal(await loadPdf(data, getDocument, controller.signal), "doc");
  assert.deepEqual(given, [{ data, ...PDFJS_DATA }]);
  assert.equal(destroyed, 0);
  controller.abort();
  controller.abort();
  assert.equal(destroyed, 1);
  // Aborted already: destroyed at once.
  await loadPdf(data, getDocument, controller.signal);
  assert.equal(destroyed, 2);
});
