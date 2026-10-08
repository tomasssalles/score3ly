import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The icon is a separate image, so it can't use the app's CSS variables: its accent color is a copy.
test("the icon's accent color is the app's accent color", () => {
  const icon = readFileSync(join(import.meta.dirname, "../public/icon.svg"), "utf8");
  const styles = readFileSync(join(import.meta.dirname, "styles.css"), "utf8");

  const inIcon = /\.accent\s*\{\s*stroke:\s*(#[0-9a-f]{6})\s*;/i.exec(icon)?.[1];
  const inApp = /--accent:\s*(#[0-9a-f]{6})\s*;/i.exec(styles)?.[1];

  assert.ok(inIcon, "icon.svg has no .accent { stroke: #rrggbb; } rule");
  assert.ok(inApp, "styles.css has no --accent: #rrggbb;");
  assert.equal(inIcon.toLowerCase(), inApp.toLowerCase());
});
