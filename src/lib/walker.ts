/**
 * One random walker with a drift — the Langevin step behind every diffusion
 * module, followed for a SINGLE particle instead of averaged into a
 * concentration field. Position x, drift v, diffusivity D:
 *
 *   dx = v dt + sqrt(2D) dW          (Euler–Maruyama: x += v dt + sqrt(2 D dt) Z)
 *
 * The ensemble of such walkers obeys the advection–diffusion equation
 *
 *   dC/dt + v dC/dx = D d^2C/dx^2,   C(x, 0) = delta(x)
 *
 * whose solution is a Gaussian that slides at v and widens as sqrt(2Dt):
 *
 *   C(x, t) = exp(-(x - vt)^2 / 4Dt) / sqrt(4 pi D t)
 *
 * Drift distance grows as t, spread only as sqrt(t), so at any horizon T a
 * single dimensionless ratio decides whether a walker's fate is noise or
 * destiny — the Péclet number again, with sqrt(2DT) standing in for L:
 *
 *   Pe(T) = vT / sqrt(2DT),   crossover (Pe = 1) at T* = 2D / v^2
 *
 * Bachelier wrote this equation down for prices in 1900, five years before
 * Einstein derived it for pollen. In log-price coordinates the mapping is
 * exact: v = mu - sigma^2/2 (the Itô correction), D = sigma^2/2, and
 * Pe(T) = (v/sqrt(2D)) sqrt(T) — a Sharpe-like ratio per root-year.
 *
 * Units: the transport face uses CGS (cm, s, cm^2/s) like the mass-transfer
 * modules; the price face uses years and per-year fractions.
 */

import { erf } from './transient';

export interface WalkerParams {
  /** Drift velocity, cm/s (or log-price drift per year). */
  v: number;
  /** Diffusivity, cm^2/s (or sigma^2/2 per year). */
  D: number;
  /** Horizon, s (or years). */
  T: number;
}

/** Where the ensemble's center is at time t. */
export function meanPosition(v: number, t: number): number {
  return v * t;
}

/** The ensemble's standard deviation at time t: sqrt(2Dt). */
export function spread(D: number, t: number): number {
  return Math.sqrt(Math.max(0, 2 * D * t));
}

/**
 * Drift distance over spread at time t — a Péclet number with the diffusion
 * length as L. Zero for no drift; infinite for a drift with no wander.
 */
export function driftToSpread(v: number, D: number, t: number): number {
  if (t <= 0) return 0;
  const s = spread(D, t);
  if (s === 0) return v === 0 ? 0 : Math.sign(v) * Infinity;
  return (v * t) / s;
}

/** The time at which drift distance first equals the spread: T* = 2D/v^2. */
export function crossoverTime(v: number, D: number): number {
  if (v === 0) return Infinity;
  return (2 * D) / (v * v);
}

/** Gaussian solution of the advection–diffusion equation for a point release. */
export function density(x: number, v: number, D: number, t: number): number {
  if (t <= 0 || D <= 0) return 0;
  const s2 = 2 * D * t;
  const dx = x - v * t;
  return Math.exp(-(dx * dx) / (2 * s2)) / Math.sqrt(2 * Math.PI * s2);
}

/** One Euler–Maruyama step; z is a standard normal draw. */
export function stepWalker(x: number, v: number, D: number, dt: number, z: number): number {
  return x + v * dt + Math.sqrt(2 * D * dt) * z;
}

/** Standard normal CDF, via the erf the transient module already checks. */
export function normalCdf(z: number): number {
  if (!Number.isFinite(z)) return z > 0 ? 1 : 0;
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Probability the walker sits ahead of its start (x > 0) at time t. */
export function probabilityAhead(v: number, D: number, t: number): number {
  return normalCdf(driftToSpread(v, D, t));
}

// ------------------------------------------------------------ the price face

/**
 * Bachelier's dictionary: a price with expected return mu and volatility
 * sigma (both per year, as fractions) is a walker in log-price whose drift
 * is mu - sigma^2/2 and whose diffusivity is sigma^2/2.
 */
export function priceToWalk(mu: number, sigma: number): { v: number; D: number } {
  return { v: mu - (sigma * sigma) / 2, D: (sigma * sigma) / 2 };
}

/** The dictionary read backwards. */
export function walkToPrice(v: number, D: number): { mu: number; sigma: number } {
  return { mu: v + D, sigma: Math.sqrt(2 * D) };
}

/**
 * The ratio finance calls the Sharpe ratio, evaluated at a horizon: excess
 * return per unit of volatility, times sqrt(T). It IS driftToSpread for the
 * price walker (up to the Itô correction in the drift).
 */
export function sharpeAtHorizon(muExcess: number, sigma: number, T: number): number {
  if (sigma <= 0) return muExcess === 0 ? 0 : Math.sign(muExcess) * Infinity;
  return (muExcess / sigma) * Math.sqrt(Math.max(0, T));
}
