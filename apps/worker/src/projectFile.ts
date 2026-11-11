// Exporting and importing a project (docs/database.md, "Exporting and importing a project"). The Worker hands out the
// rows of a project's current pipeline and takes them back in; the browser makes and reads the file (a zip with these
// rows, the PDF and the content in R2), since a zip is too much work for a Worker's CPU limit.
//
// An import is looked up like a run: a done stage whose key a live stage here has is that stage (nothing copied);
// any other stage is copied with a new id, and each of its calls is looked up: a live call with the same request key
// is used (no row), a deleted one is brought back to life (its cost stays where it was paid), and only a call found
// nowhere becomes a new row, which counts like any call. Original times are kept.

import type { Hono } from "hono";
import { firstFreeName, MAX_NAME_LENGTH } from "./names.ts";
import { anyRunning } from "./pipeline.ts";

// The export format's own version (`format` in the file), apart from the app's: raised when an export can't be read
// the same way any more. Imports read only the formats listed here.
export const EXPORT_FORMAT = 1;

type Row = Record<string, unknown>;

// What an export holds, besides the PDF and the content, which the browser fetches.
export type ProjectExport = {
  format: number;
  project: Row; // name, pdf_sha256, pdf_filename, run_mode, next_issue_number and the times
  pipeline: Row[]; // position, stage_id, carried
  stages: Row[];
  outputs: Row[];
  output_inputs: Row[];
  stage_inputs: Row[];
  llm_calls: Row[];
  model_configs: Row[];
  manual_saves: Row[];
  image_fingerprints: Row[];
  content: string[]; // every content object the rows refer to, by SHA-256 (outputs, calls' requests and responses)
};

const STAGE_COLUMNS = [
  "id",
  "step",
  "step_version",
  "status",
  "config_json",
  "model_config_id",
  "stage_key",
  "page_count",
  "in_recipe",
  "error",
  "note",
  "replaces_stage_id",
  "created_at",
  "started_at",
  "heartbeat_at",
  "finished_at",
] as const;
const OUTPUT_COLUMNS = [
  "id",
  "stage_id",
  "item",
  "type",
  "content_sha256",
  "recipe_key",
  "recipe_json",
  "parent_output_id",
  "call_id",
  "created_at",
  "duration_ms",
  "calls",
  "calls_cached",
  "images",
  "images_cached",
] as const;
const CALL_COLUMNS = [
  "id",
  "stage_id",
  "model_config_id",
  "request_key",
  "response_model",
  "request_sha256",
  "response_sha256",
  "status",
  "error",
  "error_kind",
  "http_status",
  "input_tokens",
  "output_tokens",
  "cached_tokens",
  "cache_write_tokens",
  "cost_usd",
  "price_json",
  "started_at",
  "finished_at",
] as const;
// What makes two model configs the same (all but the id, the name and the dates).
const CONFIG_VALUES = [
  "provider",
  "model_id",
  "model_string",
  "family",
  "effort",
  "region",
  "routing",
  "project",
  "account",
  "secrets_json",
  "pricing_kind",
  "pricing_reference",
] as const;
const CONFIG_COLUMNS = ["id", "name", ...CONFIG_VALUES, "created_at", "deleted_at"] as const;
const FINGERPRINT_COLUMNS = [
  "recipe_key",
  "pdf_sha256",
  "version",
  "width",
  "height",
  "pixels_sha256",
  "thumbnail",
  "thumbnail_width",
  "thumbnail_height",
  "created_at",
] as const;

const list = (columns: readonly string[], alias: string) => columns.map((c) => `${alias}.${c}`).join(", ");

// The current pipeline's stages, as a subquery (one parameter: the project's id).
const PIPELINE_STAGES = "SELECT stage_id FROM pipeline_entries WHERE project_id = ?";

// The rows of a project's current pipeline (docs/database.md, "Exporting and importing a project"): its stages, whatever
// their state, with their outputs, inputs, calls, the calls their outputs were served from, their manual saves, the
// model configs of those stages and calls, and the PDF's fingerprints. Links to anything outside are cut. Null when no
// such project; "running" while a stage of it runs.
export async function exportProject(db: D1Database, projectId: string, now = Date.now()): Promise<ProjectExport | null | "running"> {
  const project = await db
    .prepare("SELECT name, pdf_sha256, pdf_filename, run_mode, next_issue_number, created_at, last_modified_at, last_opened_at FROM projects WHERE id = ? AND deleted_at IS NULL")
    .bind(projectId)
    .first<Row>();
  if (!project) return null;
  if (await anyRunning(db, projectId, now)) return "running";
  const [pipeline, stages, outputs, outputInputs, stageInputs, calls, saves, fingerprints] = await db.batch<Row>([
    db.prepare("SELECT position, stage_id, carried FROM pipeline_entries WHERE project_id = ? ORDER BY position").bind(projectId),
    db.prepare(`SELECT ${list(STAGE_COLUMNS, "s")} FROM stages s WHERE s.id IN (${PIPELINE_STAGES})`).bind(projectId),
    db.prepare(`SELECT ${list(OUTPUT_COLUMNS, "o")} FROM outputs o WHERE o.stage_id IN (${PIPELINE_STAGES})`).bind(projectId),
    db
      .prepare(
        `SELECT oi.output_id, oi.input_id FROM output_inputs oi JOIN outputs a ON a.id = oi.output_id JOIN outputs b ON b.id = oi.input_id WHERE a.stage_id IN (${PIPELINE_STAGES}) AND b.stage_id IN (${PIPELINE_STAGES})`,
      )
      .bind(projectId, projectId),
    db
      .prepare(`SELECT si.stage_id, si.output_id FROM stage_inputs si JOIN outputs o ON o.id = si.output_id WHERE si.stage_id IN (${PIPELINE_STAGES}) AND o.stage_id IN (${PIPELINE_STAGES})`)
      .bind(projectId, projectId),
    // The stages' own calls, and those their outputs were served from (another stage's, maybe another project's).
    db
      .prepare(
        `SELECT ${list(CALL_COLUMNS, "c")} FROM llm_calls c WHERE c.stage_id IN (${PIPELINE_STAGES}) OR c.id IN (SELECT call_id FROM outputs WHERE call_id IS NOT NULL AND stage_id IN (${PIPELINE_STAGES}))`,
      )
      .bind(projectId, projectId),
    db.prepare(`SELECT stage_id, quarter, saves FROM manual_saves WHERE stage_id IN (${PIPELINE_STAGES})`).bind(projectId),
    db.prepare(`SELECT ${list(FINGERPRINT_COLUMNS, "f")} FROM image_fingerprints f WHERE f.pdf_sha256 = ?`).bind(project.pdf_sha256),
  ]);
  const stageIds = new Set(stages.results.map((s) => s.id as string));
  const outputIds = new Set(outputs.results.map((o) => o.id as string));
  // A call served to an output from another stage belongs, in the export, to the stage of the first output naming it:
  // imported where nothing matches it, it is that stage's call, as a run here would have made it.
  const servedTo = new Map<string, string>();
  for (const o of outputs.results) if (o.call_id && !servedTo.has(o.call_id as string)) servedTo.set(o.call_id as string, o.stage_id as string);
  const exportedCalls = calls.results.map((c) => (stageIds.has(c.stage_id as string) ? c : { ...c, stage_id: servedTo.get(c.id as string) ?? null }));
  const configIds = new Set<string>();
  for (const s of stages.results) if (s.model_config_id) configIds.add(s.model_config_id as string);
  for (const c of exportedCalls) configIds.add(c.model_config_id as string);
  const configs = configIds.size === 0 ? [] : await rowsByIds(db, `SELECT ${list(CONFIG_COLUMNS, "m")} FROM model_configs m WHERE m.id IN`, [...configIds]);
  const content = new Set<string>();
  // (Ingest's output is the PDF, stored under pdfs/, not content/: the file holds it apart.)
  for (const o of outputs.results) if (o.content_sha256 && o.content_sha256 !== project.pdf_sha256) content.add(o.content_sha256 as string);
  for (const c of exportedCalls) {
    if (c.request_sha256) content.add(c.request_sha256 as string);
    if (c.response_sha256) content.add(c.response_sha256 as string);
  }
  return {
    format: EXPORT_FORMAT,
    project,
    pipeline: pipeline.results,
    // Links to stages outside the pipeline are cut: an edited manual stage's link to the stage it replaced.
    stages: stages.results.map((s) => (s.replaces_stage_id && !stageIds.has(s.replaces_stage_id as string) ? { ...s, replaces_stage_id: null } : s)),
    outputs: outputs.results.map((o) => (o.parent_output_id && !outputIds.has(o.parent_output_id as string) ? { ...o, parent_output_id: null } : o)),
    output_inputs: outputInputs.results,
    stage_inputs: stageInputs.results,
    llm_calls: exportedCalls,
    model_configs: configs,
    manual_saves: saves.results,
    image_fingerprints: fingerprints.results,
    content: [...content].sort(),
  };
}

// Rows whose id is among `ids`, in chunks (D1 takes at most 100 parameters per statement).
async function rowsByIds(db: D1Database, sqlBeforeList: string, ids: string[]): Promise<Row[]> {
  const rows: Row[] = [];
  for (let i = 0; i < ids.length; i += 90) {
    const chunk = ids.slice(i, i + 90);
    const { results } = await db.prepare(`${sqlBeforeList} (${chunk.map(() => "?").join(", ")})`).bind(...chunk).all<Row>();
    rows.push(...results);
  }
  return rows;
}

// Why an export can't be imported, or null. Checks the shape the import relies on, not every value: the database's
// own constraints check the rest, and refuse the whole import.
export function exportProblem(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return "The file holds no project.";
  const d = data as Partial<ProjectExport>;
  if (d.format !== EXPORT_FORMAT) {
    return typeof d.format === "number" && d.format > EXPORT_FORMAT
      ? `The file was exported by a newer version of score3ly (export format ${d.format}); update the app to import it.`
      : `The file's export format (${String(d.format)}) isn't one this version of score3ly reads.`;
  }
  const arrays = ["pipeline", "stages", "outputs", "output_inputs", "stage_inputs", "llm_calls", "model_configs", "manual_saves", "image_fingerprints", "content"] as const;
  for (const key of arrays) if (!Array.isArray(d[key])) return `The file is incomplete: no ${key}.`;
  const p = d.project as Row | undefined;
  if (!p || typeof p.name !== "string" || !isSha256(p.pdf_sha256) || typeof p.pdf_filename !== "string") return "The file is incomplete: no project.";
  if (!(d.content as unknown[]).every(isSha256)) return "The file's content list is damaged.";
  const stageIds = new Set((d.stages as Row[]).map((s) => s.id));
  if (!(d.pipeline as Row[]).every((e) => stageIds.has(e.stage_id) && Number.isInteger(e.position))) return "The file's pipeline names stages it doesn't hold.";
  return null;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

// The same JSON with its keys sorted, so that two configs' secrets compare by content.
function canonicalJson(text: unknown): string {
  try {
    const value = JSON.parse(String(text ?? "{}")) as Record<string, unknown>;
    return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
  } catch {
    return String(text);
  }
}

const sameConfig = (a: Row, b: Row) =>
  CONFIG_VALUES.every((k) => (k === "secrets_json" ? canonicalJson(a[k]) === canonicalJson(b[k]) : (a[k] ?? null) === (b[k] ?? null)));

export type Imported = { id: string; name: string };

// Imports an export (already checked with `exportProblem`; the PDF and the content already in R2). Returns the new
// project's id and name, or what is missing.
export async function importProject(db: D1Database, bucket: R2Bucket, data: ProjectExport, now = new Date()): Promise<Imported | { missing: string }> {
  const iso = now.toISOString();
  const pdfSha = data.project.pdf_sha256 as string;
  // The content isn't checked object by object here (a request may only make so many calls to R2): the browser
  // uploads what `POST /api/content/missing` names, just before.
  if (!(await bucket.head(`pdfs/${pdfSha}.pdf`))) return { missing: "the PDF" };

  // Model configs: one with the same values among those not deleted is used; else one is created (deleted if it was
  // deleted where it came from), numbered if its name is taken.
  const configMap = new Map<string, string>();
  const { results: liveConfigs } = await db.prepare(`SELECT ${CONFIG_COLUMNS.join(", ")} FROM model_configs WHERE deleted_at IS NULL`).all<Row>();
  const takenConfigNames = liveConfigs.map((c) => c.name as string);
  const statements: D1PreparedStatement[] = [];
  for (const config of data.model_configs) {
    const match = liveConfigs.find((c) => sameConfig(c, config));
    if (match) {
      configMap.set(config.id as string, match.id as string);
      continue;
    }
    const id = crypto.randomUUID();
    const deleted = config.deleted_at ?? null;
    const name = deleted ? String(config.name) : firstFreeName(String(config.name).slice(0, MAX_NAME_LENGTH).trim(), takenConfigNames);
    if (!deleted) takenConfigNames.push(name);
    configMap.set(config.id as string, id);
    statements.push(insert(db, "model_configs", { ...pick(config, CONFIG_COLUMNS), id, name, deleted_at: deleted }));
  }

  // Stages: a done stage with the key of a live done stage here is that stage; the others are copied.
  const projectId = crypto.randomUUID();
  const stageMap = new Map<string, string>();
  const reused = new Set<string>(); // exported stage ids served by a stage here
  const outputMap = new Map<string, string>();
  const keyed = data.stages.filter((s) => s.status === "done" && typeof s.stage_key === "string");
  const matches = keyed.length === 0 ? [] : await db.batch<{ id: string }>(keyed.map((s) => db.prepare("SELECT id FROM stages WHERE stage_key = ? AND status = 'done' AND deleted_at IS NULL LIMIT 1").bind(s.stage_key)));
  keyed.forEach((s, i) => {
    const here = matches[i].results[0]?.id;
    if (here) {
      stageMap.set(s.id as string, here);
      reused.add(s.id as string);
    }
  });
  if (reused.size > 0) {
    // Their outputs, by what they are about, stand for the exported ones (the same key: the same outputs).
    const here = await rowsByIds(db, "SELECT id, stage_id, item, type FROM outputs WHERE stage_id IN", [...new Set([...reused].map((id) => stageMap.get(id)!))]);
    for (const o of data.outputs) {
      if (!reused.has(o.stage_id as string)) continue;
      const same = here.find((h) => h.stage_id === stageMap.get(o.stage_id as string) && h.item === o.item && h.type === o.type);
      if (same) outputMap.set(o.id as string, same.id as string);
    }
  }
  for (const s of data.stages) if (!stageMap.has(s.id as string)) stageMap.set(s.id as string, crypto.randomUUID());
  for (const o of data.outputs) if (!reused.has(o.stage_id as string)) outputMap.set(o.id as string, crypto.randomUUID());

  // Calls of the copied stages: a live call with the same request key is used; else a deleted one is brought back to
  // life; else a new row. Calls that didn't succeed are never served from the cache: always new rows, as in a run.
  // (A reused stage's calls are only looked up, for the copied outputs that may name them; they are never copied.)
  const callMap = new Map<string, string>();
  const callStatements: D1PreparedStatement[] = []; // after the stages they belong to (a foreign key)
  const calls = data.llm_calls.filter((c) => !reused.has(c.stage_id as string) && c.stage_id !== null);
  const okCalls = data.llm_calls.filter((c) => c.status === "ok" && c.response_sha256);
  const found =
    okCalls.length === 0
      ? []
      : await db.batch<{ id: string; deleted_at: string | null }>(
          okCalls.map((c) =>
            db
              .prepare("SELECT id, deleted_at FROM llm_calls WHERE request_key = ? AND status = 'ok' ORDER BY deleted_at IS NOT NULL, started_at LIMIT 1")
              .bind(c.request_key),
          ),
        );
  okCalls.forEach((c, i) => {
    const here = found[i].results[0];
    if (!here) return;
    if (here.deleted_at && reused.has(c.stage_id as string)) return;
    callMap.set(c.id as string, here.id);
    // A deleted call comes back to life: its request and response stored again, its cost where it was paid.
    if (here.deleted_at) {
      callStatements.push(
        db.prepare("UPDATE llm_calls SET deleted_at = NULL, imported_at = ?, request_sha256 = ?, response_sha256 = ? WHERE id = ?").bind(iso, c.request_sha256 ?? null, c.response_sha256, here.id),
      );
    }
  });
  for (const c of calls) {
    if (callMap.has(c.id as string)) continue;
    const id = crypto.randomUUID();
    callMap.set(c.id as string, id);
    callStatements.push(
      insert(db, "llm_calls", {
        ...pick(c, CALL_COLUMNS),
        id,
        stage_id: stageMap.get(c.stage_id as string)!,
        model_config_id: configMap.get(c.model_config_id as string) ?? c.model_config_id,
        imported_at: iso,
      }),
    );
  }

  // The copied stages, their outputs, inputs and saves.
  for (const s of data.stages) {
    if (reused.has(s.id as string)) continue;
    statements.push(
      insert(db, "stages", {
        ...pick(s, STAGE_COLUMNS),
        id: stageMap.get(s.id as string)!,
        created_in: projectId,
        model_config_id: s.model_config_id ? (configMap.get(s.model_config_id as string) ?? null) : null,
        replaces_stage_id: s.replaces_stage_id ? (stageMap.get(s.replaces_stage_id as string) ?? null) : null,
        imported_at: iso,
      }),
    );
  }
  statements.push(...callStatements);
  // Parents before the outputs that correct them (a foreign key).
  const copied = data.outputs.filter((o) => !reused.has(o.stage_id as string));
  const ordered = [...copied.filter((o) => !o.parent_output_id), ...copied.filter((o) => o.parent_output_id)];
  for (const o of ordered) {
    statements.push(
      insert(db, "outputs", {
        ...pick(o, OUTPUT_COLUMNS),
        id: outputMap.get(o.id as string)!,
        stage_id: stageMap.get(o.stage_id as string)!,
        call_id: o.call_id ? (callMap.get(o.call_id as string) ?? null) : null,
        parent_output_id: o.parent_output_id ? (outputMap.get(o.parent_output_id as string) ?? null) : null,
      }),
    );
  }
  const outputStage = new Map(data.outputs.map((o) => [o.id, o.stage_id as string]));
  for (const oi of data.output_inputs) {
    if (reused.has(outputStage.get(oi.output_id) ?? "")) continue;
    const output = outputMap.get(oi.output_id as string);
    const input = outputMap.get(oi.input_id as string);
    if (output && input) statements.push(db.prepare("INSERT OR IGNORE INTO output_inputs (output_id, input_id) VALUES (?, ?)").bind(output, input));
  }
  for (const si of data.stage_inputs) {
    if (reused.has(si.stage_id as string)) continue;
    const output = outputMap.get(si.output_id as string);
    if (output) statements.push(db.prepare("INSERT OR IGNORE INTO stage_inputs (stage_id, output_id) VALUES (?, ?)").bind(stageMap.get(si.stage_id as string)!, output));
  }
  for (const save of data.manual_saves) {
    if (reused.has(save.stage_id as string)) continue;
    statements.push(db.prepare("INSERT INTO manual_saves (stage_id, quarter, saves) VALUES (?, ?, ?)").bind(stageMap.get(save.stage_id as string)!, save.quarter, save.saves));
  }
  for (const f of data.image_fingerprints) statements.push(insert(db, "image_fingerprints", pick(f, FINGERPRINT_COLUMNS), "INSERT OR IGNORE"));

  // The project, under its exported name (numbered if taken), and its pipeline. One transaction; another project may
  // take the name meanwhile: then look again.
  const base = String(data.project.name).slice(0, MAX_NAME_LENGTH).trim() || "Untitled";
  for (let attempt = 0; ; attempt++) {
    const { results } = await db.prepare("SELECT name FROM projects WHERE deleted_at IS NULL").all<{ name: string }>();
    const name = firstFreeName(base, results.map((r) => r.name));
    const p = data.project;
    try {
      await db.batch([
        db
          .prepare(
            "INSERT INTO projects (id, name, pdf_sha256, pdf_filename, run_mode, next_issue_number, created_at, last_modified_at, last_opened_at, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .bind(projectId, name, pdfSha, p.pdf_filename, p.run_mode === "manual" ? "manual" : "auto", Number(p.next_issue_number) || 1, p.created_at ?? iso, p.last_modified_at ?? iso, iso, iso),
        ...statements,
        ...data.pipeline.map((e) =>
          db.prepare("INSERT INTO pipeline_entries (project_id, position, stage_id, carried) VALUES (?, ?, ?, ?)").bind(projectId, e.position, stageMap.get(e.stage_id as string)!, e.carried ? 1 : 0),
        ),
      ]);
      return { id: projectId, name };
    } catch (err) {
      if (!String(err).includes("UNIQUE constraint failed: projects.name") || attempt >= 4) throw err;
    }
  }
}

function pick(row: Row, columns: readonly string[]): Row {
  return Object.fromEntries(columns.map((c) => [c, row[c] ?? null]));
}

function insert(db: D1Database, table: string, row: Row, verb = "INSERT"): D1PreparedStatement {
  const columns = Object.keys(row);
  return db.prepare(`${verb} INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`).bind(...columns.map((c) => row[c] ?? null));
}

export function projectFileRoutes(app: Hono<{ Bindings: Env }>) {
  // The rows of the project's current pipeline, for the browser to make the file with.
  app.get("/api/projects/:id/export", async (c) => {
    const data = await exportProject(c.env.DB, c.req.param("id"));
    if (data === null) return c.json({ error: "no such project" }, 404);
    if (data === "running") return c.json({ error: "a stage of this project is running", code: "running" }, 409);
    return c.json(data);
  });

  // Which of these content objects aren't stored yet, so that an import uploads only those. Each is one call to R2, of which a
  // request may make only so many: the browser asks for at most 200 at a time.
  app.post("/api/content/missing", async (c) => {
    const body = (await c.req.json().catch(() => null)) as { sha256s?: unknown } | null;
    if (!Array.isArray(body?.sha256s) || !body.sha256s.every(isSha256) || body.sha256s.length > 200) {
      return c.json({ error: "expected 'sha256s', at most 200 SHA-256s in lowercase hex" }, 400);
    }
    const missing: string[] = [];
    for (const sha of body.sha256s as string[]) if (!(await c.env.PDFS.head(`content/${sha}`))) missing.push(sha);
    return c.json({ missing });
  });

  // Stores a PDF under its hash (R2 checks the bytes), for an import.
  app.put("/api/pdfs/:sha256", async (c) => {
    const sha256 = c.req.param("sha256");
    if (!isSha256(sha256)) return c.json({ error: "expected a SHA-256 in lowercase hex" }, 400);
    try {
      await c.env.PDFS.put(`pdfs/${sha256}.pdf`, await c.req.arrayBuffer(), { sha256 });
    } catch {
      return c.json({ error: "the PDF doesn't match its SHA-256" }, 400);
    }
    return c.body(null, 204);
  });

  // Imports a project from its export's rows (the PDF and the content uploaded first).
  app.post("/api/projects/import", async (c) => {
    const data = await c.req.json().catch(() => null);
    const problem = exportProblem(data);
    if (problem) return c.json({ error: problem }, 400);
    const result = await importProject(c.env.DB, c.env.PDFS, data as ProjectExport);
    if ("missing" in result) return c.json({ error: `upload ${result.missing} first`, code: "missing" }, 409);
    return c.json(result, 201);
  });
}
