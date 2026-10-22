import { test } from "node:test";
import assert from "node:assert/strict";
import { elementsAt, findMeasure, highlight, indexMei, lineOfId, marked, search } from "./meiView.ts";

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
    <body>
      <mdiv xml:id="piece-1" n="1" label="Von fremden L&quot;ndern">
        <score>
          <section>
            <measure xml:id="p1m1" n="0">
              <staff n="1">
                <layer n="1">
                  <note xml:id="n1" pname="c" oct="4" dur="4">
                    <accid accid="s"/>
                  </note>
                  <rest xml:id="r1" dur="4"/>
                </layer>
              </staff>
              <dir staff="1" tstamp="1">dolce</dir>
            </measure>
            <measure xml:id="p1m2-s1t2" n="1">
            </measure>
            <measure xml:id="p1m2-s2t3" n="1">
            </measure>
          </section>
        </score>
      </mdiv>
      <mdiv xml:id="piece-2" n="2">
        <measure xml:id="p2m1" n="1"/>
        <measure xml:id="p2m2" n="2–5"/>
      </mdiv>
    </body>
  </music>
</mei>`.split("\n");

test("the places to go to: pieces and measures, by line", () => {
  const index = indexMei(FILE);
  assert.deepEqual(index.pieces, [
    { n: 1, label: 'Von fremden L"ndern', line: 3 },
    { n: 2, label: null, line: 24 },
  ]);
  assert.equal(findMeasure(index, 1, 0), 6);
  assert.equal(findMeasure(index, 1, 1), 17);
  assert.equal(findMeasure(index, 2, 1), 25);
  assert.equal(findMeasure(index, 2, 4), 26);
  assert.equal(findMeasure(index, 2, 9), null);
});

test("each line's elements, from its own outwards: an accidental is its note's, a closing tag its element's", () => {
  const index = indexMei(FILE);
  const ids = (line: number) => elementsAt(index, line).map((e) => e.id ?? `<${e.line}>`);
  assert.deepEqual(ids(10), ["<10>", "n1", "<8>", "<7>", "p1m1", "<5>", "<4>", "piece-1", "<2>", "<1>", "<0>"]);
  assert.deepEqual(ids(11).slice(0, 2), ["n1", "<8>"]);
  assert.deepEqual(ids(12).slice(0, 2), ["r1", "<8>"]);
  assert.deepEqual(ids(15).slice(0, 2), ["<15>", "p1m1"]);
  assert.deepEqual(ids(18).slice(0, 2), ["p1m2-s1t2", "<5>"]);
  assert.deepEqual(ids(25).slice(0, 2), ["p2m1", "piece-2"]);
  assert.deepEqual(ids(27).slice(0, 2), ["piece-2", "<2>"]);
});

test("an element of the engraving by its id, a measure's part the file doesn't have by the part it falls in", () => {
  const index = indexMei(FILE);
  assert.equal(lineOfId(index, "n1"), 9);
  assert.equal(lineOfId(index, "p1m2-s1t2"), 17);
  assert.equal(lineOfId(index, "p1m2-s2t1"), 17); // divided at the system break, in the engraving only
  assert.equal(lineOfId(index, "p1m2-s2t3"), 19);
  assert.equal(lineOfId(index, "p1m2-s3t1"), 19);
  assert.equal(lineOfId(index, "p1m2-s1t1"), null);
  assert.equal(lineOfId(index, "vzj2bfi"), null);
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
