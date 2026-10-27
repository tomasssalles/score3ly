// Durations as exact fractions of a whole note (docs/notation.md, "The symbolic format"): a dotted quarter is 3/8, a
// triplet eighth 1/12. Numerators and denominators stay small, so plain numbers are enough.

export type Fraction = { n: number; d: number };

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

export function fraction(n: number, d = 1): Fraction {
  if (d === 0) throw new Error("A fraction can't have a denominator of 0.");
  const sign = d < 0 ? -1 : 1;
  const g = gcd(n, d);
  return { n: (sign * n) / g, d: (sign * d) / g };
}

export const ZERO = fraction(0);

export const add = (a: Fraction, b: Fraction): Fraction => fraction(a.n * b.d + b.n * a.d, a.d * b.d);
export const mul = (a: Fraction, b: Fraction): Fraction => fraction(a.n * b.n, a.d * b.d);
export const equal = (a: Fraction, b: Fraction): boolean => a.n === b.n && a.d === b.d;
export const less = (a: Fraction, b: Fraction): boolean => a.n * b.d < b.n * a.d;

// "3/8", "1", "0".
export const show = (f: Fraction): string => (f.d === 1 ? String(f.n) : `${f.n}/${f.d}`);
