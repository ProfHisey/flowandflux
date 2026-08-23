/**
 * The mixing-cup (bulk) temperature — what "the" temperature of a flowing
 * stream even means. In a tube the fluid near the wall moves slowly and the
 * core moves fast, so different radii contribute different amounts of fluid
 * per second. The honest single temperature is the one a cup at the outlet
 * would collect: velocity-weighted, not area-weighted,
 *
 *   T_mc = ∫ ρ_f c v T dA / ∫ ρ_f c v dA   (ρ_f = fluid density).
 *
 * Every internal-flow h and every energy balance along a pipe is written
 * against THIS temperature; the plain area average is a different (and
 * wrong) number whenever the profile is not flat.
 *
 * Model used here: laminar Poiseuille velocity v = 2 v̄ (1 − ρ²) with
 * ρ = r/R, and a temperature profile with adjustable fullness
 *
 *   T(ρ) = T_w + (T_c − T_w)(1 − ρⁿ),
 *
 * (T_c at the centreline, T_w at the wall; n = 2 is parabolic, large n is a
 * flat core with a thin wall layer). Both averages are then closed-form:
 * v̄, R, the density and c all cancel, so the SHAPE alone decides the answer.
 */

export interface MixingCupParams {
  /** Wall temperature, degC. */
  Tw: number;
  /** Centreline temperature, degC. */
  Tc: number;
  /** Temperature-profile fullness exponent (2 = parabolic). */
  n: number;
}

/** Poiseuille velocity at ρ = r/R, in units of the mean velocity. */
export function velocityAt(rho: number): number {
  return 2 * (1 - rho * rho);
}

/** Temperature at ρ = r/R, degC. */
export function tempAt(p: MixingCupParams, rho: number): number {
  return p.Tw + (p.Tc - p.Tw) * (1 - Math.pow(Math.abs(rho), p.n));
}

/** Plain area-averaged temperature, degC:
 *  T_avg = T_w + (T_c − T_w) · n/(n+2). */
export function areaAvgT(p: MixingCupParams): number {
  return p.Tw + ((p.Tc - p.Tw) * p.n) / (p.n + 2);
}

/** Mixing-cup (bulk) temperature, degC:
 *  T_mc = T_w + (T_c − T_w) · (1 − 4/(n+2) + 4/(n+4)). */
export function mixingCupT(p: MixingCupParams): number {
  const f = 1 - 4 / (p.n + 2) + 4 / (p.n + 4);
  return p.Tw + (p.Tc - p.Tw) * f;
}

/** The definition integrated directly (midpoint rule) — used by verify to
 *  pin the closed forms to the integral they claim to be. */
export function mixingCupTNumeric(p: MixingCupParams, N = 4000): number {
  let num = 0;
  let den = 0;
  for (let i = 0; i < N; i++) {
    const rho = (i + 0.5) / N;
    const w = velocityAt(rho) * rho; // v · dA, with dA ∝ ρ dρ
    num += w * tempAt(p, rho);
    den += w;
  }
  return num / den;
}

/** Area average integrated directly, for the same cross-check. */
export function areaAvgTNumeric(p: MixingCupParams, N = 4000): number {
  let num = 0;
  let den = 0;
  for (let i = 0; i < N; i++) {
    const rho = (i + 0.5) / N;
    num += rho * tempAt(p, rho);
    den += rho;
  }
  return num / den;
}
