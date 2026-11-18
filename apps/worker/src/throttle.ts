// Progress passed on at most every so often (docs/llm.md, "A call's progress").

import type { LlmProgress } from "./llm/types.ts";

// Passes progress on at most every `intervalMs`, the latest when it is due: the providers send far more often than
// anyone needs to know, and every event costs the Worker CPU time. `stop` drops what is still waiting.
export function throttled<T>(send: (value: T) => void, intervalMs: number): { push: (value: T) => void; flush: () => void; stop: () => void } {
  let last = -Infinity;
  let waiting: T | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    timer = undefined;
    if (waiting === undefined) return;
    last = Date.now();
    const value = waiting;
    waiting = undefined;
    send(value);
  };
  return {
    push(value) {
      waiting = value;
      const wait = last + intervalMs - Date.now();
      if (wait <= 0) flush();
      else timer ??= setTimeout(flush, wait);
    },
    // Sends the value still waiting, if any, at once (the last before an answer).
    flush() {
      if (timer !== undefined) clearTimeout(timer);
      flush();
    },
    stop() {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      waiting = undefined;
    },
  };
}

// The chunks' reports passed on at most every `intervalMs`: the latest characters, and the latest token count among
// the chunks since the previous report (null if none had one), so that a count isn't lost to the throttle.
export function throttledProgress(send: (progress: LlmProgress) => void, intervalMs: number): { push: (progress: LlmProgress) => void; flush: () => void; stop: () => void } {
  let tokensSince: number | null = null;
  const throttle = throttled<LlmProgress>((p) => {
    tokensSince = null;
    send(p);
  }, intervalMs);
  return {
    push(p) {
      if (p.outputTokens !== null) tokensSince = p.outputTokens;
      throttle.push({ ...p, outputTokens: tokensSince });
    },
    flush: throttle.flush,
    stop: throttle.stop,
  };
}
