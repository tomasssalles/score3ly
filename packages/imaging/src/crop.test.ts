import { test } from "node:test";
import assert from "node:assert/strict";
import { createImage } from "./image.ts";
import { boxProblem, crop, pixelRect } from "./crop.ts";
import { parseRegions } from "./regions.ts";
import { fillRect } from "./testPages.ts";

test("a box covers every pixel it touches", () => {
  assert.deepEqual(pixelRect({ left: 0.1, right: 0.5, top: 0.25, bottom: 0.75 }, 100, 40), {
    x: 10,
    y: 10,
    width: 40,
    height: 20,
  });
  // Partly covered pixels at the edges are included.
  assert.deepEqual(pixelRect({ left: 0.105, right: 0.495, top: 0, bottom: 1 }, 100, 40), {
    x: 10,
    y: 0,
    width: 40,
    height: 40,
  });
});

test("cropping copies exactly the pixels in the box", () => {
  const image = createImage(10, 10);
  fillRect(image, 2, 3, 4, 2, [0, 0, 0]);
  const part = crop(image, { left: 0.2, right: 0.6, top: 0.3, bottom: 0.5 });
  assert.deepEqual([part.width, part.height], [4, 2]);
  assert.ok(part.data.every((v, i) => (i % 4 === 3 ? v === 255 : v === 0)));
  const whole = crop(image, { left: 0, right: 1, top: 0, bottom: 1 });
  assert.deepEqual(whole.data, image.data);
});

test("invalid boxes are refused", () => {
  assert.equal(boxProblem({ left: 0, right: 1, top: 0, bottom: 1 }), null);
  assert.match(boxProblem({ left: 0.5, right: 0.5, top: 0, bottom: 1 }) ?? "", /left/);
  assert.match(boxProblem({ left: 0, right: 1.2, top: 0, bottom: 1 }) ?? "", /outside/);
  assert.match(boxProblem({ left: 0, right: 1, top: 0 }) ?? "", /bottom/);
  assert.throws(() => crop(createImage(4, 4), { left: 0.6, right: 0.2, top: 0, bottom: 1 }), /Invalid box/);
});

test("regions are read from JSON in its order", () => {
  const regions = parseRegions({
    system_1: { page: 1, bbox: { left: 0.05, right: 0.95, top: 0.1, bottom: 0.3 } },
    measure_12: { page: 2, bbox: { left: 0.4, right: 0.6, top: 0.5, bottom: 0.7 } },
  });
  assert.deepEqual(
    regions.map((r) => [r.name, r.page]),
    [
      ["system_1", 1],
      ["measure_12", 2],
    ],
  );
});

test("every problem in the regions is reported by name", () => {
  assert.throws(
    () =>
      parseRegions({
        "../evil": { page: 1, bbox: { left: 0, right: 1, top: 0, bottom: 1 } },
        system_2: { page: 0, bbox: { left: 0, right: 1, top: 0, bottom: 1 } },
        system_3: { page: 1, bbox: { left: 0, right: 1, top: 0.5, bottom: 0.2 } },
      }),
    (err: Error) =>
      /"\.\.\/evil": the name/.test(err.message) &&
      /"system_2": "page"/.test(err.message) &&
      /"system_3": "bbox" "top"/.test(err.message),
  );
  assert.throws(() => parseRegions([]), /Expected an object/);
});
