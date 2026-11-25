import { Hono } from "hono";
import { activityRoutes } from "./activity.ts";
import { costRoutes } from "./costs.ts";
import { projectStatsRoutes } from "./projectStats.ts";
import { failureRoutes } from "./failures.ts";
import { runTimeRoutes } from "./runTimes.ts";
import { fingerprintRoutes } from "./fingerprints.ts";
import { convertAddedConfigs, modelConfigRoutes } from "./modelConfigs.ts";
import { settingsRoutes } from "./settings.ts";
import { llmCallRoutes } from "./llmCalls.ts";
import { pipelineRoutes } from "./pipeline.ts";
import { stageEntries } from "./pipelineRules.ts";
import { versionRoutes } from "./versions.ts";
import { projectFileRoutes } from "./projectFile.ts";
import { requestLog } from "./requestLog.ts";
import { failed } from "./refusals.ts";
import { storageRoutes } from "./storage.ts";
import { projectRoutes } from "./projects.ts";

export type { ListedProject, Project, RunMode } from "@score3ly/core";
import type { Info } from "@score3ly/core";

const app = new Hono<{ Bindings: Env }>();

// Anything a route throws is answered as JSON like a refusal, with the code "internal" (docs/style.md, "Error texts").
app.onError(failed);

// A log line of our own per API request, for Workers Logs (requestLog.ts).
app.use("/api/*", requestLog);

app.get("/api/health", (c) => c.json({ status: "ok" }));

// Optimistic locking: before the project's routes, so that a stale change is refused before anything happens.
versionRoutes(app);

// Before anything reads model configs: those added by hand whose string a new list of models has become listed ones
// (docs/llm.md, "Configs"); once per list, then nothing.
app.use("/api/*", async (c, next) => {
  await convertAddedConfigs(c.env.DB);
  await next();
});

// Which host serves the app (docs/desktop.md, "What differs in the app"): here Cloudflare. The desktop version's server
// answers this itself ("desktop" in Electron, "local" as a plain local server), so the web bundle stays the same and
// the app asks rather than guessing.
app.get("/api/info", (c) => c.json<Info>({ host: "cloudflare" }));

projectRoutes(app);
storageRoutes(app);

// Every route about a stage reads its entry first (pipelineRules.ts).
stageEntries(app);
pipelineRoutes(app);
modelConfigRoutes(app);
settingsRoutes(app);
llmCallRoutes(app);
projectFileRoutes(app);
fingerprintRoutes(app);
costRoutes(app);
activityRoutes(app);
projectStatsRoutes(app);
failureRoutes(app);
runTimeRoutes(app);

export default app;
