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

### 8.3 Claude's own retrospective, reviewed
Asked afterwards what would have helped from the start. Its points, with our assessment:

| Point | Assessment |
|---|---|
| A fixed output spec from the start: one bar per variable, absolute sounding pitch under 8va, where pedal, dynamics and hairpins go, how marks spanning two variables open and close. It changed conventions mid-way (pedal moved into the LH variables, phrasing slurs from system 2, sounding pitch under 8va midway). | Agreed; that's DESIGN §7.3 and the lens (§3). Spanners across variables need an explicit rule. |
| Knowing the effort budget from the start. | Agreed; caps belong in the pipeline, not in the model's judgement. |
| Context from before this page: time signature, anything still open (slur, 8va, clef), composer and edition. | Agreed; belongs in the document-level analysis. |
| A rough chord per bar in a planning pass, as a prior. Most of its real errors were harmonic (G♮ vs G♭ in the m30 arpeggio, F♭ vs G♭ in m23/25, B♭ vs B♮ in m28, A♭ vs B♭ in the m10 LH). | **New, worth testing.** Also enables a check that flags notes clashing with the planned chord. Risk: a wrong chord biases the reading. |
| Extents of all long marks (slurs, 8va, hairpins) listed before transcribing. | Agreed; overlaps with the loose-ends idea (§8.4). |
| Repetitions verified properly in the first pass. | Partly: keep them as hints either way, verified at transcription time. |
| Staff-line positions per crop; turning pixel heights into pitches was its biggest time sink and source of doubt. | See pitch guides below. |
| Uncertainty in the JSON (`value`, `confidence`, `doubts`) instead of prose. | Already DESIGN §7.2. |
| A mandatory self-check: render and compare with the crop (would have caught the G♮). | Useful, but as a review step we control (§7.5, §9), not inside the model's own loop. |
| Labels drawn onto the images ("S3 m13–18") because filenames didn't reach the model. | **To verify.** True for claude.ai uploads; with the API we control the request and can put text labels next to each image. Drawing labels onto the image is still a cheap fallback. |
| Automation: boxes with the draw-and-check loop, max 3 rounds, then flag. | Agreed. |
| Automation: staff lines and bar lines found by pixel counting inside a system crop, model as fallback. | **Caution:** scripting like this failed in v1 and score2ly. Maybe more robust on a single crop than on a damaged page; test on stained scans (Kinderscenen) before relying on it, with the model fallback from the start. |
| Automation: faint labelled pitch guides (staff lines and ledger positions, E4, G4, … C6) drawn onto each measure crop: "read the label" instead of "estimate a pixel height". | **New, cheap to test.** Needs staff-line positions (see the previous point), or the model to supply them. |
| Automation: transcribe bar by bar, with the state carried in. | **Doubtful:** many more calls, and it loses the system-level view (the slur fix came from that view). Per-system calls with measure crops as extra input seem the better trade-off. |
| Automation: checks for bar durations (bar checks between variables), unclosed marks, pitches leaving the key without a printed accidental, range, chord clashes. | Mostly DESIGN §7.4. **New:** the key-signature check (would have caught the G♮) and the chord-clash check. |
| Automation: visual comparison per bar, 1–2 correction rounds. | Agreed, in review (§9). |
| Automation: independent review of low-confidence bars by an agent that hasn't seen the first transcription. | Agreed; DESIGN §7.5 prefers a different model as reviewer. |

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
- **Measure the value of each extra:** call records give tokens, cost and time per call. Compare one-shot with one-shot plus capped zoom (and with or without pitch guides or chord plans) on a few systems.


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

### 8.6 Musical content vs typesetting
Claude attached the m7 crescendo to the pedal line instead of the notes, so it would print lower and not clutter the music. That encodes a false musical fact on purpose, to make the engraving look better, and must never happen.

**The test:** *would a player read it differently?* If yes, it's musical and is encoded exactly as printed.

- **Musical (encoded and reviewed):** pitches, rhythms, rests, voices, which hand plays what, ties, slurs (including one slur per chord note), articulations, dynamics and hairpins with the notes they start and end on, 8va extents, clefs, repeats, **beam grouping** (e.g. 4 × 3 eighths is not 12 single eighths; grouping shows the rhythm and phrasing, including beams against the meter or across bar lines and staves), and **stem direction** where it separates voices or hands (in one staff shared by both hands it often shows which hand plays what).
- **Typesetting (ignored):** spacing, slur and beam shapes, beam slope and thickness, stem length, exact vertical position of marks, line and page breaks, fonts, the default stem direction of a single voice.

**Defences (open, not decided):**
1. **Extraction prompt:** encode what the music means, never how it should look; every dynamic, hairpin, articulation and slur is attached to the notes it applies to; layout never influences what is encoded; report what can't be expressed faithfully. Include the pedal-line example.
2. **Make hacks impossible in the format:**
   - The lens has no layout controls: no `\override`, `\tweak`, spacer-only voices or separate Dynamics contexts. Dynamics and hairpins can only be written on notes or rests in a voice.
   - The parser rejects anything outside the subset as a structural error (DESIGN §7.4).
   - In MEI, `<dynam>` and `<hairpin>` refer to a staff and to notes or beats. Placement on the page is decided later by our renderer or LilyPond export, from the musical data.
   - Open point: a dynamic printed between the piano staves usually applies to both hands, so the lens needs a way to say which staff or both (MEI `staff="1 2"`), so the model isn't tempted to pick a staff because it looks better.
3. **Review prompt:**
   - Check only the musical content (the list above) against the original, and ignore typesetting.
   - Findings must use musical categories (DESIGN §7.5), so "the hairpin looks too high" has no valid type and is dropped.
   - The reviewer also gets the source text of the measure, since a render can look right while the source is wrong (the pedal-line hack would render plausibly).
