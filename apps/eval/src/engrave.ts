// Engraves every candidate in the test set that has no PDF yet (DESIGN.md §13):
// <piece>.<method>.ly with LilyPond, <piece>.<method>.musicxml with MuseScore,
// <piece>.<method>.mei with Verovio, as the app's `engrave` does.
// Never overwrites an existing PDF.
//
// Each .ly is compiled from a temporary copy, updated to the installed LilyPond version
// with convert-ly first. The files in the test set are never modified.

import { execFile } from "node:child_process";
import { createWriteStream } from "node:fs";
import { constants, copyFile, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";
import { warningLines } from "./lilypond.ts";
import { type Candidate, TESTSET_DIR, planEngraving } from "./testset.ts";

const run = promisify(execFile);

// The MuseScore 4 command, e.g. "mscore4portable" for the AppImage. Defaults to "mscore".
const MSCORE = process.env.MSCORE || "mscore";

// Writes <workDir>/output.pdf and returns LilyPond's warnings.
async function engraveLilyPond(candidate: Candidate, workDir: string): Promise<string[]> {
  // Same name as the original, so LilyPond's messages point to the right file.
  const input = join(workDir, candidate.sourceName);
  await copyFile(join(TESTSET_DIR, candidate.sourceName), input);
  await run("convert-ly", ["--edit", input]);
  // Run from workDir with the bare file name, so messages say "<sourceName>:<line>:<column>".
  const { stderr } = await run("lilypond", ["-o", "output", candidate.sourceName], {
    cwd: workDir,
    maxBuffer: 10 * 1024 * 1024,
  });
  return warningLines(stderr);
}

async function runMuseScore(candidate: Candidate, workDir: string, force: boolean): Promise<void> {
  const args = ["-o", join(workDir, "output.pdf"), join(TESTSET_DIR, candidate.sourceName)];
  await run(MSCORE, force ? ["-f", ...args] : args, {
    maxBuffer: 10 * 1024 * 1024,
    // Lets MuseScore run without a display (Linux/WSL); an explicit setting wins.
    env: { QT_QPA_PLATFORM: "offscreen", ...process.env },
  });
}

// Writes <workDir>/output.pdf. MuseScore's console output is mostly noise, so its only
// warning is a score it considers corrupted (e.g. measure durations that don't add up).
// It refuses to convert those, silently (the reason is only in its log file), unless forced.
async function engraveMuseScore(candidate: Candidate, workDir: string): Promise<string[]> {
  try {
    await runMuseScore(candidate, workDir, false);
    return [];
  } catch {
    await runMuseScore(candidate, workDir, true);
    return ["MuseScore considers the score corrupted (details in its log file); engraved with --force"];
  }
}

// The app's engraving (apps/web/src/engraving.ts, `pageOptions`): Verovio's own breaks, A4 (its units are tenths of
// a millimetre), no footer.
const VEROVIO_OPTIONS = { breaks: "auto", pageWidth: 2100, pageHeight: 2970, scale: 40, footer: "none", svgViewBox: true };
const A4_POINTS = { width: 595.28, height: 841.89 };

let verovio: Promise<VerovioToolkit> | null = null;

// Writes <workDir>/output.pdf: Verovio's pages (SVG), each drawn on an A4 page with pdfkit. Returns what Verovio
// and the SVG conversion warned about.
async function engraveMei(candidate: Candidate, workDir: string): Promise<string[]> {
  verovio ??= createVerovioModule().then((module) => new VerovioToolkit(module));
  const toolkit = await verovio;
  toolkit.setOptions(VEROVIO_OPTIONS);
  if (!toolkit.loadData(await readFile(join(TESTSET_DIR, candidate.sourceName), "utf8"))) {
    throw new Error(`Verovio can't read it:\n${toolkit.getLog()}`);
  }
  const warnings = new Set(toolkit.getLog().split("\n").map((line) => line.trim()).filter(Boolean));
  const pdf = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: false });
  const written = new Promise<void>((resolve, reject) => {
    const out = createWriteStream(join(workDir, "output.pdf"));
    out.on("finish", resolve).on("error", reject);
    pdf.pipe(out);
  });
  for (let page = 1; page <= toolkit.getPageCount(); page++) {
    pdf.addPage();
    SVGtoPDF(pdf, toolkit.renderToSVG(page), 0, 0, { ...A4_POINTS, warningCallback: (w) => warnings.add(w) });
  }
  pdf.end();
  await written;
  return [...warnings];
}

async function engrave(candidate: Candidate): Promise<string[]> {
  const workDir = await mkdtemp(join(tmpdir(), "score3ly-engrave-"));
  try {
    const warnings =
      candidate.format === "ly"
        ? await engraveLilyPond(candidate, workDir)
        : candidate.format === "mei"
          ? await engraveMei(candidate, workDir)
          : await engraveMuseScore(candidate, workDir);
    // COPYFILE_EXCL fails if the PDF appeared in the meantime, instead of overwriting it.
    await copyFile(
      join(workDir, "output.pdf"),
      join(TESTSET_DIR, candidate.pdfName),
      constants.COPYFILE_EXCL,
    );
    return warnings;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function main(): Promise<number> {
  const plan = planEngraving(await readdir(TESTSET_DIR));

  for (const name of plan.invalidNames) {
    console.warn(`skipped ${name}: not named <piece>.<method>.<ly, musicxml or mei>`);
  }
  for (const candidate of plan.conflicts) {
    console.warn(`skipped ${candidate.sourceName}: another file would also engrave to ${candidate.pdfName}`);
  }
  console.log(
    `${plan.alreadyEngraved.length} already engraved, ${plan.toEngrave.length} to engrave`,
  );

  let failures = 0;
  for (const candidate of plan.toEngrave) {
    process.stdout.write(`${candidate.sourceName} ... `);
    try {
      const warnings = await engrave(candidate);
      console.log(warnings.length === 0 ? "ok" : `ok, ${warnings.length} warning(s):`);
      for (const warning of warnings) {
        console.log(`  ${warning}`);
      }
    } catch (error) {
      failures++;
      console.log("FAILED");
      // execFile errors carry the tool's output; LilyPond and MuseScore report problems on stderr.
      const stderr = (error as { stderr?: string }).stderr;
      console.error(stderr || String(error));
    }
  }
  return failures === 0 ? 0 : 1;
}

process.exitCode = await main();
