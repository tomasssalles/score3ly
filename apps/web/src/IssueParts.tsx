// Parts of an issue's card (docs/stages/music.md, "An issue's card") that the Transcription and a human review's
// answer list share: an answer's suffixes, and the line of choices.

import { useState } from "react";
import { InfoButton } from "./ui/Info";
import { stepInfo } from "./steps";
import type { AnswerTag } from "./transcription";
import type { IssueWho } from "./attribution";
import type { StoredIssue } from "./issues";

// An answer's suffixes, muted, the stage they name in bold (docs/stages/music.md, "An issue's card").
export function AnswerTags({ tags }: { tags: AnswerTag[] }) {
  return (
    <>
      {tags.map((t) => (
        <span key={t.words} className="answer-tag">
          {" "}[{t.words}
          {t.stage && (
            <>
              {" "}
              <strong>{t.stage}</strong>
            </>
          )}
          ]
        </span>
      ))}
    </>
  );
}

// Who chose which answer, in order; a choice with a reason has an "i" after it that shows the reason on a line below
// (docs/stages/music.md, "An issue's card": the reasons are for later reviewers, shown only on request).
export function Choices({ choices, who }: { choices: StoredIssue["choices"]; who: IssueWho | undefined }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const named = choices.map((c, i) => who?.choices[i]?.label ?? stepInfo(c.by).title);
  const toggle = (i: number) => {
    const next = new Set(open);
    if (!next.delete(i)) next.add(i);
    setOpen(next);
  };
  return (
    <>
      <p className="issue-facts">
        Choices:{" "}
        {choices.map((c, i) => (
          <span key={i}>
            {i > 0 ? " • " : ""}
            {named[i]} → {c.key}
            {c.reason && (
              <InfoButton
                open={open.has(i)}
                onToggle={() => toggle(i)}
                label={`${open.has(i) ? "Hide" : "Show"} the reason of ${named[i]}`}
                title={`${open.has(i) ? "Hide" : "Show"} the reason`}
              />
            )}
          </span>
        ))}
      </p>
      {choices.map((c, i) =>
        c.reason && open.has(i) ? (
          <p key={i} className="issue-reason">
            {named[i]}: {c.reason}
          </p>
        ) : null,
      )}
    </>
  );
}
