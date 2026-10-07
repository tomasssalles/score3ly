import { test } from "node:test";
import assert from "node:assert/strict";
import { hashForArtifact, hashForProject, parseRoute, projectIdFromHash } from "./route.ts";

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
  assert.deepEqual(parseRoute(hash), { projectId: "p1", artifactId: "pdf" });
  assert.equal(projectIdFromHash(hash), "p1");
  assert.deepEqual(parseRoute(hashForProject("p1")), { projectId: "p1", artifactId: null });
});

test("a malformed artifact hash means nothing is open", () => {
  for (const hash of ["#/projects/p1/artifacts", "#/projects/p1/artifacts/", "#/projects/p1/artifacts/a/b"]) {
    assert.equal(parseRoute(hash), null, hash);
  }
});
