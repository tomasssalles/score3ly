// What the apps share (docs/overview.md §3): code and types needed by more than one of the web app, the Worker, the desktop
// app and the evaluation tools. Runs in browsers, Workers and Node alike; the parts that don't are separate entry
// points: `@score3ly/core/pdf` (browsers) and `@score3ly/core/pdfjs-assets` (Vite, in Node).

export { canonicalJson, isSha256Hex, keyOf, modelKeyOf, normalized, sha256Hex } from "./keys.ts";
export type { Deleted, ListedProject, PdfLookup, PipelinePosition, Project, RunMode } from "./api/project.ts";
export type { AddedStage, Dropped, Output, OutputsAnswer, Pipeline, Resolved, Stage, StageModelConfig, StageStatus, StartAnswer } from "./api/pipeline.ts";
export { RECIPE, STEP_KINDS, stepsOfKind, type StageKind, type StepId } from "./steps.ts";
export { formatPages, parsePages, selectPages } from "./pageSelection.ts";
export { readSse } from "./sse.ts";
export { IMAGE_MEDIA_TYPES, MAX_CACHE_MARKS } from "./api/llmCall.ts";
export type { CallAnswer, CallBody, CallContent, CallEvent, CallPlace, CallRequest, CallStatus, CallUsage, ImageMediaType, ImagesNeeded, StreamEvent } from "./api/llmCall.ts";
export { CONFIG_VALUES, PROVIDER_NAMES, PROVIDERS, SECRET_LABELS, sameConfigValues, sameValuesMessage, valuesOf, valuesOfNew } from "./api/modelConfigs.ts";
export type { Account, ConfigValues, Effort, Family, ModelConfig, ModelOptions, NewModelConfig, Place, Price, PriceRange, Prices, Pricing, Provider, Routing, SecretNames, TestResult } from "./api/modelConfigs.ts";
export type { Settings } from "./api/settings.ts";
export { fromBase64, toBase64, toBase64Url } from "./base64.ts";
export { firstFreeName, MAX_NAME_LENGTH, nameTooLong } from "./names.ts";
export { itemKind, pageItem, pageOfItem, systemItem, systemOfItem, type ItemKind } from "./items.ts";
export { QUARTER_MS, quarterOf } from "./time.ts";
export { LEAVING_A_RUN } from "./texts.ts";
export { amount, roundUsd } from "./money.ts";
export type { ApiErrorBody, ErrorCode } from "./api/errors.ts";
export type { CallErrorKind, CostOutcome, Outcome } from "./api/outcomes.ts";
export type { ActivityData, CostData, FailureData, ProjectStats, RunTimeData } from "./api/stats.ts";
