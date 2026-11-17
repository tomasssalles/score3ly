import type { CallEvent } from "@score3ly/core";
import type { StageRun } from "./stageRunner";

// The item a stage running here works on (a page "p4", a system "p4/s3", the whole score ""; the outputs' form) and the
// characters received for it so far, the answer's and the thinking's, over all its calls (layout's rounds): null until
// its first call is sent, and for a stage without calls (docs/project-view.md, "The pipeline panel").
export type ItemProgress = { item: string; chars: number | null };

// The characters each run has received for its latest call's item, so that an item's next round counts on from them.
const itemTotals = new WeakMap<object, { item: string; chars: number }>();

// Counts a sent call's characters (docs/llm.md, "A call's progress") towards the call's item (`item`, its place's), from
// what earlier calls for the same item received, and passes the item's total on to the stage's run. A call served from
// the record reports nothing.
export function trackCall(run: Pick<StageRun, "item">, item: string): (event: CallEvent) => void {
  let started = false;
  let before = 0;
  const count = (chars: number) => {
    itemTotals.set(run, { item, chars });
    run.item?.({ item, chars });
  };
  return (event) => {
    if (event.event === "started") {
      started = true;
      const last = itemTotals.get(run);
      before = last?.item === item ? last.chars : 0;
      count(before);
    } else if (started) {
      count(before + event.textChars + event.thinkingChars);
    }
  };
}

// The characters received, short: as they are below 1000, then in thousands and millions with 2 decimals ("1.23k").
export function charsText(chars: number): string {
  if (chars === 1) return "1 char";
  if (chars < 1000) return `${chars} chars`;
  if (chars < 999_995) return `${(chars / 1000).toFixed(2)}k chars`;
  return `${(chars / 1_000_000).toFixed(2)}M chars`;
}

// The line under a running stage's bar (docs/project-view.md, "The pipeline panel"): the item, and for a stage that calls a
// model, "preparing…" until the item's first call is sent, then the characters received for it.
export function itemText(progress: ItemProgress, llm: boolean): string {
  const name = progress.item === "" ? "full score" : progress.item;
  if (!llm) return `${name}…`;
  return `${name}: ${progress.chars === null ? "preparing…" : charsText(progress.chars)}`;
}
