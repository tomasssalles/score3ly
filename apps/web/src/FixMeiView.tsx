// `fix_mei`'s artifact (DESIGN.md §6, `fix_mei`): the MEI view, editable while the stage is WIP. The text
// is saved a moment after typing stops and when the editor closes; Apply checks it and, if it passes, makes it the
// applied version, from which the score is engraved again. Once finished, the applied MEI, read-only.

import { useEffect, useMemo, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import type { Project } from "./api";
import { DEFAULT_ENGRAVE_CONFIG } from "./engrave";
import { pageOptions } from "./engraving";
import { loadFixMei, problemText, saveText, type FixMeiTexts } from "./fixMei";
import type { MeiProblem } from "./meiChecks";
import { MeiWorkspace, type Selection } from "./MeiWorkspace";
import type { Artifact } from "./pipeline";
import { renderPages } from "./rendering";

const SAVE_AFTER_MS = 2000;
const PROBLEMS_SHOWN = 20;

export function FixMeiView({ project, artifact, onEdited }: { project: Project; artifact: Artifact; onEdited?: () => void }) {
  const { stage, earlier } = artifact.fixMei!;
  const [texts, setTexts] = useState<FixMeiTexts | "error" | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadFixMei(project, stage, earlier).then(
      (t) => !cancelled && setTexts(t),
      (err) => {
        if (cancelled) return;
        setTexts("error");
        setLoadError(err instanceof Error ? err.message : String(err));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [stage.id]);
  if (texts === "error") return <div className="text-view"><p>The MEI couldn't be loaded. {loadError}</p></div>;
  if (!texts) return <div className="text-view"><p>Loading the MEI…</p></div>;
  return <FixMeiEditor project={project} stageId={stage.id} texts={texts} editable={!!artifact.editor} onEdited={onEdited} />;
}

// Saves the text a moment after it last changed. Once closed (the editor went away), every change is saved at once.
function draftSaver(save: (text: string) => Promise<void>, onError: (err: unknown) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: string | null = null;
  let closed = false;
  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    if (pending === null) return;
    const text = pending;
    pending = null;
    save(text).catch(onError);
  };
  return {
    changed(text: string) {
      pending = text;
      clearTimeout(timer);
      if (closed) flush();
      else timer = setTimeout(flush, SAVE_AFTER_MS);
    },
    close() {
      closed = true;
      flush();
    },
  };
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const view = useRef<EditorView | null>(null);
  const saved = useRef(texts.draft); // the draft as stored
  const saver = useMemo(
    () =>
      draftSaver(
        async (t) => {
          if (t === saved.current) return;
          await saveText(project, stageId, t, ["mei_draft"]);
          saved.current = t;
          setSaveError(null);
        },
        (err) => setSaveError(`The text couldn't be saved: ${err instanceof Error ? err.message : err}`),
      ),
    [],
  );
  useEffect(() => () => saver.close(), []);
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
      (err) => !cancelled && setPagesError(`The score can't be engraved: ${err instanceof Error ? err.message : err}`),
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
      await saveText(project, stageId, current, ["mei_draft", "mei"]);
      saved.current = current;
      setText(current);
      setApplied(current);
      onEdited?.();
    } catch (err) {
      setProblems([{ line: null, message: `The text couldn't be checked or applied: ${err instanceof Error ? err.message : err}` }]);
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
      {saveError && <p className="editor-hint mei-problem">{saveError}</p>}
      {problems && problems.length > 0 && (
        <div className="fix-mei-problems" role="alert">
          <p>
            Not applied: the MEI doesn't pass the checks ({problems.length} {problems.length === 1 ? "problem" : "problems"}).
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
        setText(t);
        saver.changed(t);
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
