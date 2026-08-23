/**
 * Unsteady diffusion from an instantaneous release — the "time-release
 * capsule" that bursts at t = 0. This is the module students meet BEFORE
 * steady state: concentration visibly changing in time is immediate, while
 * matched sources and sinks are an abstraction.
 *
 * Planar (1D) release of amount M spread over face area A, in an unbounded
 * medium:
 *
 *   C(x,t) = (M/A) / sqrt(4 pi D t) * exp( -x^2 / (4 D t) )
 *
 * Everything the module teaches is in this one function:
 *   - the area under C is M/A at every instant (nothing is created or lost),
 *   - the width grows as sigma = sqrt(2 D t)  — root-t, not t,
 *   - so the peak must fall as 1/sqrt(t) to keep the area fixed,
 *   - and the time to reach a distance L is t = L^2 / 2D — the diffusion
 *     clock, the single most useful number in transport.
 *
 * Internal unit system is CGS, matching the mass modules:
 *   length cm, D cm^2/s, amount mol, concentration mol/cm^3, time s.
 */

export interface UnsteadyParams {
  /** Diffusion coefficient, cm^2/s */
  D: number;
  /** Amount released at t = 0, mol */
  M: number;
  /** Face area the planar release is spread over, cm^2 */
  A: number;
  /** Time since release, s */
  t: number;
  /** Distance of interest for the diffusion clock, cm */
  Lint: number;
}

/** Concentration at position x (cm from the release plane), mol/cm^3. */
export function concentration(p: UnsteadyParams, x: number): number {
  const denom = Math.sqrt(4 * Math.PI * p.D * p.t);
  return ((p.M / p.A) / denom) * Math.exp(-(x * x) / (4 * p.D * p.t));
}

/** RMS spread of the cloud, cm: sigma = sqrt(2 D t). */
export function sigma(D: number, t: number): number {
  return Math.sqrt(2 * D * t);
}

/** Peak concentration C(0, t), mol/cm^3. Falls as 1/sqrt(t). */
export function peak(p: UnsteadyParams): number {
  return concentration(p, 0);
}

/**
 * The diffusion clock: time for the cloud to spread a distance L,
 * t = L^2 / (2 D), s. Root-t spreading run backwards: to go twice as far
 * takes four times as long — microseconds across a synapse, days across a
 * still room.
 */
export function diffusionTime(L: number, D: number): number {
  return (L * L) / (2 * D);
}

export interface ProfilePoint {
  /** position, cm (release plane at 0) */
  x: number;
  /** concentration now, mol/cm^3 */
  C: number;
  /** concentration at t/2 and t/4 — ghosts showing the evolution */
  Chalf: number;
  Cquarter: number;
}

/** Sampled profile for charting, over ±span (default ±3.5 sigma). */
export function profile(p: UnsteadyParams, n = 140, span?: number): ProfilePoint[] {
  const s = span ?? 3.5 * sigma(p.D, p.t);
  const half: UnsteadyParams = { ...p, t: p.t / 2 };
  const quarter: UnsteadyParams = { ...p, t: p.t / 4 };
  const out: ProfilePoint[] = [];
  for (let i = 0; i <= n; i++) {
    const x = -s + (2 * s * i) / n;
    out.push({
      x,
      C: concentration(p, x),
      Chalf: concentration(half, x),
      Cquarter: concentration(quarter, x),
    });
  }
  return out;
}

/**
 * Point (3D) release of amount M: C(r,t) = M / (4 pi D t)^{3/2} * exp(-r^2/4Dt).
 * The spherical capsule — a depot injection, an ink drop. Same Gaussian as
 * the planar release, once per axis: the peak falls as t^{-3/2} (one factor
 * of sqrt(t) per dimension) and the rms RADIUS is sqrt(6Dt) — 2Dt per axis,
 * three axes.
 */
export function concentrationPoint(M: number, D: number, t: number, r: number): number {
  return (M / Math.pow(4 * Math.PI * D * t, 1.5)) * Math.exp(-(r * r) / (4 * D * t));
}

/** RMS distance from the release point, cm: sqrt(<r^2>) = sqrt(6 D t). */
export function sigmaPoint(D: number, t: number): number {
  return Math.sqrt(6 * D * t);
}

/** Peak concentration C(0, t) of a point release, mol/cm^3. Falls as t^{-3/2}. */
export function peakPoint(M: number, D: number, t: number): number {
  return concentrationPoint(M, D, t, 0);
}

export interface RadialProfilePoint {
  /** distance from the release point, cm */
  r: number;
  /** concentration now, mol/cm^3 */
  C: number;
  /** concentration at t/2 and t/4 — ghosts showing the evolution */
  Chalf: number;
  Cquarter: number;
}

/** Sampled radial profile for charting, from 0 out to span
 *  (default 3.5 x the per-axis sigma). */
export function profilePoint(
  M: number,
  D: number,
  t: number,
  n = 140,
  span?: number,
): RadialProfilePoint[] {
  const s = span ?? 3.5 * sigma(D, t);
  const out: RadialProfilePoint[] = [];
  for (let i = 0; i <= n; i++) {
    const r = (s * i) / n;
    out.push({
      r,
      C: concentrationPoint(M, D, t, r),
      Chalf: concentrationPoint(M, D, t / 2, r),
      Cquarter: concentrationPoint(M, D, t / 4, r),
    });
  }
  return out;
}
