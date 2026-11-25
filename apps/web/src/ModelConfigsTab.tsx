// The Settings page's "Model configs" tab (docs/llm.md, "The settings page"; docs/project-view.md, "The menu and its
// pages"): the configs, in the order picked and as filtered, each with its actions (Test, Make default, Rename, Clone,
// Delete), and the "+" that makes one. The config form is NewModelConfig.tsx; the list's order and filter configList.ts.

import { errorText, type Host, SECRET_LABELS } from "@score3ly/core";
import { useEffect, useState } from "react";
import { deleteModelConfig, fetchModelOptions, fetchPriceRange, fetchSecretNames, putSetting, renameModelConfig, type ModelConfig, type ModelOptions, type PriceRange } from "./api";
import { NewModelConfig } from "./NewModelConfig";
import { regionLabel, routingLabel } from "./configForm";
import { DropdownMenu } from "./ui/DropdownMenu";
import { count } from "./format";
import { useHost } from "./host";
import { ACCOUNT_NAMES, pricingText } from "./pricing";
import { FilterIcon, MoreIcon, PlusIcon } from "./ui/icons";
import { CheckList } from "./ui/CheckList";
import { FilterSection } from "./ui/FilterSection";
import { OptionPicker } from "./ui/Picker";
import {
  CONFIG_FACETS,
  CONFIG_ORDERS,
  facetValues,
  filtering,
  modelLabel,
  NO_FILTER,
  shownConfigs,
  sortedConfigs,
  type ConfigFilter,
  type ConfigOrder,
} from "./configList";
import { ConfirmDialog } from "./ConfirmDialog";
import { RenameDialog } from "./RenameDialog";
import { TestConfigDialog } from "./TestConfigDialog";

// Where the secrets are set, under the new config form's secret pickers (the Secrets section below says more).
const SECRETS_HINTS: Record<Host, string> = {
  cloudflare: "The Worker's secrets, by name: set in the Cloudflare dashboard or with wrangler secret put (Secrets, below).",
  desktop: "The secrets file's names: open it with \"Open the secrets file\" (Secrets, below).",
  local: "The names in secrets.env, in the server's data folder (Secrets, below).",
};

// The filter of the configs (docs/project-view.md, "The menu and its pages"): by provider and by model, each a section
// that can be collapsed (expanded at first, a coral dot while collapsed with anything taken out), as the statistics'
// filters are. Each lists the values the configs have; one unticked hides the configs that have it.
function ConfigFilterPanel({ configs, filter, onChange }: { configs: ModelConfig[]; filter: ConfigFilter; onChange: (filter: ConfigFilter) => void }) {
  return (
    <div className="costs-panel filter-panel">
      {CONFIG_FACETS.map(({ id: facet, label }) => (
        <FilterSection key={facet} label={label} dot={filter[facet].length > 0}>
          <CheckList
            allLabel="All"
            items={facetValues(configs, facet, providerName).map((v) => ({ key: v.key, name: v.label }))}
            out={filter[facet]}
            onOut={(out) => onChange({ ...filter, [facet]: [...out] })}
          />
        </FilterSection>
      ))}
      {filtering(filter) && (
        <button type="button" className="link-button" onClick={() => onChange(NO_FILTER)}>
          Show all
        </button>
      )}
    </div>
  );
}

// A provider's name in the filter: without the fake ones' explanation ("Fake", "Fake with costs").
const providerName = (provider: ModelConfig["provider"]) => (PROVIDERS[provider] ?? provider).replace(/ \(.*\)$/, "");

const PROVIDERS: Record<ModelConfig["provider"], string> = {
  anthropic: "Anthropic",
  bedrock: "Bedrock",
  "ai-studio": "AI Studio",
  openrouter: "OpenRouter",
  vertex: "Vertex AI",
  fake: "Fake (no network, no costs, for trying the app)",
  "fake-dev": "Fake with costs (for development)",
};

// The model configs (docs/llm.md), as stored: each with its name, whether it is the default and on a free tier, its
// provider, model (its name for people where it is listed) and effort, where its requests go (a region, a routing, a
// project), how it is priced, and its secrets by the name of the Worker secret, never a value.
export function ModelConfigs({ configs, defaultId, onChanged }: { configs: ModelConfig[]; defaultId: string | null; onChanged: () => void }) {
  const host = useHost();
  // The config form, with what its pickers offer, once loaded: a new config, or a clone of `from`.
  const [creating, setCreating] = useState<{ options: ModelOptions; secretNames: string[]; from: ModelConfig | null } | null>(null);
  const [renaming, setRenaming] = useState<ModelConfig | null>(null);
  const [deleting, setDeleting] = useState<ModelConfig | null>(null);
  const [testing, setTesting] = useState<ModelConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  function openForm(from: ModelConfig | null) {
    setError(null);
    Promise.all([fetchModelOptions(), fetchSecretNames()]).then(
      ([options, secretNames]) =>
        // A provider for development the Worker doesn't offer now (DEV_PROVIDERS, docs/llm.md): the form can't show it.
        from && !options.providers.some((p) => p.id === from.provider)
          ? setError(`"${from.name}" uses a provider this app doesn't offer now, so it can't be cloned.`)
          : setCreating({ options, secretNames, from }),
      () => setError("The models couldn't be loaded."),
    );
  }
  // The default model config, picked here too (as on the General tab and in the config form).
  function makeDefault(config: ModelConfig) {
    setError(null);
    putSetting("defaultModelConfigId", config.id).then(onChanged, (err) => setError(errorText(err)));
  }
  // A config's actions (docs/llm.md, "Managing model configs"): no Edit. Delete isn't offered for the default (it can't
  // be deleted until another config is the default). Test only for real providers, and configs the app supports.
  const actions = (config: ModelConfig) => [
    ...(config.provider !== "fake" && config.provider !== "fake-dev" && !config.unsupported ? [[{ label: "Test", onSelect: () => setTesting(config) }]] : []),
    [
      // Not for the default itself, nor a config the app no longer supports (the Worker refuses it as the default).
      ...(config.id === defaultId || config.unsupported ? [] : [{ label: "Make default", onSelect: () => makeDefault(config) }]),
      { label: "Rename", onSelect: () => setRenaming(config) },
      { label: "Clone", onSelect: () => openForm(config) },
    ],
    ...(config.id === defaultId ? [] : [[{ label: "Delete", danger: true, onSelect: () => setDeleting(config) }]]),
  ];
  // Only what is shown changes; the order and the filter are forgotten when the page is left, like the statistics'.
  const [order, setOrder] = useState<ConfigOrder>("newest");
  const [filter, setFilter] = useState<ConfigFilter>(NO_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);
  const shown = shownConfigs(sortedConfigs(configs, order), filter, providerName);
  const hidden = configs.length - shown.length;
  return (
    <section className="settings-section">
      {/* The tab's title says what it lists: its head is its tools. */}
      <div className="settings-section-head config-tools">
        <OptionPicker label="Order" value={order} options={CONFIG_ORDERS} onChange={setOrder} />
        <button
          type="button"
          className="editor-mode"
          aria-pressed={filterOpen}
          aria-label="Filters"
          title="Filters"
          onClick={() => setFilterOpen(!filterOpen)}
        >
          <FilterIcon />
          {filtering(filter) && <span className="toggle-dot" />}
        </button>
        <span className="config-tools-gap" />
        <button type="button" className="icon-button" aria-label="New model config" title="New model config" onClick={() => openForm(null)}>
          <PlusIcon />
        </button>
      </div>
      {filterOpen && <ConfigFilterPanel configs={configs} filter={filter} onChange={setFilter} />}
      {!filterOpen && hidden > 0 && (
        <p className="costs-filtered">
          {count(hidden, "config")} hidden by filters ·{" "}
          <button type="button" className="link-button" onClick={() => setFilter(NO_FILTER)}>
            Show all
          </button>
        </p>
      )}
      {error && <p className="settings-error error-text">{error}</p>}
      {creating && (
        <NewModelConfig
          options={creating.options}
          secretNames={creating.secretNames}
          secretsHint={SECRETS_HINTS[host ?? "cloudflare"]}
          configs={configs}
          from={creating.from}
          isDefault={creating.from !== null && creating.from.id === defaultId}
          onCreated={onChanged}
          onClose={() => setCreating(null)}
        />
      )}
      {renaming && (
        <RenameDialog
          title="Rename model config"
          current={renaming.name}
          save={async (name) => {
            await renameModelConfig(renaming.id, name);
          }}
          onDone={() => {
            setRenaming(null);
            onChanged();
          }}
          onCancel={() => setRenaming(null)}
        />
      )}
      {testing && <TestConfigDialog config={testing} onDone={() => setTesting(null)} />}
      {deleting && (
        <ConfirmDialog
          danger
          title="Are you sure?"
          text={[
            `The model config "${deleting.name}" will be deleted. Stages that ran with it keep showing it; stages that haven't can't start with it until another config is picked for them.`,
            "This action cannot be undone.",
          ]}
          confirmLabel="Delete config"
          onConfirm={() => {
            const config = deleting;
            setDeleting(null);
            deleteModelConfig(config.id).then(onChanged, (err) => setError(errorText(err)));
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
      <p className="settings-hint model-configs-note">Prices as the providers list them, without VAT.</p>
      {configs.length === 0 && <p>No model configs yet.</p>}
      {configs.length > 0 && shown.length === 0 && <p className="settings-hint">The filters hide every config.</p>}
      <ul className="model-configs">
        {shown.map((config) => (
          <li key={config.id} className="model-config">
            <div className="model-config-head">
              <p className="model-config-name">
                {config.name}
                {config.id === defaultId && <span className="badge">Default</span>}
                {config.freeTier && <span className="badge muted">Free tier</span>}
                {config.unsupported && <span className="badge danger">No longer supported</span>}
              </p>
              <DropdownMenu icon={<MoreIcon />} label={`${config.name}: actions`} groups={actions(config)} />
            </div>
            <dl className="model-config-facts">
              <dt>Provider</dt>
              <dd>{PROVIDERS[config.provider] ?? config.provider}</dd>
              <dt>Model</dt>
              <dd>
                {config.modelName ?? <span className="mono">{modelLabel(config)}</span>}

              </dd>
              <dt>Effort</dt>
              <dd>{config.effort ?? "Default"}</dd>
              {config.region && <Fact label="Region" value={regionLabel(config.provider, config.region)} />}
              {config.routing && (
                <>
                  <dt>Routing</dt>
                  <dd>{routingLabel(config.routing)}</dd>
                </>
              )}
              {config.project && <Fact label="Project" value={config.project} />}
              {config.account && (
                <>
                  <dt>Account</dt>
                  <dd>{ACCOUNT_NAMES[config.account]}</dd>
                </>
              )}
              <dt>Pricing</dt>
              {config.price.kind === "provider" ? <ProviderPricing config={config} /> : <dd>{pricingText(config)}</dd>}
              {Object.entries(config.secrets).map(([field, secret]) => (
                <Fact key={`s-${field}`} label={SECRET_LABELS[field] ?? field} value={secret} hint={host === "cloudflare" ? "Worker secret" : "Secret"} />
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}

// The pricing of a config priced by its provider (docs/llm.md, "OpenRouter"): the range among those who run the model,
// read from the provider when the card shows, with the fee included; until then, or where it can't be read, how it is
// priced. Only a guide: each call costs what its answer says.
function ProviderPricing({ config }: { config: ModelConfig }) {
  const [range, setRange] = useState<PriceRange | null>(null);
  useEffect(() => {
    let live = true;
    fetchPriceRange(config.id).then((r) => live && setRange(r), () => {});
    return () => {
      live = false;
    };
  }, [config.id]);
  return <dd>{pricingText(config, range)}</dd>;
}

// A fact of a card in code type: a region, a project, a secret's name (`label`: what it is).
function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>
        <span className="mono">{value}</span>
        {hint && <span className="model-config-hint"> ({hint})</span>}
      </dd>
    </>
  );
}
