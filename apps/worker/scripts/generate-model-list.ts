// Step 2 of making the list of models and prices (docs/llm.md, "The list of models and prices: code, generated"):
//
//   npm run model-list -w apps/worker            writes src/llm/modelList.ts from model-list/*.json, and prints what
//                                                changed since the previous list, to spot-check
//   npm run model-list -w apps/worker -- --check only says whether modelList.ts is what the files give (exit 1 if not)
//
// Each file is checked against model-list/schema.json first; the list as a whole by `listProblems`. Nothing is written
// while there is a problem.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildModelList, listChanges, modelListModule, type ProviderFile } from "../src/llm/generateModelList.ts";
import { schemaProblems, type Schema } from "../src/llm/jsonSchema.ts";
import type { ModelList } from "../src/llm/models.ts";

const workerDir = join(import.meta.dirname, "..");
const dataDir = join(workerDir, "model-list");
const modulePath = join(workerDir, "src", "llm", "modelList.ts");
const check = process.argv.includes("--check");

const schema = JSON.parse(readFileSync(join(dataDir, "schema.json"), "utf8")) as Schema;
const files: ProviderFile[] = [];
let failed = false;
for (const name of readdirSync(dataDir).filter((f) => f.endsWith(".json") && f !== "schema.json").sort()) {
  const content = JSON.parse(readFileSync(join(dataDir, name), "utf8"));
  const problems = schemaProblems(schema, content);
  if (problems.length > 0) {
    failed = true;
    console.error(`${name}:\n${problems.map((p) => `  ${p}`).join("\n")}`);
  } else files.push(content as ProviderFile);
}
if (failed) process.exit(1);

// The previous list, for the retired models and the changes. None the first time.
let previous: ModelList | null = null;
try {
  previous = (await import(modulePath)).MODEL_LIST as ModelList;
} catch {
  console.error("No previous list: every model is new.");
}

const built = buildModelList(files, previous);
if ("problems" in built) {
  console.error(`The list has problems:\n${built.problems.map((p) => `  ${p}`).join("\n")}`);
  process.exit(1);
}
const module = modelListModule(built.list);
const current = (() => {
  try {
    return readFileSync(modulePath, "utf8");
  } catch {
    return null;
  }
})();

if (check) {
  if (current !== module) {
    console.error("src/llm/modelList.ts isn't what the files in model-list give: run `npm run model-list -w apps/worker`.");
    process.exit(1);
  }
  console.log("src/llm/modelList.ts is up to date.");
} else {
  writeFileSync(modulePath, module);
  const changes = listChanges(previous, built.list);
  console.log(
    `Wrote src/llm/modelList.ts: ${built.list.models.length} models, ${built.list.regions.length} regions, ${built.list.prices.length} prices, as of ${built.list.asOf}${built.list.mock ? " (mock)" : ""}.`,
  );
  console.log(changes.length > 0 ? `Changes since the previous list:\n${changes.map((c) => `  ${c}`).join("\n")}` : "No changes since the previous list.");
}
