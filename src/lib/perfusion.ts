/**
 * The perfused channel: fluid flows along a channel whose floor is a layer
 * of cells (thickness h2) consuming a solute at a constant rate R (zeroth
 * order — cells take what they need until there is nothing left).
 *
 * Two transport jobs are chained together, and either can fail:
 *
 *  1. INTO the tissue (y, diffusion vs consumption). At axial station x,
 *     with supply concentration Cs(x) at the fluid-tissue interface and a
 *     no-flux floor at y = h2:
 *
 *        C(x, y) = Cs(x) - (R/D) (h2 y - y^2/2)
 *        C_min(x) = Cs(x) - R h2^2 / 2D          (at the floor)
 *
 *  2. ALONG the channel (x, convection vs total uptake). The flow arrives
 *     carrying Q C0 and the tissue drains R h2 W per unit length:
 *
 *        Q dCs/dx = -R h2 W  =>  Cs(x) = C0 - R h2 W x / Q
 *
 * The most starved point is therefore the FAR END, at the BOTTOM — the
 * "lethal corner" of bioreactor design. Cells die wherever C < C_crit,
 * and the first casualty is always that corner:
 *
 *        x* = (C0 - C_crit - R h2^2/2D) Q / (R h2 W)
 *
 * Axial diffusion is neglected; the Pe readout justifies it (typically
 * ~1e5 at the default setup).
 *
 * CGS units, matching the mass modules: cm, cm^2/s, mol/cm^3 (displayed
 * as mM), cm^3/s.
 */

export interface PerfusionParams {
  /** Solute diffusivity (fluid and tissue alike, the usual simplification), cm^2/s */
  D: number;
  /** Mean flow velocity in the channel, cm/s */
  v: number;
  /** Channel (fluid) height, cm */
  h1: number;
  /** Tissue layer thickness, cm */
  h2: number;
  /** Channel width, cm */
  W: number;
  /** Channel length, cm */
  L: number;
  /** Inlet concentration, mol/cm^3 */
  C0: number;
  /** Consumption rate, mol/(cm^3 s) */
  R: number;
  /** Cells die below this, mol/cm^3 */
  Ccrit: number;
}

/** Volumetric flow rate, cm^3/s. */
export function flowQ(p: PerfusionParams): number {
  return p.v * p.h1 * p.W;
}

/** Supply concentration at the fluid–tissue interface, station x. */
export function supplyC(p: PerfusionParams, x: number): number {
  return p.C0 - (p.R * p.h2 * p.W * x) / flowQ(p);
}

/** Concentration inside the tissue at station x, depth y in [0, h2]. */
export function tissueC(p: PerfusionParams, x: number, y: number): number {
  return supplyC(p, x) - (p.R / p.D) * (p.h2 * y - (y * y) / 2);
}

/** The floor of the tissue at station x — the worst place at that x. */
export function minC(p: PerfusionParams, x: number): number {
  return supplyC(p, x) - (p.R * p.h2 * p.h2) / (2 * p.D);
}

/** The drop the tissue itself costs, independent of x. */
export function tissueDrop(p: PerfusionParams): number {
  return (p.R * p.h2 * p.h2) / (2 * p.D);
}

/**
 * Where death begins: the x at which the tissue floor first hits C_crit.
 * Beyond L means everyone lives; negative means even the inlet corner is
 * dead.
 */
export function deathOnset(p: PerfusionParams): number {
  return ((p.C0 - p.Ccrit - tissueDrop(p)) * flowQ(p)) / (p.R * p.h2 * p.W);
}

/** Fraction of the tissue floor that is alive, 0..1. */
export function aliveFraction(p: PerfusionParams): number {
  const xs = deathOnset(p);
  return Math.max(0, Math.min(1, xs / p.L));
}

/** Axial Peclet number — the license for dropping axial diffusion. */
export function axialPeclet(p: PerfusionParams): number {
  return (p.v * p.L) / p.D;
}

/** Fraction of the incoming solute the tissue consumes (if all lives). */
export function extraction(p: PerfusionParams): number {
  return (p.R * p.h2 * p.W * p.L) / (flowQ(p) * p.C0);
}
