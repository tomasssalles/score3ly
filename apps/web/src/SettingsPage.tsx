// The settings (DESIGN.md §5.1, §5.8, §10): the user's, stored by the Worker. So far the run mode new projects start
// with and the spending cap. A pick is saved at once, an amount when it is left or Enter is pressed.

import { useEffect, useState, type KeyboardEvent } from "react";
import { fetchSettings, putSetting, type Settings } from "./api";
import { DropdownMenu } from "./DropdownMenu";
import { ChevronDownIcon } from "./icons";
import { MODE_LABELS, MODES } from "./pipeline";

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings().then(setSettings, () => setError("The settings couldn't be loaded."));
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
              At most this much within any 24 hours, in US dollars. Paid LLM calls are refused once it is reached, and
              until it is set.
            </span>
          </dt>
          <dd>
            <SpendingCap key={settings.spendingCapUsd ?? "none"} value={settings.spendingCapUsd} onSave={(usd) => save("spendingCapUsd", usd)} />
          </dd>
        </dl>
      )}
    </div>
  );
}

// An amount as shown: two decimals where they are enough ("1.50").
const amount = (usd: number | null) => (usd === null ? "" : Number.isInteger(Math.round(usd * 1e6) / 1e4) ? usd.toFixed(2) : String(usd));

// An amount in US dollars above 0, typed. Left empty or invalid, nothing is saved and the reason is shown.
function SpendingCap({ value, onSave }: { value: number | null; onSave: (usd: number) => void }) {
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
        placeholder="Not set"
        aria-label="Spending cap in US dollars per 24 hours"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
      {problem && <p className="settings-error">{problem}</p>}
    </div>
  );
}
