import { dollars } from "./money";
import { KIND_LABELS, STATUS_LABELS, type Stage } from "./pipeline";
import { duration } from "./format";

// A stage's details, shown in the artifact view ("Show details" in the stage's menu): what the card leaves out.
export function StageDetails({ stage }: { stage: Stage }) {
  const facts: [string, string][] = [
    ["Step", stage.step],
    ["Kind", KIND_LABELS[stage.kind]],
    ["Status", STATUS_LABELS[stage.status]],
  ];
  if (stage.seconds !== undefined) facts.push(["Run time", duration(stage.seconds)]);
  // Costs include VAT (docs/llm.md, "VAT").
  if (stage.cost !== undefined) facts.push(["Cost, incl. VAT", dollars(stage.cost)]);
  if (stage.note) facts.push(["Result", stage.note]);
  if (stage.error) facts.push(["Error", stage.error]);
  const config = Object.entries(stage.config);

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
    </div>
  );
}
