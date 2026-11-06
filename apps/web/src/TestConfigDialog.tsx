import { useEffect, useRef, useState } from "react";
import { testModelConfig, type ModelConfig, type TestResult } from "./api";
import { resultText } from "./testResult";
import { CloseIcon } from "./icons";

// A model config's test (docs/llm.md, "The settings page"): one small real request, sent when the user asks, with the
// answer or the error as a stage would show it.
export function TestConfigDialog({ config, onDone }: { config: ModelConfig; onDone: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<{ kind: "idle" } | { kind: "sending" } | { kind: "done"; result: TestResult } | { kind: "refused"; error: string }>({ kind: "idle" });

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

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
    <dialog ref={dialog} className="app-dialog" aria-labelledby="test-config-title" onClose={onDone} onClick={(e) => e.target === dialog.current && dialog.current.close()}>
      <div className="dialog-head">
        <h2 id="test-config-title">Test "{config.name}"</h2>
        <button type="button" className="dialog-close" aria-label="Close" onClick={() => dialog.current?.close()}>
          <CloseIcon />
        </button>
      </div>
      <p className="dialog-text">
        Sends {model} a small image and a question about it, with this config's {config.region ? "region, " : ""}effort and secrets, to show that they work before a long run. It
        costs real money, usually less than a cent, and counts towards the spending cap.
      </p>
      <p className={`dialog-text test-result ${state.kind === "done" && state.result.status === "ok" ? "ok" : state.kind === "idle" || state.kind === "sending" ? "" : "failed"}`} role="status">
        {state.kind === "sending" && "Waiting for the answer…"}
        {state.kind === "refused" && state.error}
        {state.kind === "done" && resultText(state.result, model, config)}
      </p>
      <div className="dialog-buttons">
        <button type="button" className="button-secondary" onClick={() => dialog.current?.close()}>
          Close
        </button>
        <button type="button" className="button-primary" disabled={state.kind === "sending"} onClick={() => void send()}>
          {state.kind === "idle" || state.kind === "sending" ? "Send test" : "Send again"}
        </button>
      </div>
    </dialog>
  );
}
