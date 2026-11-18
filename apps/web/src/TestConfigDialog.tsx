import { useEffect, useRef, useState } from "react";
import { testModelConfig, type ModelConfig, type TestResult } from "./api";
import { resultText } from "./testResult";
import { Dialog, useDialog } from "./ui/Dialog";
import { errorText } from "@score3ly/core";

// A model config's test (docs/llm.md, "The settings page"): one small real request, sent when the user asks, with the
// answer or the error as a stage would show it.
export function TestConfigDialog({ config, onDone }: { config: ModelConfig; onDone: () => void }) {
  const dialog = useDialog();
  const [state, setState] = useState<{ kind: "idle" } | { kind: "sending" } | { kind: "done"; result: TestResult } | { kind: "refused"; error: string }>({ kind: "idle" });

  // The request on its way is stopped when the dialog closes, and with it the provider's call: its answer would never be
  // shown (docs/llm.md, "Stopped calls").
  const sending = useRef<AbortController | null>(null);
  useEffect(() => () => sending.current?.abort(), []);

  async function send() {
    setState({ kind: "sending" });
    const controller = new AbortController();
    sending.current = controller;
    try {
      setState({ kind: "done", result: await testModelConfig(config.id, controller.signal) });
    } catch (err) {
      if (controller.signal.aborted) return;
      setState({ kind: "refused", error: errorText(err) });
    } finally {
      if (sending.current === controller) sending.current = null;
    }
  }

  const model = config.modelName ?? config.model;
  return (
    // Not busy while the request is on its way: closing is allowed, and stops it.
    <Dialog handle={dialog} title={`Test "${config.name}"`} closeLabel="Close" onClose={onDone}>
      <p className="dialog-text">
        Sends {model} a small image and a question about it, with this config's {config.region ? "region, " : ""}effort and secrets, to check that everything
        works.
        {config.price.kind !== "free" && " It usually costs less than a cent, but real money nevertheless, and counts towards the spending cap."}
      </p>
      <p className={`dialog-text test-result error-text ${state.kind === "done" && state.result.status === "ok" ? "ok" : state.kind === "idle" || state.kind === "sending" ? "" : "failed"}`} role="status">
        {state.kind === "sending" && "Waiting for the response…"}
        {state.kind === "refused" && state.error}
        {state.kind === "done" && resultText(state.result, model, config)}
      </p>
      <div className="dialog-buttons">
        <button type="button" className="button-secondary" onClick={() => dialog.close()}>
          Close
        </button>
        <button type="button" className="button-primary" disabled={state.kind === "sending"} onClick={() => void send()}>
          {state.kind === "idle" || state.kind === "sending" ? "Send request" : "Send again"}
        </button>
      </div>
    </Dialog>
  );
}
