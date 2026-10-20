// `extract`'s artifacts (DESIGN.md §6, §5.6): the score so far, system by system (each system's crop with its music
// below it, as a filmstrip, so that the end of one system and the start of the next are on screen together), and the
// issues raised, all of them in the score's order. The music is shown as the lens has it; the warnings come with their
// system.

import { useEffect, useRef, useState } from "react";
import { CLAUDE_IMAGE_LIMIT, CROP_VERSION, DESKEW_VERSION, ROTATE_VERSION, SCALE_VERSION } from "@score3ly/imaging";
import type { LensStretch } from "@score3ly/notation";
import { fetchJsonContent } from "./api";
import { Filmstrip } from "./ArtifactView";
import { systemCropBox, type StoredExtraction, type StoredIssue } from "./extract";
import type { PageLayout } from "./layout";
import { cropImage, type CropRecipe } from "./pageImages";
import type { Artifact } from "./pipeline";

type Loaded = { systems: { extraction: StoredExtraction; recipe: CropRecipe }[] };

function useExtractions(artifact: Artifact): Loaded | "error" | null {
  const [loaded, setLoaded] = useState<Loaded | "error" | null>(null);
  const data = artifact.extraction!;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pages = artifact.pages ?? [];
      const layouts = new Map(
        await Promise.all(pages.map(async (p) => [p.page, (await fetchJsonContent(p.layoutSha256!)) as PageLayout] as const)),
      );
      const extractions = await Promise.all(
        data.systems.map(async (s) => ({ index: s.index, extraction: (await fetchJsonContent(s.sha256)) as StoredExtraction })),
      );
      const systems = extractions
        .sort((a, b) => a.extraction.system - b.extraction.system)
        .flatMap(({ index, extraction }) => {
          const page = pages.find((p) => p.page === extraction.page);
          const layout = layouts.get(extraction.page);
          const system = layout?.systems[index - 1];
          if (!page || !layout || !system) return [];
          const recipe: CropRecipe = {
            straight: { page: page.recipe, angle: layout.angle, deskew: DESKEW_VERSION, rotate: ROTATE_VERSION },
            box: systemCropBox(system),
            crop: CROP_VERSION,
            limit: CLAUDE_IMAGE_LIMIT,
            scale: SCALE_VERSION,
          };
          return [{ extraction, recipe }];
        });
      if (!cancelled) setLoaded({ systems });
    })().catch(() => !cancelled && setLoaded("error"));
    return () => {
      cancelled = true;
    };
  }, [data.systems.map((s) => s.sha256).join()]);
  return loaded;
}

export function ExtractionView({ artifact }: { artifact: Artifact }) {
  const loaded = useExtractions(artifact);
  if (loaded === "error") return <div className="text-view"><p>The extraction couldn't be loaded.</p></div>;
  if (!loaded) return <div className="text-view"><p>Loading the extraction…</p></div>;
  if (artifact.extraction!.view === "issues") return <IssuesList systems={loaded.systems.map((s) => s.extraction)} />;
  const { systems } = loaded;
  return (
    <Filmstrip
      count={systems.length}
      wide={true}
      render={(i) => {
        const { extraction, recipe } = systems[i];
        return (
          <figure className="film-item">
            <figcaption>
              System {extraction.system} · page {extraction.page}
            </figcaption>
            <CropView recipe={recipe} label={`System ${extraction.system}`} />
            <SystemMusic extraction={extraction} />
          </figure>
        );
      }}
    />
  );
}

// A crop, from the device's cache or cut again from its page (DESIGN.md §5.3), once it scrolls near the view.
function CropView({ recipe, label }: { recipe: CropRecipe; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: "100% 0px" });
    observer.observe(box.current!);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    cropImage(recipe).then(
      (png) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(png);
        setUrl(objectUrl);
      },
      (err) => !cancelled && setError(`This system can't be drawn: ${err instanceof Error ? err.message : err}`),
    );
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [near, JSON.stringify(recipe)]);
  return (
    <div ref={box} className="page-image">
      {url ? <img src={url} alt={label} /> : <div className="page-placeholder crop-placeholder">{error ?? "Drawing the system…"}</div>}
    </div>
  );
}

const CLASS_LABELS: Record<LensStretch["class"], string> = { new: "new measure", continues: "continues the measure", none: "no measure" };

function stretchHead(s: LensStretch): string {
  const parts = [`Stretch ${s.stretch}`, s.class === "new" && s.kind !== "normal" ? `${CLASS_LABELS.new}, ${s.kind}` : CLASS_LABELS[s.class]];
  if (s.printedNumber) parts.push(`m. ${s.printedNumber}`);
  for (const c of s.changes) parts.push(`staff ${c.staff}: ${[c.key && `key ${c.key}`, c.time && `time ${c.time}`].filter(Boolean).join(", ")}`);
  if (s.ending) parts.push(`ending${s.ending.label ? ` ${s.ending.label}` : ""}${s.ending.startsHere ? " starts" : ""}${s.ending.endsHere ? " ends" : ""}`);
  if (s.rightBarLine !== "single") parts.push(`bar line: ${s.rightBarLine}`);
  return parts.join(" · ");
}

// A system's music as the lens has it: the staves at its start, then each stretch with its voices.
function SystemMusic({ extraction }: { extraction: StoredExtraction }) {
  const { answer, issues, warnings } = extraction;
  return (
    <div className="system-music">
      <p className="system-staves">
        {answer.startRepeat && "Start repeat · "}
        {answer.staves.map((s) => `staff ${s.staff}${s.label ? ` "${s.label}"` : ""}: ${s.clef}, key ${s.key}${s.time ? `, ${s.time}` : ""}`).join(" · ")}
        {answer.lastMeasureContinues && " · the last measure continues"}
      </p>
      {answer.stretches.map((s) => (
        <div key={s.stretch} className="stretch-music">
          <p className="stretch-head">{stretchHead(s)}</p>
          {s.voices.map((v) => (
            <pre key={v.voice}>
              <span className="voice-name">
                v{v.voice}/s{v.staff}
              </span>{" "}
              {v.music}
            </pre>
          ))}
        </div>
      ))}
      {warnings.map((w, i) => (
        <p key={i} className="extraction-warning">
          {w.message}
        </p>
      ))}
      {issues.map((issue) => (
        <IssueCard key={issue.id} issue={issue} />
      ))}
    </div>
  );
}

function IssueCard({ issue, system }: { issue: StoredIssue; system?: number }) {
  return (
    <div className="issue-card">
      <p className="issue-head">
        #{issue.id} · {issue.class}
        {issue.source === "code" ? " · raised by code" : ""}
        {system !== undefined ? ` · system ${system}` : ""}
      </p>
      <p>
        {issue.location ? `${issue.location}: ` : ""}
        {issue.question}
      </p>
      {issue.answers.length > 0 && (
        <ul>
          {issue.answers.map((a) => (
            <li key={a.key} className={a.key === issue.applied ? "applied" : undefined}>
              {a.key}) {a.text}
              {a.key === issue.applied ? " ✓" : ""}
            </li>
          ))}
        </ul>
      )}
      {issue.lilypond && <p className="issue-tokens">{issue.lilypond.join(" ")}</p>}
    </div>
  );
}

function IssuesList({ systems }: { systems: StoredExtraction[] }) {
  const all = systems.flatMap((s) => s.issues.map((issue) => ({ issue, system: s.system })));
  if (all.length === 0) return <div className="text-view"><p>No issues were raised.</p></div>;
  return (
    <div className="text-view">
      <div className="issues-list">
        {all.map(({ issue, system }) => (
          <IssueCard key={issue.id} issue={issue} system={system} />
        ))}
      </div>
    </div>
  );
}
