/**
 * Stokes drag and settling: a small sphere falling (or being spun) through
 * a viscous fluid.
 *
 *   drag        F_D = 6 pi mu a v                     (Re < 1)
 *   balance     m dv/dt = (rho_p - rho_f) V g_eff - 6 pi mu a v
 *   solution    v(t) = v_inf (1 - e^{-t/tau})
 *   terminal    v_inf = 2 (rho_p - rho_f) g_eff a^2 / (9 mu)
 *   time const  tau   = 2 rho_p a^2 / (9 mu)          = m / 6 pi mu a
 *
 * The two punchlines:
 *  - tau is MICROSECONDS for anything cell-sized: terminal velocity is not
 *    approached, it simply is. The whole v(t) drama is invisible.
 *  - v_inf goes as a^2 and as g. Small particles settle absurdly slowly
 *    (a cell: ~1 cm per DAY), and the only knob left is g — which is the
 *    entire reason centrifuges exist. g_eff = gFactor x 9.81.
 *
 * Validity: all of this is the Re < 1 (creeping flow) regime, where
 * C_D = 24/Re. The module deliberately includes a preset that leaves the
 * regime, so the formula can be seen failing honestly.
 *
 * SI units, matching the momentum modules.
 */

export interface StokesParams {
  /** Particle radius, m */
  a: number;
  /** Particle density, kg/m^3 */
  rhoP: number;
  /** Fluid density, kg/m^3 */
  rhoF: number;
  /** Fluid viscosity, Pa s */
  mu: number;
  /** Multiples of Earth gravity: 1 = settling, 1e5 = ultracentrifuge. */
  gFactor: number;
  /** Distance of interest for the settling clock, m. */
  Lint: number;
}

const G = 9.81;

export function gEff(p: StokesParams): number {
  return p.gFactor * G;
}

/** Stokes drag on a sphere moving at speed v, N. */
export function dragForce(mu: number, a: number, v: number): number {
  return 6 * Math.PI * mu * a * v;
}

/** Particle mass, kg. */
export function mass(p: StokesParams): number {
  return p.rhoP * (4 / 3) * Math.PI * p.a ** 3;
}

/** Net driving force: weight minus buoyancy, N. */
export function netWeight(p: StokesParams): number {
  return (p.rhoP - p.rhoF) * (4 / 3) * Math.PI * p.a ** 3 * gEff(p);
}

/** Terminal velocity, m/s (negative means the particle floats upward). */
export function terminalVelocity(p: StokesParams): number {
  return (2 * (p.rhoP - p.rhoF) * gEff(p) * p.a * p.a) / (9 * p.mu);
}

/** Time constant of the approach to terminal velocity, s. */
export function timeConstant(p: StokesParams): number {
  return (2 * p.rhoP * p.a * p.a) / (9 * p.mu);
}

/** Velocity during the (invisibly brief) approach, m/s. */
export function velocityAt(p: StokesParams, t: number): number {
  return terminalVelocity(p) * (1 - Math.exp(-t / timeConstant(p)));
}

/** Particle Reynolds number at terminal velocity, on the diameter. */
export function particleReynolds(p: StokesParams): number {
  return (p.rhoF * Math.abs(terminalVelocity(p)) * 2 * p.a) / p.mu;
}

/** Drag coefficient in the Stokes regime: C_D = 24/Re. */
export function dragCoefficient(p: StokesParams): number {
  return 24 / particleReynolds(p);
}

/** Time to settle the distance of interest, s (terminal velocity all the
 *  way — tau is negligible for anything this module simulates). */
export function settlingTime(p: StokesParams): number {
  return p.Lint / Math.abs(terminalVelocity(p));
}
