import { AboutPage } from "./AboutPage";
import { SettingsPage } from "./SettingsPage";
import type { Page } from "./route";

// The pages reached from the menu. Statistics and Help are placeholders for now: each says what it will hold.
const CONTENT: Record<Exclude<Page, "about" | "settings">, { title: string; text: string[] }> = {
  stats: {
    title: "Statistics",
    text: [
      "Costs per stage, per project and per month, in US dollars, including replaced stages and deleted projects.",
      "Runtimes of stages and whole pipelines, and averages per PDF page.",
    ],
  },
  help: {
    title: "Help",
    text: ["How to turn a printed score into MEI and LilyPond with this app."],
  },
};

export function PageView({ page }: { page: Page }) {
  if (page === "about") return <AboutPage />;
  if (page === "settings") return <SettingsPage />;
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
