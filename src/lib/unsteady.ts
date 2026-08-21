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
 * Not surfaced in the UI yet — kept alongside the planar solution because the
 * spherical capsule is the natural follow-on, and verify.ts checks it now so
 * the UI work later starts from trusted math.
 */
export function concentrationPoint(M: number, D: number, t: number, r: number): number {
  return (M / Math.pow(4 * Math.PI * D * t, 1.5)) * Math.exp(-(r * r) / (4 * D * t));
}
