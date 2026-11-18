// Whether a model's answer can be used (docs/llm.md, "Answers the stage can't use"): its form checked against the request's
// schema, then the stage's own check, which turns it into what the stage stores. An answer that can't be used is
// marked so on its call, which keeps the cache from serving it again (a retry asks the model anew), and ends the stage
// with an error that says why. `ask` (llm.ts) does this for every LLM stage.

import { errorText, schemaProblem, type CallAnswer, type JsonSchema, type Problem } from "@score3ly/core";
import { markUnusable, type Project } from "./api.ts";

// A stage's check of an answer: what the stage takes from it, or why it can't be used. It may throw on a malformed
// answer: that is a reason too.
export type AnswerCheck<T> = (json: unknown) => T | Problem;

const isProblem = (value: unknown): value is Problem => typeof value === "object" && value !== null && "problem" in value;

// Why the answer can't be used, or what the check made of it.
function verdict<T>(json: unknown, schema: JsonSchema | undefined, check: AnswerCheck<T>): { value: T } | Problem {
  const shape = schema ? schemaProblem(schema, json) : null;
  if (shape) return { problem: `the answer doesn't have the expected form: ${shape}` };
  try {
    const checked = check(json);
    return isProblem(checked) ? checked : { value: checked };
  } catch (err) {
    return { problem: `checking it failed: ${errorText(err)}` };
  }
}

// What the stage takes from an answer (`status: "ok"`); or the call marked unusable and the stage's error thrown,
// in the words `unusable` gives it. The mark is tried twice: a call left `ok` would be served again on the retry.
export async function checkedAnswer<T>(
  where: { project: Project; stageId: string },
  answer: CallAnswer,
  schema: JsonSchema | undefined,
  check: AnswerCheck<T>,
  unusable: (problem: string) => string,
): Promise<T> {
  const result = verdict(answer.json, schema, check);
  if (!isProblem(result)) return result.value;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await markUnusable(where.project, where.stageId, answer.callId, result.problem);
      break;
    } catch (err) {
      if (attempt === 2) console.warn("Marking an answer unusable failed:", err);
    }
  }
  throw new Error(unusable(result.problem));
}
