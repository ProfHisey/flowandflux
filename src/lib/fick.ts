/**
 * Steady-state Fick's first law of diffusion in one dimension,
 * for the three canonical geometries: slab, cylinder, sphere.
 *
 *   Cartesian    j_x = -D dC/dx          J = -D A_x  dC/dx
 *   Cylindrical  j_r = -D dC/dr          J = -D (2 pi r L) dC/dr
 *   Spherical    j_r = -D dC/dr          J = -D (4 pi r^2) dC/dr
 *
 * At steady state with no generation, species conservation (dJ/dx = 0)
 * forces the TOTAL transfer rate J to be constant through the wall, even
 * though the local flux j is not constant in curved geometries. That is the
 * whole reason the concentration profile is linear in a slab, logarithmic in
 * a cylinder, and hyperbolic in a sphere.
 *
 * Internal unit system is CGS, matching the course:
 *   length          cm
 *   diffusivity     cm^2 / s
 *   concentration   mol / cm^3   (displayed as mM; 1 mM = 1e-6 mol/cm^3)
 *   flux j          mol / (cm^2 s)
 *   transfer rate J mol / s
 *   resistance R_D  s / cm^3
 */

export type Geometry = 'slab' | 'cylinder' | 'sphere';

export interface FickParams {
  geometry: Geometry;
  /** Diffusion coefficient, cm^2/s */
  D: number;
  /** Concentration held at the inner boundary (x = 0, or r = r1), mol/cm^3 */
  C1: number;
  /** Concentration held at the outer boundary (x = L, or r = r2), mol/cm^3 */
  C2: number;
  /** Slab thickness, cm. Also used as the cylinder's axial length. */
  L: number;
  /** Slab face area, cm^2 */
  A: number;
  /** Inner radius, cm (cylinder and sphere) */
  r1: number;
  /** Outer radius, cm (cylinder and sphere) */
  r2: number;
}

export const MM_PER_MOL_CM3 = 1e6; // 1 mol/cm^3 = 1e6 mM
export const mMToMolPerCm3 = (mM: number) => mM / MM_PER_MOL_CM3;
export const molPerCm3TomM = (c: number) => c * MM_PER_MOL_CM3;

/** Independent-variable range for the active geometry, in cm. */
export function domain(p: FickParams): [number, number] {
  return p.geometry === 'slab' ? [0, p.L] : [p.r1, p.r2];
}

/**
 * Diffusive resistance R_D = ΔC / J, by direct analogy with Ohm's law
 * Units: s/cm^3.
 */
export function resistance(p: FickParams): number {
  const { geometry, D, L, A, r1, r2 } = p;
  switch (geometry) {
    case 'slab':
      return L / (A * D);
    case 'cylinder':
      // L doubles as the axial length of the cylindrical shell
      return Math.log(r2 / r1) / (2 * Math.PI * L * D);
    case 'sphere':
      return (1 / r1 - 1 / r2) / (4 * Math.PI * D);
  }
}

/**
 * Total transfer rate through the wall, mol/s. Positive means transport in
 * the +x (or +r) direction, i.e. from boundary 1 toward boundary 2.
 */
export function transferRate(p: FickParams): number {
  return (p.C1 - p.C2) / resistance(p);
}

/** Concentration profile C(s), mol/cm^3, for s in the geometry's domain. */
export function concentration(p: FickParams, s: number): number {
  const { geometry, C1, C2, L, r1, r2 } = p;
  switch (geometry) {
    case 'slab':
      return C1 + ((C2 - C1) * s) / L;
    case 'cylinder':
      return C1 + ((C2 - C1) * Math.log(s / r1)) / Math.log(r2 / r1);
    case 'sphere':
      return C1 + ((C2 - C1) * (1 / r1 - 1 / s)) / (1 / r1 - 1 / r2);
  }
}

/** Cross-sectional area available for transport at station s, cm^2. */
export function areaAt(p: FickParams, s: number): number {
  switch (p.geometry) {
    case 'slab':
      return p.A;
    case 'cylinder':
      return 2 * Math.PI * s * p.L;
    case 'sphere':
      return 4 * Math.PI * s * s;
  }
}

/** Local flux j(s) = J / A(s), mol/(cm^2 s). */
export function flux(p: FickParams, s: number): number {
  return transferRate(p) / areaAt(p, s);
}

/** Local concentration gradient dC/ds, mol/cm^4. */
export function gradient(p: FickParams, s: number): number {
  return -flux(p, s) / p.D;
}

export interface ProfilePoint {
  /** position, cm */
  s: number;
  /** concentration, mM */
  C: number;
  /** local flux, mol/(cm^2 s) */
  j: number;
  /** fraction across the wall, 0 at boundary 1 and 1 at boundary 2 */
  t: number;
}

/** Sampled profile for charting. */
export function profile(p: FickParams, n = 120): ProfilePoint[] {
  const [a, b] = domain(p);
  const out: ProfilePoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const s = a + (b - a) * t;
    out.push({
      s,
      t,
      C: molPerCm3TomM(concentration(p, s)),
      j: flux(p, s),
    });
  }
  return out;
}

/**
 * Total amount of species held inside the wall at steady state, mol.
 * For the slab this is the "how much drug is in the epidermis" question
 * which reduces to the average concentration times the volume.
 */
export function holdup(p: FickParams, n = 400): number {
  const [a, b] = domain(p);
  const h = (b - a) / n;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    // midpoint rule on C(s) * dV/ds
    const s = a + h * (i + 0.5);
    sum += concentration(p, s) * areaAt(p, s) * h;
  }
  return sum;
}

/** Volume of the transporting region, cm^3. */
export function volume(p: FickParams): number {
  switch (p.geometry) {
    case 'slab':
      return p.A * p.L;
    case 'cylinder':
      return Math.PI * (p.r2 ** 2 - p.r1 ** 2) * p.L;
    case 'sphere':
      return (4 / 3) * Math.PI * (p.r2 ** 3 - p.r1 ** 3);
  }
}

/**
 * Stokes-Einstein diffusivity, cm^2/s, for a sphere of radius
 * a (cm) in a fluid of viscosity mu (poise = g/cm/s) at temperature T (K).
 *
 *   D = k_B T / (6 pi mu a)
 */
export const BOLTZMANN_CGS = 1.380649e-16; // erg/K
export function stokesEinstein(aCm: number, muPoise: number, TKelvin: number): number {
  return (BOLTZMANN_CGS * TKelvin) / (6 * Math.PI * muPoise * aCm);
}

/** Hydrodynamic radius implied by a measured D, cm. Inverse of the above. */
export function stokesEinsteinRadius(D: number, muPoise: number, TKelvin: number): number {
  return (BOLTZMANN_CGS * TKelvin) / (6 * Math.PI * muPoise * D);
}
