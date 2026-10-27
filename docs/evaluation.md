# Evaluation

How the quality of transcriptions is judged: by people, with tooling. The test set, the engrave command, the viewer and the highlighter, the baselines from existing tools, and the manual run that decided building the app. § numbers here are `DESIGN.md`'s sections.

**Human evaluation, supported by tooling.** There is no ground-truth encoding for interesting scores (only for PDFs engraved from a source that is published with them, such as Mutopia's LilyPond, a narrow and easy subdomain). Every format can also express the same music in many ways, so comparing source text is meaningless. And the errors music OCR still makes are big and obvious: improvements are visible from a glance at the rendered output. Precise automatic metrics would be the right tool for a production system tuned over years, not for this project.

## Test set
- `testset/` in the repo (its `README.md` lists the pieces, why each was picked, and how to use the tooling). Small, since evaluation is by hand. Only the input PDFs (public domain, e.g. from IMSLP), the highlighter strokes on them, the `.ly` and `.musicxml` candidates and the Soundslice screenshots are committed. The inputs never change, so their strokes stay valid on any machine. Engravings, strokes on engravings and any other files produced there stay local. Its README documents the tooling and why each piece was picked.
- Input PDFs are chosen to cover the phenomena in §1 rather than random pieces: multiple voices per staff, staff count changes, lyrics, editorial notes and ossia/alternatives, reduction staff, two-piano double systems, old ornamented scans, clean vector PDFs, a few non-piano cases.
- Naming: `<piece>.orig.pdf` is the input. Each extraction method adds `<piece>.<method>.<format>`, in the format the method writes: `.musicxml` from OMR tools (e.g. `fuer_elise.audiveris.musicxml`), rendered directly, so a tool isn't judged on a lossy `musicxml2ly` conversion; `.ly` from LilyPond (e.g. the manual run's `bendel_la_cascade_p4.claude-chat.ly`); `.mei` from score3ly (e.g. `fuer_elise.s3l-opus.mei`). Baselines are the best results from existing tools.

## Tooling
- **Engrave command:** engraves every `<piece>.<method>.ly` (local LilyPond install), `<piece>.<method>.musicxml` (local MuseScore 4 install) and `<piece>.<method>.mei` (score3ly's output: Verovio in Node with the app's options, Verovio's own breaks on A4, its SVG pages drawn into the PDF with pdfkit and svg-to-pdfkit, nothing to install) that has no `<piece>.<method>.pdf` yet. Never overwrites existing PDFs. MEI candidates are committed like the others, named `s3l-<model or config>`.
- **Viewer:** a local web page with three PDFs side by side, each scrolling continuously (page breaks don't line up across engravings). The left pane always shows the original. The middle and right panes have dropdowns listing the available engravings of the same piece.
- **Highlighter:** freehand strokes painted over any of the PDFs (original or engraving), in a color from a short list, with multiply blending so the notes underneath stay visible. They point the eye at errors: no types, no counting. A switch between reading and highlighting mode prevents accidental strokes. One "undo last stroke" covers all panes and is the only way to erase. Its history covers the current session and is cleared when switching pieces.
- **Stroke storage:** next to the PDF in `<piece>.<method>.marks.jsonl` (`<piece>.orig.marks.jsonl` for the original), saved after every change, as JSON Lines: one stroke per line. Per stroke: page, color name, width and points (relative to the page size), and the SHA-256 of the PDF it was drawn on. Colors are stored by name and looked up in the viewer's palette, so adjusting a palette value recolors existing strokes; names not in the palette are painted grey. Storing the hash per stroke means strokes drawn on an older version of a PDF stay identifiable even after new ones are added. The viewer warns about such strokes, since they may be misplaced. The PDF itself is never modified.

## Baselines
**The question:** how well can existing tools read a PDF, understand the music and write it in a formal text format? Any format counts, so MusicXML is rendered directly with MuseScore 4 (`npm run eval:engrave`), not converted to LilyPond first. Audiveris is installed only from https://github.com/Audiveris/audiveris/releases: `audiveris.com` and `audiveris.net` are scam sites.
- **Tested** (2026-10), covering free and open source to expensive proprietary: Soundslice (free tier), Newzik (7-day trial), PlayScore 2 (1-week trial), SmartScore 64 Pro (demo), Audiveris 5.11. Not tested: PhotoScore & NotateMe, ScanScore, Klangio Scan2Notes, Opuscan/Flat, ACE Studio, oemer, and research models (LEGATO and others, which mostly output notes and rhythms only, in ABC or kern). Ruled out: combining several tools' extractions with an LLM, which would cost more than any paid service.
- **Results:** every tool is far from usable; even the best results need too much correction by hand.
  - **Soundslice:** Mozart unrecognizable. Its free tier doesn't allow exporting the extracted music, so its results in the test set are screenshots of its rendering (`<piece>.soundslice.pdf`). A very polished UI, which asks multiple-choice questions about everything it was unsure of.
  - **Newzik:** terrible throughout, and very verbose (141k characters of MusicXML for one Mozart page). Failed on the full Kinderscenen.
  - **PlayScore 2:** the best of the three on the whole test set, still not usable. Measures whose durations don't add up (Chopin, Kinderscenen p3, Villa-Lobos). Crashed on the full Kinderscenen.
  - **Audiveris** (batch mode): mostly very bad; Clair de Lune (a vector PDF engraved by LilyPond) surprisingly decent. Failed on Chopin (internal crash), Liszt (a cover page without staff lines aborts the export) and Kinderscenen (pages over its 20-megapixel limit).
  - **SmartScore** (judged in the app, the demo exports almost nothing): Für Elise (Leipzig) the best of any tool, few mistakes; Clair de Lune good, Mozart decent; the rest bad to a disaster. The full Kinderscenen took over 45 minutes and failed; its binarization threshold suits no part of the stained paper (one reason to keep colour, §8.1).
  - **Bendel, La Cascade p4** (an obscure piece): a disaster with every tool.
- **Opus 5.5 in a chat** ("The manual run" below) did far better, which decided building the app (2026-10-06): every existing tool tested, paid or free, was far from usable, and this design builds on the manual run's lessons.

**Memorization:** LLMs recognize the famous pieces of the test set (Gemini Flash named the Mozart concerto and movement from a page with the edition, plate and page numbers cropped away), so a transcription may be partly recalled rather than read, and the test set would overstate how well the approach works. Two checks: obscure scores unlikely to be in the training data (Bendel, La Cascade, which neither Gemini 3.1 Pro nor Opus 5.5 could identify), and different editions of the same piece (the two Für Elise), to see whether the model follows the page or its memory where they differ (§15).

## The manual run
Bendel, La Cascade p4, transcribed by Claude Opus 5.5 in a claude.ai chat with code execution, following the intended pipeline by hand (2026-10). The result, uncorrected, is `testset/bendel_la_cascade_p4.claude-chat.ly`.
- **What was done:**
  1. Structure from the full page, as structured text: systems, measures and staves per system, clefs, keys and time signatures with their changes, voices, and observations such as repeated melodies.
  2. A LilyPond skeleton with one variable per measure and hand (a first version reused one variable for measures it thought identical, and was corrected).
  3. System boxes by eye, with a check loop: code draws the boxes on the page, the model looks and corrects; two rounds sufficed.
  4. System crops, uploaded one at a time; the model cut them into measure crops on its own and zoomed further into tricky note groups.
  5. Transcription system by system, compiled with LilyPond to check, and a correction of system 4 after system 5 (a slur continued into the next system).
- **What it showed, and where it went in the design:**
  - **Opus read the structure from the full page correctly,** measure counts included (6, 6, 6, 7, 8), where Gemini 3.1 Pro and 3.6 Flash had answered 3 per system, guessing from note groups instead of bar lines. One page, one try each, but it supports `layout` on whole pages with bar line positions as evidence rather than counts.
  - **Boxes by eye with a draw-and-check loop work,** at least on a clean page (`layout`'s tool, at most 3 rounds). Unknown on stained, ornamented scans (the Kinderscenen test, §15).
  - **Measure crops help, and so does zooming into small note groups:** stretch crops with every system crop, and zoom crops on request (`docs/stages/music.md`, "Zooming in").
  - **Left alone, the model over-explores:** too many images, turns and tool calls, and too much time (7 minutes for system 1). Images are cheap (a full page is roughly 1.5–3k input tokens); the cost is in turns resending a growing context and in long reasoning. Hence steps we control, one call per system, and caps on every loop.
  - **Systems depend on each other:** slurs, ties, hairpins, 8va lines, pedal and voices cross system breaks, and a later system can change the reading of an earlier one. Hence the neighbouring crops in `extract`, the continuation flags, and `review` with the whole score.
  - **Repetitions seen from above were partly wrong** (m13 isn't m9): observations are hints, and every stretch is read on its own.
- **The author's check of the result** found 11 errors, 6 of them at least partly in the model's list of doubts. Three kinds, needing different remedies:
  - *saw it, decided wrongly* (the extent of an 8va, a crescendo dismissed as a printing mark, staccatos left out, the wrong one of two rhythms): mostly among the doubts; `review` and the issues resolve them;
  - *misread or invented* (an invented note, a wrong note, a missed staccato, a measure copied from a supposed repeat): reading discipline in the prompt, and `review`;
  - *spanners and simplification* (slurs ending too early at bar lines and system breaks, three slurs written as one): crop margins, `review`'s attention to spanners, and the rules on musical content (`docs/notation.md`, "Musical content and typesetting").

  Claude's account of what it had checked was wrong until asked again (it recommended comparing the rendering with the crop but never did it): the call records are trusted, not a model's account (§5.2).
- **Claude's own retrospective** (what would have helped from the start), and what became of it:
  - **A fixed output spec,** given in full from the start: it changed its conventions midway (pedal moved into the left hand, phrasing slurs from system 2 on, sounding pitch under 8va). That is the lens and the prompt (`docs/notation.md`, "The lens").
  - **A known effort budget:** caps belong to the pipeline, not to the model's judgement (`extract`'s loops).
  - **Context from before the page** (time signature, anything still open, composer and edition): the state carried by code, the observations and the metadata.
  - **Doubts as data, not prose:** issues.
  - **Labels for the images:** in the chat, uploads reached the model as generic file names, so it couldn't tell which crop was which. In the API, a text block before each image labels it (§7.2).
  - **Boxes by eye with a draw-and-check loop, at most 3 rounds:** `layout`.
  - **A render-and-compare self-check, and visual comparison per bar:** a review step we control, not the model's own loop (`review`, "Renderings").
  - **An independent review** by a model that hasn't seen the first transcription: `review`, possibly with another model (§7.2).
  - **Checks** for durations and unclosed marks: `extract` and `apply_review`.
  - **Dropped:**
    - **a rough chord per bar as a prior,** with a check for notes clashing with it: Claude did fine without it, and a wrong chord would bias the reading;
    - **staff lines and bar lines found by pixel counting:** that kind of scripting failed in v1 and in score2ly, and a wrong detection would make the extraction worse; bar lines come from `layout`;
    - **transcribing bar by bar:** many more calls, and the view of the whole system is lost (the slur fix came from it).
  - **Experiments for some day** (§15): pitch guides. Printed accidentals and 8va instead of pitches became the symbolic format (§6), as an experiment.

## Use
- Compare methods, prompts and models side by side by eye.
- Count how many of the real errors the issues raised by `extract` catch (6 of 11 in the manual run).
- Cost per piece comes from the LLM call records (§10).
