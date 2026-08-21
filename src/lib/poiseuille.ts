/**
 * Steady, laminar, fully developed viscous flows — the three canonical
 * solutions of Navier-Stokes that every transport course derives:
 *
 *   round tube (Poiseuille):  v(r) = (dP/4 mu L)(R^2 - r^2),  Q = pi dP R^4 / 8 mu L
 *   parallel plates:          v(y) = (dP/2 mu L) y (h - y),   Q = W h^3 dP / 12 mu L
 *   falling film (gravity):   v(x) = (rho g/mu)(h x - x^2/2), Q = rho g W h^3 / 3 mu
 *
 * The headline is the tube's R^4: flow rate against the FOURTH power of
 * radius. Narrow a vessel 20% and flow drops to 41%; that one exponent is
 * why vasoconstriction regulates blood pressure and why a stenosis is so
 * much worse than it looks.
 *
 * The wall shear stress closes a force balance in every geometry — the
 * pressure (or weight) pushing the fluid slab equals the wall drag holding
 * it back. verify.ts checks those balances exactly.
 *
 * SI units, matching the Newton (viscosity) module.
 */

export type FlowGeometry = 'tube' | 'plates' | 'film';

export interface PoiseuilleParams {
  geometry: FlowGeometry;
  /** Dynamic viscosity, Pa s */
  mu: number;
  /** Fluid density, kg/m^3 (Re everywhere; the driving force for the film) */
  rho: number;
  /** Driving pressure difference over the length, Pa (tube and plates) */
  dP: number;
  /** Channel length, m */
  L: number;
  /** Tube radius, m */
  R: number;
  /** Plate gap or film thickness, m */
  h: number;
  /** Width, m (plates and film; the tube has none) */
  W: number;
}

const G = 9.81; // m/s^2

/** The driving force per unit volume: dP/L, or rho g for the film. */
export function drivingGradient(p: PoiseuilleParams): number {
  return p.geometry === 'film' ? p.rho * G : p.dP / p.L;
}

/**
 * Velocity at transverse position s, m/s.
 * Tube: s = r in [0, R]. Plates: s = y in [0, h], measured from one plate.
 * Film: s = x in [0, h], measured from the wall (free surface at h).
 */
export function velocity(p: PoiseuilleParams, s: number): number {
  const g = drivingGradient(p);
  switch (p.geometry) {
    case 'tube':
      return (g / (4 * p.mu)) * (p.R * p.R - s * s);
    case 'plates':
      return (g / (2 * p.mu)) * s * (p.h - s);
    case 'film':
      return (g / p.mu) * (p.h * s - (s * s) / 2);
  }
}

/** Volumetric flow rate, m^3/s. */
export function flowRate(p: PoiseuilleParams): number {
  const g = drivingGradient(p);
  switch (p.geometry) {
    case 'tube':
      return (Math.PI * g * p.R ** 4) / (8 * p.mu);
    case 'plates':
      return (p.W * p.h ** 3 * g) / (12 * p.mu);
    case 'film':
      return (g * p.W * p.h ** 3) / (3 * p.mu);
  }
}

/** Cross-sectional area, m^2. */
export function area(p: PoiseuilleParams): number {
  return p.geometry === 'tube' ? Math.PI * p.R * p.R : p.W * p.h;
}

/** Average velocity Q/A, m/s. */
export function vAvg(p: PoiseuilleParams): number {
  return flowRate(p) / area(p);
}

/** Peak velocity, m/s: 2 v-bar in the tube, 1.5 v-bar for plates and film. */
export function vMax(p: PoiseuilleParams): number {
  const g = drivingGradient(p);
  switch (p.geometry) {
    case 'tube':
      return (g * p.R * p.R) / (4 * p.mu);
    case 'plates':
      return (g * p.h * p.h) / (8 * p.mu);
    case 'film':
      return (g * p.h * p.h) / (2 * p.mu);
  }
}

/**
 * Shear stress magnitude at position s, Pa. Linear in every geometry —
 * zero where the profile peaks, maximum at the wall.
 */
export function shear(p: PoiseuilleParams, s: number): number {
  const g = drivingGradient(p);
  switch (p.geometry) {
    case 'tube':
      return (g * s) / 2;
    case 'plates':
      return g * Math.abs(p.h / 2 - s);
    case 'film':
      return g * (p.h - s);
  }
}

/** Wall shear stress, Pa. */
export function wallShear(p: PoiseuilleParams): number {
  return shear(p, p.geometry === 'tube' ? p.R : 0);
}

/**
 * Reynolds number on the conventional length: tube diameter 2R, hydraulic
 * diameter 2h for wide plates, 4h for the film.
 */
export function reynolds(p: PoiseuilleParams): number {
  const Lc = p.geometry === 'tube' ? 2 * p.R : p.geometry === 'plates' ? 2 * p.h : 4 * p.h;
  return (p.rho * vAvg(p) * Lc) / p.mu;
}

/**
 * Hydraulic resistance R_hyd = dP/Q — the circuit view of a conduit, the
 * momentum sibling of R_D and R_th. Tube: 8 mu L / pi R^4. Not defined for
 * the gravity-driven film.
 */
export function hydraulicResistance(p: PoiseuilleParams): number {
  switch (p.geometry) {
    case 'tube':
      return (8 * p.mu * p.L) / (Math.PI * p.R ** 4);
    case 'plates':
      return (12 * p.mu * p.L) / (p.W * p.h ** 3);
    case 'film':
      return NaN;
  }
}

export interface ProfilePoint {
  /** transverse position, m */
  s: number;
  /** velocity, m/s */
  v: number;
  /** shear stress magnitude, Pa */
  tau: number;
}

/** Sampled profile for charting: full diameter for the tube (mirrored),
 *  0..h otherwise. */
export function profile(p: PoiseuilleParams, n = 100): ProfilePoint[] {
  const out: ProfilePoint[] = [];
  if (p.geometry === 'tube') {
    for (let i = 0; i <= n; i++) {
      const r = -p.R + (2 * p.R * i) / n;
      out.push({ s: r, v: velocity(p, Math.abs(r)), tau: shear(p, Math.abs(r)) });
    }
  } else {
    for (let i = 0; i <= n; i++) {
      const s = (p.h * i) / n;
      out.push({ s, v: velocity(p, s), tau: shear(p, s) });
    }
  }
  return out;
}
