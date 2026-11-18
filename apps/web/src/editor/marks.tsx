// What is drawn over a page to show its layout (system boxes, bar lines, numbered labels) and its lines that should be
// horizontal, in the page editors (in the image's pixels, `LayoutMarks`, `LineMarks`) and in the views (stretched over
// the image in its fractions, with labels as HTML so the stretching doesn't distort them: `LayoutOverlay`,
// `LineOverlay`). Systems are coloured by their index on the page, as imaging's draw.ts colours them for the model.

import { LAYOUT_COLOR_HEX, type SkewLine } from "@score3ly/imaging";
import type { LayoutSystem } from "@score3ly/core";
import { angleLabel } from "../skewAnalysis";

// The colour of the system at index i on its page.
export const systemColor = (i: number) => LAYOUT_COLOR_HEX[i % LAYOUT_COLOR_HEX.length];

// A label's size in screen px, per digit and fixed (the editors: a tap on a label selects its system).
export const LABEL = { height: 18, digit: 8, padding: 8 };

// A label's width in image px, at a scale of `scale` screen px per image px.
export const labelWidth = (label: string, scale: number) => (label.length * LABEL.digit + LABEL.padding) / scale;

type Size = { width: number; height: number };

// A page's systems in an editor, numbered from `first`: the selected one stands out, the others are dimmed while one
// is selected.
export function LayoutMarks({ systems, first, size, scale, selected }: { systems: LayoutSystem[]; first: number; size: Size; scale: number; selected: number | null }) {
  const { width: W, height: H } = size;
  const s = scale;
  return (
    <>
      {systems.map((system, i) => {
        const color = systemColor(i);
        const { left, right, top, bottom } = system.box;
        const isSelected = selected === i;
        const label = String(first + i);
        return (
          <g
            key={i}
            stroke={color}
            className={isSelected ? "layout-box selected" : selected !== null ? "layout-box dimmed" : "layout-box"}
          >
            <rect x={left * W} y={top * H} width={(right - left) * W} height={(bottom - top) * H} fill="none" />
            {system.barLines.map((x, j) => (
              <line
                key={j}
                className="layout-bar"
                x1={x * W}
                x2={x * W}
                y1={top * H}
                y2={bottom * H}
              />
            ))}
            <rect
              className="layout-label"
              x={left * W}
              y={top * H}
              width={labelWidth(label, s)}
              height={LABEL.height / s}
              fill={color}
            />
            <text
              className="layout-label-text"
              x={left * W + LABEL.padding / 2 / s}
              y={top * H + (LABEL.height - 5) / s}
              fontSize={13 / s}
            >
              {label}
            </text>
          </g>
        );
      })}
    </>
  );
}

// A page's lines in an editor, each labelled with its angle; `ends` gives a line's ends in image px.
export function LineMarks({ lines, ends, scale, selected }: { lines: SkewLine[]; ends: (line: SkewLine) => [{ x: number; y: number }, { x: number; y: number }]; scale: number; selected: number | null }) {
  const s = scale;
  return (
    <>
      {lines.map((line, i) => {
        const [a, b] = ends(line);
        return (
          <g key={i} className={i === selected ? "skew-line selected" : "skew-line"}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            <text x={a.x} y={a.y - 8 / s} fontSize={12 / s}>
              {angleLabel(line.angle)}
            </text>
          </g>
        );
      })}
    </>
  );
}

// A page's systems in a view, numbered from `first`.
export function LayoutOverlay({ systems, first }: { systems: LayoutSystem[]; first: number }) {
  return (
    <div className="lines-overlay">
      <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
        {systems.map((system, i) => {
          const color = systemColor(i);
          const { left, right, top, bottom } = system.box;
          return (
            <g key={i} stroke={color} className="layout-system">
              <rect x={left} y={top} width={right - left} height={bottom - top} fill="none" />
              {system.barLines.map((x, j) => (
                <line key={j} x1={x} x2={x} y1={top} y2={bottom} className="bar-line" />
              ))}
            </g>
          );
        })}
      </svg>
      {systems.map((system, i) => (
        <span
          key={i}
          className="system-label"
          style={{
            left: `${system.box.left * 100}%`,
            top: `${system.box.top * 100}%`,
            background: systemColor(i),
          }}
        >
          {first + i}
        </span>
      ))}
    </div>
  );
}

// A page's lines in a view, each labelled with its angle.
export function LineOverlay({ lines }: { lines: SkewLine[] }) {
  return (
    <div className="lines-overlay">
      <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
        {lines.map((line, i) => (
          <line key={i} x1={line.x0} y1={line.y0} x2={line.x1} y2={line.y1} />
        ))}
      </svg>
      {lines.map((line, i) => (
        <span key={i} className="line-label" style={{ left: `${line.x0 * 100}%`, top: `${line.y0 * 100}%` }}>
          {angleLabel(line.angle)}
        </span>
      ))}
    </div>
  );
}
