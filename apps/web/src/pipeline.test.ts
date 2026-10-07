import { test } from "node:test";
import assert from "node:assert/strict";
import type { Project } from "./api.ts";
import { defaultArtifactId, findArtifact, pipelineFor, type PipelineItem } from "./pipeline.ts";

const project: Project = {
  id: "p1",
  name: "Sonata",
  pdfSha256: "a".repeat(64),
  pdfFilename: "Sonata.pdf",
  createdAt: "2026-10-07T00:00:00.000Z",
  lastModifiedAt: "2026-10-07T00:00:00.000Z",
  lastOpenedAt: "2026-10-07T00:00:00.000Z",
};

test("a new project's pipeline is just the original PDF, which is shown by default", () => {
  const items = pipelineFor(project);
  assert.deepEqual(
    items.map((item) => [item.id, item.detail]),
    [["pdf", "Sonata.pdf"]],
  );
  assert.equal(defaultArtifactId(items), "pdf");
});

test("the default artifact is the latest item's main artifact", () => {
  const stage: PipelineItem = {
    id: "stage",
    title: "Stage",
    detail: "",
    artifacts: [
      { id: "side", title: "Side output", kind: "pdf" },
      { id: "main", title: "Main output", kind: "pdf" },
    ],
    mainArtifactId: "main",
  };
  const items = [...pipelineFor(project), stage];
  assert.equal(defaultArtifactId(items), "main");
  assert.equal(defaultArtifactId([]), null);
});

test("findArtifact finds an artifact and its item, or nothing", () => {
  const items = pipelineFor(project);
  assert.equal(findArtifact(items, "pdf")?.item.id, "pdf");
  assert.equal(findArtifact(items, "missing"), null);
});
