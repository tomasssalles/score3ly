import type { CallEvent } from "@score3ly/core";
import type { StageRun } from "./stageRunner";

// The LLM call a stage running here waits for (docs/llm.md, "A call's progress"): what it is for (`label`, e.g. "System
// 4"), when it started and its timeout, and how far its answer has got: the output tokens so far (exact, or estimated
// from the characters received) and those characters. `endedAt` once its answer has come. Times are this device's.
export type CallProgress = {
  callId: string;
  label: string;
  startedAt: number;
  timeoutMs: number;
  outputTokens: number;
  exact: boolean;
  textChars: number;
  thinkingChars: number;
  endedAt?: number;
};

// Passes a sent call's start and progress on to the stage's run (docs/llm.md, "A call's progress"), as one state, and
// marks it ended when its answer has come. A call served from the record has neither.
export function trackCall(run: Pick<StageRun, "call">, label: string, now: () => number = Date.now): { onEvent: (event: CallEvent) => void; ended: () => void } {
  let call: CallProgress | null = null;
  return {
    onEvent(event) {
      if (event.event === "started") {
        call = { callId: event.callId, label, startedAt: now(), timeoutMs: event.timeoutMs, outputTokens: 0, exact: false, textChars: 0, thinkingChars: 0 };
      } else if (call) {
        call = { ...call, outputTokens: event.outputTokens, exact: event.exact, textChars: event.textChars, thinkingChars: event.thinkingChars };
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

