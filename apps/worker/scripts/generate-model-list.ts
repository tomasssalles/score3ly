// Step 2 of making the list of models and prices (docs/llm.md, "The list of models and prices: code, generated"):
//
//   npm run model-list -w apps/worker            writes src/llm/modelList.ts from model-list/*.json, and prints what
//                                                changed since the previous list, to spot-check
//   npm run model-list -w apps/worker -- --check only says whether the committed files are what the gathering's
//                                                committed excerpts give, and modelList.ts what the files give (exit 1
//                                                if not)
//
// Each file is checked against model-list/schema.json first; the list as a whole by `listProblems`. Nothing is written
// while there is a problem.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { buildModelList, listChanges, modelListModule, type ProviderFile } from "../src/llm/generateModelList.ts";
import { schemaProblems, type JsonSchema } from "@score3ly/core";
import type { ModelList } from "../src/llm/models.ts";
import { gatheringDrift } from "../model-list/gather/all.ts";

const workerDir = join(import.meta.dirname, "..");
const dataDir = join(workerDir, "model-list");
const modulePath = join(workerDir, "src", "llm", "modelList.ts");

// The previous list, for the retired models and the changes: null only where there is no module yet. A module that
// can't be imported stops the script, since writing over it would lose its retired models.
export async function readPrevious(path: string): Promise<ModelList | null> {
  if (!existsSync(path)) return null;
  return ((await import(pathToFileURL(path).href)) as { MODEL_LIST: ModelList }).MODEL_LIST;
}

async function main(): Promise<void> {
  const check = parseArgs({ options: { check: { type: "boolean", default: false } } }).values.check;

  if (check) {
    const drift = gatheringDrift();
    if (drift.length > 0) {
      console.error(drift.join("\n"));
      process.exit(1);
    }
    console.log("model-list/*.json are what the gathering's committed excerpts give.");
  }

  const schema = JSON.parse(readFileSync(join(dataDir, "schema.json"), "utf8")) as JsonSchema;
  const files: ProviderFile[] = [];
  let failed = false;
  for (const name of readdirSync(dataDir).filter((f) => f.endsWith(".json") && f !== "schema.json").sort()) {
    const content = JSON.parse(readFileSync(join(dataDir, name), "utf8"));
    const problems = schemaProblems(schema, content, "$");
    if (problems.length > 0) {
      failed = true;
      console.error(`${name}:\n${problems.map((p) => `  ${p}`).join("\n")}`);
    } else files.push(content as ProviderFile);
  }
  if (failed) process.exit(1);

  let previous: ModelList | null;
  try {
    previous = await readPrevious(modulePath);
  } catch (err) {
    console.error(`src/llm/modelList.ts can't be read, so its retired models would be lost: fix it (or restore it from git) first.\n${err}`);
    process.exit(1);
  }
  if (!previous) console.error("No previous list: every model is new.");

  const built = buildModelList(files, previous);
  if ("problems" in built) {
    console.error(`The list has problems:\n${built.problems.map((p) => `  ${p}`).join("\n")}`);
    process.exit(1);
  }
  const module = modelListModule(built.list);
  const current = existsSync(modulePath) ? readFileSync(modulePath, "utf8") : null;

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
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await main();
