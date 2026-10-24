// The settings (DESIGN.md §5.1, §5.8, §7.2, §10): the user's, stored by the Worker. So far the run mode new projects
// start with and the spending cap, and the model configs, read-only. A pick is saved at once, an amount when it is
// left or Enter is pressed. Then this device's own: the theme (§5.7), kept in the browser.

import { useEffect, useState, type KeyboardEvent } from "react";
import { fetchModelConfigs, fetchSettings, putSetting, type ModelConfig, type Settings } from "./api";
import { DropdownMenu } from "./DropdownMenu";
import { ChevronDownIcon } from "./icons";
import { MODE_LABELS, MODES } from "./pipeline";
import { CHOICES, setThemeChoice, themeChoice } from "./themes";

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [configs, setConfigs] = useState<ModelConfig[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState(themeChoice);

  useEffect(() => {
    fetchSettings().then(setSettings, () => setError("The settings couldn't be loaded."));
    fetchModelConfigs().then(setConfigs, () => setError("The model configs couldn't be loaded."));
  }, []);

  async function save<K extends keyof Settings>(key: K, value: Settings[K]) {
    setError(null);
    try {
      setSettings(await putSetting(key, value));
    } catch (err) {
      setError(`Saving failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  return (
    <div className="page-view settings">
      <h2>Settings</h2>
      {error && <p className="settings-error">{error}</p>}
      {settings && (
        <dl className="settings-list">
          <dt>Run mode for new projects</dt>
          <dd>
            <DropdownMenu
              className="mode-picker"
              buttonClassName="mode-button"
              icon={
                <>
                  {MODE_LABELS[settings.newProjectRunMode]}
                  <ChevronDownIcon />
                </>
              }
              label="Run mode for new projects"
              groups={[
                MODES.map((mode) => ({
                  label: MODE_LABELS[mode],
                  current: mode === settings.newProjectRunMode,
                  onSelect: () => void save("newProjectRunMode", mode),
                })),
              ]}
            />
          </dd>
          <dt>
            Spending cap
            <span className="settings-hint">
              At most this much within any 24 hours, in US dollars. Paid LLM calls are refused once it is reached.
            </span>
          </dt>
          <dd>
            <SpendingCap key={settings.spendingCapUsd} value={settings.spendingCapUsd} onSave={(usd) => save("spendingCapUsd", usd)} />
          </dd>
        </dl>
      )}
      {settings && configs && <ModelConfigs configs={configs} defaultId={settings.defaultModelConfigId} />}
      <section className="settings-section">
        <h3>This device</h3>
        <dl className="settings-list">
          <dt>
            Theme
            <span className="settings-hint">Auto follows the system's light or dark setting, where the app has a theme for it.</span>
          </dt>
          <dd>
            <DropdownMenu
              className="mode-picker"
              buttonClassName="mode-button"
              icon={
                <>
                  {CHOICES.find((c) => c.value === theme)?.label}
                  <ChevronDownIcon />
                </>
              }
              label="Theme"
              groups={[
                CHOICES.map((c) => ({
                  label: c.label,
                  current: c.value === theme,
                  onSelect: () => {
                    setThemeChoice(c.value);
                    setTheme(c.value);
                  },
                })),
              ]}
            />
          </dd>
        </dl>
      </section>
    </div>
  );
}

const PROVIDERS: Record<ModelConfig["provider"], string> = {
  anthropic: "Anthropic API",
  "anthropic-vertex": "Claude on Google Vertex AI",
  "anthropic-bedrock": "Claude on AWS Bedrock",
  google: "Google Gemini API",
  fake: "Fake (no network, for tests)",
};

// The providers' fields by name (the Worker's FIELDS); one it doesn't know is shown as stored.
const FIELD_LABELS: Record<string, string> = {
  apiKey: "API key",
  serviceAccount: "Service account",
  accessKeyId: "Access key ID",
  secretAccessKey: "Secret access key",
  region: "Region",
  projectId: "Project",
};

// The model configs (DESIGN.md §7.2), as stored: each with its name (else its model), whether it is the default and
// on a free tier, its provider, model and effort, its plain values (a region, a project) and its secrets by the name
// of the Worker secret, never a value.
function ModelConfigs({ configs, defaultId }: { configs: ModelConfig[]; defaultId: string | null }) {
  return (
    <section className="settings-section">
      <h3>Model configs</h3>
      {configs.length === 0 && <p>No model configs yet.</p>}
      <ul className="model-configs">
        {configs.map((config) => (
          <li key={config.id} className="model-config">
            <p className="model-config-name">
              {config.name ?? config.model}
              {config.id === defaultId && <span className="badge">Default</span>}
              {config.freeTier && <span className="badge muted">Free tier</span>}
            </p>
            <dl className="model-config-facts">
              <dt>Provider</dt>
              <dd>{PROVIDERS[config.provider] ?? config.provider}</dd>
              <dt>Model</dt>
              <dd className="mono">{config.model}</dd>
              <dt>Effort</dt>
              <dd>{config.effort ?? "the model's default"}</dd>
              {Object.entries(config.params).map(([key, value]) => (
                <Fact key={`p-${key}`} label={key} value={value} />
              ))}
              {Object.entries(config.secrets).map(([field, secret]) => (
                <Fact key={`s-${field}`} label={field} value={secret} hint="Worker secret" />
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <>
      <dt>{FIELD_LABELS[label] ?? label}</dt>
      <dd>
        <span className="mono">{value}</span>
        {hint && <span className="model-config-hint"> ({hint})</span>}
      </dd>
    </>
  );
}

// An amount as shown: two decimals where they are enough ("1.50").
const amount = (usd: number) => (Number.isInteger(Math.round(usd * 1e6) / 1e4) ? usd.toFixed(2) : String(usd));

// An amount in US dollars above 0, typed. Left empty or invalid, nothing is saved and the reason is shown; Escape
// brings back the cap as it is (there is always one).
function SpendingCap({ value, onSave }: { value: number; onSave: (usd: number) => void }) {
  const [text, setText] = useState(amount(value));
  const [problem, setProblem] = useState<string | null>(null);

  function commit() {
    const trimmed = text.trim();
    const usd = Number(trimmed);
    if (trimmed === "" || !Number.isFinite(usd) || usd <= 0) {
      setProblem("Enter an amount above $0.");
      return;
    }
    setProblem(null);
    if (usd !== value) onSave(usd);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") {
      setText(amount(value));
      setProblem(null);
    }
  }

  return (
    <div className="settings-amount">
      <span className="settings-currency">$</span>
      <input
        className="field-input"
        inputMode="decimal"
        value={text}
        aria-label="Spending cap in US dollars per 24 hours"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
      {problem && <p className="settings-error">{problem}</p>}
    </div>
  );
}
