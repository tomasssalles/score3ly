import { test } from "node:test";
import assert from "node:assert/strict";
import { findMeasure, highlight, indexMei, marked, pieceAt, search } from "./meiView.ts";

test("a line's tokens: tags, attributes, values, text and punctuation, nothing lost", () => {
  const line = '    <dynam startid="#a" staff="1 2">p &amp; "f"</dynam>';
  const tokens = highlight(line);
  assert.equal(tokens.map((t) => t.text).join(""), line);
  assert.deepEqual(
    tokens.filter((t) => t.kind !== "text").map((t) => `${t.kind}:${t.text}`),
    ["punct:<", "tag:dynam", "attr:startid", "punct:=", 'value:"#a"', "attr:staff", "punct:=", 'value:"1 2"', "punct:>", "punct:</", "tag:dynam", "punct:>"],
  );
  assert.equal(highlight('<?xml version="1.0"?>')[1].text, "xml");
});

const FILE = `<mei>
  <music>
    <facsimile>
      <surface xml:id="surface-1" n="1" ulx="0">
        <zone xml:id="z1t1-1" ulx="1"/>
        <zone xml:id="z1t2-2" ulx="1"/>
      </surface>
      <surface xml:id="surface-2" n="2" ulx="0">
        <zone xml:id="z2t1-1" ulx="1"/>
      </surface>
    </facsimile>
    <body>
      <mdiv xml:id="piece-1" n="1" label="Von fremden L&quot;ndern">
        <measure xml:id="p1m1" n="0" facs="#z1t1-1">
        <measure xml:id="p1m2-s1t2" n="1" facs="#z1t2-2">
      <mdiv xml:id="piece-2" n="2">
        <measure xml:id="p2m1" n="1" facs="#z2t1-1">
        <measure xml:id="p2m2" n="2–5">`.split("\n");

test("the places to go to: pieces, pages, systems and measures, by line", () => {
  const index = indexMei(FILE);
  assert.deepEqual(index.pieces, [
    { n: 1, label: 'Von fremden L"ndern', line: 12 },
    { n: 2, label: null, line: 15 },
  ]);
  assert.deepEqual([...index.pages], [[1, 13], [2, 16]]);
  assert.deepEqual([...index.systems], [[1, 13], [2, 16]]);
  assert.equal(findMeasure(index, 1, 1), 14);
  assert.equal(findMeasure(index, 2, 1), 16);
  assert.equal(findMeasure(index, 2, 4), 17);
  assert.equal(findMeasure(index, 2, 9), null);
  assert.equal(pieceAt(index, 14), 1);
  assert.equal(pieceAt(index, 17), 2);
});

test("searching ignores case, and the matches cut a line's tokens", () => {
  const matches = search(['<note pname="c"/>', "<Note/> note"], "note");
  assert.deepEqual(matches, [
    { line: 0, start: 1, end: 5 },
    { line: 1, start: 1, end: 5 },
    { line: 1, start: 8, end: 12 },
  ]);
  const pieces = marked(highlight("<note/>"), [{ start: 2, end: 4, current: true }]);
  assert.deepEqual(pieces.map((p) => [p.text, p.mark]), [["<", ""], ["n", ""], ["ot", "current"], ["e", ""], ["/>", ""]]);
});
