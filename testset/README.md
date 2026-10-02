# Test set

Input scores and their LilyPond extractions, compared by eye in the evaluation viewer.
See DESIGN.md §13 for the rationale.

## Files

| File | What it is |
|---|---|
| `<piece>.orig.pdf` | The input score. |
| `<piece>.<method>.ly` | LilyPond produced by one extraction method, e.g. `audiveris`, `s3l-gemini`. |
| `<piece>.<method>.pdf` | Engraving of that `.ly`, produced by the engrave command. |
| `<piece>.<file>.marks.json` | Highlighter strokes drawn in the viewer on `<piece>.<file>.pdf` (`<file>` is `orig` or a method). |

Only the README, the `*.orig.pdf` inputs, their highlighter strokes (`*.orig.marks.json`) and the `*.ly` candidates are committed (public-domain scores, e.g. from IMSLP).
Engravings, highlighter strokes on engravings and anything else produced here stay local (see `.gitignore`).

## Tooling

Run from the repository root:

```sh
npm run eval:engrave   # compile every .ly that has no PDF yet (never overwrites)
npm run eval:view      # open the side-by-side viewer at http://localhost:5174
```

Both are stubs for now. Engraving requires a local LilyPond install.

## Pieces

Each piece is described by what makes it easy or hard to extract.

| Piece | Description | Source |
|---|---|---|
| `bach_cello_suite_I_prelude_leipzig` | Bach, Cello Suite No. 1, Prelude only (1 page). Good quality scan, single staff, single voice. | [IMSLP](https://imslp.org/wiki/Special:ReverseLookup/1298), [download](https://s9.imslp.org/files/imglnks/usimg/f/f3/IMSLP01298-BWV1007.pdf) (full suite, 2026-03-26) |
| `beethoven_fuer_elise_first_edition` | Beethoven, Für Elise, first edition. Piano, two-staff systems. Yellow-tinted old paper with the ink of the back page showing through. Lots of German editorial text in old script between systems. | [IMSLP](https://imslp.org/wiki/Special:ReverseLookup/103834), [download](https://s9.imslp.org/files/imglnks/usimg/e/ed/IMSLP103834-PMLP14377-Beethoven-WoO.059nohl1867.pdf) (2026-03-13) |
| `beethoven_fuer_elise_leipzig` | Beethoven, Für Elise. Piano, two-staff systems. Good quality scan with clean, simple typesetting, no ornamentation, clean paper: the easy case among scans. Has repeats, pedal markings, octave markings and a pickup measure. | [IMSLP](https://imslp.org/wiki/Special:ReverseLookup/993345), [download](https://vmirror.imslp.org/files/imglnks/usimg/a/a0/IMSLP993345-PMLP14377-Beethoven,_L._van_-_Clavierstuck_in_A_moll_'Fu-r_Elise',_WoO_59.pdf) (2026-03-13) |
| `chopin_etude_op25_no6_breitkopf` | Chopin, Étude Op. 25 No. 6, Breitkopf. Piano. Good scan, but compact typesetting and the scales in thirds make it very dense. Many dynamics, octave markings and fingerings. Key changes whose new key signature is announced at the end of the previous system, looking like an extra measure. Editorial notes below the score offering alternatives for specific passages, with small rendered score snippets inside the notes. | [IMSLP](https://imslp.org/wiki/Special:ReverseLookup/702090). Public domain. |
| `debussy_clair_de_lune_mutopia` | Debussy, Clair de Lune. Vector PDF typeset with LilyPond. Its LilyPond source from Mutopia is included as `.orig_source.ly` (LilyPond 2.12.3), as a reference candidate. | [Mutopia](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1778), [download](https://www.mutopiaproject.org/ftp/DebussyC/L75/debussy_Ste_Bergamesq_Clair/debussy_Ste_Bergamesq_Clair-let.pdf) (2026-03-14) |
| `liszt_consolations_first_edition` | Liszt, Consolations, first edition. Piano, 22 pages, several pieces, cover page. Crooked, poor quality book scan with decorative borders on every page and fading ink. | [IMSLP](https://imslp.org/wiki/Special:ReverseLookup/14080), [download](https://ks15.imslp.org/files/imglnks/usimg/6/6f/IMSLP14080-Liszt_-_S172_Consolations_(breitkopf)_mono.pdf) (2026-03-14) |
| `mozart_concerto_20_peters_p23` | Mozart, Piano Concerto No. 20 in D minor, Edition Peters, a single page (printed page 23) near the end of the first movement. Systems of two piano double-staves: the solo part on top, the orchestra reduced for a second piano below. Fairly busy. Good quality scan of relatively modern typesetting. | [IMSLP](https://imslp.org/wiki/Special:ReverseLookup/102002). The music is public domain, but the edition is not public domain in the EU (life+70; an editor died in 1960). |
| `schumann_kinderscenen_first_edition` | Schumann, Kinderscenen, first edition. Piano, 22 pages, several pieces, cover page and an empty page. Crooked color scan of yellow, stained and creased paper, with page borders visible and a decorative frame around the music. | [IMSLP](https://imslp.org/wiki/Special:ReverseLookup/971706), [download](https://vmirror.imslp.org/files/imglnks/usimg/1/14/IMSLP971706-PMLP2799-Schumann_Kinderscenen_leichte_Stu-cke_fu-r_das_Pianoforte.pdf) (2026-03-14) |
| `villa-lobos_bachianas_brasileiras_4_prelude` | Villa-Lobos, Bachianas Brasileiras No. 4, Prelude. Piano. The number of staves changes between 2 and 3 several times. Good scan of relatively modern typesetting. | [IMSLP](https://imslp.org/wiki/Special:ReverseLookup/99583). Consolidated Music Publishers, New York, 1948. Not public domain in the EU (life+70). |
