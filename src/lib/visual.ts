/**
 * The site's one rule for cosmetic RATES — how fast an animation runs when
 * a faithful speed is impossible because the physics spans many decades.
 *
 *   every factor of ten in the real value is a factor of two on screen,
 *   factor = 2^log10(value / ref), pinned to a stated window.
 *
 * So every slider that changes a real rate visibly changes the animation in
 * the right direction, a multiplicative change stays multiplicative, and
 * the extremes stay watchable. Each page that uses it states the rule, and
 * verify.ts pins it. First used by Poiseuille; now shared by Stokes, Newton,
 * the Nu/Sh correlations and the cooling clock.
 */

/** Multiplier on an on-screen rate: 1 at `ref`, 2x per decade above it,
 *  pinned to [2^-below, 2^above] — the window [ref·10^-below, ref·10^above].
 *  Nonsense (0, negative, NaN) reads as the slow pin, never NaN. */
export function compressRatio(value: number, ref: number, below: number, above: number): number {
  const lo = ref * 10 ** -below;
  const hi = ref * 10 ** above;
  const v = Number.isFinite(value) && value > 0 ? Math.min(hi, Math.max(lo, value)) : lo;
  return 2 ** Math.log10(v / ref);
}

/** Which end of the window a value falls off, if either. */
export function compressPinned(
  value: number, ref: number, below: number, above: number,
): 'slow' | 'fast' | null {
  if (!(value >= ref * 10 ** -below)) return 'slow'; // also catches NaN and v <= 0
  return value > ref * 10 ** above ? 'fast' : null;
}
