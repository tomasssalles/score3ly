// Makes THIRD_PARTY_NOTICES.md: the code and other material by others that score3ly's builds include (the web app,
// the Worker and the packages they use), each with its license and copyright notices, as their licenses require
// (DESIGN.md §3, "License"). Run `npm run notices` after changing dependencies; a test fails while the file is out of
// date (scripts/notices.test.ts).
//
// Packages: the production dependencies of apps/web, apps/worker and packages/*, and theirs, as installed. Optional
// dependencies are left out (platform-specific binaries, which differ between machines, and Node-only extras the builds
// don't include). apps/eval is a local tool, not distributed. Material that isn't an npm package is listed in OTHER.

import { existsSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const ROOTS = ["apps/web", "apps/worker", "packages/imaging", "packages/notation", "packages/prompts"];
export const NOTICES_FILE = join(ROOT, "THIRD_PARTY_NOTICES.md");

// Material in the builds that isn't an npm package.
const OTHER = [
  {
    name: "Leipzig (metronome glyphs)",
    where: "apps/web/src/metronomeFont.ts, a subset of Verovio's music font, for the PDFs",
    notice: "Leipzig is Verovio's own font (https://github.com/rism-digital/verovio, fonts/Leipzig). All fonts included in Verovio are licensed under the SIL Open Font License.",
    license: "OFL-1.1",
  },
  {
    name: "MEI 5.1 schema (mei-all.rng)",
    where: "packages/notation/schemas, loaded by the web app to check MEI files (Fix MEI)",
    notice: "Generated from the MEI source (https://github.com/music-encoding/music-encoding) by the Music Encoding Initiative, licensed under the Educational Community License version 2.0.",
    license: "ECL-2.0",
  },
];

// `files`: the package's own license and notice files, else the standard text of its license (`ownFiles` false).
type Package = { name: string; version: string; license: string; url: string | null; dir: string; files: { name: string; text: string }[]; ownFiles: boolean };

const LICENSE_FILE = /^(licen[cs]e|copying|notice)([-._].*)?$/i;

function readJson(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(file, "utf8"));
}

// A dependency's folder, found as Node finds it: in node_modules, from the dependent's folder up to the root.
function resolve(name: string, from: string): string | null {
  for (let dir = from; ; dir = dirname(dir)) {
    const candidate = join(dir, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) return realpathSync(candidate);
    if (dir === ROOT || dir === dirname(dir)) return null;
  }
}

function licenseOf(json: Record<string, unknown>): string {
  const l = json.license ?? json.licenses;
  if (typeof l === "string") return l;
  if (Array.isArray(l)) return l.map((x) => (typeof x === "string" ? x : (x as { type?: string }).type)).join(" OR ");
  if (l && typeof l === "object") return String((l as { type?: unknown }).type ?? "unknown");
  return "unknown";
}

// The package's repository (else its home page) as a web address: npm allows "git@github.com:owner/repo",
// "github:owner/repo", plain "owner/repo" and more.
function urlOf(json: Record<string, unknown>): string | null {
  const repo = json.repository;
  const raw = typeof repo === "string" ? repo : repo && typeof repo === "object" ? (repo as { url?: string }).url : undefined;
  let url = raw ?? (typeof json.homepage === "string" ? json.homepage : undefined);
  if (!url) return null;
  url = url
    .replace(/^git\+/, "")
    .replace(/\.git$/, "")
    .replace(/^(ssh:\/\/)?git@github\.com[:/]/, "https://github.com/")
    .replace(/^git:\/\//, "https://")
    .replace(/^github:/, "https://github.com/")
    .replace(/^https:\/\/[^@/]+@/, "https://");
  if (/^[\w.-]+\/[\w.-]+$/.test(url)) url = `https://github.com/${url}`;
  return url;
}

// A license's standard text, for a package that ships none: by its SPDX id, from scripts/licenses. The LGPL is a set
// of permissions added to the GPL, so both go together. MIT's text needs the copyright holder: the package's author.
function standardTexts(p: { name: string; license: string; author: string | null }): { name: string; text: string }[] {
  const read = (id: string) => readFileSync(join(import.meta.dirname, "licenses", `${id}.txt`), "utf8").replace(/\r\n/g, "\n").trimEnd();
  switch (p.license) {
    case "MIT":
      return [{ name: "MIT License (standard text)", text: `Copyright (c) ${p.author ?? `the authors of ${p.name}`}\n\n${read("MIT")}` }];
    case "Apache-2.0":
      return [{ name: "Apache License 2.0 (standard text)", text: read("Apache-2.0") }];
    case "LGPL-3.0-or-later":
    case "LGPL-3.0-only":
      return [
        { name: "GNU Lesser General Public License, version 3", text: read("LGPL-3.0") },
        { name: "GNU General Public License, version 3 (which the LGPL supplements)", text: read("GPL-3.0") },
      ];
    default:
      throw new Error(`${p.name} ships no license file, and scripts/licenses has no standard text for ${p.license}`);
  }
}

function authorOf(json: Record<string, unknown>): string | null {
  const a = json.author;
  if (typeof a === "string") return a;
  if (a && typeof a === "object" && typeof (a as { name?: unknown }).name === "string") return (a as { name: string }).name;
  return null;
}

export function packages(): Package[] {
  const found = new Map<string, Package>();
  const visit = (dir: string, listed: boolean) => {
    const json = readJson(join(dir, "package.json"));
    const key = realpathSync(dir);
    if (listed) {
      // The same version installed in several places is listed once.
      const id = `${json.name}@${json.version}`;
      if (found.has(key) || found.has(id)) return;
      found.set(id, null as unknown as Package);
      const files = readdirSync(dir)
        .filter((f) => LICENSE_FILE.test(f))
        .sort()
        .map((f) => ({ name: f, text: readFileSync(join(dir, f), "utf8").replace(/\r\n/g, "\n").trimEnd() }));
      found.set(key, {
        name: String(json.name),
        version: String(json.version),
        license: licenseOf(json),
        url: urlOf(json),
        dir: key,
        files: files.length > 0 ? files : standardTexts({ name: String(json.name), license: licenseOf(json), author: authorOf(json) }),
        ownFiles: files.length > 0,
      });
    }
    for (const dep of Object.keys((json.dependencies as Record<string, string>) ?? {}).sort()) {
      const at = resolve(dep, dir);
      if (!at) throw new Error(`${dep}, a dependency of ${json.name}, isn't installed: run npm install`);
      // Our own packages are linked into node_modules: they aren't third-party, but what they use is.
      const ours = !relative(ROOT, at).startsWith("node_modules");
      if (ours) {
        if (!found.has(`ours:${at}`)) {
          found.set(`ours:${at}`, null as unknown as Package);
          visit(at, false);
        }
      } else {
        visit(at, true);
      }
    }
  };
  for (const root of ROOTS) visit(join(ROOT, root), false);
  return [...found.values()].filter(Boolean).sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

const fence = (text: string) => {
  const ticks = "`".repeat(Math.max(3, ...[...text.matchAll(/`+/g)].map((m) => m[0].length + 1)));
  return `${ticks}text\n${text}\n${ticks}`;
};

export function buildNotices(): string {
  const list = packages();
  const out: string[] = [
    "# Third-party notices",
    "",
    "score3ly is licensed under the GNU Affero General Public License, version 3 (LICENSE). Its builds include code and other material by others, listed here with their licenses and the notices those licenses require.",
    "",
    "Generated by `npm run notices` (scripts/notices.ts) from the installed packages: don't edit it by hand.",
    "",
    "## Packages",
    "",
    "| Package | Version | License |",
    "|---|---|---|",
    ...list.map((p) => `| ${p.url ? `[${p.name}](${p.url})` : p.name} | ${p.version} | ${p.license} |`),
    "",
    "**Verovio** is licensed under the GNU Lesser General Public License, version 3 or later. Its source code is at https://github.com/rism-digital/verovio. The web app loads it as a separate WebAssembly module, which can be replaced by another build of Verovio.",
    "",
    "## Other material",
    "",
    ...OTHER.flatMap((o) => [`### ${o.name}`, "", `In ${o.where}. ${o.notice} License: ${o.license}, below.`, ""]),
    "## Notices and license texts",
    "",
  ];
  // Packages with the same texts (e.g. the AWS SDK's, each with Apache 2.0) share one section.
  const groups = new Map<string, Package[]>();
  for (const p of list) {
    const key = JSON.stringify([p.ownFiles, p.files]);
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  for (const group of groups.values()) {
    out.push(`### ${group.map((p) => `${p.name} ${p.version}`).join(", ")}`, "");
    if (!group[0].ownFiles) out.push(`No license file in the package${group.length > 1 ? "s" : ""}: the standard text of ${group[0].license}.`, "");
    for (const f of group[0].files) out.push(`${f.name}:`, "", fence(f.text), "");
  }
  for (const id of [...new Set(OTHER.map((o) => o.license))]) {
    out.push(`### ${id} (${OTHER.filter((o) => o.license === id).map((o) => o.name).join(", ")})`, "");
    out.push(fence(readFileSync(join(import.meta.dirname, "licenses", `${id}.txt`), "utf8").replace(/\r\n/g, "\n").trimEnd()), "");
  }
  return `${out.join("\n").trimEnd()}\n`;
}

if (process.argv[1] === import.meta.filename) {
  writeFileSync(NOTICES_FILE, buildNotices());
  console.log(`${relative(ROOT, NOTICES_FILE)}: ${packages().length} packages`);
}
