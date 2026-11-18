import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { checkSystem, pieceStart } from "@score3ly/notation";
import { richScore } from "@score3ly/notation/testScore";
import { checkLayoutAnswer, EXTRACT_SCHEMA, groupForModel, LAYOUT_SCHEMA, lensFromExtract, staffForModel, stretchForModel } from "@score3ly/prompts";
import type { CallAnswer } from "@score3ly/core";
import type { Project } from "./api.ts";
import { checkedAnswer } from "./checkedAnswer.ts";

// As in api.test.ts: the browser's fetch replaced by a fake that records each request and answers with the next status.
const realFetch = globalThis.fetch;
let requests: { url: string; body: unknown }[] = [];

function answerWith(...statuses: number[]) {
  requests = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : null });
    const status = statuses.shift() ?? 200;
    return new Response(status === 200 ? "{}" : JSON.stringify({ error: "The server is down." }), { status });
  };
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

const project = { id: "p1" } as Project;
const where = { project, stageId: "s1" };
const answer = (json: unknown): CallAnswer => ({ callId: "c1", cached: false, status: "ok", text: null, json, error: null, usage: null, costUsd: 0, vatPercent: 0 });
const pageError = (problem: string) => `Page 1: the answer can't be used: ${problem}.`;
const MARK = "/api/projects/p1/stages/s1/llm-calls/c1/unusable";

const box = { left: 0.05, right: 0.95, top: 0.1, bottom: 0.3, barLines: [0.5] };
const layoutAnswer = (systems: unknown[]) => ({ severelySkewed: false, satisfied: true, note: "", systems });

test("a usable answer gives what the check made of it, and marks nothing", async () => {
  answerWith();
  const checked = await checkedAnswer(where, answer(layoutAnswer([box])), LAYOUT_SCHEMA, checkLayoutAnswer, pageError);
  assert.deepEqual(checked, { severelySkewed: false, satisfied: true, note: "", systems: [{ box: { left: 0.05, right: 0.95, top: 0.1, bottom: 0.3 }, barLines: [0.5] }] });
  assert.equal(requests.length, 0);
});

test("a null system in a layout answer is unusable, not a TypeError: marked, and the stage's error says why (code review C1)", async () => {
  answerWith(200);
  await assert.rejects(checkedAnswer(where, answer(layoutAnswer([box, null])), LAYOUT_SCHEMA, checkLayoutAnswer, pageError), {
    message: "Page 1: the answer can't be used: the answer doesn't have the expected form: systems[1] isn't an object.",
  });
  assert.deepEqual(requests, [{ url: MARK, body: { reason: "the answer doesn't have the expected form: systems[1] isn't an object" } }]);
});

test("the check's own problem is the reason", async () => {
  answerWith(200);
  await assert.rejects(checkedAnswer(where, answer(layoutAnswer([{ ...box, right: 0.01 }])), LAYOUT_SCHEMA, checkLayoutAnswer, pageError), {
    message: "Page 1: the answer can't be used: system 1: its box is empty or the wrong way round.",
  });
  assert.deepEqual(requests, [{ url: MARK, body: { reason: "system 1: its box is empty or the wrong way round" } }]);
});

// The rich score's first system as extract's answer, in the model's form.
const [first] = richScore();
const extractAnswer = {
  startRepeat: first.answer.startRepeat,
  staves: first.answer.staves.map(staffForModel),
  groups: first.answer.groups.map(groupForModel),
  stretches: first.answer.stretches.map((s) => stretchForModel(s)),
  lastMeasureContinues: first.answer.lastMeasureContinues,
  issues: [],
};
const extractCheck = (json: unknown) =>
  checkSystem(lensFromExtract(json), { system: 1, stretches: first.answer.stretches.length, firstOfPiece: true, images: ["system"] }, pieceStart());

test("an extract answer without its groups is refused by its schema, not taken as having none (code review D11)", async () => {
  answerWith();
  const checked = await checkedAnswer(where, answer(extractAnswer), EXTRACT_SCHEMA, extractCheck, pageError);
  assert.ok(!("problem" in checked));
  answerWith(200);
  const { groups: _, ...noGroups } = extractAnswer;
  await assert.rejects(checkedAnswer(where, answer(noGroups), EXTRACT_SCHEMA, extractCheck, (p) => `Couldn't use the answer for system 1: ${p}.`), {
    message: "Couldn't use the answer for system 1: the answer doesn't have the expected form: groups isn't a list.",
  });
  assert.equal(requests.length, 1);
});

test("a check that throws makes the answer unusable", async () => {
  answerWith(200);
  const check = (): never => {
    throw new TypeError("Cannot read properties of undefined (reading 'x')");
  };
  await assert.rejects(checkedAnswer(where, answer({}), undefined, check, pageError), {
    message: "Page 1: the answer can't be used: checking it failed: Cannot read properties of undefined (reading 'x').",
  });
  assert.equal(requests.length, 1);
});

test("a failed mark is tried once more; failing again, the stage's error is still the answer's", async () => {
  answerWith(500, 200);
  await assert.rejects(checkedAnswer(where, answer(null), LAYOUT_SCHEMA, checkLayoutAnswer, pageError), { message: /^Page 1: the answer can't be used: / });
  assert.equal(requests.length, 2);
  answerWith(500, 503);
  const warn = console.warn;
  console.warn = () => {};
  try {
    await assert.rejects(checkedAnswer(where, answer(null), LAYOUT_SCHEMA, checkLayoutAnswer, pageError), { message: /^Page 1: the answer can't be used: / });
  } finally {
    console.warn = warn;
  }
  assert.equal(requests.length, 2);
});
