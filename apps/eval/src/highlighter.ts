// Painting highlighter strokes on a page's drawing layer: a canvas exactly covering the page.

import type { Point, Stroke } from "./marks.ts";

// Strokes store the colour's name, so changing a value here recolours existing strokes.
export const HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: "#ffec1a",
  orange: "#ffaf4d",
  coral: "#ff6a4d",
  magenta: "#ff80ff",
  violet: "#d9b2ff",
  sky: "#4dd2ff",
  teal: "#4dffc3",
  green: "#80ff80",
};
export const COLOR_NAMES = Object.keys(HIGHLIGHT_COLORS);
const UNKNOWN_COLOR = "#bbbbbb"; // for names not (or no longer) in the list

export function colorValue(name: string): string {
  return Object.hasOwn(HIGHLIGHT_COLORS, name) ? HIGHLIGHT_COLORS[name] : UNKNOWN_COLOR;
}

export const STROKE_WIDTH = 0.012; // relative to the page width, about 2.5 mm on A4

// Creates the drawing layer for a page canvas. "Multiply" blending keeps black notes black
// under the colour, like a real highlighter.
export function createDrawingLayer(page: HTMLCanvasElement): HTMLCanvasElement {
  const layer = document.createElement("canvas");
  layer.width = page.width;
  layer.height = page.height;
  Object.assign(layer.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    mixBlendMode: "multiply",
  });
  layer.dataset.drawingLayer = "true";
  return layer;
}

export function paintStrokes(layer: HTMLCanvasElement, strokes: Stroke[]) {
  const context = layer.getContext("2d")!;
  context.clearRect(0, 0, layer.width, layer.height);
  for (const stroke of strokes) {
    paintLine(layer, stroke.color, stroke.width, stroke.points);
  }
}

// Paints a line through the points, in the named colour. A single point gives a dot.
export function paintLine(layer: HTMLCanvasElement, color: string, width: number, points: Point[]) {
  const context = layer.getContext("2d")!;
  context.strokeStyle = colorValue(color);
  context.lineWidth = width * layer.width;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  points.forEach(([x, y], i) => {
    const [px, py] = [x * layer.width, y * layer.height];
    if (i === 0) {
      context.moveTo(px, py);
    }
    context.lineTo(px, py);
  });
  context.stroke();
}

// The point under the mouse pointer, relative to the page, rounded to keep the files small.
export function pointOn(layer: HTMLCanvasElement, clientX: number, clientY: number): Point {
  const rect = layer.getBoundingClientRect();
  const round = (v: number) => Math.round(v * 10000) / 10000;
  return [round((clientX - rect.left) / rect.width), round((clientY - rect.top) / rect.height)];
}
