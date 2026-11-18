// What a human review in progress adds to its Transcription (docs/stages/music.md, `human_review`, "The screen"): an
// issue's answers as a list to pick from, the user's own issues (clarifications) as cards, and boxes drawn on a crop.

import { onCrop, onPage, type Box } from "@score3ly/core";
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { AnswerTags } from "./ExtractionView";
import type { StoredIssue } from "./extract";
import { boxThrough, resizeBox, type BoxHandle } from "./fixLayout";
import { handleAt } from "./handles";
import { BoxHandles } from "./pageEditor";
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

// The cursor over a handle: which way it resizes.
function handleCursor(handle: BoxHandle): string {
  if (handle.x && handle.y) return (handle.x === "left") === (handle.y === "top") ? "nwse-resize" : "nesw-resize";
  return handle.x ? "ew-resize" : "ns-resize";
}

// Drawing a selected clarification's boxes on a crop: a box is dragged, or set by two taps at opposite corners; the
// clarification's boxes on the crop get the page editors' handles (BoxHandles, handleAt), which resize them. A finger
// doesn't scroll the page on such a crop (two still zoom). Boxes are in the page's fractions outside, the crop's inside;
// the handles are drawn in the crop's screen pixels, as the page editors draw them at a zoom of 1.
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
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [anchor, setAnchor] = useState<CropPoint | null>(null);
  const [rubber, setRubber] = useState<CropPoint | null>(null);
  const [resizing, setResizing] = useState<{ k: number; handle: BoxHandle; box: Box } | null>(null);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const down = useRef<{ at: CropPoint; moved: boolean } | null>(null);
  useLayoutEffect(() => {
    const el = layer.current!;
    const measure = () => setSize({ width: el.clientWidth || 1, height: el.clientHeight || 1 });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const w = crop.right - crop.left;
  const h = crop.bottom - crop.top;
  const toCrop = (b: Box) => onCrop(crop, b);
  const toPage = (b: Box) => onPage(crop, b);
  const pointAt = (e: { clientX: number; clientY: number }): CropPoint => {
    const r = layer.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const px = (p: CropPoint) => ({ x: p.x * size.width, y: p.y * size.height });
  const handleUnder = (p: CropPoint) => {
    for (const b of boxes) {
      const handle = handleAt(toCrop(b.box), px(p), size, 1);
      if (handle) return { k: b.k, handle, box: b.box };
    }
    return null;
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
    if (!box) return; // too small to be meant
    setAnchor(null);
    setRubber(null);
    onAdd(toPage(box));
  }
  function onPointerDown(e: ReactPointerEvent) {
    if (e.button !== 0) return;
    const p = pointAt(e);
    layer.current?.setPointerCapture(e.pointerId);
    const grabbed = handleUnder(p);
    if (grabbed) setResizing(grabbed);
    else down.current = { at: p, moved: false };
  }
  function onPointerMove(e: ReactPointerEvent) {
    const p = pointAt(e);
    if (resizing) {
      setResizing({ ...resizing, box: resizeBox(resizing.box, resizing.handle, { x: crop.left + p.x * w, y: crop.top + p.y * h }) });
      return;
    }
    if (down.current) {
      const q = px(p);
      const at = px(down.current.at);
      down.current.moved ||= Math.hypot(q.x - at.x, q.y - at.y) > 8;
      if (down.current.moved) setRubber(p);
      return;
    }
    if (e.pointerType === "mouse") {
      const over = handleUnder(p);
      setCursor(over ? handleCursor(over.handle) : undefined);
      if (anchor) setRubber(p);
    }
  }
  function onPointerUp(e: ReactPointerEvent) {
    if (resizing) {
      onResize(resizing.k, resizing.box);
      setResizing(null);
      return;
    }
    const start = down.current;
    down.current = null;
    if (!start) return;
    const p = pointAt(e);
    if (start.moved) finish(start.at, p);
    // A tap or a click: the first corner, or the second.
    else if (anchor) finish(anchor, p);
    else setAnchor(p);
  }
  const shown = boxes.map((b) => (resizing?.k === b.k ? { ...b, box: resizing.box } : b));
  const from = anchor ?? (down.current?.moved ? down.current.at : null);
  const band = from && rubber ? boxThrough(from, rubber) : null;
  return (
    <div
      ref={layer}
      className="draw-layer"
      style={{ cursor: resizing ? handleCursor(resizing.handle) : cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        down.current = null;
        setResizing(null);
      }}
      onPointerLeave={() => !down.current && !resizing && setRubber(null)}
    >
      <svg viewBox={`0 0 ${size.width} ${size.height}`} style={{ "--px": "1px" } as React.CSSProperties} aria-hidden="true">
        {shown.map(({ k, box }) => (
          <BoxHandles key={k} box={toCrop(box)} size={size} scale={1} />
        ))}
        {band && (
          <rect
            className="editor-rubber"
            x={band.left * size.width}
            y={band.top * size.height}
            width={(band.right - band.left) * size.width}
            height={(band.bottom - band.top) * size.height}
            fill="none"
          />
        )}
        {anchor && <circle className="editor-anchor" cx={anchor.x * size.width} cy={anchor.y * size.height} r={5} />}
      </svg>
    </div>
  );
}
