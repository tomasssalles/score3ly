import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSystems, type LensStretch, type LensSystem } from "./lens.ts";
import { firstMeasureStretch, splitPieces, trailingNoneStretches } from "./structure.ts";
import { checkScore } from "./scoreChecks.ts";
import { systemLinks } from "./links.ts";
import { buildScore } from "./score.ts";
import { buildMei } from "./mei.ts";
import { elements, type XmlElement } from "./xml.ts";
import { box, richScore, stretch, system, voice } from "./testScore.ts";

const voices = () => [voice(1, 1, "c''1"), voice(2, 2, "c1")];
const none = (i: number, over: Partial<LensStretch> = {}) => stretch(i, [], { class: "none", kind: null, ...over });

test("systems are split into pieces at the starts, in the score's order, the first system always starting one", () => {
  const systems = [3, 1, 4, 2, 5].map((number) => ({ number }));
  assert.deepEqual(splitPieces(systems, [1, 4]), [[{ number: 1 }, { number: 2 }, { number: 3 }], [{ number: 4 }, { number: 5 }]]);
  assert.deepEqual(splitPieces(systems, [3]), [[{ number: 1 }, { number: 2 }], [{ number: 3 }, { number: 4 }, { number: 5 }]]);
  assert.deepEqual(splitPieces([], [1]), []);
});

test("the first stretch that is part of a measure, and the trailing ones that aren't", () => {
  const answer = system([none(1), stretch(2, voices()), stretch(3, voices()), none(4), none(5)]);
  assert.equal(firstMeasureStretch(answer), 2);
  assert.deepEqual(trailingNoneStretches(answer).map((s) => s.stretch), [5, 4]);
  const allNone = system([none(1), none(2)]);
  assert.equal(firstMeasureStretch(allNone), 1);
  assert.deepEqual(trailingNoneStretches(allNone).map((s) => s.stretch), [2, 1]);
  assert.deepEqual(trailingNoneStretches(system([stretch(1, voices())])), []);
});

const contextOf = (n: number, stretches: number, firstOfPiece: boolean) => ({ system: n, stretches, firstOfPiece, images: [] });

test("the systems are checked in order, each from what the one before it left, a piece starting afresh", () => {
  const input = richScore();
  const checked = checkSystems(input.map((s) => ({ answer: s.answer, context: contextOf(s.number, s.answer.stretches.length, s.number === 1 || s.number === 4) })));
  assert.ok(!("problem" in checked));
  assert.deepEqual(checked.map((c) => [c.number, c.state.count]), [[1, 4], [2, 7], [3, 12], [4, 2]]);
  // A system that doesn't follow the one before it in the list starts afresh too.
  const gap = checkSystems([input[0], input[2]].map((s) => ({ answer: s.answer, context: contextOf(s.number, s.answer.stretches.length, s.number === 1) })));
  assert.ok("problem" in gap);
  assert.equal(gap.system, 3);
});

test("the first system that can't be used stops the chain, with its number", () => {
  const input = richScore();
  const result = checkSystems(input.map((s) => ({ answer: s.answer, context: contextOf(s.number, s.number === 2 ? 9 : s.answer.stretches.length, s.number === 1 || s.number === 4) })));
  assert.deepEqual(result, { system: 2, problem: "the answer must have exactly the stretches 1 to 9, in order, and has 1, 2, 3, 4" });
});

// The structure's readers on one answer (D9 of the code review): the checks (lens.ts, scoreChecks.ts), the links
// (links.ts) and the MEI (mei.ts) must read the endings and the start repeats alike.
const described = () => [voice(1, 1, "c''1", "melody"), voice(2, 2, "c1", "bass")];
const scoreOf = (answers: LensSystem[]) => answers.map((answer, i) => ({ number: i + 1, page: 1, box: box(0.1 + 0.4 * i), barLines: answer.stretches.slice(1).map((_, k) => (k + 1) / answer.stretches.length), answer }));
function readers(answers: LensSystem[]) {
  const input = scoreOf(answers);
  const checked = checkSystems(input.map((s) => ({ answer: s.answer, context: contextOf(s.number, s.answer.stretches.length, s.number === 1) })));
  if ("problem" in checked) assert.fail(checked.problem);
  return { warnings: checkScore(checked, [1]).warnings.map((w) => w.message), links: systemLinks(checked, [1]), mei: buildMei(buildScore(input, [1])) };
}
const children = (e: XmlElement) => e.children.filter((c): c is XmlElement => typeof c !== "string");
const section = (root: XmlElement) => [...elements(root)].find((e) => e.name === "section")!;
const idOf = (e: XmlElement) => e.attrs.find(([k]) => k === "xml:id")?.[1];
const attr = (e: XmlElement, name: string) => e.attrs.find(([k]) => k === name)?.[1];

// A first ending that runs on past the system's last bar line, over a stretch of courtesy signatures, and ends there;
// the second ending starts the next system.
function endingOnNone(labelOnNone: boolean): LensSystem[] {
  return [
    system(
      [
        stretch(1, described()),
        stretch(2, voices(), { ending: { startsHere: true, endsHere: false, label: labelOnNone ? null : "1." }, rightBarLine: "endRepeat" }),
        none(3, { ending: { startsHere: false, endsHere: true, label: labelOnNone ? "1." : null }, changes: [{ staff: 1, key: "2s", time: null }, { staff: 2, key: "2s", time: null }], rightBarLine: "none" }),
      ],
      {},
      true,
    ),
    {
      ...system([stretch(1, voices(), { ending: { startsHere: true, endsHere: true, label: "2." }, rightBarLine: "final" })]),
      staves: system([]).staves.map((s) => ({ ...s, key: "2s" })),
    },
  ];
}

test("an ending that ends on a stretch of no measure is linked to the next, and written as one", () => {
  for (const labelOnNone of [false, true]) {
    const { warnings, links, mei } = readers(endingOnNone(labelOnNone));
    assert.deepEqual(warnings, [], `label on the courtesy stretch: ${labelOnNone}`);
    const first = 'The ending "1." runs from system 1, stretch 2 to system 1, stretch 3; the ending "2." follows it at system 2, stretch 1.';
    assert.ok(links.get(1)?.includes(first), JSON.stringify(links.get(1)));
    assert.ok(links.get(2)?.includes('The ending "2." runs from system 2, stretch 1 to system 2, stretch 1; it follows the ending "1." from system 1, stretch 2.'));
    // In the MEI: each ending holds its own measure, with its label (the second, as every ending that starts a system,
    // the system break and the new key before its measure).
    const parts = children(section(mei)).map((e) => [e.name, e.name === "ending" ? attr(e, "label") : idOf(e), e.name === "ending" ? children(e).map((m) => idOf(m) ?? m.name) : []]);
    assert.deepEqual(parts, [
      ["measure", "p1m1", []],
      ["ending", "1.", ["p1m2"]],
      ["ending", "2.", ["sb", "scoreDef", "p1m3"]],
    ]);
  }
});

test("an ending's label given on its second measure is the ending's", () => {
  const answers = [
    system(
      [
        stretch(1, described(), { ending: { startsHere: true, endsHere: false, label: null } }),
        stretch(2, voices(), { ending: { startsHere: false, endsHere: true, label: "1." }, rightBarLine: "endRepeat" }),
        stretch(3, voices(), { ending: { startsHere: true, endsHere: true, label: "2." }, rightBarLine: "final" }),
      ],
      {},
      true,
    ),
  ];
  const { warnings, mei } = readers(answers);
  assert.deepEqual(warnings, []);
  assert.deepEqual([...elements(mei)].filter((e) => e.name === "ending").map((e) => [attr(e, "label"), children(e).map((m) => idOf(m))]), [
    ["1.", ["p1m1", "p1m2"]],
    ["2.", ["p1m3"]],
  ]);
});

// The start repeat at a system break, given both as the bar line at the end of the system and as the next system's
// start repeat: one start repeat.
test("a start repeat given twice at a system break is one", () => {
  const answers = [
    system([stretch(1, described()), stretch(2, voices(), { rightBarLine: "startRepeat" })], {}, true),
    system([stretch(1, voices()), stretch(2, voices(), { rightBarLine: "endRepeat" })], { startRepeat: true }),
  ];
  const { warnings, links, mei } = readers(answers);
  assert.deepEqual(warnings, []);
  assert.deepEqual(links.get(2), ["The end repeat at the right of system 2, stretch 2 goes back to the start repeat at system 2, stretch 1."]);
  assert.deepEqual([...elements(mei)].filter((e) => e.name === "measure").map((m) => [idOf(m), attr(m, "left"), attr(m, "right")]), [
    ["p1m1", undefined, undefined],
    ["p1m2", undefined, undefined],
    ["p1m3", "rptstart", undefined],
    ["p1m4", undefined, "rptend"],
  ]);
});
