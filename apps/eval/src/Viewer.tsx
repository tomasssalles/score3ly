// Viewer for the test set (DESIGN.md §13): the original and two engravings of the same piece,
// chosen with dropdowns, either side by side or stacked vertically. Each pane can be hidden.
// In highlighting mode, strokes can be drawn on any pane; one undo covers all panes.

import { Fragment, type ReactNode, useEffect, useState } from "react";
import { COLOR_NAMES, colorValue } from "./highlighter.ts";
import type { Stroke } from "./marks.ts";
import { PdfPane } from "./PdfPane";
import { ORIG, type Piece, listPieces, pdfName, testsetUrl } from "./testset.ts";
import { useMarks } from "./useMarks.ts";

type Pane = { label: string; title: ReactNode; pdf: string | undefined };

export function Viewer() {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [piece, setPiece] = useState<Piece>();
  const [middle, setMiddle] = useState<string>();
  const [right, setRight] = useState<string>();
  const [stacked, setStacked] = useState(false);
  const [shown, setShown] = useState([true, true, true]);
  const [highlighting, setHighlighting] = useState(false);
  const [color, setColor] = useState(COLOR_NAMES[0]);

  const panes: Pane[] = piece
    ? [
        { label: ORIG, title: ORIG, pdf: piece.hasOrig ? pdfName(piece.name, ORIG) : undefined },
        {
          label: middle ?? "middle",
          title: <MethodSelect methods={piece.methods} value={middle} onChange={setMiddle} />,
          pdf: middle && pdfName(piece.name, middle),
        },
        {
          label: right ?? "right",
          title: <MethodSelect methods={piece.methods} value={right} onChange={setRight} />,
          pdf: right && pdfName(piece.name, right),
        },
      ]
    : [];
  const marks = useMarks(panes.flatMap((pane) => (pane.pdf ? [pane.pdf] : [])));

  function selectPiece(selected: Piece | undefined) {
    setPiece(selected);
    setMiddle(selected?.methods[0]);
    setRight(selected?.methods[1] ?? selected?.methods[0]);
    // Undo shouldn't change a piece that's no longer on screen.
    marks.forgetHistory();
  }

  useEffect(() => {
    fetch("/api/files")
      .then((res) => res.json())
      .then((fileNames: string[]) => {
        const found = listPieces(fileNames);
        setPieces(found);
        selectPiece(found[0]);
      });
  }, []);

  function toggle(index: number) {
    setShown(shown.map((isShown, i) => (i === index ? !isShown : isShown)));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header style={{ padding: 8, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={piece?.name ?? ""}
          onChange={(e) => selectPiece(pieces.find((p) => p.name === e.target.value))}
        >
          {pieces.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
        <button onClick={() => setStacked(!stacked)}>{stacked ? "Side by side" : "Stacked"}</button>
        {panes.map((pane, i) => (
          <button
            key={i}
            onClick={() => toggle(i)}
            title={shown[i] ? "Hide" : "Show"}
            style={{ opacity: shown[i] ? 1 : 0.4 }}
          >
            👁 {pane.label}
          </button>
        ))}
        <span style={{ borderLeft: "1px solid #999", alignSelf: "stretch" }} />
        <button onClick={() => setHighlighting(!highlighting)}>
          {highlighting ? "🖍 Highlighting" : "📖 Reading"}
        </button>
        {COLOR_NAMES.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            title={c}
            style={{
              width: 22,
              height: 22,
              background: colorValue(c),
              border: c === color ? "2px solid black" : "1px solid #999",
            }}
          />
        ))}
        <button onClick={marks.undo} disabled={!marks.canUndo}>
          Undo
        </button>
      </header>
      {piece && (
        <div
          style={{
            display: "flex",
            flexDirection: stacked ? "column" : "row",
            gap: 4,
            flex: 1,
            minHeight: 0,
            padding: "0 8px 8px",
          }}
        >
          {panes.map((pane, i) => (
            // Hidden panes stay mounted, so they keep their drawing and scroll position.
            <Fragment key={i}>
              {shown[i] && shown.slice(0, i).some(Boolean) && <Separator />}
              <Column title={pane.title} hidden={!shown[i]}>
                {pane.pdf ? (
                  <PdfPane
                    key={pane.pdf}
                    url={testsetUrl(pane.pdf)}
                    strokes={marks.strokesOf(pane.pdf)}
                    highlightColor={highlighting ? color : null}
                    onStroke={(stroke: Stroke) => marks.addStroke(pane.pdf!, stroke)}
                  />
                ) : (
                  "No PDF"
                )}
              </Column>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

function Column(props: { title: ReactNode; hidden: boolean; children: ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: props.hidden ? "none" : "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ paddingBottom: 4 }}>{props.title}</div>
      <div style={{ flex: 1, minHeight: 0 }}>{props.children}</div>
    </div>
  );
}

// A thin line between columns: vertical side by side, horizontal when stacked.
function Separator() {
  return <div style={{ flex: "0 0 1px", background: "#999" }} />;
}

function MethodSelect(props: {
  methods: string[];
  value: string | undefined;
  onChange: (method: string) => void;
}) {
  if (props.methods.length === 0) {
    return <span>No engravings</span>;
  }
  return (
    <select value={props.value} onChange={(e) => props.onChange(e.target.value)}>
      {props.methods.map((method) => (
        <option key={method} value={method}>
          {method}
        </option>
      ))}
    </select>
  );
}
