// The Statistics page, in tabs: Costs (CostsTab.tsx), Usage (UsageTab.tsx), Run times (RunTimesTab.tsx) and Effort
// (EffortTab.tsx).

import { CostsTab } from "./CostsTab";
import { EffortTab } from "./EffortTab";
import { RunTimesTab } from "./RunTimesTab";
import { UsageTab } from "./UsageTab";
import type { TabOf } from "./route";
import { Tabs } from "./ui/Tabs";

// The page's tabs, each with its own URL ("#/stats/usage"; "#/stats" opens the first). Switching tabs replaces the URL rather than adding to the
// history, so back leaves the page, as from any other page of the menu.
const TABS: { id: TabOf<"stats">; label: string }[] = [
  { id: "costs", label: "Costs" },
  { id: "usage", label: "Usage" },
  { id: "times", label: "Run times" },
  { id: "effort", label: "Effort" },
];

export function StatsPage({ tab, onTab }: { tab: TabOf<"stats">; onTab: (tab: TabOf<"stats">) => void }) {
  return (
    <div className="page-view stats">
      <h2>Statistics</h2>
      <Tabs tabs={TABS} current={tab} onTab={onTab} label="Statistics" />
      <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label}>
        {tab === "costs" && <CostsTab />}
        {tab === "usage" && <UsageTab />}
        {tab === "times" && <RunTimesTab />}
        {tab === "effort" && <EffortTab />}
      </div>
    </div>
  );
}
