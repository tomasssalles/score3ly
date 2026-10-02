// Compiles every <piece>.<method>.ly in the test set that has no PDF yet (DESIGN.md §13).
// Never overwrites an existing PDF.
//
// Each file is compiled from a temporary copy, updated to the installed LilyPond version
// with convert-ly first. The .ly files in the test set are never modified.

import { execFile } from "node:child_process";
import { constants, copyFile, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { type Candidate, TESTSET_DIR, planEngraving } from "./testset.ts";

const run = promisify(execFile);

async function engrave(candidate: Candidate): Promise<void> {
  const workDir = await mkdtemp(join(tmpdir(), "score3ly-engrave-"));
  try {
    const input = join(workDir, "input.ly");
    await copyFile(join(TESTSET_DIR, candidate.lyName), input);
    await run("convert-ly", ["--edit", input]);
    // -I keeps \include paths relative to the test set working.
    await run("lilypond", ["-I", TESTSET_DIR, "-o", join(workDir, "output"), input], {
      maxBuffer: 10 * 1024 * 1024,
    });
    // COPYFILE_EXCL fails if the PDF appeared in the meantime, instead of overwriting it.
    await copyFile(
      join(workDir, "output.pdf"),
      join(TESTSET_DIR, candidate.pdfName),
      constants.COPYFILE_EXCL,
    );
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function main(): Promise<number> {
  const plan = planEngraving(await readdir(TESTSET_DIR));

  for (const name of plan.invalidNames) {
    console.warn(`skipped ${name}: not named <piece>.<method>.ly`);
  }
  console.log(
    `${plan.alreadyEngraved.length} already engraved, ${plan.toEngrave.length} to engrave`,
  );

  let failures = 0;
  for (const candidate of plan.toEngrave) {
    process.stdout.write(`${candidate.lyName} ... `);
    try {
      await engrave(candidate);
      console.log("ok");
    } catch (error) {
      failures++;
      console.log("FAILED");
      // execFile errors carry the tool's output; LilyPond reports problems on stderr.
      const stderr = (error as { stderr?: string }).stderr;
      console.error(stderr || String(error));
    }
  }
  return failures === 0 ? 0 : 1;
}

process.exitCode = await main();
