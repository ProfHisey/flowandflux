/**
 * Transient conduction: the semi-infinite solid, sudden contact between two
 * bodies, and the one-term (Heisler) solutions for finite walls and spheres.
 *
 * Semi-infinite solid, surface suddenly held at T_s at t = 0:
 *
 *   theta(x,t) = (T - T_s)/(T_i - T_s) = erf( x / 2 sqrt(alpha t) )
 *   q''_s(t)   = k (T_s - T_i) / sqrt(pi alpha t)
 *
 * Sudden contact of two semi-infinite bodies: the interface jumps at once
 * to a temperature that never changes, weighted by THERMAL EFFUSIVITY
 * e = sqrt(k rho c):
 *
 *   T_contact = (e1 T1 + e2 T2) / (e1 + e2)
 *
 * This one line is why 20 degC tile feels cold and 20 degC carpet does not,
 * and why 60 degC steel burns while 60 degC wood is merely warm — the whole
 * "what your nerves actually measure" story, quantitative.
 *
 * Finite bodies (one-term approximation, valid Fo = alpha t / L_c^2 > 0.2):
 *
 *   theta_0/theta_i = C1 exp(-zeta1^2 Fo)
 *   plane wall:  zeta tan zeta = Bi,     theta/theta_0 = cos(zeta1 x*)
 *   sphere:      1 - zeta cot zeta = Bi, theta/theta_0 = sin(zeta1 r*)/(zeta1 r*)
 *
 * SI units throughout, matching the heat modules.
 */

/** Abramowitz–Stegun 7.1.26 rational approximation, |error| < 1.5e-7. */
export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

export const erfc = (x: number) => 1 - erf(x);

// ------------------------------------------------------- semi-infinite

export interface SemiInfParams {
  /** Thermal conductivity, W/(m K) */
  k: number;
  /** Density, kg/m^3 */
  rho: number;
  /** Specific heat, J/(kg K) */
  c: number;
  /** Initial body temperature, degC */
  Ti: number;
  /** Surface temperature imposed at t = 0, degC */
  Ts: number;
}

export function alphaOf(k: number, rho: number, c: number): number {
  return k / (rho * c);
}

/** T(x, t), degC, for depth x (m) at time t (s). */
export function semiInfT(p: SemiInfParams, x: number, t: number): number {
  const a = alphaOf(p.k, p.rho, p.c);
  return p.Ts + (p.Ti - p.Ts) * erf(x / (2 * Math.sqrt(a * t)));
}

/** Surface heat flux magnitude q''(t) = k (Ts - Ti) / sqrt(pi alpha t), W/m^2. */
export function semiInfFlux(p: SemiInfParams, t: number): number {
  const a = alphaOf(p.k, p.rho, p.c);
  return (p.k * (p.Ts - p.Ti)) / Math.sqrt(Math.PI * a * t);
}

/** Thermal penetration depth: where theta has recovered to 99% of Ti —
 *  delta = 3.65 sqrt(alpha t), m (the course's convention: "the distance
 *  which contains 99%", eta ~ 1.825). */
export function penetrationDepth(k: number, rho: number, c: number, t: number): number {
  return 3.65 * Math.sqrt(alphaOf(k, rho, c) * t);
}

// ------------------------------------------------------- sudden contact

export interface ContactBody {
  name: string;
  k: number;
  rho: number;
  c: number;
  /** This body's initial temperature, degC. */
  T: number;
}

/** Thermal effusivity e = sqrt(k rho c), W s^0.5 / (m^2 K). */
export function effusivity(k: number, rho: number, c: number): number {
  return Math.sqrt(k * rho * c);
}

/** The interface temperature the instant two semi-infinite bodies touch —
 *  and forever after, until a boundary is felt. */
export function contactTemp(a: ContactBody, b: ContactBody): number {
  const ea = effusivity(a.k, a.rho, a.c);
  const eb = effusivity(b.k, b.rho, b.c);
  return (ea * a.T + eb * b.T) / (ea + eb);
}

// ------------------------------------------------- one-term (Heisler)

export type TransientGeometry = 'wall' | 'sphere';

/** First eigenvalue zeta1 for the given Biot number, by bisection.
 *  Wall: zeta tan zeta = Bi on (0, pi/2). Sphere: 1 - zeta cot zeta = Bi
 *  on (0, pi). */
export function zeta1(geometry: TransientGeometry, Bi: number): number {
  const f =
    geometry === 'wall'
      ? (z: number) => z * Math.tan(z) - Bi
      : (z: number) => 1 - z / Math.tan(z) - Bi;
  let lo = 1e-9;
  let hi = (geometry === 'wall' ? Math.PI / 2 : Math.PI) - 1e-9;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (f(lo) * f(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/** One-term coefficient C1 for the given geometry and Biot number. */
export function coefC1(geometry: TransientGeometry, Bi: number): number {
  const z = zeta1(geometry, Bi);
  if (geometry === 'wall') {
    return (4 * Math.sin(z)) / (2 * z + Math.sin(2 * z));
  }
  return (4 * (Math.sin(z) - z * Math.cos(z))) / (2 * z - Math.sin(2 * z));
}

export interface HeislerParams {
  geometry: TransientGeometry;
  /** Half-thickness (wall) or radius (sphere), m. */
  L: number;
  /** Object conductivity, W/(m K) */
  k: number;
  /** Density, kg/m^3 */
  rho: number;
  /** Specific heat, J/(kg K) */
  c: number;
  /** Convection coefficient, W/(m^2 K) */
  h: number;
  /** Initial temperature, degC */
  Ti: number;
  /** Fluid temperature, degC */
  Tinf: number;
  /** Time, s */
  t: number;
}

export function biotOf(p: HeislerParams): number {
  return (p.h * p.L) / p.k;
}

export function fourierOf(p: HeislerParams): number {
  return (alphaOf(p.k, p.rho, p.c) * p.t) / (p.L * p.L);
}

/** Centre temperature at time t, degC (one-term; honest for Fo > 0.2). */
export function centerTemp(p: HeislerParams): number {
  const Bi = biotOf(p);
  const Fo = fourierOf(p);
  const z = zeta1(p.geometry, Bi);
  const C1 = coefC1(p.geometry, Bi);
  const theta0 = C1 * Math.exp(-z * z * Fo);
  return p.Tinf + (p.Ti - p.Tinf) * Math.min(1, theta0);
}

/** Temperature at dimensionless position xStar in [0, 1], degC. */
export function tempAt(p: HeislerParams, xStar: number): number {
  const Bi = biotOf(p);
  const z = zeta1(p.geometry, Bi);
  const shape =
    p.geometry === 'wall'
      ? Math.cos(z * xStar)
      : xStar < 1e-6
        ? 1
        : Math.sin(z * xStar) / (z * xStar);
  const T0 = centerTemp(p);
  return p.Tinf + (T0 - p.Tinf) * shape;
}
