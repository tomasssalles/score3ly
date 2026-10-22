// The MEI file as text, in CodeMirror (DESIGN.md §6, `final_touches`, "The editor"): read-only in `engrave`'s MEI
// artifact, editable in `final_touches`. Only what is in view is drawn; highlighting, folding and undo are
// CodeMirror's. What the view around it needs comes in as props: the search's matches, the line selected (marked, and
// brought to the middle of the view when asked); a line chosen here (a click, or the cursor moved) goes out.

import { useEffect, useRef } from "react";
import { EditorSelection, EditorState, RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, keymap, lineNumbers, type DecorationSet } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { foldGutter, foldKeymap, HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { xml } from "@codemirror/lang-xml";
import { tags } from "@lezer/highlight";
import type { Match } from "./meiView";

// Lines are counted from 0, as in meiView.ts.
type Marks = { matches: Match[]; current: number; selected: number | null };

const setMarks = StateEffect.define<Marks>();

// The matches and the selected line, as decorations. Positions come from the text the matches were found in, which
// can lag behind the editor by a moment while typing: they are clamped to the document.
const marks = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    value = value.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(setMarks)) continue;
      const { doc } = tr.state;
      const { matches, current, selected } = effect.value;
      const ranges: { from: number; to: number; deco: Decoration }[] = [];
      if (selected !== null && selected < doc.lines) {
        const line = doc.line(selected + 1);
        ranges.push({ from: line.from, to: line.from, deco: SELECTED_LINE });
      }
      matches.forEach((m, i) => {
        if (m.line >= doc.lines) return;
        const line = doc.line(m.line + 1);
        const from = Math.min(line.from + m.start, line.to);
        const to = Math.min(line.from + m.end, line.to);
        if (to > from) ranges.push({ from, to, deco: i === current ? CURRENT : MATCH });
      });
      ranges.sort((a, b) => a.from - b.from || (a.deco === SELECTED_LINE ? -1 : 1));
      const builder = new RangeSetBuilder<Decoration>();
      for (const r of ranges) builder.add(r.from, r.to, r.deco);
      value = builder.finish();
    }
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const SELECTED_LINE = Decoration.line({ class: "cm-mei-selected" });
const MATCH = Decoration.mark({ class: "cm-mei-match" });
const CURRENT = Decoration.mark({ class: "cm-mei-current" });

// After GitHub's dark theme, as the view had before.
const HIGHLIGHT = HighlightStyle.define([
  { tag: tags.tagName, color: "#7ee787" },
  { tag: tags.attributeName, color: "#79c0ff" },
  { tag: tags.attributeValue, color: "#a5d6ff" },
  { tag: [tags.angleBracket, tags.punctuation, tags.definitionOperator, tags.processingInstruction, tags.documentMeta], color: "var(--muted)" },
  { tag: tags.comment, color: "#8b949e", fontStyle: "italic" },
  { tag: tags.content, color: "var(--fg)" },
]);

const THEME = EditorView.theme(
  {
    "&": { height: "100%", background: "#0d0e10", color: "var(--fg)", fontSize: "13px" },
    ".cm-scroller": { fontFamily: "var(--mono)", lineHeight: "20px", overflow: "auto" },
    ".cm-content": { caretColor: "var(--fg)", padding: "4px 0" },
    ".cm-gutters": { background: "#0d0e10", color: "#5c6068", border: "none" },
    ".cm-lineNumbers .cm-gutterElement": { padding: "0 4px 0 12px" },
    ".cm-foldGutter .cm-gutterElement": { padding: "0 4px", cursor: "pointer" },
    ".cm-activeLine": { background: "transparent" },
    "&.cm-focused .cm-cursor": { borderLeftColor: "var(--fg)" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { background: "rgba(121, 192, 255, 0.25)" },
    ".cm-mei-selected": { background: "rgba(224, 160, 48, 0.16)" },
    ".cm-mei-match": { background: "rgba(224, 160, 48, 0.35)" },
    ".cm-mei-current": { background: "#e0a030", color: "#000" },
    ".cm-foldPlaceholder": { background: "var(--raised)", border: "1px solid var(--line)", color: "var(--muted)" },
  },
  { dark: true },
);

export function MeiCode({
  initial,
  editable,
  matches,
  current,
  selected,
  onSelectLine,
  onChange,
  onView,
}: {
  initial: string; // the text when the editor opens; later changes are the editor's own
  editable: boolean;
  matches: Match[];
  current: number;
  selected: { line: number; from: "file" | "score" | "nav" } | null;
  onSelectLine: (line: number) => void;
  onChange?: (text: string) => void; // a moment after typing stops
  onView?: (view: EditorView | null) => void; // for the text as it is now (e.g. to save it at once)
}) {
  const parent = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const callbacks = useRef({ onSelectLine, onChange });
  callbacks.current = { onSelectLine, onChange };

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const lineOf = (v: EditorView, pos: number) => v.state.doc.lineAt(pos).number - 1;
    const created = new EditorView({
      parent: parent.current!,
      state: EditorState.create({
        doc: initial,
        extensions: [
          lineNumbers(),
          foldGutter(),
          xml(),
          syntaxHighlighting(HIGHLIGHT),
          THEME,
          marks,
          keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap, ...(editable ? [indentWithTab] : [])]),
          ...(editable ? [history()] : [EditorState.readOnly.of(true), EditorView.editable.of(false)]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && callbacks.current.onChange) {
              clearTimeout(timer);
              timer = setTimeout(() => callbacks.current.onChange?.(update.view.state.doc.toString()), 250);
            }
            if (update.selectionSet && update.transactions.some((t) => t.isUserEvent("select"))) {
              callbacks.current.onSelectLine(lineOf(update.view, update.state.selection.main.head));
            }
          }),
          // Read-only, a click doesn't move a cursor: the line clicked is chosen all the same.
          ...(editable
            ? []
            : [
                EditorView.domEventHandlers({
                  click(event, v) {
                    if (!window.getSelection()?.isCollapsed) return false; // selecting text, not a line
                    const pos = v.posAtCoords({ x: event.clientX, y: event.clientY });
                    if (pos !== null) callbacks.current.onSelectLine(lineOf(v, pos));
                    return false;
                  },
                }),
              ]),
        ],
      }),
    });
    view.current = created;
    onView?.(created);
    return () => {
      // Typing just before closing isn't lost: the text goes out at once.
      if (timer !== undefined) {
        clearTimeout(timer);
        callbacks.current.onChange?.(created.state.doc.toString());
      }
      onView?.(null);
      created.destroy();
      view.current = null;
    };
  }, []);

  useEffect(() => {
    view.current?.dispatch({ effects: setMarks.of({ matches, current, selected: selected?.line ?? null }) });
  }, [matches, current, selected?.line]);

  // A line chosen elsewhere comes to the middle of the view; in the editor, the cursor goes to its start.
  useEffect(() => {
    const v = view.current;
    if (!v || !selected || selected.from === "file" || selected.line >= v.state.doc.lines) return;
    const line = v.state.doc.line(selected.line + 1);
    v.dispatch({
      effects: EditorView.scrollIntoView(line.from, { y: "center" }),
      ...(editable ? { selection: EditorSelection.cursor(line.from + (line.text.length - line.text.trimStart().length)) } : {}),
    });
  }, [selected]);

  return <div className="mei-code" ref={parent} />;
}
