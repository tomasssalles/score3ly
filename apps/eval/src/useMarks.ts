// Loads, changes and saves the highlighter strokes of the PDFs on screen.

import { useEffect, useRef, useState } from "react";
import {
  type Marks,
  NO_MARKS,
  type Stroke,
  marksName,
  parseMarks,
  serializeMarks,
  withLoaded,
  withStroke,
  withoutLastStroke,
} from "./marks.ts";
import { testsetUrl } from "./testset.ts";

export function useMarks(pdfs: string[]) {
  const [marks, setMarks] = useState<Marks>(NO_MARKS);
  const saving = useRef(Promise.resolve());

  // Loads the strokes of each PDF once. Effects compare dependencies by value, hence the string.
  const pdfList = pdfs.join("\n");
  useEffect(() => {
    for (const pdf of pdfList.split("\n").filter(Boolean)) {
      loadStrokes(pdf).then(
        (strokes) => setMarks((m) => (pdf in m.byPdf ? m : withLoaded(m, pdf, strokes))),
        (e) => alert(`Could not load the highlighter strokes for ${pdf}: ${e}`),
      );
    }
  }, [pdfList]);

  function save(pdf: string, strokes: Stroke[]) {
    // One save at a time, so they reach the server in order.
    saving.current = saving.current
      .then(async () => {
        const response = await fetch(testsetUrl(marksName(pdf)), {
          method: "PUT",
          body: serializeMarks(strokes),
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
      })
      .catch((e) => alert(`Could not save the highlighter strokes for ${pdf}: ${e}`));
  }

  function addStroke(pdf: string, stroke: Stroke) {
    const next = withStroke(marks, pdf, stroke);
    setMarks(next);
    save(pdf, next.byPdf[pdf]);
  }

  function undo() {
    const result = withoutLastStroke(marks);
    if (result !== null) {
      setMarks(result.marks);
      save(result.pdf, result.marks.byPdf[result.pdf]);
    }
  }

  function forgetHistory() {
    setMarks((m) => ({ ...m, history: [] }));
  }

  return {
    strokesOf: (pdf: string): Stroke[] | undefined => marks.byPdf[pdf],
    canUndo: marks.history.length > 0,
    addStroke,
    undo,
    forgetHistory,
  };
}

async function loadStrokes(pdf: string): Promise<Stroke[]> {
  const response = await fetch(testsetUrl(marksName(pdf)));
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return parseMarks(await response.text());
}
