import type { CallEvent } from "@score3ly/core";
import type { StageRun } from "./stageRunner";

// The LLM call a stage running here waits for (docs/llm.md, "A call's progress"): what it is for (`label`, e.g. "System
// 4"), when it started and its timeout, and how far its answer has got, as the latest report said: the characters so
// far, and the output tokens so far, or null where the report had no count (what to show then is the view's choice).
// `endedAt` once its answer has come. Times are this device's.
export type CallProgress = {
  callId: string;
  label: string;
  startedAt: number;
  timeoutMs: number;
  outputTokens: number | null;
  textChars: number;
  thinkingChars: number;
  endedAt?: number;
};

// The item a stage running here works on (a page "p4", a system "p4/s3", the whole score ""; the outputs' form) and the
// characters received for it so far, the answer's and the thinking's, over all its calls (layout's rounds): null until
// its first call is sent, and for a stage without calls (docs/project-view.md, "The pipeline panel").
export type ItemProgress = { item: string; chars: number | null };

// The characters each run has received for its latest call's item, so that an item's next round counts on from them.
const itemTotals = new WeakMap<object, { item: string; chars: number }>();

// Passes a sent call's start and progress on to the stage's run (docs/llm.md, "A call's progress"), as one state, and
// marks it ended when its answer has come. A call served from the record has neither. The characters also count
// towards the call's item (`item`, its place's), from what earlier calls for the same item received.
export function trackCall(
  run: Pick<StageRun, "call" | "item">,
  label: string,
  item: string,
  now: () => number = Date.now,
): { onEvent: (event: CallEvent) => void; ended: () => void } {
  let call: CallProgress | null = null;
  let before = 0;
  const count = (chars: number) => {
    itemTotals.set(run, { item, chars });
    run.item?.({ item, chars });
  };
  return {
    onEvent(event) {
      if (event.event === "started") {
        call = { callId: event.callId, label, startedAt: now(), timeoutMs: event.timeoutMs, outputTokens: null, textChars: 0, thinkingChars: 0 };
        const last = itemTotals.get(run);
        before = last?.item === item ? last.chars : 0;
        count(before);
      } else if (call) {
        call = { ...call, outputTokens: event.outputTokens, textChars: event.textChars, thinkingChars: event.thinkingChars };
        count(before + event.textChars + event.thinkingChars);
      } else return;
      run.call?.(call);
    },
    ended() {
      if (!call) return;
      call = { ...call, endedAt: now() };
      run.call?.(call);
    },
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
