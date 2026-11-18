// `fix_mei`'s artifact (docs/stages/engrave.md): the MEI view, editable while the stage is WIP. The text
// is saved a moment after typing stops, when the editor closes and when Finish asks for it (the stage's saver,
// saving.ts); Apply checks it and, if it passes, makes it the applied version, from which the score is engraved again.
// Once finished, the applied MEI, read-only (loaded again when the stage's status changes).

import { useEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import type { Project } from "./api";
import { DEFAULT_ENGRAVE_CONFIG, pageOptions } from "./engrave";
import { loadFixMei, problemText, saveText, type FixMeiTexts } from "./fixMei";
import type { MeiProblem } from "./meiChecks";
import { MeiWorkspace, type Selection } from "./MeiWorkspace";
import type { Artifact } from "./pipeline";
import { renderPages } from "./rendering";
import { count } from "./format";
import { failure } from "./api";
import { errorText } from "@score3ly/core";
import { UnsavedNote } from "./pageEditor";
import { saverOf, useHolding, useSaver } from "./saving";

const SAVE_AFTER_MS = 2000;
const PROBLEMS_SHOWN = 20;

export function FixMeiView({ project, artifact, onEdited }: { project: Project; artifact: Artifact; onEdited?: () => void }) {
  const { stage, earlier } = artifact.fixMei!;
  const [texts, setTexts] = useState<FixMeiTexts | "error" | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const editable = !!artifact.editor;
  useEffect(() => {
    let cancelled = false;
    setTexts(null);
    loadFixMei(project, stage, earlier).then(
      // What this device saved comes first: the pipeline the app has may not show it yet.
      (t) => !cancelled && setTexts(editable ? { ...t, draft: saverOf(stage.id).value<string>("") ?? t.draft, applied: saverOf(stage.id).value<string>("mei") ?? t.applied } : t),
      (err) => {
        if (cancelled) return;
        setTexts("error");
        setLoadError(errorText(err));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [stage.id, editable]);
  if (texts === "error") return <div className="text-view"><p className="error-text">The MEI couldn't be loaded. {loadError}</p></div>;
  if (!texts) return <div className="text-view"><p>Loading the MEI…</p></div>;
  return <FixMeiEditor key={`${stage.id}:${editable}`} project={project} stageId={stage.id} texts={texts} editable={editable} onEdited={onEdited} />;
}

function FixMeiEditor({
  project,
  stageId,
  texts,
  editable,
  onEdited,
}: {
  project: Project;
  stageId: string;
  texts: FixMeiTexts;
  editable: boolean;
  onEdited?: () => void;
}) {
  const [text, setText] = useState(editable ? texts.draft : texts.applied);
  const [applied, setApplied] = useState(texts.applied);
  const [pages, setPages] = useState<string[] | null>(null);
  const [pagesError, setPagesError] = useState<string | null>(null);
  const [problems, setProblems] = useState<MeiProblem[] | null>(null);
  const [applying, setApplying] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const view = useRef<EditorView | null>(null);
  // The draft is saved a moment after typing stops, through the stage's saver: one save after the other, Apply's too.
  const saver = useSaver(stageId);
  const sent = useRef(texts.draft); // the last text given to the saver
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closed = useRef(false);
  const latest = useRef(texts.draft); // the text as the editor last reported it
  function saveDraft(t: string) {
    clearTimeout(timer.current);
    timer.current = undefined;
    if (t === sent.current) return;
    sent.current = t;
    saver.save("", t, () => saveText(project, stageId, t, ["mei_draft"]).then(() => undefined));
  }
  // Finish (and the saver's other waits) take the editor's text as it is now, not as it was a moment ago.
  useHolding(stageId, () => editable && saveDraft(view.current?.state.doc.toString() ?? latest.current));
  useEffect(
    () => () => {
      closed.current = true;
      if (editable) saveDraft(latest.current);
    },
    [],
  );
  // The schema is compiled while the user reads and types, not on the first Apply.
  useEffect(() => {
    if (editable) import("./meiValidation").then((m) => m.prepareMeiChecks());
  }, []);

  // The score, engraved from the applied text (Verovio's breaks; the page size of `engrave`'s default).
  useEffect(() => {
    let cancelled = false;
    setPages(null);
    setPagesError(null);
    renderPages(applied, pageOptions(DEFAULT_ENGRAVE_CONFIG)).then(
      (svgs) => !cancelled && setPages(svgs),
      (err) => !cancelled && setPagesError(failure("The score can't be engraved", err)),
    );
    return () => {
      cancelled = true;
    };
  }, [applied]);

  async function apply() {
    const current = view.current?.state.doc.toString() ?? text;
    setApplying(true);
    setProblems(null);
    try {
      const { checkMeiText } = await import("./meiValidation");
      const found = await checkMeiText(current);
      if (found.length > 0) {
        setProblems(found);
        return;
      }
      // The applied text, and the draft as it is now (typing may have gone on during the check), each the latest of its own.
      saver.save("mei", current, () => saveText(project, stageId, current, ["mei"]).then(() => undefined));
      saveDraft(view.current?.state.doc.toString() ?? current);
      if (!(await saver.saver.settled())) return;
      setText(current);
      setApplied(current);
      onEdited?.();
    } catch (err) {
      const message = failure("The text couldn't be checked or applied", err);
      setProblems(message === null ? [] : [{ line: null, message }]);
    } finally {
      setApplying(false);
    }
  }

  const changed = editable && text !== applied;
  const tools = editable && (
    <div className="editor-tools fix-mei-tools">
      <button type="button" className="button-primary fix-mei-apply" disabled={applying || !changed} onClick={apply}>
        {applying ? "Checking…" : "Apply"}
      </button>
      <span className={changed ? "fix-mei-state changed" : "fix-mei-state"}>{changed ? "Not applied" : "Applied"}</span>
    </div>
  );
  const notice = (
    <>
      <UnsavedNote className="editor-hint mei-problem error-text" state={saver.state} onRetry={saver.retry} />
      {problems && problems.length > 0 && (
        <div className="fix-mei-problems error-text" role="alert">
          <p>
            Not applied: the MEI doesn't pass the checks ({count(problems.length, "problem")}).
          </p>
          <ul>
            {problems.slice(0, PROBLEMS_SHOWN).map((p, i) => (
              <li key={i}>
                {p.line === null ? (
                  problemText(p)
                ) : (
                  <button type="button" onClick={() => setSelection({ line: p.line! - 1, from: "nav" })}>
                    {problemText(p)}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {problems.length > PROBLEMS_SHOWN && <p>…and {problems.length - PROBLEMS_SHOWN} more.</p>}
        </div>
      )}
    </>
  );
  return (
    <MeiWorkspace
      text={text}
      editable={editable}
      onText={(t) => {
        latest.current = t;
        if (closed.current) return saveDraft(t);
        setText(t);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => saveDraft(latest.current), SAVE_AFTER_MS);
      }}
      onView={(v) => {
        view.current = v;
      }}
      pages={pages}
      pagesError={pagesError}
      tools={tools}
      notice={notice}
      selection={selection}
      onSelect={setSelection}
    />
  );
}
