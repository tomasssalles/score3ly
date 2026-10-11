# Notes: baselines, music formats, MEI (discussion of 2026-10-02 to 2026-10-06)

> Status: **exploration, no decisions.** Nothing here changes `DESIGN.md` yet. Ideas and findings to come back to.
> **Conclusion (2026-10-06):** the early assessment is done; the app will be built (DESIGN §16 step 4). Next: review the design and these notes, update the decisions and fold everything into `DESIGN.md` (§16 step 5), then delete this file.
> Prices and tool facts were gathered from web search snippets (vendor sites were not reachable); verify before relying on them.

## 1–3. Folded into `DESIGN.md` (2026-10-11)
- §1, baselines: DESIGN §13, "Baselines".
- §2, why the target format was in question, and §3, the canonical representation: DESIGN §1, "Why a text encoding, and which one", and §6, "MEI" and "The lens". The early sketches of corrections and of a first draft via the lens were replaced by the stages in DESIGN §6.

## 4–7. Folded into `DESIGN.md` or dropped (2026-10-11)
- §4, image region linking: DESIGN §6, "MEI" (`facsimile`).
- §5 (things to verify), §6 (Gemini's prompt for a content box) and §7 (Gemini counting measures from the full page): dropped as no longer relevant.

## 8. Manual run with Claude Opus 5.5 on Bendel p4 (claude.ai chat)

A first hand-run of the intended pipeline (DESIGN §16 step 3) on `bendel_la_cascade_p4.orig.pdf`, the obscure piece no model identified. Done in a claude.ai chat, with code execution available to the model. The result is `testset/bendel_la_cascade_p4.claude-chat.ly`; its quality hasn't been checked in the viewer yet.

### 8.1–8.2 Folded into `DESIGN.md` (2026-10-11)
What was done and the findings: DESIGN §13, "The manual run". The result is `testset/bendel_la_cascade_p4.claude-chat.ly`.

### 8.3 Folded into `DESIGN.md` (2026-10-11)
Claude's retrospective: DESIGN §13, "The manual run"; pitch guides and the key-signature check as experiments in §15; chord plans dropped. Still open here: listing the extents of all long marks (slurs, 8va, hairpins) before transcribing, which belongs with the loose ends (§8.4).

### 8.4 Ideas for the pipeline (open, not decided)
- **Replace self-directed actions with steps we control:**
  - measure crops precomputed from measure boxes and sent with the system crop in one request (one turn with several images is far cheaper than several turns)
  - structural checks by our parser instead of the model compiling LilyPond (§7.4)
  - renderings for comparison produced in review (§9)
- **Caps:**
  - one call per system by default, no tools
  - a `zoom(box)` tool (normalized coordinates on the preprocessed page) only in the fix loop for flagged measures, with a hard limit (e.g. 2 per measure, 4 per system), then human
  - reasoning effort or thinking budget set per step
  - zoom boxes are recorded with the call (§5.2) and are also useful evidence for the reviewer
- **Cross-system dependencies:**
  - **Loose ends:** each system's output lists spanners and voices continuing into the next system or arriving from the previous one. Code checks that both sides match and flags both systems on a mismatch.
  - **Document-level notes:** every call may add notes tagged with the measures they concern. The reviewer of a system sees all notes concerning it, including ones written later. Short text, so cheap to show in full; also covers observations not about neighbours.
  - **Review after the whole page is transcribed,** with neighbouring systems' images and transcriptions. A later finding that affects an earlier system marks it stale for re-review (as in DESIGN §5.4), within the review-loop limit.
- **Measure the value of each extra:** call records give tokens, cost and time per call. Compare one-shot with one-shot plus capped zoom on a few systems.


### 8.5 The author's corrections, and what Claude made of them
The author checked the result against the page. Claude had listed its doubts beforehand (time signature 2/4 inferred, piece unidentified, plus about 18 doubtful spots, each with the reading it chose).

**Corrections** (`claude-chat.ly` in the test set is the *uncorrected* version):

| Bar | Correction | Flagged by Claude? | What went wrong |
|---|---|---|---|
| m3–4 | The 8va also covers the following note (where the dashed line drops) | Yes | Saw where the bracket drops, reasoned wrongly |
| m7 | The LH wedge is a crescendo | Yes | Saw it, dismissed it as a printing mark |
| m9, m17 | Beat 2 has 4 notes; the C was invented | Partly (flagged the "quintuplet", not the pitches) | The invented note produced the odd rhythm, "fixed" with an unprinted tuplet |
| m10 | LH: the F is really E♭ (A♭ was right) | Partly (flagged the wrong note) | Misread |
| m12→13 | The slur continues into m13 | No | Slur crossing a bar line and system break |
| m13 | LH last chord is E♭–G♮–D♭ | No | Copied m9 because of the "REF m9" hint instead of reading |
| m14, m22, m24 | The dot is a staccato | Yes | Saw it, left it out |
| m23→24, m25→26 | LH: three slurs, one per chord note, to the next chord | No | Saw the three arcs, silently wrote one slur because it's simpler in LilyPond |
| m24 | LH last note is an eighth plus an eighth rest (as in m26), then the clef | Yes | Picked the wrong option although m26 pointed the right way |
| m26 | RH first note has a staccato | No | Plain miss |
| m31→32 | The slur continues to the last note of the piece | No | Ended it at the last note of the arpeggio |

So 6 of 11 corrections were at least partly in Claude's doubt list: a review step that receives the list sees them for free.

**Three kinds of error, needing different fixes:**
- *Saw it, decided wrongly* (8va extent, wedge, staccatos, m24 rhythm): mostly flagged; the review step resolves them.
- *Misread or invented* (m9 C, m10 F, m26 staccato, m13 copied): reading discipline and review.
- *Spanners and simplification* (slurs across bar lines and systems, triple chord slurs): loose-end tracing, crop margins, and a definition of what is musical.

**Claude's own lessons, with the author's assessment:**
- "Keep printed marks by default": **rejected.** Several of its omissions were right (the stray dot in m2, the dot beside the B♭3 in m15). It would only trade one error for another; what's missing is telling marks from smudges.
- "Use matching bars as evidence" vs "read every bar on its own terms": both make sense in context but are hard to turn into a rule; bars are often nearly but not exactly repeats. At most a hint to look again more carefully.
- "Treat durations that don't add up as a warning": agreed, same caution.
- "Measure crops wide enough to show where slurs end, and a separate step tracing each slur end to end across system breaks": **agreed, good idea.** The measure crops had only a 25 px margin; every missed slur crossed a bar line or system break.
- "A checklist per note" (accidental, dots, accents, fingering, slur start and end): agreed.
- "Be open about simplifying": it did report most simplifications (accent placement, extra stem in m4, hidden tuplet number, beams in m31, pedal moved into the LH), **except the triple slurs**, which are musically important and must never be simplified.
- "Compare the render with the crop side by side": it recommended this but **never actually did it**; it only checked that the result compiled and looked plausible. It found the G♮ arpeggio error by chance. Its first account of what it had checked was wrong until asked again.
- Layout details it also changed silently (hairpins ending at the last note rather than the bar line, "8va" text instead of "8", default stem directions in single-voice bars) don't matter: only the musical content counts, and a review pass is planned anyway.

**Consequences (open, not decided):**
- **Prompts:**
  - Define what is musical, with examples (§8.6), and forbid simplifying to suit the output format; what can't be expressed is reported as such, never dropped.
  - Doubts as alternatives with evidence for each ("dot near A♭: staccato or smudge"), not decisions. Measure how many real errors the doubt list catches (6 of 11 here).
  - Reference bars after reading: transcribe the bar from the image first, only then get the supposed repeat and list the differences, each as an observation to check. Matching bars become a hint to look again, without copy instead of read (m13).
  - No unprinted tuplets: if durations don't add up, re-read; if it still doesn't fit, flag a doubt.
- **Lens and storage:** several simultaneous slurs on chord notes must be expressible (LilyPond labelled slurs `\=1(` … `\=1)`; MEI slurs attach to individual notes), or the model is pushed toward simplifying.
- **Inputs and loop:**
  - Measure crops with generous margins (e.g. half a measure each side).
  - A slur-tracing pass over system crops across system breaks, feeding the loose-ends matching (§8.4).
  - The render-vs-crop comparison as a pipeline step, since the model won't reliably do it on its own.
  - Trust call records (DESIGN §5.2), not the model's account of what it did.

### 8.6 Folded into `DESIGN.md` (2026-10-11)
Musical content and typesetting: DESIGN §6, "Musical content and typesetting".
