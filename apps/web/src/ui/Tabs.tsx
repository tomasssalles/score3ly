// A page's tabs (the Statistics and Settings pages): a row of tab buttons, the current one marked; the page shows the
// current tab's content and gives each tab its URL (route.ts).

export function Tabs<T extends string>({
  tabs,
  current,
  onTab,
  label,
}: {
  tabs: { id: T; label: string }[];
  current: T;
  onTab: (tab: T) => void;
  label: string; // the tab list's accessible name, e.g. "Statistics"
}) {
  return (
    <div className="stats-tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={t.id === current} className="stats-tab" onClick={() => onTab(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
