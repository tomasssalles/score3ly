// Rules every issue keeps, whoever writes it, a model or a person (docs/notation.md, "Issues"): its answers' keys, and
// the systems its boxes are on. One rule each, here; the stages that write issues are to check them (`extract`'s checks
// and the human review don't yet: the code review's batch 29 puts them there).

const A = "a".charCodeAt(0);
const LETTERS = 26;

// The key of an answer added after `answers`: the letter after the last one used, so that keys given "a", "b", "c", …
// in order stay so, and a new key never repeats one; null once "z" is used.
export function nextAnswerKey(answers: { key: string }[]): string | null {
  const used = answers.map((a) => a.key.charCodeAt(0) - A).filter((n) => n >= 0 && n < LETTERS);
  const next = used.length === 0 ? 0 : Math.max(...used) + 1;
  return next < LETTERS ? String.fromCharCode(A + next) : null;
}

// The answers' keys are "a", "b", "c", … in order, one letter each: what is wrong with them, or null.
export function answerKeysProblem(keys: string[]): string | null {
  if (keys.length > LETTERS) return `an issue has at most ${LETTERS} answers, "a" to "z"`;
  return keys.some((k, i) => k !== String.fromCharCode(A + i)) ? `the answers' keys must be "a", "b", "c", … in order` : null;
}

// An issue's boxes are on at most two systems, and two must be consecutive (docs/notation.md, "Issues"): given the
// systems its boxes are on, what is wrong, or null.
export function systemsRuleProblem(systems: number[]): string | null {
  const list = [...new Set(systems)].sort((a, b) => a - b);
  return list.length > 2 || (list.length === 2 && list[1] - list[0] !== 1) ? "covers more than two consecutive systems" : null;
}
