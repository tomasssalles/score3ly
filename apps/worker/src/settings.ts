// The user's settings the Worker keeps (docs/database.md, "Two kinds of settings"; docs/llm.md): read with their
// defaults, checked, and the routes that read and change them.

import type { Hono } from "hono";
import type { Settings } from "@score3ly/core";
import { problemText, NO_MODEL_CONFIG, refuse } from "./refusals.ts";
import { isVatPercent } from "./spending.ts";
import { devProviders, type ModelConfigRow, unsupportedOf } from "./modelConfigs.ts";

// The settings the Worker knows (`Settings`, core), with their defaults. Settings that depend on the device stay in the
// browser (§5.8).
const DEFAULT_SETTINGS: Settings = { defaultModelConfigId: null, spendingCapUsd: 1, newProjectRunMode: "auto", vatPercent: 0 };

export async function readSettings(db: D1Database): Promise<Settings> {
  const { results } = await db.prepare("SELECT key, value_json FROM settings").all<{ key: string; value_json: string }>();
  const stored = Object.fromEntries(results.map((r) => [r.key, JSON.parse(r.value_json)]));
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries(Object.keys(DEFAULT_SETTINGS).filter((k) => k in stored).map((k) => [k, stored[k]])) };
}

function settingProblem(key: string, value: unknown): string | null {
  // There is always a default (docs/llm.md, "Which config a stage uses"): it can be changed, never removed.
  if (key === "defaultModelConfigId") return typeof value === "string" ? null : "expected a model config id";
  if (key === "spendingCapUsd") {
    // There is always a cap: it can be changed, never removed.
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? null : "expected an amount in US dollars above 0";
  }
  if (key === "newProjectRunMode") return value === "auto" || value === "manual" ? null : "expected 'auto' or 'manual'";
  if (key === "vatPercent") return isVatPercent(value) ? null : "expected a percentage from 0 to 100, with at most two decimals";
  return "no such setting";
}

export function settingsRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/api/settings", async (c) => c.json<Settings>(await readSettings(c.env.DB)));

  app.put("/api/settings/:key", async (c) => {
    const key = c.req.param("key");
    const body = await c.req.json().catch(() => null);
    const problem = body && "value" in body ? settingProblem(key, body.value) : "expected a 'value'";
    if (problem) return refuse(c, 400, problemText(problem));
    if (key === "defaultModelConfigId") {
      const exists = await c.env.DB.prepare("SELECT * FROM model_configs WHERE id = ? AND deleted_at IS NULL").bind(body.value).first<ModelConfigRow>();
      if (!exists) return refuse(c, 404, NO_MODEL_CONFIG);
      const unsupported = unsupportedOf(exists, devProviders(c.env));
      if (unsupported) return refuse(c, 400, `The model config "${exists.name}" ${unsupported}, so it can't be the default.`);
    }
    await c.env.DB.prepare("INSERT OR REPLACE INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)")
      .bind(key, JSON.stringify(body.value), new Date().toISOString())
      .run();
    return c.json<Settings>(await readSettings(c.env.DB));
  });
}
