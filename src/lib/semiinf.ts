/**
 * The semi-infinite medium: a surface condition switched on at t = 0, and a
 * front that marches into an otherwise untouched body as sqrt(t).
 *
 * Written in the course sheet's notation, which differs from lib/transient
 * on purpose: theta RISES from the initial state,
 *
 *   theta = (C - C0) / (Cs - C0)        0 deep inside, 1 at the surface
 *
 * so the held-surface solution reads as erfc rather than erf. Cargo-agnostic:
 * pass D for mass, alpha = k / (rho cp) for heat. The profile and the
 * penetration depth carry over between them by D -> alpha alone; a FLUX or an
 * AMOUNT also needs the transport coefficient (k) or rho cp, because
 * C -> rho cp T. That is the trap to avoid: substituting D -> alpha alone
 * into M/A gives K.m, not J/m^2.
 *
 * SURFACE HELD (Dirichlet):
 *
 *   eta = x / (2 sqrt(D t))
 *   theta = erfc(eta)                          one curve for every (x, t)
 *   j(0,t)  = (Cs - C0) sqrt(D / (pi t))       falls as 1/sqrt(t)
 *   M/A     = 2 (Cs - C0) sqrt(D t / pi)       grows as sqrt(t)
 *   delta   = 3.65 sqrt(D t)                   where theta = 0.01
 *
 * SURFACE FILM (Robin), -D dC/dx|0 = h (C_inf - C(0,t)):
 *
 *   theta = erfc(a) - exp(Bi + Bi^2 Fo) erfc(a + Bi sqrt(Fo))
 *   a = x / (2 sqrt(D t)),  Bi = h x / D,  Fo = D t / x^2
 *
 * with theta now referred to C_inf. The film introduces its own length scale,
 * D/h, so theta depends on TWO groups and the similarity collapse is lost —
 * profiles at different times no longer fall on one curve. That is the
 * honest reason the Appendix C semi-infinite-wall charts need Bi as a second
 * parameter, and the module shows it rather than asserting it.
 */

/**
 * Scaled complementary error function, erfcx(z) = exp(z^2) erfc(z), z >= 0.
 *
 * Numerical Recipes' Chebyshev fit for erfc, whose FRACTIONAL error is below
 * 1.2e-7 for every z. It is written as t exp(-z^2 + P(t)), so the exp(z^2)
 * cancels analytically and erfcx never overflows. That matters for the film
 * solution, where exp(Bi + Bi^2 Fo) erfc(...) multiplies a huge number by a
 * tiny one: computed literally it returns Infinity * 0 = NaN for a strong film
 * or a late time. Rewritten through erfcx every factor stays finite — the same
 * trap, and the same cure, as the fin's exponentials.
 *
 * (lib/transient's erf is Abramowitz-Stegun 7.1.26, whose 1.5e-7 bound is
 * ABSOLUTE; fine for erf, useless for erfc deep in the tail.)
 */
export function erfcx(z: number): number {
  if (z < 0) {
    // erfcx(-z) = 2 exp(z^2) - erfcx(z); only reached for tiny negatives here.
    return 2 * Math.exp(z * z) - erfcx(-z);
  }
  const t = 1 / (1 + 0.5 * z);
  const poly =
    -1.26551223 +
    t * (1.00002368 +
    t * (0.37409196 +
    t * (0.09678418 +
    t * (-0.18628806 +
    t * (0.27886807 +
    t * (-1.13520398 +
    t * (1.48851587 +
    t * (-0.82215223 +
    t * 0.17087277))))))));
  return t * Math.exp(poly);
}

/** erfc(z) with relative accuracy in the deep tail (unlike 1 - erf(z)). */
export function erfcAcc(z: number): number {
  if (z >= 0) return erfcx(z) * Math.exp(-z * z);
  return 2 - erfcx(-z) * Math.exp(-z * z);
}

/** erf(z), consistent with erfcAcc. */
export function erfAcc(z: number): number {
  return 1 - erfcAcc(z);
}

/** The similarity variable, eta = x / (2 sqrt(D t)). */
export function eta(x: number, D: number, t: number): number {
  if (t <= 0) return x > 0 ? Infinity : 0;
  return x / (2 * Math.sqrt(D * t));
}

/** Penetration depth to the course's 1 % criterion, delta = 3.65 sqrt(D t). */
export const DELTA_COEFF = 3.65;
export function penetration(D: number, t: number): number {
  return DELTA_COEFF * Math.sqrt(D * Math.max(0, t));
}

/* ------------------------------------------------------------------ *
 * Surface held (Dirichlet)
 * ------------------------------------------------------------------ */

/** theta(x, t) = erfc(eta), rising from 0 deep inside to 1 at the face. */
export function thetaHeld(x: number, D: number, t: number): number {
  if (t <= 0) return x <= 0 ? 1 : 0;
  return erfcAcc(eta(x, D, t));
}

/** Flux into the medium at the face, per unit (Cs - C0):
 *  j/(Cs - C0) = sqrt(D / (pi t)). Multiply by (Cs - C0) for mass; for
 *  heat use heldHeatFlux, which carries k. */
export function heldFluxPerUnit(D: number, t: number): number {
  return Math.sqrt(D / (Math.PI * t));
}

/** Cumulative amount per area that has crossed the face, per unit (Cs - C0):
 *  M/A/(Cs - C0) = 2 sqrt(D t / pi). */
export function heldAmountPerUnit(D: number, t: number): number {
  return 2 * Math.sqrt((D * Math.max(0, t)) / Math.PI);
}

/** Heat versions, which need k and rho cp — not D -> alpha alone.
 *  q(0,t) = k (Ts - T0) / sqrt(pi alpha t),  E/A = 2 rho cp (Ts - T0) sqrt(alpha t / pi). */
export function heldHeatFlux(k: number, alpha: number, dT: number, t: number): number {
  return (k * dT) / Math.sqrt(Math.PI * alpha * t);
}
export function heldHeatEnergy(rhoCp: number, alpha: number, dT: number, t: number): number {
  return 2 * rhoCp * dT * Math.sqrt((alpha * Math.max(0, t)) / Math.PI);
}

/* ------------------------------------------------------------------ *
 * Surface film (Robin)
 * ------------------------------------------------------------------ */

/**
 * theta(x, t) with a film of transfer coefficient h at the face, referred to
 * the bulk: theta = (C - C0)/(C_inf - C0).
 *
 *   theta = erfc(a) - exp(-a^2) erfcx(a + b)
 *   a = x / (2 sqrt(D t)),   b = (h / kappa) sqrt(D t)
 *
 * kappa is the transport coefficient in the flux law: D for mass (so
 * b = h_m sqrt(t / D)), k for heat with D read as alpha (so b = h sqrt(alpha
 * t) / k) — the sheet's Bi sqrt(Fo) in both cases.
 *
 * The exp(-a^2) erfcx(a + b) form is the sheet's exp(Bi + Bi^2 Fo) erfc(a +
 * Bi sqrt Fo) with the exponents combined: (a + b)^2 - a^2 = Bi + Bi^2 Fo.
 * Literal evaluation overflows; this does not.
 */
export function thetaFilm(x: number, D: number, h: number, kappa: number, t: number): number {
  if (t <= 0) return 0;
  const a = eta(x, D, t);
  const b = (h / kappa) * Math.sqrt(D * t);
  return erfcAcc(a) - Math.exp(-a * a) * erfcx(a + b);
}

/** The face itself: theta(0, t) = 1 - erfcx(b). Starts at 0 and creeps
 *  toward 1, where the held surface would have jumped there at once. */
export function surfaceFilm(D: number, h: number, kappa: number, t: number): number {
  if (t <= 0) return 0;
  const b = (h / kappa) * Math.sqrt(D * t);
  return 1 - erfcx(b);
}

/** Flux through the film into the medium, per unit (C_inf - C0), as a
 *  multiple of h: j/(C_inf - C0) = h (1 - theta_s) = h erfcx(b). For heat
 *  this is q/(T_inf - T0) directly, with h the heat-transfer coefficient. */
export function filmFluxPerUnit(D: number, h: number, kappa: number, t: number): number {
  if (t <= 0) return h;
  const b = (h / kappa) * Math.sqrt(D * t);
  return h * erfcx(b);
}

/** The film's own length scale, kappa / h. Profiles collapse only once the
 *  front has gone far past it — the film has stopped mattering. */
export function filmLength(h: number, kappa: number): number {
  return kappa / h;
}
