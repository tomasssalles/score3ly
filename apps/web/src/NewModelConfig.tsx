// The form that creates a model config (docs/llm.md, "The settings page"), opened by the "+" of "Model configs":
// everything picked but the name and a model added by hand's string. Its logic is in configForm.ts.

import { useEffect, useRef, useState } from "react";
import { createModelConfig, putSetting, type ModelConfig, type ModelOptions } from "./api";
import {
  confirmationOf,
  defaultName,
  familyOption,
  initialForm,
  hasRegions,
  listedModel,
  missing,
  modelsOf,
  priceAt,
  providerOf,
  referencesOf,
  regionsOf,
  requestOf,
  routingLabel,
  routingsOf,
  servedAtRegion,
  settled,
  withProvider,
  type FormState,
} from "./configForm";
import { ConfirmDialog } from "./ConfirmDialog";
import { Picker } from "./fieldList";
import { CloseIcon } from "./icons";
import { Info } from "./Info";
import { pricesText } from "./pricing";

const FIELD_LABELS: Record<string, string> = {
  apiKey: "API key",
  serviceAccount: "Service account",
  accessKeyId: "Access key ID",
  secretAccessKey: "Secret access key",
};

const ADD_BY_HAND = "Unlisted model, by the exact identifier the provider's API expects";

export function NewModelConfig({
  options,
  secretNames,
  secretsHint,
  onCreated,
  onCancel,
}: {
  options: ModelOptions;
  secretNames: string[];
  secretsHint: string; // where the secrets are set, as the host says it
  onCreated: (config: ModelConfig) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [form, setFormRaw] = useState<FormState>(() => initialForm(options));
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setForm = (change: Partial<FormState>) => {
    setError(null);
    setFormRaw((f) => settled(options, { ...f, ...change }));
  };

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const provider = providerOf(options, form);
  const family = familyOption(options, form);
  const listed = listedModel(options, form);
  const problem = missing(options, form);
  const name = defaultName(options, form);
  const price = priceAt(options, form);

  async function create() {
    setBusy(true);
    try {
      const config = await createModelConfig(requestOf(form));
      if (form.makeDefault) await putSetting("defaultModelConfigId", config.id);
      onCreated(config);
      dialog.current?.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (problem !== null || busy) return;
    const confirmation = confirmationOf(options, form);
    if (confirmation) setConfirming(confirmation);
    else void create();
  }

  // The model picker: the provider's listed models, those served at the region picked first, the others after it (one
  // of them clears the region); then a model of one's own.
  const models = provider ? modelsOf(options, provider.id) : [];
  const here = models.filter((m) => servedAtRegion(m, provider!.id, form.region));
  const elsewhere = models.filter((m) => !servedAtRegion(m, provider!.id, form.region));
  const allGroups = [
    here.map((m) => ({ label: m.name, current: listed?.id === m.id, onSelect: () => setForm({ model: { kind: "listed", id: m.id } }) })),
    elsewhere.map((m) => ({ label: m.name, current: false, onSelect: () => setForm({ model: { kind: "listed", id: m.id }, region: null, routing: null }) })),
    [{ label: ADD_BY_HAND, current: form.model?.kind === "added", onSelect: () => setForm({ model: { kind: "added", string: "", family: null } }) }],
  ];
  const allHeadings = ["", `Not in ${form.region}`, ""];
  const kept = allGroups.map((g, i) => i).filter((i) => allGroups[i].length > 0);
  const modelGroups = kept.map((i) => allGroups[i]);
  const modelHeadings = kept.map((i) => allHeadings[i]);
  const modelLabel = listed?.name ?? (form.model?.kind === "added" ? ADD_BY_HAND : "Pick one");
  const addedFamily = form.model?.kind === "added" ? form.model.family : null;

  return (
    <dialog
      ref={dialog}
      className="app-dialog config-form"
      aria-labelledby="new-config-title"
      onClose={onCancel}
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
    >
      <form onSubmit={submit}>
        <div className="dialog-head">
          <h2 id="new-config-title">New model config</h2>
          <button type="button" className="dialog-close" aria-label="Cancel" onClick={() => dialog.current?.close()}>
            <CloseIcon />
          </button>
        </div>

        <PickerField label="Provider">
          <Picker
            value={provider?.name ?? "Pick one"}
            label="Provider"
            fitted
            groups={[
              options.providers.map((p) => ({
                label: p.name,
                current: p.id === form.provider,
                onSelect: () => {
                  setError(null);
                  setFormRaw((f) => (f.provider === p.id ? f : withProvider(options, f, p.id)));
                },
              })),
            ]}
          />
        </PickerField>

        {provider && (
          <PickerField label="Model">
            <Picker value={modelLabel} label="Model" fitted groups={modelGroups} headings={modelHeadings} />
          </PickerField>
        )}

        {form.model?.kind === "added" && (
          <>
            <label className="field">
              Model identifier, exactly as {provider!.name}'s API expects it
              <input
                autoComplete="off"
                spellCheck={false}
                value={form.model.string}
                onChange={(e) => setForm({ model: { kind: "added", string: e.target.value, family: form.model?.kind === "added" ? form.model.family : null } })}
              />
            </label>
            <PickerField label="Family">
              <Picker
                value={provider!.families.find((f) => f.id === addedFamily)?.name ?? "Pick one"}
                label="Family"
                fitted
                groups={[
                  provider!.families.map((f) => ({
                    label: f.name,
                    current: addedFamily === f.id,
                    onSelect: () => setForm({ model: { kind: "added", string: form.model?.kind === "added" ? form.model.string : "", family: f.id } }),
                  })),
                ]}
              />
            </PickerField>
            {provider!.families.length === 1 && (
              <p className="field-hint">The only family the app supports on {provider!.name}.</p>
            )}
          </>
        )}

        {provider && form.model && hasRegions(options, form) && (
          <PickerField label={provider.id === "vertex" ? "Location" : "Region"}>
            <Picker
              value={form.region ?? "Pick one"}
              label="Region"
              fitted
              groups={[regionsOf(options, form).map((r) => ({ label: r, current: r === form.region, onSelect: () => setForm({ region: r, routing: null }) }))]}
            />
          </PickerField>
        )}

        {form.region !== null && routingsOf(options, form).length > 0 && (
          <PickerField label="Routing">
            <Picker
              value={(() => {
                const r = routingsOf(options, form).find((x) => x.routing === form.routing);
                return r ? routingLabel(r.routing, r.geography) : "Pick one";
              })()}
              label="Routing"
              fitted
              groups={[
                routingsOf(options, form).map((r) => ({
                  label: routingLabel(r.routing, r.geography),
                  current: r.routing === form.routing,
                  onSelect: () => setForm({ routing: r.routing }),
                })),
              ]}
            />
          </PickerField>
        )}

        {family && (
          <PickerField label="Effort">
            <Picker
              value={form.effort ?? "Default"}
              label="Effort"
              fitted
              groups={[
                [{ label: "Default", current: form.effort === null, onSelect: () => setForm({ effort: null }) }],
                family.efforts.map((e) => ({ label: e, current: form.effort === e, onSelect: () => setForm({ effort: e }) })),
              ]}
            />
          </PickerField>
        )}

        {provider?.id === "vertex" && family && (
          <label className="field">
            Project
            <input autoComplete="off" spellCheck={false} placeholder="The service account's" value={form.project} onChange={(e) => setForm({ project: e.target.value })} />
          </label>
        )}

        {family && family.secrets[0].length > 0 && (
          <>
            {family.secrets.length > 1 && (
              <PickerField label="Credentials">
                <Picker
                  value={family.secrets[form.secretSet].map((f) => FIELD_LABELS[f] ?? f).join(" and ")}
                  label="Credentials"
                  fitted
                  groups={[
                    family.secrets.map((set, i) => ({
                      label: set.map((f) => FIELD_LABELS[f] ?? f).join(" and "),
                      current: i === form.secretSet,
                      onSelect: () => setForm({ secretSet: i, secrets: {} }),
                    })),
                  ]}
                />
              </PickerField>
            )}
            {family.secrets[form.secretSet].map((field) => (
              <PickerField key={field} label={FIELD_LABELS[field] ?? field}>
                <Picker
                  value={form.secrets[field] ?? (secretNames.length > 0 ? "Pick a secret" : "No secrets are set")}
                  label={FIELD_LABELS[field] ?? field}
                  fitted
                  groups={[secretNames.map((n) => ({ label: n, current: form.secrets[field] === n, onSelect: () => setForm({ secrets: { ...form.secrets, [field]: n } }) }))]}
                />
              </PickerField>
            ))}
            <p className="field-hint">{secretsHint}</p>
          </>
        )}

        {form.model && (
          <div className="field">
            <span>Pricing</span>
            {form.model.kind === "listed" ? (
              <PricingChoice
                checked={form.pricing === "list"}
                onCheck={() => setForm({ pricing: "list" })}
                label={form.pricing === "list" && price ? pricesText(price) : "The app's prices for this model"}
              />
            ) : (
              <>
                <PricingChoice
                  checked={form.pricing === "as"}
                  onCheck={() => setForm({ pricing: "as" })}
                  label="Priced as"
                  info="Its calls are counted at the prices of the model picked below, which may differ from this model's. Once the app's list of models has this model, its own prices are used from then on."
                />
                {form.pricing === "as" && (
                  <div className="model-config-field pricing-reference">
                    <Picker
                      value={options.models.find((m) => m.id === form.reference)?.name ?? "Pick one"}
                      label="Priced as"
                      fitted
                      groups={[referencesOf(options, form).map((m) => ({ label: m.name, current: m.id === form.reference, onSelect: () => setForm({ reference: m.id }) }))]}
                    />
                    {price && <p className="field-hint">{pricesText(price)}</p>}
                  </div>
                )}
                <PricingChoice
                  checked={form.pricing === "unpriced"}
                  onCheck={() => setForm({ pricing: "unpriced" })}
                  label="Unpriced"
                  info="Its calls are recorded without a cost: the costs count them apart, and the spending cap can't stop them. Once the app's list of models has this model, its prices are used from then on."
                />
              </>
            )}
            <PricingChoice
              checked={form.pricing === "free"}
              onCheck={() => setForm({ pricing: "free" })}
              label="Free tier"
              info="For a model your account doesn't pay for: its calls cost $0.00 and don't count towards the spending cap. It stays free when the app's list of models changes."
            />
          </div>
        )}

        <label className="field">
          Name
          <input
            className={form.nameEdited ? undefined : "default-value"}
            autoComplete="off"
            spellCheck={false}
            value={form.nameEdited ? form.name : (name ?? "")}
            onChange={(e) => setForm({ name: e.target.value, nameEdited: true })}
          />
        </label>
        <p className="field-hint">A default name based on the provider, model and effort level will be used, unless you edit the name directly.</p>

        <label className="field-check config-default">
          <input type="checkbox" checked={form.makeDefault} onChange={(e) => setForm({ makeDefault: e.target.checked })} />
          Make default
        </label>

        <p className="field-message" role="alert">
          {error ?? (form.provider ? problem : null)}
        </p>
        <div className="dialog-buttons">
          <button type="button" className="button-secondary" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="button-primary" disabled={problem !== null || busy}>
            Create config
          </button>
        </div>
      </form>
      {confirming && (
        <ConfirmDialog
          title="Are you sure?"
          text={[confirming]}
          confirmLabel="Create config"
          onConfirm={() => {
            setConfirming(null);
            void create();
          }}
          onCancel={() => setConfirming(null)}
        />
      )}
    </dialog>
  );
}

function PickerField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field model-config-field">
      <span>{label}</span>
      {children}
    </div>
  );
}

function PricingChoice({ checked, onCheck, label, info }: { checked: boolean; onCheck: () => void; label: string; info?: string }) {
  return (
    <div className="pricing-choice">
      <label className="field-check">
        <input type="radio" name="pricing" checked={checked} onChange={onCheck} />
        {label}
      </label>
      {info && <Info label={`About "${label}"`}>{info}</Info>}
    </div>
  );
}
