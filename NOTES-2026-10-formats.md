# Notes: baselines, music formats, MEI (discussion of 2026-10-02 to 2026-10-05)

> Status: **exploration, no decisions.** Nothing here changes `DESIGN.md` yet. Ideas and findings to come back to.
> Prices and tool facts were gathered from web search snippets (vendor sites were not reachable); verify before relying on them.

## 1. Baselines for §16 step 2

**The question the baselines answer:** how well can existing tools read a PDF, understand the music and write it in a formal text-based format? Any such format will do, so a good MusicXML counts as success. Converting it to LilyPond (`musicxml2ly` or an LLM) is not part of the test: the conversion is messy and lossy and would unfairly penalize tools that export MusicXML. That's why the test set engraves `.ly` and `.musicxml` candidates alike.

### Candidate tools
- **Commercial OMR → MusicXML:** Soundslice, PhotoScore & NotateMe Ultimate, SmartScore 64 Pro, Newzik (Maestria), Tutteo (Opuscan / Flat), PlayScore 2, ScanScore, Klangio Scan2Notes, ACE Studio.
- **Open source:** Audiveris 5.11, oemer. MuseScore's online PDF import runs an old Audiveris (and claims a broad license on converted files).
- **Research models** (LEGATO / LEGATO 2, end-to-end pianoform OMR): output ABC or kern, research code, mostly notes and rhythms only.
- **Vision LLMs directly to LilyPond** (Gemini, Claude, GPT).
- Ruled out: combining several extractions with an LLM. It might work, but would cost far more than any paid service.

### Prices (test set: 9 pieces, 68 PDF pages, ~60–65 pages of music)
| Tool | Price | Free route |
|---|---|---|
| Soundslice | Plus $5/month: 100 pages/month, ≤25 pages per scan, no measure limit. Higher plans: 200 pages/month | Free: 2 scans/month, each exactly 1 page and ≤32 measures (author-verified) |
| Newzik | Premium €9.99/month | 7-day Premium trial |
| Opuscan / Flat (Tutteo) | $17.99 for 70 page credits | 1 free page |
| PlayScore 2 | Professional $6.99/month (needed for MusicXML) | 1-week trial (Windows) |
| ScanScore 3 Pro | $79/year | 30-day money-back guarantee |
| Klangio Scan2Notes | $14.99/month | 12 measures, PDF only |
| ACE Studio | paid plans ~$20/month | reportedly 10 free conversions/day |
| SmartScore 64 Pro | $399 | demo: 2 MusicXML exports (a 14-day full trial is also mentioned) |
| PhotoScore Ultimate | $249 | demo cannot save or export |
| Claude API | Opus 5.5 $4/$20, Sonnet 5.5 $2/$10 per M tokens | — |
| Gemini API | 3.1 Pro $2/$12, Flash $0.75/$3.75 per M tokens | Flash on free tier; Pro removed from free tier 2026-04-01 |

### Plan (the author's)
- Tested: Soundslice (free tier only), Newzik (7-day trial), PlayScore 2 (1-week trial), SmartScore 64 Pro (demo), Audiveris 5.11. No other OMR tools will be tested: these cover the landscape from free and open source to expensive proprietary.
- Remaining: experiments with Gemini and Claude in chats (Claude Opus 5.5 via the Pro subscription, Gemini via the app or Vertex AI welcome credits).
- **Memorization:** LLMs recognize every famous test-set piece. Gemini Flash identified the Mozart page (concerto and movement) even with edition, plate number and page number cropped away. So an LLM transcription may be partly recalled rather than read, and the test set would overstate the approach. Checks: obscure old scores unlikely to be in the training data (added: Bendel, La Cascade, which neither Gemini 3.1 Pro nor Claude Opus 5.5 could identify), and transcriptions of different editions of the same piece (e.g. the two Für Elise), to see whether the model follows the page or its memory where they differ.

### Results
- **Soundslice (free tier):** Mozart p23 and Kinderscenen p3 only, no export on the free tier, so screenshots were kept (`<piece>.soundslice.pdf`). Mozart unrecognizable. Hopeless enough that the paid month was skipped. The UI is very polished: after processing it asks multiple-choice questions about everything it was unsure of.
- **Newzik (7-day trial, cancelled):** MusicXML for the whole test set except the full Kinderscenen (failed; the single page 3 worked). Quality terrible throughout. Very verbose: 7k lines / 141k characters for the one Mozart page.
- **PlayScore 2 (1-week trial, Windows):** MusicXML for the whole test set except the full Kinderscenen (PlayScore crashes on it, even with the cover and empty pages removed; page 3 alone worked). Chopin, Kinderscenen p3 and Villa-Lobos have measures whose durations don't add up, so MuseScore only renders them with `--force`. The strongest so far, but still very bad and not usable. Best on Clair de Lune (Mutopia vector PDF engraved from LilyPond) and the Bach (a scan, but very easy to extract), though even those have too many mistakes to fix by hand.
- **Audiveris 5.11 (Linux `.deb` in WSL, batch mode):** the GUI window stays invisible under WSLg, so it was run as `audiveris -batch -export` with default settings. No Tesseract language data was installed, so no text was recognized in any piece.
  - Results: Bach terrible. Für Elise (Leipzig) better, but also very bad. Für Elise (first edition) and Villa-Lobos a disaster, unrecognizable. Mozart looks relatively normal (not yet checked against the original), better than Soundslice. Clair de Lune surprisingly decent, with many mistakes.
  - Failed, no export (not pursued, since the results above suffice to judge): Chopin (internal crash on page 2, "no such edge in graph"); Liszt (cover page has no staff lines, which aborts the whole export; `-sheets 2-22` would skip it); Kinderscenen, full and p3 (pages decode to 89.5 MP, above Audiveris's 20 MP limit).
- **SmartScore 64 Pro (Windows demo, no trial):** judged mostly from its own rendering in the app, since the demo allows little export. MusicXML exported for Mozart p23 only; a second export (Villa-Lobos) would have been cut to the first 6 measures, despite the advertised "2 exports", so it was abandoned. Needs Smart App Control turned off (it blocks the bundled unsigned `zlib1.dll`, `tiff.dll`, `jpeg62.dll`).
  - Results: Für Elise (Leipzig) the best of any tool so far, few mistakes but not perfect. Clair de Lune good overall, with some serious mistakes. Mozart decent, several serious mistakes, but among the better results in the app; the engraved MusicXML misses some of the last measures, so the export is faulty. Bach OK, several mistakes, bad text recognition. Liszt bad, mistakes everywhere. Villa-Lobos very bad. Für Elise (first edition) horrible. Chopin a disaster.
  - Kinderscenen: the full PDF took over 30 minutes to load (conversion to TIFF) and to extract, failed on most pages and was aborted after about 45 minutes. Page 3 alone: loading requires choosing an unexplained threshold (apparently binarization by lightness); the preview can't be zoomed or scrolled and shows no notes, and no threshold suits the dark, stained paper. One reason to keep colour (DESIGN §8.1).
- **Bendel, La Cascade p4** (the obscure piece; Soundslice skipped): Newzik, PlayScore 2 and Audiveris a disaster. SmartScore very, very bad in the app; no export (again only the first 6 measures allowed).
- **Overall:** every tool is still far from usable. Even the best results need too much correction by hand. If the score3ly approach works at all, it could be much better, and for transcription alone also cheaper (the commercial tools bundle practice, editing and library features this project doesn't need).
- MusicXML baselines are judged by rendering them directly with MuseScore 4 (`npm run eval:engrave`), not via `musicxml2ly`.

## 2. Why the target format is in question

The two goals:
- **A:** modify a score that exists only as a PDF (convert, edit, re-render). MusicXML + MuseScore would also do.
- **B:** give the music to an LLM for analysis or generation (e.g. a simpler version for a beginner). This was the main reason for choosing LilyPond: MusicXML is verbose, typesetting-heavy, and forces tick arithmetic.

### ABC and kern
- **ABC:** compact plain-text notation from folk music. LLMs know it best. Weak for dense piano polyphony and cross-staff notes.
- **kern (Humdrum):** a time grid with one column (spine) per staff and one row per time slice. Voices via spine split/merge (`*^`/`*v`). Dynamics in a parallel `**dynam` spine. Cross-staff notes and other layout via extensions (RDF signifiers, Verovio). Researchers use it (and ABC) because image-to-sequence models need a compact linear target, datasets exist (GrandStaff, KernScores), and token edit distance is easy to score. The research variant **bekern** keeps only the core: pitches, rhythms, ties, beams, clefs/keys/meters.
- **For an LLM:** LilyPond keeps melodic lines contiguous, but simultaneity still needs duration sums. kern makes simultaneity explicit but scatters melodic lines down columns, and is fragile to generate (every row needs one token per spine). Possible combination: LilyPond for lines plus a code-generated kern-like grid for harmony.
- **Experiment idea:** convert the Mutopia Clair de Lune to kern and compare LLM analysis/simplification from both formats.

### Why MusicXML → LilyPond via `musicxml2ly` is imperfect
1. Different voice models: MusicXML uses a time cursor (`<backup>`/`<forward>`) with voice numbers, LilyPond uses continuous voice streams. With inconsistent OMR voice numbers the output gets fragmented, but the music is mostly preserved. Voice identity itself is musical information for piano, though.
2. Redundant and inconsistent data (`<duration>` vs `<type>`, `<alter>` vs printed accidental), and OMR measures whose durations don't add up. MuseScore tolerates this; LilyPond is strict. In practice wrong measure durations are strong red flags for OMR errors.
3. Converter gaps (cross-staff notes, staff count changes, pedal, some ornaments, octave marks): check on the test set rather than assume.

### Idea: OMR + programmatic checks + LLM fixes
- OMR → MusicXML → import into our own representation → checks → LLM fixes only the flagged measures → export to anything. Cheap, since only flagged measures go to the LLM.
- Checks beyond measure durations: key/time consistency, pitch ranges per staff, stable voice count, measure count vs global analysis. Legitimate exceptions (pickups, repeats, cadenzas, Chopin-style key changes at line ends) are flagged, not forced.
- Needs a measure → image region mapping; the MusicXML layout data (`<print>`, `default-x`) may or may not be reliable per tool.
- The LLM should not edit MusicXML (tick arithmetic). It gets the measure in a compact text form, returns a replacement, and code splices it back. Include neighboring measures for ties and voices crossing barlines.

## 3. A canonical internal representation

### Requirements (the author's)
- Everything "musical", as opposed to typesetting: pitches, durations, rests, ties, slurs, articulations, tremolo, dynamics, and what an interpreter needs: voices, cross-staff notes, stem directions.
- Optionally editorial notes, alternative snippets, etc., clearly separated from the music.
- In-memory structure or text format, parseable unambiguously.
- After removing non-musical elements, only one way to represent given music, or equivalences that are trivial to recognize.
- Easy conversion both ways with MusicXML, LilyPond, ABC and kern.
- Bonus: our own rendering with informative adaptations (e.g. one colour per voice).
- Need not suit LLMs or humans.

### Findings
- No format guarantees "only one way" by itself. That needs a **normalizer** to a canonical form, and equality on the normalized form.
- Lossless conversion to ABC/kern is impossible (they express less). Importing LilyPond is only possible from a subset we define.
- **MEI** fits best. MusicXML subset is the fallback (best tool ecosystem, heavy normalization, weak editorial). kern and LilyPond are better as derived views.

### MEI in brief
- XML, from the musicology community (TEI-like). Structure `meiHead` → `music/body/mdiv/score` → `scoreDef` → `section` → `measure` → `staff` → `layer` (= voice) → notes/chords/rests.
- Pitch as name + octave, durations as note values (no divisions/backup). Control events (dynamics, slurs, hairpins, pedal, tempo, octave lines) after the layers, attached by `startid`/`endid` or `tstamp`.
- Written vs sounding values separated (`accid` vs `accid.ges`, `dur` vs `dur.ges`). Explicit `stem.dir`, `staff` on a note for cross-staff, `color`.
- Editorial: `<app>`/`<rdg>`, `<choice>` (`sic`/`corr`, `orig`/`reg`), `<supplied>`, `<unclear cert>`, `<annot>`, ossia.
- **MEI Basic:** official subset with "one way of encoding for every feature", intended for exchange and converters. It **excludes editorial markup**, so our profile would be MEI Basic plus selected full-MEI modules (editorial; facsimile if Basic lacks it, which was not verified). Profiles are defined formally in ODD, from which a validating schema is generated.
- `<measure metcon="false">` marks deliberately irregular measures. Rule idea: a measure whose durations don't match the meter and isn't marked `metcon="false"` is an error.
- **Verovio** (WASM, browser): imports MEI, MusicXML, Humdrum/kern, ABC, PAE. Outputs MEI (incl. `mei-basic`, `mei-facs`), SVG, MIDI, Humdrum (only from MusicXML input), PAE, timemap. **No MusicXML export.** Renders with colours, keeps `xml:id`s in the SVG.
- music21 reads MEI; MuseScore has MEI import/export since 4.2 (to verify). No LilyPond converter either way: MEI → LilyPond would be ours.

### Leaning (not decided): MEI Basic as storage, a "lens" format for LLMs
- MEI Basic (plus extensions) is the stored ground truth and contains everything. The LLM never reads or writes MEI.
- The **lens** covers only the subset the LLM needs, so only that subset has to be defined. Converting lens → MEI Basic normalizes whatever flexibility the lens still has.
- Considered and rejected for now: storing the lens format itself (one format fewer, readable), because MEI keeps everything we need and the lens only needs to cover a subset.
- Lens shape: a JSON envelope (provider-enforced schema) for measure/staff/voice structure, with one compact note string per voice, essentially the constrained LilyPond subset of §7.3 (absolute pitches, explicit durations, inline slurs/dynamics/articulations, stem and cross-staff markers), plus an uncertainty list:

  ```json
  { "measures": [ { "n": 12, "staves": [
      { "staff": 1, "voices": [
          { "voice": 1, "music": "e''4( <c'' e''>4 a'2-.) \\p" },
          { "voice": 2, "music": "a'2 g2\\staffDown" } ] } ] } ],
    "uncertain": [ { "measure": 12, "voice": "1.2", "reason": "smudge, beat 3" } ] }
  ```
- The lens is swappable (e.g. a kern-like lens) without touching storage. Which lens transcribes best is an empirical question.

### Corrections via the lens
- Input: system crop with the flagged measure boxed (from facsimile zones); the flagged measure plus neighbours in the lens; the precise check findings; the state at that point computed by code (key, time, clefs, octave marks, continuing voices); optionally a Verovio rendering coloured by voice.
- Output: a full replacement of the flagged measure (not edit operations) plus reason and confidence. Code parses, re-checks, splices into MEI keeping IDs/facs/editorial, reconnects cross-barline slurs and ties. Repeated failure or low confidence → human.

### First draft via the lens
1. Global analysis and layout: system boxes, metadata, key/time/clefs, voices per staff, ideally also **measure boxes** (needed for every later correction).
2. Code builds an empty MEI skeleton: staves, expected voices, measure numbers with facs zones, state at each system start.
3. One call per system: crop + skeleton + start state + previous system's last measure + global context → lens JSON for all measures of the system + uncertainties.
4. Code parses, normalizes, fills the skeleton, runs checks; failures enter the correction loop.

## 4. Image region linking (MEI facsimile)
- `<surface>` = a page with an abstract coordinate space we choose (`ulx/uly/lrx/lry`, e.g. 0–1000 like Gemini's boxes). `<zone>` coordinates are in the surface's space, not in any image's pixels. `<graphic>` (optional, several allowed) names images of the surface with their pixel sizes. Content points at zones with `@facs`.
- Fits §8.2 (normalized coordinates) and §5.3 (images are cache): graphics can be omitted, page images regenerated.
- MEI has no notion of PDF pages. "Surface p3 = page 3 of the project PDF" is our own convention (a `graphic target` URI like `pdfs/<sha256>.pdf#page=3` would be informational only).
- Open point: which geometry zones refer to. Simplest: the **preprocessed** page image (what the LLM and human saw), identified by recipe and fingerprint, since deskewing turns rectangles into rotated ones on the original.
- The other direction, our own renderings: Verovio's SVG carries the MEI `xml:id`s, so rendered measures/notes map back to stored ones for free. LilyPond would need our own ID attributes in its SVG output (or point-and-click positions mapped back).
- Use: crop measure N from the original (via its facs zone) and from the Verovio rendering (via its `xml:id`, with original system breaks kept via `<sb/>`/`<pb/>` and encoded breaks), optionally coloured by voice, and give the pair to the reviewer LLM, the correction step or the viewer.

## 5. Things to verify
- Whether MEI Basic includes the facsimile module.
- Quality of MEI → MusicXML converters (Verovio doesn't export MusicXML).
- MuseScore's MEI support.
- Which `musicxml2ly` gaps actually bite on the test set.
- The vendor prices and trial terms above, before paying.

## 6. Draft prompt: bounding box of the musical content (Gemini's suggestion)

After a few attempts at getting a content bounding box from Gemini, Gemini suggested the prompt below. Use it as input when writing our own, but **it is biased by the single example it was developed on** (Kinderscenen p3: decorative frame, "N°1" label, plate number "6016"). Generalize it and drop test-set-specific details (such as the "N°1" and "6016" examples) to avoid overfitting to the test set.

> **System Prompt: Sheet Music Core Content Extraction**
>
> Your task is to detect and extract the bounding box coordinates of the core musical and textual content in the provided image of a musical score.
>
> **Coordinate Format**
> Output ONLY a JSON array of four integers representing coordinates normalized on a scale from 0 to 1000. Use the exact format `[ymin, xmin, ymax, xmax]` (Top, Left, Bottom, Right).
>
> **Target Content (What to Include)**
> The bounding box must comprehensively enclose the central musical composition and its integral metadata. This strictly includes:
> - All musical staves, notes, stems, ledger lines, bar lines, clefs, and key/time signatures.
> - All system connectors on the far left edge, specifically capturing curly braces, straight brackets, and staff labels (e.g., "N°1", "Flute", "I", "II").
> - All performance directions, including tempos, dynamics, lyrics, fingering numbers, slurs, and pedal markings.
> - The main title, subtitles, and composer/arranger credits usually located at the top of the first page.
> - Publisher plate numbers (e.g., "6016") typically located at the bottom center of the page.
>
> **Exclusions (What to Ignore)**
> The bounding box must intentionally exclude peripheral non-musical elements, adapting to both clean vector PDFs and historical scanned documents. Strictly exclude:
> - Blank paper margins.
> - Decorative page borders, ornamental frames, or purely aesthetic background illustrations.
> - Page numbers isolated in the extreme top or bottom corners.
> - Archival library stamps, watermarks, scanner artifacts, or binder holes.
>
> **Precision Guardrails**
> Provide a tight bounding box that hugs the outermost pixels of the target content. Pay special attention to the left and right extremities to avoid clipping system brackets, initial clefs, or outer ledger lines, while ensuring no decorative borders inflate the dimensions.
