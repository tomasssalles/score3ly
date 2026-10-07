import { test } from "node:test";
import assert from "node:assert/strict";
import { hashForProject, projectIdFromHash } from "./route.ts";

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
