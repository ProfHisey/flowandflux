/**
 * Number formatting for scientific readouts.
 *
 * The course is emphatic that units are not optional ("if you get a problem
 * wrong and you have not checked units, you will get no credit at all"), so
 * every value surfaced in the UI travels with its unit string.
 */

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '-': '⁻',
};

const superscript = (s: string) =>
  s
    .split('')
    .map((ch) => SUPERSCRIPT[ch] ?? ch)
    .join('');

/**
 * Format in scientific notation with a real times-ten-to-the, e.g. 7.0 x 10^-12.
 * Falls back to plain decimal for numbers of everyday magnitude.
 */
export function sci(value: number, sigFigs = 3): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';

  const abs = Math.abs(value);
  if (abs >= 1e-3 && abs < 1e5) {
    // Everyday magnitude: plain decimal reads better than 7.00 x 10^0.
    const digits = Math.max(0, sigFigs - 1 - Math.floor(Math.log10(abs)));
    const fixed = value.toFixed(Math.min(digits, 6));
    // Trim only *fractional* trailing zeros. Anchoring on the decimal point
    // matters: a naive /0+$/ turns 100 into 1.
    return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
  }

  const exp = Math.floor(Math.log10(abs));
  const mantissa = value / 10 ** exp;
  return `${mantissa.toFixed(sigFigs - 1)} × 10${superscript(String(exp))}`;
}

/** Compact form for axis ticks, where space is tight. */
export function tick(value: number): string {
  if (!Number.isFinite(value)) return '';
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 0.01 && abs < 1e4) {
    return String(Number(value.toPrecision(3)));
  }
  const exp = Math.floor(Math.log10(abs));
  const mantissa = value / 10 ** exp;
  const m = Number(mantissa.toPrecision(2));
  return `${m}e${exp}`;
}

/** A time in seconds, rendered in whichever unit keeps the number readable.
 *  Diffusion times span microseconds (synapse) to days (a still room), and
 *  the whole lesson is in that range — so the unit must move. */
export function timeS(s: number): string {
  const abs = Math.abs(s);
  if (abs < 1e-3) return `${sci(s * 1e6)} µs`;
  if (abs < 1) return `${sci(s * 1e3)} ms`;
  if (abs < 90) return `${sci(s)} s`;
  if (abs < 5400) return `${sci(s / 60)} min`;
  if (abs < 172800) return `${sci(s / 3600)} h`;
  return `${sci(s / 86400)} days`;
}

/** A length in m (SI, used for heat and momentum), rendered readably. */
export function lengthM(m: number): string {
  const abs = Math.abs(m);
  if (abs < 1e-3) return `${sci(m * 1e6)} µm`;
  if (abs < 1e-2) return `${sci(m * 1e3)} mm`;
  if (abs < 1) return `${sci(m * 1e2)} cm`;
  return `${sci(m)} m`;
}

/** A length in cm, rendered in whichever unit keeps the number readable. */
export function lengthCm(cm: number): string {
  const abs = Math.abs(cm);
  if (abs < 1e-4) return `${sci(cm * 1e7)} nm`;
  if (abs < 1e-1) return `${sci(cm * 1e4)} µm`;
  return `${sci(cm)} cm`;
}

/**
 * A round upper bound at or above `v`, and a matching set of evenly spaced
 * ticks starting at zero.
 *
 * Letting the chart library pick its own domain produced ticks like 8.5e-16
 * where a plain 0 belongs — a floating-point artefact that reads, on a page
 * about scientific notation, as though it means something.
 */
export function niceAxis(v: number, divisions = 4): { max: number; ticks: number[] } {
  if (!Number.isFinite(v) || v <= 0) return { max: 1, ticks: [0, 0.25, 0.5, 0.75, 1] };
  // Search one decade below the value so a step of, say, 0.25 is reachable
  // for v = 1. Anchoring on 10^exp alone forces the max up to 4.
  const base = 10 ** (Math.floor(Math.log10(v)) - 1);
  const target = v / divisions;
  const step = [1, 2, 2.5, 5, 10, 20, 25, 50, 100].find((m) => m * base >= target) ?? 100;
  const stepSize = step * base;
  let max = stepSize * divisions;
  while (max < v) max += stepSize;
  const ticks: number[] = [];
  for (let t = 0; t <= max + stepSize / 2; t += stepSize) ticks.push(Number(t.toPrecision(12)));
  return { max, ticks };
}
