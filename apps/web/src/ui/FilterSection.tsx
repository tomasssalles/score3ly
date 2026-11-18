// A section of a filter panel that can be collapsed (docs/style.md, "Check lists"): expanded at first, a coral dot on
// its name while collapsed with anything filtered out (`dot`). `controls` follow the name on its line (e.g. a grouping's
// picker); `children` is what collapses (the check list).

import { type ReactNode, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "../icons";

export function FilterSection({ label, dot, controls, children }: { label: string; dot: boolean; controls?: ReactNode; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="filter-section">
      <div className="costs-panel-row">
        <button type="button" className="section-toggle" aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
          {label}
          {collapsed && dot && <span className="inline-dot" aria-label="some hidden" />}
        </button>
        {controls}
      </div>
      {!collapsed && children}
    </div>
  );
}
