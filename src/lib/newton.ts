/**
 * Newton's law of viscosity for steady, planar Couette flow: a fluid layer
 * of thickness H between a stationary bottom plate and a top plate sliding
 * at speed U.
 *
 *   tau = mu du/dy
 *
 * At steady state with no pressure gradient, momentum conservation forces
 * the shear stress tau to be the SAME at every height — the momentum-flux
 * counterpart of "J is constant through the wall" — which is why the
 * velocity profile is a straight line.
 *
 * The analogy to read off:  u  plays the role of C and T (the thing whose
 * gradient drives transport), tau plays the role of j and q'' (a flux — of
 * x-momentum, flowing in the y direction), and nu = mu/rho plays the role
 * of D and alpha (a diffusivity, m^2/s).
 *
 * Internal unit system is SI:
 *   length          m
 *   viscosity mu    Pa s  (1 Pa s = 10 poise)
 *   velocity        m/s
 *   shear stress    Pa = N/m^2   (momentum flux: kg m/s per m^2 per s)
 *   drag force      N
 */

export interface NewtonParams {
  /** Dynamic viscosity, Pa s */
  mu: number;
  /** Top plate speed, m/s */
  U: number;
  /** Gap between the plates, m */
  H: number;
  /** Wetted plate area, m^2 */
  A: number;
  /** Fluid density, kg/m^3 — only used for nu = mu/rho */
  rho: number;
}

export const PA_S_PER_POISE = 0.1; // 1 poise = 0.1 Pa s
export const poiseToPaS = (poise: number) => poise * PA_S_PER_POISE;
export const paSToPoise = (paS: number) => paS / PA_S_PER_POISE;

/** Velocity profile u(y), m/s, for y in [0, H]. Linear in Couette flow. */
export function velocity(p: NewtonParams, y: number): number {
  return (p.U * y) / p.H;
}

/** Velocity gradient du/dy, 1/s. Constant across the gap. */
export function shearRate(p: NewtonParams): number {
  return p.U / p.H;
}

/**
 * Shear stress tau = mu du/dy, Pa. Constant at every height at steady
 * state — measure it at the top plate, the midplane, or the bottom plate
 * and you get the same number.
 */
export function shearStress(p: NewtonParams): number {
  return p.mu * shearRate(p);
}

/** Drag force the fluid exerts on either plate, N. */
export function dragForce(p: NewtonParams): number {
  return shearStress(p) * p.A;
}

/**
 * Kinematic viscosity nu = mu/rho, m^2/s — the momentum diffusivity, and
 * the direct analog of D and alpha. For water it is ~1e-6 m^2/s, within a
 * factor of a few of alpha, and ~1000x larger than a typical solute D:
 * momentum spreads through water a thousand times faster than molecules do.
 */
export function kinematicViscosity(p: NewtonParams): number {
  return p.mu / p.rho;
}

export interface ProfilePoint {
  /** height above the bottom plate, m */
  y: number;
  /** velocity, m/s */
  u: number;
  /** shear stress, Pa (constant, but charted to make that visible) */
  tau: number;
  /** fraction across the gap */
  t: number;
}

/** Sampled profile for charting. */
export function profile(p: NewtonParams, n = 60): ProfilePoint[] {
  const out: ProfilePoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = p.H * t;
    out.push({ y, t, u: velocity(p, y), tau: shearStress(p) });
  }
  return out;
}
