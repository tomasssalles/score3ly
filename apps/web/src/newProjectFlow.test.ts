import { test } from "node:test";
import assert from "node:assert/strict";
import { makeAndOpen } from "./newProjectFlow.ts";

// The flow with fakes: what happened, in order; `answer` is the user's answer to the question, if one is asked.
async function run(options: { asked: boolean; answer?: "leave" | "cancel"; fails?: boolean }) {
  const events: string[] = [];
  let list: string[] = [];
  makeAndOpen({
    whenLeaving: (then) => {
      if (!options.asked) return then();
      events.push("asked");
      if (options.answer === "leave") then();
    },
    make: async () => {
      events.push("made");
      if (options.fails) throw new Error("no");
      return { id: "new" };
    },
    refresh: async () => {
      events.push("refreshed");
      list = ["new"];
    },
    open: (made) => events.push(list.includes(made.id) ? "opened, listed" : "opened, not listed"),
    failed: (err) => void events.push(`failed: ${(err as Error).message}`),
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  return events;
}

test("a new project is opened once the list has it (F3)", async () => {
  assert.deepEqual(await run({ asked: false }), ["made", "refreshed", "opened, listed"]);
});

test("while a run goes, the question comes before the project is made; Cancel makes nothing (dec. 43)", async () => {
  assert.deepEqual(await run({ asked: true, answer: "cancel" }), ["asked"]);
  assert.deepEqual(await run({ asked: true, answer: "leave" }), ["asked", "made", "refreshed", "opened, listed"]);
});

test("a project that couldn't be made opens nothing", async () => {
  assert.deepEqual(await run({ asked: false, fails: true }), ["made", "failed: no"]);
});
