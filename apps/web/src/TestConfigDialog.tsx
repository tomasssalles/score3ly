import { useState } from "react";
import { testModelConfig, type ModelConfig, type TestResult } from "./api";
import { resultText } from "./testResult";
import { Dialog, useDialog } from "./ui/Dialog";

// A model config's test (docs/llm.md, "The settings page"): one small real request, sent when the user asks, with the
// answer or the error as a stage would show it.
export function TestConfigDialog({ config, onDone }: { config: ModelConfig; onDone: () => void }) {
  const dialog = useDialog();
  const [state, setState] = useState<{ kind: "idle" } | { kind: "sending" } | { kind: "done"; result: TestResult } | { kind: "refused"; error: string }>({ kind: "idle" });

  async function send() {
    setState({ kind: "sending" });
    try {
      setState({ kind: "done", result: await testModelConfig(config.id) });
    } catch (err) {
      setState({ kind: "refused", error: err instanceof Error ? err.message : String(err) });
    }
  }

  const model = config.modelName ?? config.model;
  return (
    // Not busy while the request is on its way: closing is allowed, and the answer is then not shown.
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
