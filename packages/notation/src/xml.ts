// A small XML tree for the MEI builder (mei.ts): elements with attributes in a fixed order, text, and a serializer
// that escapes what users and models wrote (titles, names, texts in the music).

export type XmlNode = XmlElement | string;
export type XmlElement = { name: string; attrs: [string, string][]; children: XmlNode[] };

// An element; attributes that are null or undefined are left out, in the order given.
export function el(name: string, attrs: Record<string, string | number | null | undefined> = {}, children: (XmlNode | null | undefined | false)[] = []): XmlElement {
  return {
    name,
    attrs: Object.entries(attrs).flatMap(([k, v]) => (v === null || v === undefined ? [] : [[k, String(v)] as [string, string]])),
    children: children.filter((c): c is XmlNode => c !== null && c !== undefined && c !== false),
  };
}

export function attr(e: XmlElement, name: string): string | undefined {
  return e.attrs.find(([k]) => k === name)?.[1];
}

export function setAttr(e: XmlElement, name: string, value: string): void {
  const at = e.attrs.findIndex(([k]) => k === name);
  if (at >= 0) e.attrs[at] = [name, value];
  else e.attrs.push([name, value]);
}

// Characters XML 1.0 doesn't allow at all are dropped; the rest is escaped.
const INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

export function escapeText(text: string): string {
  return text.replace(INVALID, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeAttr(text: string): string {
  return escapeText(text).replace(/"/g, "&quot;").replace(/\n/g, "&#10;").replace(/\t/g, "&#9;").replace(/\r/g, "&#13;");
}

// Indented, one element per line; an element with text keeps its content on its line.
export function serialize(root: XmlElement): string {
  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
  const open = (e: XmlElement) => `<${e.name}${e.attrs.map(([k, v]) => ` ${k}="${escapeAttr(v)}"`).join("")}`;
  const inline = (n: XmlNode): string =>
    typeof n === "string" ? escapeText(n) : n.children.length === 0 ? `${open(n)}/>` : `${open(n)}>${n.children.map(inline).join("")}</${n.name}>`;
  const write = (e: XmlElement, depth: number) => {
    const pad = "  ".repeat(depth);
    if (e.children.length === 0) lines.push(`${pad}${open(e)}/>`);
    else if (e.children.some((c) => typeof c === "string")) lines.push(pad + inline(e));
    else {
      lines.push(`${pad}${open(e)}>`);
      for (const c of e.children) write(c as XmlElement, depth + 1);
      lines.push(`${pad}</${e.name}>`);
    }
  };
  write(root, 0);
  return lines.join("\n") + "\n";
}

// Every element of the tree, depth first.
export function* elements(root: XmlElement): Generator<XmlElement> {
  yield root;
  for (const c of root.children) if (typeof c !== "string") yield* elements(c);
}
