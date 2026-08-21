/**
 * Convection correlations: the Nusselt and Sherwood numbers, computed live
 * instead of squinted off a chart.
 *
 *   Nu = h L / k_fluid      Sh = h_m L / D_AB
 *
 * Both are "how much better than a stagnant film" numbers: Nu = 1 would be
 * pure conduction across the length scale, and every correlation is an
 * empirical fit of how flow beats that. The classics implemented here, all
 * average values:
 *
 *   flat plate, laminar:      Nu = 0.664 Re^{1/2} Pr^{1/3}      (Re < 5e5)
 *   flat plate, mixed/turb:   Nu = (0.037 Re^{4/5} - 871) Pr^{1/3}
 *   sphere (Ranz-Marshall):   Nu = 2 + 0.6 Re^{1/2} Pr^{1/3}
 *   cylinder (Churchill-Bernstein): the long one, valid Re Pr > 0.2
 *   tube, laminar (const Ts): Nu = 3.66  (fully developed, Re < 2300)
 *   tube, turbulent (Dittus-Boelter): Nu = 0.023 Re^{4/5} Pr^{0.4}
 *
 * Every one converts to mass transfer by Pr -> Sc, Nu -> Sh: the
 * heat-mass analogy earning its keep one last time. For the Pr^{1/3}
 * family this gives the Chilton-Colburn ratio Sh/Nu = (Sc/Pr)^{1/3}
 * exactly.
 *
 * The sphere's Re -> 0 limit, Nu = 2, is not a fit — it is the exact
 * conduction solution for a sphere in an infinite stagnant medium
 * (h = k/R), and verify.ts checks it against the Fourier library.
 *
 * SI units.
 */

export type CorrGeometry = 'plate' | 'cylinder' | 'sphere' | 'tube';

export interface Fluid {
  name: string;
  /** kg/m^3 */
  rho: number;
  /** Pa s */
  mu: number;
  /** W/m K */
  k: number;
  /** J/kg K */
  cp: number;
  /** Default solute diffusivity in this fluid, m^2/s. */
  D: number;
}

export const FLUIDS: Fluid[] = [
  { name: 'Air', rho: 1.2, mu: 1.8e-5, k: 0.026, cp: 1006, D: 2e-5 },
  { name: 'Water', rho: 998, mu: 1e-3, k: 0.6, cp: 4182, D: 1e-9 },
  { name: 'Light oil', rho: 900, mu: 0.03, k: 0.14, cp: 1900, D: 1e-10 },
];

export interface CorrParams {
  geometry: CorrGeometry;
  fluid: Fluid;
  /** Free-stream (or mean) velocity, m/s */
  v: number;
  /** Characteristic length: plate length, cylinder/sphere DIAMETER, tube
   *  diameter, m */
  L: number;
  /** Solute diffusivity, m^2/s (overridable) */
  D: number;
}

export function reynolds(p: CorrParams): number {
  return (p.fluid.rho * p.v * p.L) / p.fluid.mu;
}

export function prandtl(f: Fluid): number {
  return (f.cp * f.mu) / f.k;
}

export function schmidt(p: CorrParams): number {
  return p.fluid.mu / (p.fluid.rho * p.D);
}

/** The correlation, for any Pr-like number — call once with Pr for Nu and
 *  once with Sc for Sh. Returns NaN outside all validity. */
export function nusseltOf(geometry: CorrGeometry, Re: number, Pr: number): number {
  switch (geometry) {
    case 'plate': {
      if (Re < 5e5) return 0.664 * Math.sqrt(Re) * Math.cbrt(Pr);
      return (0.037 * Re ** 0.8 - 871) * Math.cbrt(Pr);
    }
    case 'sphere':
      return 2 + 0.6 * Math.sqrt(Re) * Math.cbrt(Pr);
    case 'cylinder': {
      // Churchill-Bernstein, one line of empirical heroics.
      const a = (0.62 * Math.sqrt(Re) * Math.cbrt(Pr)) /
        Math.pow(1 + Math.pow(0.4 / Pr, 2 / 3), 0.25);
      const b = Math.pow(1 + Math.pow(Re / 282000, 5 / 8), 4 / 5);
      return 0.3 + a * b;
    }
    case 'tube': {
      if (Re < 2300) return 3.66; // laminar, fully developed, constant Ts
      return 0.023 * Re ** 0.8 * Pr ** 0.4; // Dittus-Boelter (heating)
    }
  }
}

export function nusselt(p: CorrParams): number {
  return nusseltOf(p.geometry, reynolds(p), prandtl(p.fluid));
}

export function sherwood(p: CorrParams): number {
  return nusseltOf(p.geometry, reynolds(p), schmidt(p));
}

/** Heat transfer coefficient, W/m^2 K. */
export function hOf(p: CorrParams): number {
  return (nusselt(p) * p.fluid.k) / p.L;
}

/** Mass transfer coefficient, m/s. */
export function hmOf(p: CorrParams): number {
  return (sherwood(p) * p.D) / p.L;
}

/** Validity notes per geometry — surfaced honestly in the UI. */
export function validity(p: CorrParams): string | null {
  const Re = reynolds(p);
  switch (p.geometry) {
    case 'plate':
      if (Re > 1e7) return 'Re > 10⁷: beyond the mixed-boundary-layer fit.';
      if (Re > 5e5) return 'Re > 5×10⁵: the boundary layer has gone turbulent — using the mixed correlation.';
      return null;
    case 'sphere':
      if (Re > 5e4) return 'Re > 5×10⁴: outside Ranz–Marshall\'s comfortable range.';
      return null;
    case 'cylinder':
      if (Re * prandtl(p.fluid) < 0.2) return 'Re·Pr < 0.2: below Churchill–Bernstein\'s validity.';
      return null;
    case 'tube':
      if (Re >= 2300 && Re < 1e4) return 'Re in the transition region (2300–10⁴): neither correlation is trustworthy here.';
      return null;
  }
}
