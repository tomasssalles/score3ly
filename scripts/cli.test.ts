import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { markFolder, mayReplace } from "./cli.ts";

// A script run with `args`: its exit code and what it printed on stderr.
function run(script: string, args: string[]) {
  const result = spawnSync(process.execPath, [join(import.meta.dirname, script), ...args], { encoding: "utf8", timeout: 60_000 });
  return { status: result.status, stderr: result.stderr };
}

// Found in the code review (E10): a flag without its value took `undefined` or the next flag, and the folders the
// scripts delete were whatever an argument named.
test("a flag without its value, or an unknown one, is refused before anything is done", () => {
  for (const [script, args, message] of [
    ["screenshots.ts", ["--out"], /--out <value>' argument missing/],
    ["screenshots.ts", ["--only", "--desktop"], /--only' argument is ambiguous/],
    ["screenshots.ts", ["--bogus"], /Unknown option '--bogus'/],
    ["replay.ts", ["--only"], /--only <value>' argument missing/],
    ["replay.ts", ["fake"], /Unexpected argument 'fake'/],
  ] as const) {
    const { status, stderr } = run(script, [...args]);
    assert.equal(status, 1, `${script} ${args.join(" ")}`);
    assert.match(stderr, message);
    assert.match(stderr, /Usage: /);
  }
});

test("seedStats deletes only a folder of its own inside apps/worker/.wrangler", () => {
  for (const folder of [".", "..", ".wrangler", "/tmp/elsewhere", "../../.."]) {
    const { status, stderr } = run("seedStats.ts", [folder]);
    assert.equal(status, 1, folder);
    assert.match(stderr, /isn't inside/, folder);
  }
  assert.match(run("seedStats.ts", ["a", "b"]).stderr, /at most one folder/);
});

test("screenshots refuse an --out folder they didn't write", () => {
  const dir = mkdtempSync(join(tmpdir(), "score3ly-cli-"));
  try {
    writeFileSync(join(dir, "precious.txt"), "");
    const { status, stderr } = run("screenshots.ts", ["--out", dir]);
    assert.equal(status, 1);
    assert.match(stderr, /wasn't written by this tool/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("mayReplace: the tool's own default, an empty or missing folder, or one it marked", () => {
  const root = mkdtempSync(join(tmpdir(), "score3ly-cli-"));
  try {
    const own = join(root, "own");
    const full = join(root, "full");
    const marked = join(root, "marked");
    for (const dir of [own, full, marked]) {
      mkdirSync(dir);
      writeFileSync(join(dir, "file"), "");
    }
    markFolder(marked, ".mark");
    assert.equal(mayReplace(own, ".mark", { ownDefault: own }), null);
    assert.equal(mayReplace(join(root, "missing"), ".mark"), null);
    assert.equal(mayReplace(marked, ".mark"), null);
    mkdirSync(join(root, "empty"));
    assert.equal(mayReplace(join(root, "empty"), ".mark"), null);
    assert.match(mayReplace(full, ".mark") ?? "", /wasn't written by this tool/);
    assert.match(mayReplace(root, ".mark", { within: root }) ?? "", /isn't inside/);
    assert.match(mayReplace(join(root, ".."), ".mark", { within: root }) ?? "", /isn't inside/);
    assert.equal(mayReplace(marked, ".mark", { within: root }), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
