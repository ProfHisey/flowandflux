/**
 * Steady-state Fourier's law of heat conduction in one dimension, for the
 * same three geometries as Fick's law — deliberately, since the two files
 * mirror each other function for function. The mass↔heat analogy is the
 * spine of the whole subject:
 *
 *   Cartesian    q'' = -k dT/dx          Q = -k A_x  dT/dx
 *   Cylindrical  q'' = -k dT/dr          Q = -k (2 pi r L) dT/dr
 *   Spherical    q'' = -k dT/dr          Q = -k (4 pi r^2) dT/dr
 *
 * At steady state with no generation, energy conservation forces the TOTAL
 * heat rate Q to be constant through the wall, even though the local flux
 * q'' is not constant in curved geometries — the same statement, symbol for
 * symbol, as species conservation in fick.ts.
 *
 * Internal unit system is SI, matching how heat transfer is taught:
 *   length            m
 *   conductivity k    W / (m K)
 *   temperature       degC (differences in degC equal differences in K)
 *   heat flux q''     W / m^2
 *   heat rate Q       W
 *   resistance R_th   K / W
 */

export type Geometry = 'slab' | 'cylinder' | 'sphere';

export interface FourierParams {
  geometry: Geometry;
  /** Thermal conductivity, W/(m K) */
  k: number;
  /** Temperature held at the inner boundary (x = 0, or r = r1), degC */
  T1: number;
  /** Temperature held at the outer boundary (x = L, or r = r2), degC */
  T2: number;
  /** Slab thickness, m. Also used as the cylinder's axial length. */
  L: number;
  /** Slab face area, m^2 */
  A: number;
  /** Inner radius, m (cylinder and sphere) */
  r1: number;
  /** Outer radius, m (cylinder and sphere) */
  r2: number;
}

/** Independent-variable range for the active geometry, in m. */
export function domain(p: FourierParams): [number, number] {
  return p.geometry === 'slab' ? [0, p.L] : [p.r1, p.r2];
}

/**
 * Thermal resistance R_th = ΔT / Q, by direct analogy with Ohm's law —
 * and with R_D = ΔC / J. Units: K/W.
 */
export function resistance(p: FourierParams): number {
  const { geometry, k, L, A, r1, r2 } = p;
  switch (geometry) {
    case 'slab':
      return L / (A * k);
    case 'cylinder':
      // L doubles as the axial length of the cylindrical shell
      return Math.log(r2 / r1) / (2 * Math.PI * L * k);
    case 'sphere':
      return (1 / r1 - 1 / r2) / (4 * Math.PI * k);
  }
}

/**
 * Total heat rate through the wall, W. Positive means heat flowing in the
 * +x (or +r) direction, i.e. from boundary 1 toward boundary 2.
 */
export function heatRate(p: FourierParams): number {
  return (p.T1 - p.T2) / resistance(p);
}

/** Temperature profile T(s), degC, for s in the geometry's domain. */
export function temperature(p: FourierParams, s: number): number {
  const { geometry, T1, T2, L, r1, r2 } = p;
  switch (geometry) {
    case 'slab':
      return T1 + ((T2 - T1) * s) / L;
    case 'cylinder':
      return T1 + ((T2 - T1) * Math.log(s / r1)) / Math.log(r2 / r1);
    case 'sphere':
      return T1 + ((T2 - T1) * (1 / r1 - 1 / s)) / (1 / r1 - 1 / r2);
  }
}

/** Cross-sectional area available for conduction at station s, m^2. */
export function areaAt(p: FourierParams, s: number): number {
  switch (p.geometry) {
    case 'slab':
      return p.A;
    case 'cylinder':
      return 2 * Math.PI * s * p.L;
    case 'sphere':
      return 4 * Math.PI * s * s;
  }
}

/** Local heat flux q''(s) = Q / A(s), W/m^2. */
export function heatFlux(p: FourierParams, s: number): number {
  return heatRate(p) / areaAt(p, s);
}

/** Local temperature gradient dT/ds, K/m. */
export function gradient(p: FourierParams, s: number): number {
  return -heatFlux(p, s) / p.k;
}

export interface ProfilePoint {
  /** position, m */
  s: number;
  /** temperature, degC */
  T: number;
  /** local heat flux, W/m^2 */
  q: number;
  /** fraction across the wall, 0 at boundary 1 and 1 at boundary 2 */
  t: number;
}

/** Sampled profile for charting. */
export function profile(p: FourierParams, n = 120): ProfilePoint[] {
  const [a, b] = domain(p);
  const out: ProfilePoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const s = a + (b - a) * t;
    out.push({ s, t, T: temperature(p, s), q: heatFlux(p, s) });
  }
  return out;
}

/**
 * Thermal diffusivity α = k / (ρ c_p), m^2/s — the exact analog of D. It is
 * the quantity that decides how fast a temperature disturbance spreads, and
 * comparing its magnitude with D for the same material is the fastest way to
 * see why heat "diffuses" ~100x faster than solutes in water.
 */
export function thermalDiffusivity(k: number, rho: number, cp: number): number {
  return k / (rho * cp);
}
