// What a human review in progress adds to its Transcription (docs/stages/music.md, `human_review`, "The screen"): an
// issue's answers as a list to pick from, the user's own issues (clarifications) as cards, and boxes drawn on a crop.

import type { Box } from "@score3ly/notation";
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { AnswerTags } from "./ExtractionView";
import type { StoredIssue } from "./extract";
import { boxThrough, resizeBox, type BoxHandle } from "./fixLayout";
import { NO_TEXT } from "./humanReview";
import { Info } from "./Info";
import type { PlacedSystem } from "./review";
import { answerTags } from "./transcription";
import type { IssueWho } from "./attribution";

// An issue's answers, one to pick (docs/stages/music.md, `human_review`): a radio mark on each, its suffixes as the
// user's choices leave them; tapping the chosen answer again takes it back. The last row is an answer of the user's
// own: its letter the next one, its text a field ("Other"). Typing in it chooses it; its text stays there while another
// answer is chosen, and choosing it again uses it; emptying it takes the answer back. `issue` is as the user's choices
// leave it (a written answer among its answers), `original` as the transcription has it, which choices are made on.
export function AnswerPicker({
  issue,
  original,
  who,
  mine,
  onChoose,
  onWrite,
  onClear,
}: {
  issue: StoredIssue;
  original: StoredIssue;
  who: IssueWho | undefined;
  mine: { key: string; newAnswer: { key: string; text: string } | null } | null;
  onChoose: (key: string) => void;
  onWrite: (text: string) => void;
  onClear: () => void;
}) {
  const otherKey = String.fromCharCode("a".charCodeAt(0) + original.answers.length);
  const [text, setText] = useState(mine?.newAnswer?.text ?? "");
  const [pending, setPending] = useState(false); // the row chosen, its text not saved yet
  const field = useRef<HTMLTextAreaElement>(null);
  // The field grows with its text, wrapping like the other answers.
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const otherChosen = mine?.newAnswer != null || pending;
  // The field's text as the answer: written, or, emptied, taken back. Text saves when the typing pauses or the field is
  // left (docs/style.md, "Confirmations, saving and undo").
  function commit(value: string) {
    clearTimeout(timer.current);
    if (value.trim()) {
      if (value.trim() !== mine?.newAnswer?.text) onWrite(value);
      // The text of one of the answers chooses that one (writeAnswer).
      if (original.answers.some((a) => a.text.trim() === value.trim())) setPending(false);
    } else if (mine?.newAnswer) onClear();
  }
  function type(value: string) {
    setText(value);
    setPending(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(value), 800);
  }
  function pickOther() {
    if (otherChosen) {
      clearTimeout(timer.current);
      setPending(false);
      if (mine?.newAnswer) onClear();
    } else if (text.trim()) onWrite(text);
    else {
      setPending(true);
      field.current?.focus();
    }
  }
  return (
    <div className="answer-list" role="radiogroup" aria-label={`Answers to issue ${issue.id}`}>
      {original.answers.map((a) => (
        <button
          key={a.key}
          type="button"
          role="radio"
          aria-checked={mine?.key === a.key && !mine.newAnswer && !pending}
          className="answer-option"
          onClick={() => {
            clearTimeout(timer.current);
            setPending(false);
            if (mine?.key === a.key && !mine.newAnswer) onClear();
            else onChoose(a.key);
          }}
        >
          <span className="answer-mark" aria-hidden="true" />
          <span>
            {a.key}) {a.text}
            <AnswerTags tags={answerTags(issue, a.key, who)} />
          </span>
        </button>
      ))}
      <div className="answer-option answer-other" role="radio" aria-checked={otherChosen} tabIndex={-1} onClick={(e) => e.target === field.current || pickOther()}>
        <span className="answer-mark" aria-hidden="true" />
        <span className="answer-other-key">{otherKey})</span>
        <span className="answer-other-text">
          <textarea
            ref={field}
            rows={1}
            className="answer-other-field"
            aria-label="Another answer"
            value={text}
            placeholder="Other"
            onChange={(e) => type(e.target.value)}
            onFocus={() => {
              if (!otherChosen && text.trim()) onWrite(text);
              else if (!otherChosen) setPending(true);
            }}
            onBlur={() => {
              commit(text);
              if (!text.trim()) setPending(false);
            }}
            onKeyDown={(e) => {
              // One line of text: Enter ends it, as in any field.
              if (e.key === "Enter") {
                e.preventDefault();
                commit(text);
              }
            }}
          />
          {mine?.newAnswer && (
            <span className="answer-other-tags">
              <AnswerTags tags={answerTags(issue, mine.newAnswer.key, who)} />
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

// A clarification, the user's own issue, as a card below its system: what the original score has in the places its
// boxes mark, its boxes (each removable), and "Delete clarification", which asks first. While it is selected, boxes are
// drawn for it on its system's crop and its neighbours' (DrawLayer), and its boxes there have handles. What keeps it
// from being finished is said in red.
export function ClarificationCard({
  id,
  issue,
  color,
  systems,
  problem,
  selected,
  onSelect,
  onWrite,
  onRemoveBox,
  onDelete,
}: {
  id: string;
  issue: StoredIssue;
  color?: string;
  systems: PlacedSystem[];
  problem: { problem: string | null; bad: number[] };
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onWrite: (text: string) => void;
  onRemoveBox: (k: number) => void;
  onDelete: () => void;
}) {
  const [text, setText] = useState(issue.answers[0]?.text ?? "");
  const [deleting, setDeleting] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!issue.answers[0] && selected) field.current?.focus({ preventScroll: true });
  }, []);
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);
  function commit(value: string) {
    clearTimeout(timer.current);
    if (value.trim() !== (issue.answers[0]?.text ?? "")) onWrite(value);
  }
  const where = (b: { page: number; box: Box }) => {
    const covered = systems.filter((s) => s.page === b.page && Math.min(b.box.bottom, s.layout.box.bottom) > Math.max(b.box.top, s.layout.box.top));
    return `page ${b.page}${covered.length ? `, system ${covered.map((s) => s.number).join(" and ")}` : ""}`;
  };
  return (
    <div
      className={selected ? "issue-card clarification selected" : "issue-card clarification"}
      id={id}
      style={{ borderLeftColor: color }}
      onClick={() => selected || onSelect(true)}
    >
      <p className="issue-head">#{issue.id} · [clarification]</p>
      <div className="own-correction">
        <span className="answer-own-label">
          <label htmlFor={`clarification-${issue.id}`}>What's in the original score?</label>
          <Info label="What to write">
            Explain what you see in the places marked by the boxes, where the models seem to be confused. Focus on what the
            original score shows, not on the mistakes you see in the transcription. For example, if the original has a C that
            was transcribed as a D, write “This is a C” rather than “The D is wrong”. That way, what you write still makes sense
            in later stages, once the mistake has been corrected.
          </Info>
        </span>
        <textarea
          id={`clarification-${issue.id}`}
          ref={field}
          rows={1}
          className="answer-other-field"
          value={text}
          placeholder="Clarification"
          onChange={(e) => {
            const value = e.target.value;
            setText(value);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => commit(value), 800);
          }}
          onBlur={() => commit(text)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(text);
            }
          }}
        />
      </div>
      {!text.trim() && <p className="issue-facts hint-problem error-text">{NO_TEXT}</p>}
      {problem.problem && <p className="issue-facts hint-problem error-text">{problem.problem}</p>}
      {issue.boxes.length > 0 && (
        <ul className="own-boxes">
          {issue.boxes.map((b, k) => (
            <li key={k} className={problem.bad.includes(k) ? "hint-problem" : undefined}>
              <span>
                Box {k + 1} · {where(b)}
              </span>
              <button type="button" className="button-secondary button-small" onClick={() => onRemoveBox(k)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="own-actions">
        {selected ? (
          <span className="own-add">
            <span className="issue-facts">Drag on the system above, or tap two opposite corners, to add a box. Drag a box's handles to resize it.</span>
            <Info label="The rules for boxes">
              Every clarification needs at least one box. Each box has to be on a system. The boxes can be on one system, or on
              two neighbouring systems. While you work on this stage, the rules are not enforced (what breaks a rule is just shown
              in red). To successfully finish the stage, however, all rules must be followed.
            </Info>
          </span>
        ) : null}
        <span className="own-buttons">
          {selected ? (
            <button
              type="button"
              className="button-secondary"
              onClick={(e) => {
                e.stopPropagation();
                commit(text);
                onSelect(false);
              }}
            >
              Done
            </button>
          ) : (
            <button type="button" className="button-secondary" onClick={() => onSelect(true)}>
              Edit boxes
            </button>
          )}
          <button
            type="button"
            className="button-danger"
            onClick={(e) => {
              e.stopPropagation();
              setDeleting(true);
            }}
          >
            Delete clarification
          </button>
        </span>
      </div>
      {deleting && (
        <ConfirmDialog
          title="Are you sure?"
          text={[`Clarification ${issue.id} and its boxes will be deleted. This action cannot be undone.`]}
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            setDeleting(false);
            onDelete();
          }}
          onCancel={() => setDeleting(false)}
        />
      )}
    </div>
  );
}

type CropPoint = { x: number; y: number }; // fractions of the crop
const HANDLES: BoxHandle[] = [
  { x: "left", y: "top" },
  { x: null, y: "top" },
  { x: "right", y: "top" },
  { x: "right", y: null },
  { x: "right", y: "bottom" },
  { x: null, y: "bottom" },
  { x: "left", y: "bottom" },
  { x: "left", y: null },
];

// Drawing a selected clarification's boxes on a crop: a box is dragged with a mouse, or set by two taps at opposite
// corners (a finger's drag scrolls the page, as anywhere else); the clarification's boxes on the crop get handles that
// resize them. Boxes are in the page's fractions outside, the crop's inside.
export function DrawLayer({
  crop,
  boxes,
  onAdd,
  onResize,
}: {
  crop: Box;
  boxes: { k: number; box: Box }[]; // the clarification's boxes on this page, by their index
  onAdd: (box: Box) => void;
  onResize: (k: number, box: Box) => void;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<CropPoint | null>(null);
  const [rubber, setRubber] = useState<CropPoint | null>(null);
  const [resizing, setResizing] = useState<{ k: number; handle: BoxHandle; box: Box } | null>(null);
  const down = useRef<{ at: CropPoint; mouse: boolean; moved: boolean } | null>(null);
  const w = crop.right - crop.left;
  const h = crop.bottom - crop.top;
  const toCrop = (b: Box): Box => ({ left: (b.left - crop.left) / w, right: (b.right - crop.left) / w, top: (b.top - crop.top) / h, bottom: (b.bottom - crop.top) / h });
  const toPage = (b: Box): Box => ({ left: crop.left + b.left * w, right: crop.left + b.right * w, top: crop.top + b.top * h, bottom: crop.top + b.bottom * h });
  const pointAt = (e: { clientX: number; clientY: number }): CropPoint => {
    const r = layer.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  // Escape lets go of a first corner.
  useEffect(() => {
    if (!anchor) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAnchor(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anchor]);
  function finish(a: CropPoint, b: CropPoint) {
    const box = boxThrough(a, b);
    if (!box) return false; // too small to be meant
    setAnchor(null);
    setRubber(null);
    onAdd(toPage(box));
    return true;
  }
  function onPointerDown(e: ReactPointerEvent) {
    if (e.button !== 0) return;
    down.current = { at: pointAt(e), mouse: e.pointerType === "mouse", moved: false };
    if (e.pointerType === "mouse") layer.current?.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: ReactPointerEvent) {
    const p = pointAt(e);
    if (down.current?.mouse) {
      down.current.moved ||= Math.hypot(p.x - down.current.at.x, (p.y - down.current.at.y) * (h / w)) > 0.01;
      if (down.current.moved) setRubber(p);
    } else if (anchor && e.pointerType === "mouse") setRubber(p);
  }
  function onPointerUp(e: ReactPointerEvent) {
    const start = down.current;
    down.current = null;
    if (!start) return;
    const p = pointAt(e);
    if (start.mouse && start.moved) {
      finish(start.at, p);
      return;
    }
    // A tap or a click: the first corner, or the second.
    if (anchor) finish(anchor, p);
    else setAnchor(p);
  }
  function startResize(e: ReactPointerEvent, k: number, handle: BoxHandle, box: Box) {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setResizing({ k, handle, box });
  }
  function moveResize(e: ReactPointerEvent) {
    if (!resizing) return;
    e.stopPropagation();
    const p = pointAt(e);
    const page = { x: crop.left + p.x * w, y: crop.top + p.y * h };
    setResizing({ ...resizing, box: resizeBox(resizing.box, resizing.handle, page) });
  }
  function endResize(e: ReactPointerEvent) {
    if (!resizing) return;
    e.stopPropagation();
    onResize(resizing.k, resizing.box);
    setResizing(null);
  }
  const shown = boxes.map((b) => (resizing?.k === b.k ? { ...b, box: resizing.box } : b));
  const band = anchor && rubber ? boxThrough(anchor, rubber) : down.current?.mouse && rubber ? boxThrough(down.current.at, rubber) : null;
  return (
    <div
      ref={layer}
      className="draw-layer"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        down.current = null;
      }}
      onPointerLeave={() => !down.current && setRubber(null)}
    >
      {shown.map(({ k, box }) => {
        const c = toCrop(box);
        return (
          <div key={k} className="draw-box" style={{ left: `${c.left * 100}%`, top: `${c.top * 100}%`, width: `${(c.right - c.left) * 100}%`, height: `${(c.bottom - c.top) * 100}%` }}>
            {HANDLES.map((handle, i) => (
              <span
                key={i}
                className="draw-handle"
                style={{
                  left: handle.x === "left" ? "0%" : handle.x === "right" ? "100%" : "50%",
                  top: handle.y === "top" ? "0%" : handle.y === "bottom" ? "100%" : "50%",
                  cursor: handle.x && handle.y ? (handle.x === handle.y.replace("top", "left").replace("bottom", "right") ? "nwse-resize" : "nesw-resize") : handle.x ? "ew-resize" : "ns-resize",
                }}
                onPointerDown={(e) => startResize(e, k, handle, box)}
                onPointerMove={moveResize}
                onPointerUp={endResize}
              />
            ))}
          </div>
        );
      })}
      {band && (
        <div
          className="draw-rubber"
          style={{ left: `${band.left * 100}%`, top: `${band.top * 100}%`, width: `${(band.right - band.left) * 100}%`, height: `${(band.bottom - band.top) * 100}%` }}
        />
      )}
      {anchor && <span className="draw-anchor" style={{ left: `${anchor.x * 100}%`, top: `${anchor.y * 100}%` }} />}
    </div>
  );
}
