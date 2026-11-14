// The replay model (docs/overview.md §12, "Replay tests"): a model of the fake provider, `fake-replay`, whose answers are
// the ones recorded in the project, found by their place, not by the request, which changes with the prompts. A stage
// that runs with it is answered, for each of its calls, with the latest usable answer that the same place got in the
// project before: the same step at the same turn among the stages of that step (the second `apply_review` from the
// second), the same item and the same round. A place with no recording fails the call, saying which.
//
// It needs the database and the call's place, which a provider's adapter doesn't have, so the route makes one per call.

import { LlmError, type LlmProvider, type LlmRequest, type LlmResponse, withJson } from "./types.ts";

export const REPLAY_MODEL = "fake-replay";

export function isReplay(config: { provider: string; model: string }): boolean {
  return config.provider === "fake" && config.model === REPLAY_MODEL;
}

type Place = { item: string; round: number };

export function replayProvider(db: D1Database, bucket: R2Bucket, stageId: string | null, place: Place, configId: string): LlmProvider {
  return {
    id: "fake",
    async send(request: LlmRequest): Promise<LlmResponse> {
      if (stageId === null) throw new LlmError("bad_request", "The replay model answers only a stage's calls.");
      const recorded = await recordedCall(db, stageId, place, configId);
      // As an HTTP refusal (400): nothing was paid for.
      if ("missing" in recorded) throw new LlmError("bad_request", `Replay: no recorded answer for ${recorded.missing}.`, 400);
      const object = await bucket.get(`content/${recorded.responseSha256}`);
      if (!object) throw new LlmError("bad_request", `Replay: the recorded answer of call ${recorded.id} isn't stored.`, 400);
      const stored = (await object.json()) as { text: string };
      const response: LlmResponse = {
        provider: "fake",
        model: request.model,
        text: stored.text,
        stop: "end",
        usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
        raw: { replayedFrom: recorded.id },
      };
      return request.jsonSchema ? withJson(response) : response;
    },
  };
}

// The recorded call for a stage's call at this place: among the project's stages of the same step that have calls of
// another model config than the replay's (the recorded ones, in the order they ran), the one at the stage's turn among
// the pipeline's stages of that step; and in it, the latest usable call at the same item and round.
async function recordedCall(db: D1Database, stageId: string, place: Place, configId: string): Promise<{ id: string; responseSha256: string } | { missing: string }> {
  const stage = await db.prepare("SELECT step, created_in FROM stages WHERE id = ?").bind(stageId).first<{ step: string; created_in: string }>();
  if (!stage) return { missing: `stage ${stageId}` };
  const { results: turns } = await db
    .prepare("SELECT s.id FROM pipeline_entries e JOIN stages s ON s.id = e.stage_id WHERE e.project_id = ? AND s.step = ? ORDER BY e.position")
    .bind(stage.created_in, stage.step)
    .all<{ id: string }>();
  const turn = turns.findIndex((t) => t.id === stageId);
  const { results: recordedStages } = await db
    .prepare(
      "SELECT s.id FROM stages s WHERE s.created_in = ? AND s.step = ? AND s.started_at IS NOT NULL AND EXISTS (SELECT 1 FROM llm_calls c WHERE c.stage_id = s.id AND c.model_config_id != ?) ORDER BY s.started_at, s.id",
    )
    .bind(stage.created_in, stage.step, configId)
    .all<{ id: string }>();
  const where = `${stage.step} (stage ${turn + 1} of its step), item "${place.item}", round ${place.round}`;
  const recordedStage = turn >= 0 ? recordedStages[turn] : undefined;
  if (!recordedStage) return { missing: where };
  const call = await db
    .prepare(
      "SELECT id, response_sha256 FROM llm_calls WHERE stage_id = ? AND item = ? AND round = ? AND status = 'ok' AND response_sha256 IS NOT NULL ORDER BY started_at DESC LIMIT 1",
    )
    .bind(recordedStage.id, place.item, place.round)
    .first<{ id: string; response_sha256: string }>();
  return call ? { id: call.id, responseSha256: call.response_sha256 } : { missing: where };
}
