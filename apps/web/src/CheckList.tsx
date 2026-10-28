// A list to select items from, each with a box (docs/style.md, "Check lists"): the statistics' filters. A box above the
// items selects all or none, with a dash in it while only some are selected; beside it, an optional menu of actions.
// Each item has a name, optional facts under it and amounts on the right. The list doesn't scroll by itself: the panel
// holding it does, as one.

import type { ReactNode } from "react";
import { CheckIcon } from "./icons";

export type CheckItem = { key: string; name: string; note?: string; facts?: string; amounts?: string[] };

export function CheckList({
  allLabel,
  items,
  isOn,
  setOn,
  menu,
}: {
  allLabel: string; // e.g. "All projects"
  items: CheckItem[];
  isOn: (key: string) => boolean;
  setOn: (keys: string[], on: boolean) => void;
  menu?: ReactNode;
}) {
  const on = items.filter((item) => isOn(item.key)).length;
  const all = on === items.length;
  const none = on === 0;
  return (
    <div className="check-list">
      <div className="check-tools">
        <button
          type="button"
          role="checkbox"
          aria-checked={all ? true : none ? false : "mixed"}
          className="check-row check-all"
          onClick={() => setOn(items.map((item) => item.key), !all)}
        >
          <span className="check-box">{all ? <CheckIcon /> : none ? null : <span className="check-mixed" />}</span>
          <span className="check-name">{allLabel}</span>
        </button>
        {menu}
      </div>
      <ul>
        {items.map((item) => {
          const checked = isOn(item.key);
          return (
            <li key={item.key}>
              <button type="button" role="checkbox" aria-checked={checked} className="check-row" onClick={() => setOn([item.key], !checked)}>
                <span className="check-box">{checked && <CheckIcon />}</span>
                <span className="check-name">
                  {item.name}
                  {item.note && <span className="menu-note"> {item.note}</span>}
                  {item.facts && <span className="check-facts">{item.facts}</span>}
                </span>
                {(item.amounts ?? []).map((amount, i) => (
                  <span key={i} className={i === 0 ? "check-amount" : "check-amount muted"}>
                    {amount}
                  </span>
                ))}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
