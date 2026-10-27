import { AboutPage } from "./AboutPage";
import { SettingsPage } from "./SettingsPage";
import { StatsPage } from "./StatsPage";
import type { Page } from "./route";

// The pages reached from the menu. Help is a placeholder for now: it says what it will hold.
const CONTENT: Record<Exclude<Page, "about" | "settings" | "stats">, { title: string; text: string[] }> = {
  help: {
    title: "Help",
    text: ["How to turn a printed score into MEI and LilyPond with this app."],
  },
};

export function PageView({ page }: { page: Page }) {
  if (page === "about") return <AboutPage />;
  if (page === "settings") return <SettingsPage />;
  if (page === "stats") return <StatsPage />;
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
