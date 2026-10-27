import { useEffect, useRef, useState } from "react";
import { Picker } from "./fieldList";
import { CloseIcon } from "./icons";
import type { ConfigContext, ConfigValues, StepConfig } from "./steps";

// A stage's config (docs/project-view.md, "Change config"): the form its step declares (steps.ts).
export function ConfigDialog({
  title,
  config,
  values: initial,
  context,
  onSave,
  onCancel,
}: {
  title: string;
  config: StepConfig;
  values: ConfigValues;
  context: ConfigContext;
  onSave: (values: ConfigValues) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  // As typed: numbers are text until saved.
  const [texts, setTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(config.fields.map((f) => [f.key, String(initial[f.key] ?? "")])),
  );

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const values: ConfigValues = Object.fromEntries(
    config.fields.map((f) => [f.key, f.kind === "number" ? Number(texts[f.key]) : texts[f.key].trim()]),
  );
  const empty = config.fields.find((f) => f.kind === "number" && texts[f.key].trim() === "");
  const problem = empty ? `Enter a value for "${empty.label}".` : config.check(values, context);
  const unchanged = config.fields.every((f) => values[f.key] === initial[f.key]);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (problem !== null || unchanged) return;
    onSave(values);
    dialog.current?.close();
  }

  return (
    <dialog
      ref={dialog}
      className="app-dialog"
      aria-labelledby="config-title"
      onClose={onCancel}
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
    >
      <form onSubmit={save}>
        <div className="dialog-head">
          <h2 id="config-title">{title}: config</h2>
          <button type="button" className="dialog-close" aria-label="Cancel" onClick={() => dialog.current?.close()}>
            <CloseIcon />
          </button>
        </div>
        {config.fields.map((field) => (
          <div key={field.key}>
            {field.kind === "choice" ? (
              <div className="field">
                <span>{field.label}</span>
                <Picker
                  value={field.options?.find((o) => o.value === texts[field.key])?.label ?? texts[field.key]}
                  label={field.label}
                  groups={[
                    (field.options ?? []).map((o) => ({
                      label: o.label,
                      current: o.value === texts[field.key],
                      onSelect: () => setTexts((t) => ({ ...t, [field.key]: o.value })),
                    })),
                  ]}
                />
              </div>
            ) : (
              <label className="field">
                {field.label}
                <input
                  type={field.kind}
                  inputMode={field.kind === "number" ? "decimal" : undefined}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={field.placeholder}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={texts[field.key]}
                  onChange={(e) => setTexts((t) => ({ ...t, [field.key]: e.target.value }))}
                  aria-describedby={field.hint ? `config-${field.key}-hint` : undefined}
                />
              </label>
            )}
            {field.hint && (
              <p id={`config-${field.key}-hint`} className="field-hint">
                {field.hint}
              </p>
            )}
          </div>
        ))}
        <p className="field-message" role="alert">
          {problem}
        </p>
        <div className="dialog-buttons">
          <button type="button" className="button-secondary" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="button-primary" disabled={problem !== null || unchanged}>
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}
