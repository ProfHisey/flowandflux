/**
 * Steady 1-D convection-diffusion through a channel or pore: the Peclet
 * number's home turf, and the bridge between the diffusion modules and
 * everything convective.
 *
 *   v dC/dx = D d^2C/dx^2,  C(0) = C0,  C(L) = CL
 *
 *   theta(xi) = (e^{Pe xi} - 1)/(e^{Pe} - 1),  xi = x/L,  Pe = vL/D
 *   C(x) = C0 + (CL - C0) theta
 *
 * Total flux (convective + diffusive), the same at every station:
 *
 *   N = v C - D dC/dx = v C0 - v (CL - C0)/(e^{Pe} - 1)
 *
 * Limits, which are the whole lesson:
 *   Pe << 1: profile -> linear, N -> D(C0 - CL)/L + v(C0+CL)/2 (diffusion)
 *   Pe >> 1: profile -> plug at C0 with a thin exit layer, N -> v C0
 *            (convection carries the UPWIND value; diffusion only survives
 *            in a boundary layer of thickness ~ L/Pe at the far end)
 *
 * Pe is one ratio wearing three coats: vL/D for mass, vL/alpha for heat,
 * and vL/nu (= Re) for momentum.
 *
 * CGS units, matching the mass-transfer modules (D cm^2/s, C mol/cm^3).
 */

export interface PecletParams {
  /** Diffusion coefficient, cm^2/s */
  D: number;
  /** Flow velocity through the channel, cm/s */
  v: number;
  /** Channel length, cm */
  L: number;
  /** Upstream concentration, mol/cm^3 */
  C0: number;
  /** Downstream concentration, mol/cm^3 */
  CL: number;
}

export function peclet(p: PecletParams): number {
  return (p.v * p.L) / p.D;
}

/**
 * Dimensionless profile theta(xi) for a given Pe, numerically stable from
 * Pe = 0 out to arbitrarily large Pe (where the naive exponentials
 * overflow long before the physics gets interesting).
 */
export function theta(Pe: number, xi: number): number {
  if (Math.abs(Pe) < 1e-9) return xi; // pure diffusion: linear
  if (Pe > 50) {
    // e^{-Pe} is far below double precision noise: exit boundary layer.
    return Math.exp(Pe * (xi - 1));
  }
  if (Pe < -50) {
    return -Math.expm1(Pe * xi); // reversed flow: entry boundary layer
  }
  return Math.expm1(Pe * xi) / Math.expm1(Pe);
}

/** Concentration at x (cm), mol/cm^3. */
export function concentration(p: PecletParams, x: number): number {
  return p.C0 + (p.CL - p.C0) * theta(peclet(p), x / p.L);
}

/**
 * Total flux N = vC - D dC/dx, mol/(cm^2 s) — constant along the channel
 * (that constancy is checked numerically in verify.ts).
 */
export function totalFlux(p: PecletParams): number {
  const Pe = peclet(p);
  if (Math.abs(Pe) < 1e-9) {
    return (p.D * (p.C0 - p.CL)) / p.L + (p.v * (p.C0 + p.CL)) / 2;
  }
  if (Pe > 50) return p.v * p.C0;
  return p.v * p.C0 - (p.v * (p.CL - p.C0)) / Math.expm1(Pe);
}

/** The two clocks Pe is secretly comparing. */
export function diffusionTime(p: PecletParams): number {
  return (p.L * p.L) / (2 * p.D);
}
export function convectionTime(p: PecletParams): number {
  return p.L / p.v;
}

export interface ProfilePoint {
  /** position, cm */
  x: number;
  /** concentration, mol/cm^3 */
  C: number;
  /** the pure-diffusion (Pe = 0) reference at the same x */
  Cdiff: number;
}

/** Sampled profile, with the Pe = 0 straight line as a reference. */
export function profile(p: PecletParams, n = 140): ProfilePoint[] {
  const out: ProfilePoint[] = [];
  for (let i = 0; i <= n; i++) {
    const xi = i / n;
    out.push({
      x: xi * p.L,
      C: p.C0 + (p.CL - p.C0) * theta(peclet(p), xi),
      Cdiff: p.C0 + (p.CL - p.C0) * xi,
    });
  }
  return out;
}
