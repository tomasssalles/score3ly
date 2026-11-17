import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hashForArtifact,
  hashForPage,
  hashForProject,
  hashForStage,
  hashForTab,
  HOME_HASH,
  PAGES,
  pageFromHash,
  parseRoute,
  projectIdFromHash,
  STATS_TABS,
  tabFromHash,
  SETTINGS_TABS,
} from "./route.ts";

test("a project's hash leads back to its ID", () => {
  const id = "0612ea30-be38-4e1b-8aeb-ff9984d9590b";
  assert.equal(hashForProject(id), "#/projects/0612ea30-be38-4e1b-8aeb-ff9984d9590b");
  assert.equal(projectIdFromHash(hashForProject(id)), id);
});

test("any other hash means no project is open", () => {
  for (const hash of ["", "#", "#/", "#/projects", "#/projects/", "#/projects/abc/extra", "#/other/abc"]) {
    assert.equal(projectIdFromHash(hash), null, hash);
  }
});

test("an artifact's hash leads back to its project and to the artifact", () => {
  const hash = hashForArtifact("p1", "pdf");
  assert.equal(hash, "#/projects/p1/artifacts/pdf");
  assert.deepEqual(parseRoute(hash), { projectId: "p1", artifactId: "pdf", stageId: null });
  assert.equal(projectIdFromHash(hash), "p1");
  assert.deepEqual(parseRoute(hashForProject("p1")), { projectId: "p1", artifactId: null, stageId: null });
});

test("a stage's hash leads back to its project and to the stage", () => {
  const hash = hashForStage("p1", "analysis");
  assert.equal(hash, "#/projects/p1/stages/analysis");
  assert.deepEqual(parseRoute(hash), { projectId: "p1", artifactId: null, stageId: "analysis" });
});

test("a malformed artifact hash means nothing is open", () => {
  for (const hash of [
    "#/projects/p1/artifacts",
    "#/projects/p1/artifacts/",
    "#/projects/p1/artifacts/a/b",
    "#/projects/p1/stages/",
    "#/projects/p1/other/a",
  ]) {
    assert.equal(parseRoute(hash), null, hash);
  }
});

test("each menu page's hash leads back to it, and isn't a project", () => {
  for (const page of PAGES) {
    assert.equal(pageFromHash(hashForPage(page)), page);
    assert.equal(parseRoute(hashForPage(page)), null);
  }
});

test("other hashes are no page", () => {
  for (const hash of ["", "#", "#/", "#/projects", "#/projects/p1", "#/settings/x", "#/stats/x", "#/unknown", "#settings"]) {
    assert.equal(pageFromHash(hash), null, hash);
  }
});

test("each tab of a page has its hash; the Settings page's own is its first tab's", () => {
  for (const tab of STATS_TABS) {
    assert.equal(pageFromHash(hashForTab("stats", tab)), "stats");
    assert.equal(tabFromHash("stats", hashForTab("stats", tab)), tab);
  }
  for (const tab of SETTINGS_TABS) {
    assert.equal(pageFromHash(hashForTab("settings", tab)), "settings");
    assert.equal(tabFromHash("settings", hashForTab("settings", tab)), tab);
  }
  assert.equal(hashForTab("stats", "costs"), "#/stats/costs");
  assert.equal(hashForTab("stats", "usage"), "#/stats/usage");
  assert.equal(hashForTab("settings", "general"), "#/settings");
  assert.equal(hashForTab("settings", "configs"), "#/settings/configs");
  assert.equal(pageFromHash("#/settings/costs"), null);
});

test("a page's hash naming its first tab, or no tab of it, opens the first tab", () => {
  assert.equal(tabFromHash("stats", "#/stats"), "costs");
  assert.equal(tabFromHash("stats", "#/stats/costs"), "costs");
  assert.equal(tabFromHash("stats", "#/stats/configs"), "costs");
  assert.equal(tabFromHash("settings", "#/stats/usage"), "general");
});

test("the home is no project and no page", () => {
  assert.equal(parseRoute(HOME_HASH), null);
  assert.equal(pageFromHash(HOME_HASH), null);
});
