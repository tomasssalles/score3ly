// Marks with two ends across stretches and systems (docs/stages/music.md, "Loose ends across systems"): code finds what is
// still open at the end of a system, from the lens alone, and checks both sides: what was left open must be closed in
// the next system, or still be open for marks that can run longer (8va, pedal, trill spans). A mismatch is an issue
// raised by code, not a reason to reject the answer.

import { walk, type Event, type Mark } from "./symbolic.ts";

// A curve, a hairpin, a trill span or a glissando belongs to its voice; an ottava and the pedal to the staff they
// are written on (§6: a voice may move to another staff, and carries such marks there). `from` and `fromStretch`:
// where it opened.
export type OpenMark = (
  | { kind: "curve"; voice: number; number: number }
  | { kind: "hairpin"; voice: number }
  | { kind: "trill"; voice: number }
  | { kind: "glissando"; voice: number }
  | { kind: "ottava"; staff: number; value: number }
  | { kind: "pedal"; staff: number }
) & { from: number; fromStretch: number };

// A mark from an earlier system that closed on this one, and where: what links a mark across system breaks
// (links.ts).
export type ClosedMark = { mark: OpenMark; at: { system: number; stretch: number } };

// Marks that may run on over more than one system break.
const LONG: OpenMark["kind"][] = ["ottava", "pedal", "trill"];

export function describeMark(m: OpenMark): string {
  switch (m.kind) {
    case "curve":
      return `curve ${m.number} in voice ${m.voice}`;
    case "hairpin":
      return `the hairpin in voice ${m.voice}`;
    case "trill":
      return `the trill line in voice ${m.voice}`;
    case "glissando":
      return `the glissando in voice ${m.voice}`;
    case "ottava":
      return `the ottava (${m.value > 0 ? "+" : ""}${m.value}) on staff ${m.staff}`;
    case "pedal":
      return `the pedal on staff ${m.staff}`;
  }
}

// Where a problem is: the stretches it is about, by system and stretch number. `message` says what is wrong with the
// transcription; `question` asks about the page, in words that stay true whichever answer is applied later
// (docs/notation.md, "Issues": the texts are for people).
export type SpanProblem = { message: string; question: string; places: { system: number; stretch: number }[] };

// What a mark is called on the page.
export function markName(kind: OpenMark["kind"]): string {
  return { curve: "slur or tie", hairpin: "hairpin", trill: "trill line", glissando: "glissando", ottava: "ottava line", pedal: "pedal mark" }[kind];
}

const whereEnds = (kind: OpenMark["kind"]) => `Where does this ${markName(kind)} end?`;
const whereStarts = (kind: OpenMark["kind"]) => `Where does this ${markName(kind)} start?`;

// Follows the marks of one system's voices, stretch by stretch: `open` is what was open when the system began (from
// the previous one), and is updated in place to what is open at its end. Each voice's string comes with the staff it
// starts on.
export class SpanTracker {
  readonly open: OpenMark[];
  readonly problems: SpanProblem[] = [];
  readonly closed: ClosedMark[] = []; // marks from earlier systems that closed here
  private readonly system: number;
  private readonly carried: OpenMark[];

  constructor(system: number, open: OpenMark[]) {
    this.system = system;
    this.open = open.map((m) => ({ ...m }));
    this.carried = this.open.filter((m) => !LONG.includes(m.kind));
  }

  // Returns the staff the voice is on at the end of the string (after any \change Staff).
  voice(stretch: number, voice: number, staff: number, events: Event[]): number {
    const here = [{ system: this.system, stretch }];
    const problem = (message: string, question: string) => this.problems.push({ message, question, places: here });
    const find = (pred: (m: OpenMark) => boolean) => this.open.findIndex(pred);
    const close = (index: number) => {
      const [m] = this.open.splice(index, 1);
      if (m.from < this.system) this.closed.push({ mark: m, at: { system: this.system, stretch } });
    };
    const origin = { from: this.system, fromStretch: stretch };
    const openMark = (m: OpenMark) => this.open.push(m);

    const marks = (list: Mark[]) => {
      for (const m of list) {
        if (m.kind === "curve") {
          const at = find((o) => o.kind === "curve" && o.voice === voice && o.number === m.number);
          if (m.open) {
            if (at >= 0) problem(`curve ${m.number} in voice ${voice} starts while curve ${m.number} is still open`, whereEnds("curve"));
            else openMark({ kind: "curve", voice, number: m.number, ...origin });
          } else if (at < 0) {
            problem(`curve ${m.number} in voice ${voice} ends, but no curve ${m.number} is open there`, whereStarts("curve"));
          } else {
            close(at);
          }
        } else if (m.kind === "command") {
          const hairpin = find((o) => o.kind === "hairpin" && o.voice === voice);
          if (m.name === "<" || m.name === ">") {
            if (hairpin >= 0) close(hairpin);
            openMark({ kind: "hairpin", voice, ...origin });
          } else if (m.name === "!") {
            if (hairpin < 0) problem(`a hairpin ends with \\! in voice ${voice}, but none is open there`, whereStarts("hairpin"));
            else close(hairpin);
          } else if (["ppp", "pp", "p", "mp", "mf", "f", "ff", "fff", "sf", "sfz", "fz", "fp", "sfp", "rfz"].includes(m.name)) {
            if (hairpin >= 0) close(hairpin); // the next dynamic ends a hairpin
          } else if (m.name === "startTrillSpan") {
            const trill = find((o) => o.kind === "trill" && o.voice === voice);
            if (trill >= 0) problem(`a trill line starts in voice ${voice} while another is open`, whereEnds("trill"));
            else openMark({ kind: "trill", voice, ...origin });
          } else if (m.name === "stopTrillSpan") {
            const trill = find((o) => o.kind === "trill" && o.voice === voice);
            if (trill < 0) problem(`a trill line ends in voice ${voice}, but none is open there`, whereStarts("trill"));
            else close(trill);
          } else if (m.name === "sustainOn") {
            const pedal = find((o) => o.kind === "pedal" && o.staff === staff);
            if (pedal >= 0) problem(`the pedal goes down on staff ${staff} while it is already down`, whereEnds("pedal"));
            else openMark({ kind: "pedal", staff, ...origin });
          } else if (m.name === "sustainOff") {
            const pedal = find((o) => o.kind === "pedal" && o.staff === staff);
            if (pedal < 0) problem(`the pedal comes up on staff ${staff}, but it isn't down there`, whereStarts("pedal"));
            else close(pedal);
          } else if (m.name === "glissando") {
            openMark({ kind: "glissando", voice, ...origin });
          }
        }
      }
    };

    for (const event of walk(events)) {
      switch (event.e) {
        case "changeStaff":
          staff = event.staff;
          break;
        case "ottava": {
          const at = find((o) => o.kind === "ottava" && o.staff === staff);
          if (event.value === 0) {
            if (at < 0) problem(`an ottava ends on staff ${staff}, but none is open there`, whereStarts("ottava"));
            else close(at);
          } else {
            if (at >= 0) close(at);
            openMark({ kind: "ottava", staff, value: event.value, ...origin });
          }
          break;
        }
        case "note":
        case "chord": {
          // A glissando ends on the next note of its voice.
          const gliss = find((o) => o.kind === "glissando" && o.voice === voice);
          if (gliss >= 0) close(gliss);
          const heads = event.e === "note" ? [event.head] : event.heads;
          // On each note, its curves that end come before those that start.
          const headMarks = heads.flatMap((h) => h.marks);
          marks([...headMarks.filter((m) => m.kind === "curve" && !m.open), ...headMarks.filter((m) => !(m.kind === "curve" && !m.open))]);
          marks(event.marks);
          break;
        }
        case "rest":
        case "measureRest":
          marks(event.marks);
          break;
        default:
          break;
      }
    }
    return staff;
  }

  // At the end of the system: what came from the previous system and had to end here, but didn't.
  finish(): SpanProblem[] {
    for (const m of this.carried) {
      const still = this.open.find((o) => sameMark(o, m) && o.from === m.from);
      if (still) {
        this.problems.push({
          message: `${describeMark(m)} continues from the previous system, but doesn't end on this one`,
          question: whereEnds(m.kind),
          places: [{ system: this.system, stretch: 1 }],
        });
      }
    }
    return this.problems;
  }
}

export function sameMark(a: OpenMark, b: OpenMark): boolean {
  if (a.kind !== b.kind) return false;
  if ("voice" in a && "voice" in b && a.voice !== b.voice) return false;
  if ("staff" in a && "staff" in b && a.staff !== b.staff) return false;
  if (a.kind === "curve" && b.kind === "curve") return a.number === b.number;
  return true;
}
