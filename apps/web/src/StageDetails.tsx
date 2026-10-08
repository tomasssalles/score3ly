import { dollars } from "./money";
import type { Stage, StageKind, StageStatus } from "./pipeline";
import { duration } from "./time";

export const KIND_LABELS: Record<StageKind, string> = { computed: "Computed", llm: "LLM", manual: "Manual" };

const STATUS_LABELS: Record<StageStatus, string> = {
  done: "Done",
  running: "Running",
  failed: "Failed",
  wip: "In progress",
  ready: "Ready to run",
  planned: "Planned",
};

// A stage's details, shown in the artifact view ("Show details" in the stage's menu): what the card leaves out.
export function StageDetails({ stage }: { stage: Stage }) {
  const facts: [string, string][] = [
    ["Step", stage.step],
    ["Kind", KIND_LABELS[stage.kind]],
    ["Status", STATUS_LABELS[stage.status]],
  ];
  if (stage.seconds !== undefined) facts.push(["Run time", duration(stage.seconds)]);
  if (stage.cost !== undefined) facts.push(["Cost", dollars(stage.cost)]);
  if (stage.note) facts.push(["Result", stage.note]);
  if (stage.error) facts.push(["Error", stage.error]);
  const config = Object.entries(stage.config);
  // Made up: a few of the calls an LLM stage made.
  const calls =
    stage.kind === "llm" && stage.status === "done" && stage.cost !== undefined
      ? [1, 2, 3].map((n) => ({ n, cost: stage.cost! / 40 + n * 0.001 }))
      : [];

  return (
    <div className="details-view">
      <h2>{stage.title}</h2>
      <dl className="details-facts">
        {facts.map(([term, value]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd className={term === "Step" ? "mono" : undefined}>{value}</dd>
          </div>
        ))}
      </dl>
      {config.length > 0 && (
        <>
          <h3>Config</h3>
          <dl className="details-facts">
            {config.map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      {calls.length > 0 && (
        <>
          <h3>LLM calls</h3>
          <ul className="details-calls">
            {calls.map(({ n, cost }) => (
              <li key={n}>
                <span>System {n}</span>
                <span className="mono">
                  {12 + n}.{n}k in · 1.{n}k out · {dollars(cost)}
                </span>
              </li>
            ))}
            <li className="more">…</li>
          </ul>
        </>
      )}
    </div>
  );
}
