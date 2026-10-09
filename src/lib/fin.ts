/**
 * The fin: a rod (pin) or plate (rect) of length L sticking out of a hot
 * base, losing heat to the surrounding fluid along its whole surface.
 *
 * Conduction along the fin feeds convection off its sides:
 *
 *   d2T/dx2 = m^2 (T - Tinf),   m = sqrt(h P / k A) = sqrt(2h / kR)
 *
 * With the insulated-tip boundary condition (the standard classroom
 * closure; a convecting tip is absorbed by the corrected length L + R/2):
 *
 *   theta(x)/theta_0 = (e^-mx + e^-2mL e^mx) / (1 + e^-2mL)
 *   Q_fin = sqrt(h P k A) * theta_0 * (1 - e^-2mL)/(1 + e^-2mL)
 *
 * written in exponentials, as the course sheet carries them. The hyperbolic
 * forms are the same expressions folded up; the exponential ones show where
 * they came from — two roots of the ODE, A1 e^mx + A2 e^-mx, with the tip
 * condition fixing A1 = A2 e^-2mL.
 *
 * The one number that matters is mL. Small mL: the fin is nearly
 * isothermal and every added centimeter helps. Large mL: the far end has
 * already reached the fluid temperature and transfers nothing — the
 * frying-pan-handle regime, and the reason you can grab one.
 *
 * SI units, matching the heat modules.
 */

export interface FinParams {
  /** Convection coefficient, W/(m^2 K) */
  h: number;
  /** Fin conductivity, W/(m K) */
  k: number;
  /** Fin radius, m (pin cross-section) */
  R: number;
  /** Fin length, m */
  L: number;
  /** Base temperature, degC */
  T0: number;
  /** Fluid temperature, degC */
  Tinf: number;
  /** Cross-section: 'pin' (default) is a rod of radius R; 'rect' is a
   *  plate fin of width w and thickness t (R is then ignored). */
  shape?: 'pin' | 'rect';
  /** Plate width (spanwise), m. rect only. */
  w?: number;
  /** Plate thickness, m. rect only. */
  t?: number;
}

/** Cross-section perimeter (m) and area (m^2). Everything downstream —
 *  m, Q, effectiveness — differs between pin and plate ONLY through
 *  these two numbers. That is the whole lesson of the shape toggle. */
export function finSection(p: FinParams): { P: number; A: number } {
  if (p.shape === 'rect') {
    const w = p.w ?? 0.04;
    const t = p.t ?? 0.002;
    return { P: 2 * (w + t), A: w * t };
  }
  return { P: 2 * Math.PI * p.R, A: Math.PI * p.R * p.R };
}

/** The fin parameter m = sqrt(hP/kA), 1/m. Pin: sqrt(2h/kR); a thin
 *  wide plate (w >> t) tends to sqrt(2h/kt). */
export function finM(p: FinParams): number {
  const { P, A } = finSection(p);
  return Math.sqrt((p.h * P) / (p.k * A));
}

/** The dimensionless product mL — the fin's whole personality. */
export function finML(p: FinParams): number {
  return finM(p) * p.L;
}

/** Temperature at distance x from the base, degC (insulated tip).
 *
 * The profile in the exponential form the course sheet carries:
 *
 *   (T - Tinf)/(T0 - Tinf) = (e^-mx + e^-2mL e^mx) / (1 + e^-2mL)
 *
 * COMPUTED as e^-mx + e^-m(2L-x) over 1 + e^-2mL, which is the same
 * expression with the second term's exponents already combined. That matters:
 * written literally, e^mx overflows for a long fin while e^-2mL underflows,
 * and the product they were supposed to form is lost. Combined, every
 * exponent is <= 0 for 0 <= x <= L, so nothing overflows at any mL and the
 * long-fin limit falls out on its own as e^-2mL -> 0 — no special case for
 * large mL, which the hyperbolic version needed.
 */
export function finTemp(p: FinParams, x: number): number {
  const mL = finML(p);
  const xi = x / p.L;
  const shape =
    (Math.exp(-mL * xi) + Math.exp(-mL * (2 - xi))) / (1 + Math.exp(-2 * mL));
  return p.Tinf + (p.T0 - p.Tinf) * shape;
}

/** Heat the fin actually moves, W — the gradient at the base, -kA dT/dx|0:
 *
 *   Q = sqrt(h P k A) (T0 - Tinf) (1 - e^-2mL) / (1 + e^-2mL)
 *
 * The trailing factor is tanh(mL) wearing the sheet's clothes. It runs from 0
 * (no fin) to 1 (the long fin, where the tip has already reached the fluid
 * and extra length earns nothing). */
export function finHeat(p: FinParams): number {
  const { P, A } = finSection(p);
  const e = Math.exp(-2 * finML(p));
  return Math.sqrt(p.h * P * p.k * A) * (p.T0 - p.Tinf) * ((1 - e) / (1 + e));
}

/** The same base area, bare: what the fin is competing against, W. */
export function bareHeat(p: FinParams): number {
  const { A } = finSection(p);
  return p.h * A * (p.T0 - p.Tinf);
}

/** Fin effectiveness: Q_fin / Q_bare. Below ~2 the fin is not earning
 *  its material. */
export function finEffectiveness(p: FinParams): number {
  return finHeat(p) / bareHeat(p);
}
