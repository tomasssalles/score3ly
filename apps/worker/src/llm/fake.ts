// A provider that answers without any network, for tests and for trying the pipeline without paying (
// docs/llm.md). Its answer follows the request's JSON schema with the simplest values (empty arrays, zeros, the first
// option), and its "tokens" are estimated from the request's text and images. Some model names make it fail on purpose:
// "fake-error" (a server error), "fake-refusal", "fake-cut-off", "fake-unparseable", "fake-other-model" (another model
// answers).
// Three steps get more than that, so the pipeline runs end to end: `layout` (two systems on every page, each with three
// bar lines, so that the later stages have systems to work on), `extract`, whose answer must cover exactly the
// stretches asked for, with a voice on every staff (the fake reads the request's JSON and answers with whole-measure
// rests in 4/4, a made-up doubt on every system and a format issue on the first, so their views can be seen), and
// `review` (a made-up correction on the first system, another answer chosen for the first issue of the second), and
// `apply_review` (on a window that starts on an odd system, each issue applied by writing a C in the first voice of the
// first stretch under it; on an even one, each reverted, with a made-up reason, by a made-up new answer where none is
// applied; a person's answers, resolved, are applied on either).

import { LlmError, type LlmProvider, type LlmRequest, type LlmResponse } from "./types.ts";

// Long, with JSON and an unbroken word, as providers' errors are, so the screenshots show how the app wraps them.
const FAKE_ERROR =
  'The fake provider failed, as asked: {"type":"error","error":{"type":"invalid_request_error","message":"output_config.format.schema.properties.systems.items.properties.stretches.items.anyOf[3]: the_compiled_grammar_is_too_large_for_the_fake_provider_to_accept_it"}}';

export class FakeProvider implements LlmProvider {
  readonly id: "fake" | "fake-dev";

  // "fake-dev" answers the same, but has prices (prices.ts).
  constructor(id: "fake" | "fake-dev" = "fake") {
    this.id = id;
  }

  async send(request: LlmRequest): Promise<LlmResponse> {
    if (request.model === "fake-error") throw new LlmError("server", FAKE_ERROR, 500);
    const unparseable = request.model === "fake-unparseable" && request.jsonSchema;
    const answer = unparseable ? "Not JSON, as asked." : request.jsonSchema ? (fakeLayout(request) ?? fakeExtract(request) ?? fakeReview(request) ?? fakeApplyReview(request) ?? simplest(request.jsonSchema)) : "Fake answer.";
    const text = typeof answer === "string" ? answer : JSON.stringify(answer);
    const stop = request.model === "fake-refusal" ? "refusal" : request.model === "fake-cut-off" ? "max_tokens" : "end";
    return {
      provider: this.id,
      model: request.model,
      text,
      json: request.jsonSchema && stop === "end" && !unparseable ? answer : undefined,
      invalidJson: unparseable ? "The fake answer isn't JSON, as asked." : undefined,
      unexpectedModel: request.model === "fake-other-model" ? "Asked fake-other-model, but fake answered." : undefined,
      stop,
      usage: { inputTokens: inputTokens(request), outputTokens: Math.ceil(text.length / 4), cacheReadTokens: 0, cacheWriteTokens: 0 },
      raw: { fake: true },
    };
  }
}

// About what Claude would bill: a token per 4 characters of text, and each image at Claude's most per image (4784
// tokens), not by the length of its base64, which would make a page cost a hundred times too much.
const IMAGE_TOKENS = 4784;

function inputTokens(request: LlmRequest): number {
  let chars = (request.system ?? "").length + JSON.stringify(request.jsonSchema ?? null).length;
  let images = 0;
  for (const message of request.messages) {
    for (const content of message.content) {
      if (content.type === "image") images++;
      else chars += content.text.length;
    }
  }
  return Math.ceil(chars / 4) + images * IMAGE_TOKENS;
}

// The simplest value a JSON schema allows.
function simplest(schema: Record<string, unknown>): unknown {
  if (Array.isArray(schema.enum)) return schema.enum[0];
  if ("const" in schema) return schema.const;
  const anyOf = (schema.anyOf ?? schema.oneOf) as Record<string, unknown>[] | undefined;
  if (anyOf?.length) return simplest(anyOf[0]);
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  switch (type) {
    case "object": {
      const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
      const required = (schema.required ?? Object.keys(properties)) as string[];
      return Object.fromEntries(required.map((key) => [key, simplest(properties[key] ?? {})]));
    }
    case "array":
      return [];
    case "string":
      return "";
    case "number":
    case "integer":
      return typeof schema.minimum === "number" ? schema.minimum : 0;
    case "boolean":
      return false;
    default:
      return null;
  }
}

type ExtractRequest = {
  system: number;
  stretches: number;
  firstOfPiece: boolean;
  staves: { staff: number }[];
  voices: { voice: number }[];
  signatures: { staff: number; clef: string; key: string }[];
  hints: { staves: { count: number } | null };
};

// An `extract` answer for a request in its form (its schema has "stretches" and "lastMeasureContinues"): the piece's
// staves, or as many as the hints say (two if they say nothing), one voice per staff with a whole-measure rest in every
// stretch, every stretch a new measure; with the issues above.
function fakeExtract(request: LlmRequest): unknown {
  const properties = (request.jsonSchema?.properties ?? {}) as Record<string, unknown>;
  if (!("stretches" in properties && "lastMeasureContinues" in properties)) return null;
  const texts = request.messages.flatMap((m) => m.content.flatMap((c) => (c.type === "text" ? [c.text] : [])));
  const last = texts.at(-1) ?? "";
  let r: ExtractRequest;
  try {
    r = JSON.parse(last.slice(last.indexOf("\n\n{") + 2)) as ExtractRequest;
  } catch {
    return null;
  }
  const count = r.staves.length > 0 ? r.staves.length : (r.hints?.staves?.count ?? 2);
  const numbers = r.staves.length > 0 ? r.staves.map((s) => s.staff) : Array.from({ length: count }, (_, i) => i + 1);
  const knownStaves = new Set(r.staves.map((s) => s.staff));
  const knownVoices = new Set(r.voices.map((v) => v.voice));
  const staves = numbers.map((staff, i) => {
    const sig = r.signatures.find((s) => s.staff === staff);
    return {
      staff,
      description: knownStaves.has(staff) ? "" : `staff ${staff}`,
      label: "",
      clef: sig?.clef ?? (i === 0 ? "treble" : "bass"),
      key: sig?.key ?? "0",
      time: r.firstOfPiece ? "4/4" : "",
    };
  });
  const stretches = Array.from({ length: r.stretches }, (_, i) => ({
    stretch: i + 1,
    class: "new-normal",
    printedNumber: "",
    measureNumber: -1,
    changes: [],
    ending: "none",
    endingLabel: "",
    voices: numbers.map((staff) => ({
      voice: staff,
      staff,
      description: i === 0 && !knownVoices.has(staff) ? `voice on staff ${staff}` : "",
      music: "R1",
    })),
    rightBarLine: "single",
  }));
  const box = { left: 0.1, right: 0.4, top: 0.2, bottom: 0.6 };
  const issues: unknown[] = [
    {
      boxes: [{ image: "stretch 1", box }],
      location: "The first note",
      question: "Is the dot after the first note a staccato or a smudge? (A made-up doubt from the fake model.)",
      answers: [
        { key: "a", text: "A staccato" },
        { key: "b", text: "A smudge" },
      ],
      applied: "b",
      class: "reading",
      lilypond: [],
    },
  ];
  if (r.system === 1) {
    issues.push({
      boxes: [{ image: "system", box }],
      location: "",
      question: "A harmonic is printed here, which the format can't write. (A made-up format issue from the fake model.)",
      answers: [
        { key: "a", text: "Left out" },
        { key: "b", text: "Written as a plain note" },
      ],
      applied: "a",
      class: "format",
      lilypond: ["\\harmonic"],
    });
  }
  return { startRepeat: false, staves, groups: [], stretches, lastMeasureContinues: false, issues };
}

// A `layout` answer (its schema has "systems", "satisfied" and "severelySkewed"): two systems, each with three bar
// lines, satisfied.
function fakeLayout(request: LlmRequest): unknown {
  const properties = (request.jsonSchema?.properties ?? {}) as Record<string, unknown>;
  if (!("systems" in properties && "satisfied" in properties && "severelySkewed" in properties)) return null;
  const system = (top: number) => ({ left: 0.1, right: 0.9, top, bottom: top + 0.2, barLines: [0.3, 0.5, 0.7] });
  return { severelySkewed: false, systems: [system(0.2), system(0.55)], satisfied: true, note: "" };
}

// A `review` answer (its schema has only "entries"): on system 1 a new issue, a made-up correction; on system 2 a
// choice of answer "a" for the first issue on it (the fake `extract`'s doubt there has "b" chosen); nothing elsewhere.
function fakeReview(request: LlmRequest): unknown {
  const properties = (request.jsonSchema?.properties ?? {}) as Record<string, unknown>;
  if (Object.keys(properties).join() !== "entries") return null;
  const texts = request.messages.flatMap((m) => m.content.flatMap((c) => (c.type === "text" ? [c.text] : [])));
  const last = texts.at(-1) ?? "";
  let r: { system: number; issues: number[] };
  try {
    r = JSON.parse(last.slice(last.indexOf("\n{") + 1)) as { system: number; issues: number[] };
  } catch {
    return null;
  }
  if (r.system === 1) {
    return {
      entries: [
        {
          newIssue: {
            boxes: [{ image: "stretch 2", box: { left: 0.2, right: 0.6, top: 0.3, bottom: 0.7 } }],
            location: "The second note of the upper staff",
            question: "Is this note a D or an E? (A made-up correction from the fake model.)",
            answers: [
              { key: "a", text: "A D" },
              { key: "b", text: "An E" },
            ],
            applied: "a",
            chosen: "b",
            reason: "Its head sits on the space above the line, as the E in the next measure does.",
            class: "reading",
            lilypond: null,
          },
        },
      ],
    };
  }
  if (r.system === 2 && r.issues.length > 0) return { entries: [{ choice: { issue: Math.min(...r.issues), key: "a", newAnswer: null, reason: null } }] };
  return { entries: [] };
}

type ApplyRequest = {
  window: number[];
  systems: { system: number; stretches: { stretch: number; voices: { voice: number; staff: number }[] }[] }[];
  apply: { id: number; places: { system: number; stretches: number[] }[]; applied: string | null; resolved?: boolean }[];
};

// An `apply_review` answer (its schema has "voices", "stretches", "systems" and "choices"): as said at the top.
function fakeApplyReview(request: LlmRequest): unknown {
  const properties = (request.jsonSchema?.properties ?? {}) as Record<string, unknown>;
  if (Object.keys(properties).join() !== "voices,stretches,systems,choices") return null;
  const texts = request.messages.flatMap((m) => m.content.flatMap((c) => (c.type === "text" ? [c.text] : [])));
  const last = texts.at(-1) ?? "";
  let r: ApplyRequest;
  try {
    r = JSON.parse(last.slice(last.indexOf("\n{") + 1)) as ApplyRequest;
  } catch {
    return null;
  }
  const answer = { voices: [] as unknown[], stretches: [], systems: [], choices: [] as unknown[] };
  const done = new Set<string>();
  for (const issue of r.apply) {
    const place = issue.places.find((p) => r.window.includes(p.system) && p.stretches.length > 0);
    const stretch = place && r.systems.find((s) => s.system === place.system)?.stretches.find((t) => t.stretch === place.stretches[0]);
    const voice = stretch?.voices[0];
    // A person's answers are always applied where they can be, so that a human review gets through.
    if ((r.window[0] % 2 === 0 && !issue.resolved) || !place || !voice) {
      const reason = "The fake model can't apply this answer (a made-up reason).";
      if (issue.applied !== null) answer.choices.push({ issue: issue.id, key: issue.applied, newAnswer: null, reason });
      else answer.choices.push({ issue: issue.id, key: null, newAnswer: "As it is now (a made-up answer from the fake model)", reason });
      continue;
    }
    const key = `${place.system}/${place.stretches[0]}/${voice.voice}`;
    if (done.has(key)) continue;
    done.add(key);
    answer.voices.push({ system: place.system, stretch: place.stretches[0], voice: voice.voice, staff: voice.staff, description: null, music: "c''1", reason: null });
  }
  return answer;
}
