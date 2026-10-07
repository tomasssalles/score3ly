import type { Page } from "./route";

// The pages reached from the menu. Placeholders for now: each says what it will hold.
const CONTENT: Record<Page, { title: string; text: string[] }> = {
  stats: {
    title: "Statistics",
    text: [
      "Costs per stage, per project and per month, in US dollars, including replaced stages and deleted projects.",
      "Runtimes of stages and whole pipelines, and averages per PDF page.",
    ],
  },
  settings: {
    title: "Settings",
    text: ["The spending cap (at most $X within any 24 hours) and which LLM configs are on a free tier."],
  },
  help: {
    title: "Help",
    text: ["How to turn a printed score into MEI and LilyPond with this app."],
  },
  about: {
    title: "About",
    text: ["score3ly turns printed musical scores into MEI and LilyPond, with vision LLMs doing the reading."],
  },
};

export function PageView({ page }: { page: Page }) {
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
