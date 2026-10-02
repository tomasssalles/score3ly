// Side-by-side viewer for the test set (DESIGN.md §13): the original on the left,
// two engravings of the same piece, chosen with dropdowns, in the middle and on the right.

import { useEffect, useState } from "react";
import { PdfPane } from "./PdfPane";
import { ORIG, type Piece, listPieces, pdfName } from "./testset.ts";

export function Viewer() {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [piece, setPiece] = useState<Piece>();
  const [middle, setMiddle] = useState<string>();
  const [right, setRight] = useState<string>();

  function selectPiece(selected: Piece | undefined) {
    setPiece(selected);
    setMiddle(selected?.methods[0]);
    setRight(selected?.methods[1] ?? selected?.methods[0]);
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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header style={{ padding: 8 }}>
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
      </header>
      {piece && (
        <div style={{ display: "flex", gap: 8, flex: 1, minHeight: 0, padding: "0 8px 8px" }}>
          <Column title={ORIG} url={piece.hasOrig ? pdfUrl(piece, ORIG) : undefined} />
          <Column
            title={<MethodSelect methods={piece.methods} value={middle} onChange={setMiddle} />}
            url={middle && pdfUrl(piece, middle)}
          />
          <Column
            title={<MethodSelect methods={piece.methods} value={right} onChange={setRight} />}
            url={right && pdfUrl(piece, right)}
          />
        </div>
      )}
    </div>
  );
}

function pdfUrl(piece: Piece, source: string): string {
  return `/testset/${encodeURIComponent(pdfName(piece.name, source))}`;
}

function Column({ title, url }: { title: React.ReactNode; url: string | undefined }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ paddingBottom: 4 }}>{title}</div>
      <div style={{ flex: 1, minHeight: 0 }}>{url ? <PdfPane url={url} /> : "No PDF"}</div>
    </div>
  );
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
