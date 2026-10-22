// Checking an MEI file in the browser (DESIGN.md §6, `final_touches`): xmllint (WebAssembly, in its own Web Worker)
// with the vendored MEI 5.1 schema, both loaded on the first check.

import schemaUrl from "../../../packages/notation/schemas/mei-all.rng?url";
import { checkMei, xmllintProblems, type MeiProblem } from "./meiChecks";

let schema: Promise<string> | null = null;

async function validate(text: string): Promise<MeiProblem[]> {
  schema ??= fetch(schemaUrl).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`The MEI schema couldn't be loaded (${r.status}).`))));
  const [{ validateXML }, rng] = await Promise.all([import("xmllint-wasm"), schema]).catch((err) => {
    schema = null;
    throw err;
  });
  const result = await validateXML({
    xml: [{ fileName: "score.mei", contents: text }],
    schema: [{ fileName: "mei-all.rng", contents: rng }],
    extension: "relaxng",
    initialMemoryPages: 1024, // 64 MiB: the schema alone needs more than the default
    maxMemoryPages: 16384, // 1 GiB
  });
  return xmllintProblems(result.errors);
}

export function checkMeiText(text: string): Promise<MeiProblem[]> {
  return checkMei(text, validate);
}
