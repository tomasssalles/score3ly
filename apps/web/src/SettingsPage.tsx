// The settings (DESIGN.md §5.1, §5.8): the user's, stored by the Worker. So far only the run mode new projects start
// with. A change is saved at once.

import { useEffect, useState } from "react";
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
        </dl>
      )}
    </div>
  );
}
