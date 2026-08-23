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
 *   theta(x)/theta_0 = cosh(m(L - x)) / cosh(mL)
 *   Q_fin = sqrt(h P k A) * theta_0 * tanh(mL)
 *
 * The one number that matters is mL. Small mL: the fin is nearly
 * isothermal and every added centimetre helps. Large mL: the far end has
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

/** Temperature at distance x from the base, degC (insulated tip). */
export function finTemp(p: FinParams, x: number): number {
  const mL = finML(p);
  const xi = x / p.L;
  // cosh(m(L-x))/cosh(mL), computed stably for large mL.
  let shape: number;
  if (mL > 30) {
    shape = Math.exp(-mL * xi); // the infinite-fin limit
  } else {
    shape = Math.cosh(mL * (1 - xi)) / Math.cosh(mL);
  }
  return p.Tinf + (p.T0 - p.Tinf) * shape;
}

/** Heat the fin actually moves, W. */
export function finHeat(p: FinParams): number {
  const { P, A } = finSection(p);
  return Math.sqrt(p.h * P * p.k * A) * (p.T0 - p.Tinf) * Math.tanh(finML(p));
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
