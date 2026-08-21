/**
 * Newton's law of cooling and the convection coefficients h and h_m.
 *
 * Convection at a surface:
 *   q'' = h (T_s - T_inf)          [heat,  W/m^2]
 *   j   = h_m (C_s - C_inf)        [mass,  mol/m^2 s — same law, new letter]
 *
 * h is NOT a material property. It bundles the fluid, the flow, and the
 * geometry into one number — which is why it spans five decades (still air
 * ~5, boiling water ~10^5 W/m^2 K) and why whole correlation tables exist
 * to estimate it. That bundling is the module's main confession.
 *
 * Lumped transient cooling (the classic "Newton's law of cooling"):
 * if the object's interior equilibrates much faster than the surface loses
 * heat (Biot number Bi = h L_c / k << 1, L_c = V/A), the whole object has
 * ONE temperature and an energy balance gives
 *
 *   rho V c_p dT/dt = -h A (T - T_inf)
 *   T(t) - T_inf = (T_0 - T_inf) e^{-t/tau},   tau = rho V c_p / (h A)
 *
 * Internal unit system is SI, matching the heat modules.
 */

export interface CoolingParams {
  /** Convection coefficient, W/(m^2 K) */
  h: number;
  /** Surface area, m^2 */
  A: number;
  /** Volume, m^3 */
  V: number;
  /** Object density, kg/m^3 */
  rho: number;
  /** Object specific heat, J/(kg K) */
  cp: number;
  /** Object thermal conductivity, W/(m K) — only used for the Biot check */
  k: number;
  /** Initial object temperature, degC */
  T0: number;
  /** Ambient fluid temperature, degC */
  Tinf: number;
  /** Time since the start, s */
  t: number;
}

/** The time constant tau = rho V c_p / (h A), s. */
export function tau(p: CoolingParams): number {
  return (p.rho * p.V * p.cp) / (p.h * p.A);
}

/** Lumped temperature at time t, degC. Works for heating too (T0 < Tinf). */
export function temperature(p: CoolingParams, t = p.t): number {
  return p.Tinf + (p.T0 - p.Tinf) * Math.exp(-t / tau(p));
}

/** Heat rate leaving the object at time t, W (negative when warming up). */
export function heatRate(p: CoolingParams, t = p.t): number {
  return p.h * p.A * (temperature(p, t) - p.Tinf);
}

/** Characteristic length L_c = V/A, m. */
export function charLength(p: CoolingParams): number {
  return p.V / p.A;
}

/**
 * Biot number Bi = h L_c / k: convection at the surface racing conduction
 * inside. Bi < ~0.1 means the inside keeps up and the lumped (single
 * temperature) model is honest; beyond that the interior lags the surface
 * and this module's math becomes an approximation.
 */
export function biot(p: CoolingParams): number {
  return (p.h * charLength(p)) / p.k;
}

/** Time to close half the remaining gap to ambient: tau ln 2, s. */
export function halfLife(p: CoolingParams): number {
  return tau(p) * Math.LN2;
}

/** Total energy the object must exchange to reach ambient, J. */
export function totalEnergy(p: CoolingParams): number {
  return p.rho * p.V * p.cp * (p.T0 - p.Tinf);
}

export interface ProfilePoint {
  /** time, s */
  t: number;
  /** lumped temperature, degC */
  T: number;
  /** instantaneous heat rate, W */
  Q: number;
}

/** Sampled T(t) and Q(t) for charting, over [0, tMax] (default 4 tau). */
export function profile(p: CoolingParams, n = 120, tMax?: number): ProfilePoint[] {
  const span = tMax ?? 4 * tau(p);
  const out: ProfilePoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (span * i) / n;
    out.push({ t, T: temperature(p, t), Q: heatRate(p, t) });
  }
  return out;
}

/** The mass-transfer twin: j = h_m (C_s - C_inf), mol/(m^2 s). */
export function massFlux(hm: number, Cs: number, Cinf: number): number {
  return hm * (Cs - Cinf);
}
