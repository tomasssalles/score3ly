import { AboutPage } from "./AboutPage";
import { SettingsPage } from "./SettingsPage";
import { lazy, Suspense } from "react";
import { hashForTab, tabFromHash, type Page } from "./route";

// Loaded when first opened, to keep it out of the bundle every visit downloads (docs/tasks.md, the build's warning).
const StatsPage = lazy(() => import("./StatsPage").then((m) => ({ default: m.StatsPage })));

// The pages reached from the menu. Help is a placeholder for now: it says what it will hold.
const CONTENT: Record<Exclude<Page, "about" | "settings" | "stats">, { title: string; text: string[] }> = {
  help: {
    title: "Help",
    text: ["How to turn a printed score into MEI and LilyPond with this app."],
  },
};

// The whole width scrolls, not only the page's narrower column in the middle.
// The hash shown, for the tabs; a tab replaces the URL, so back leaves the page (docs/project-view.md, "The menu").
type Props = { page: Page; hash: string; replace: (hash: string) => void };

export function PageView(props: Props) {
  return (
    <div className="page-scroll">
      <PageContent {...props} />
    </div>
  );
}

function PageContent({ page, hash, replace }: Props) {
  if (page === "about") return <AboutPage />;
  if (page === "settings") return <SettingsPage tab={tabFromHash("settings", hash)} onTab={(tab) => replace(hashForTab("settings", tab))} />;
  if (page === "stats") {
    return (
      <Suspense fallback={<div className="page-view stats" />}>
        <StatsPage tab={tabFromHash("stats", hash)} onTab={(tab) => replace(hashForTab("stats", tab))} />
      </Suspense>
    );
  }
  const { title, text } = CONTENT[page];
  return (
    <div className="page-view">
      <h2>{title}</h2>
      {text.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <p className="placeholder-note">Not built yet.</p>
    </div>
  );
}
