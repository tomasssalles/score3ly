// How long the events of a voice last (docs/stages/music.md, `extract`'s checks): every note and rest has its own duration,
// tuplets scale their notes, grace notes take no time, a two-note tremolo lasts its count times its notes.

import { add, fraction, mul, ZERO, type Fraction } from "./fraction.ts";
import type { Duration, Event } from "./symbolic.ts";

export function durationValue({ base, dots }: Duration): Fraction {
  // A dotted value is the base times (2 - 1/2^dots).
  const whole = base === 0.5 ? fraction(2) : fraction(1, base);
  return mul(whole, fraction(2 ** (dots + 1) - 1, 2 ** dots));
}

export function eventsDuration(events: Event[]): Fraction {
  let total = ZERO;
  for (const event of events) {
    switch (event.e) {
      case "note":
      case "chord":
      case "rest":
        total = add(total, durationValue(event.duration));
        break;
      case "measureRest":
        total = add(total, mul(fraction(event.count), durationValue(event.duration)));
        break;
      case "tuplet":
        total = add(total, mul(eventsDuration(event.body), fraction(event.m, event.n)));
        break;
      case "tremolo":
        total = add(total, mul(fraction(event.count), eventsDuration(event.body)));
        break;
      default:
        break; // grace notes and commands take no time
    }
  }
  return total;
}

// A time signature as the lens writes it: "3/4", "6/8", "C" (common time), "C|" (cut time), "3+2/8".
export type TimeSignature = { count: number[]; unit: number; symbol: "common" | "cut" | null };

export function parseTime(text: string): TimeSignature | null {
  if (text === "C") return { count: [4], unit: 4, symbol: "common" };
  if (text === "C|") return { count: [2], unit: 2, symbol: "cut" };
  const m = /^(\d+(?:\+\d+)*)\/(1|2|4|8|16|32|64)$/.exec(text);
  if (!m) return null;
  const count = m[1].split("+").map(Number);
  if (count.some((c) => c < 1)) return null;
  return { count, unit: Number(m[2]), symbol: null };
}

// How long a measure in that time lasts.
export function measureLength(time: TimeSignature): Fraction {
  return fraction(time.count.reduce((a, b) => a + b, 0), time.unit);
}

// A key signature as MEI writes it: "0", "1s" … "7s", "1f" … "7f".
export function parseKey(text: string): { count: number; accidental: "s" | "f" | null } | null {
  if (text === "0") return { count: 0, accidental: null };
  const m = /^([1-7])([sf])$/.exec(text);
  return m ? { count: Number(m[1]), accidental: m[2] as "s" | "f" } : null;
}
