/**
 * Elementary kinetic theory of gases — the statistical mechanics UNDER the
 * diffusion coefficient. Where lib/fick.ts takes D as given, this file says
 * where it comes from: molecules in a gas fly hundreds of diameters between
 * collisions (long mean free path), molecules in a liquid never leave contact
 * with their neighbours (caged rattling), and that one difference is the four
 * decades between D ~ 0.1 cm^2/s in air and D ~ 1e-5 cm^2/s in water.
 *
 * SI inputs (kg, m, Pa, K) because that is how the constants are tabulated;
 * gasDiffusivity converts its answer to cm^2/s to match the course's CGS
 * convention for mass transfer (lib/fick.ts, non-negotiable #6).
 */

export const KB = 1.380649e-23; // J/K

/** Nitrogen at room conditions — the worked example the cards use. */
export const N2 = {
  /** molecular mass, kg */
  m: 28.014 * 1.66054e-27,
  /** kinetic diameter, m */
  d: 3.7e-10,
};

/** Mean molecular speed from the Maxwell distribution, m/s:
 *  v_bar = sqrt(8 k T / pi m). */
export function meanSpeed(TKelvin: number, mKg: number): number {
  return Math.sqrt((8 * KB * TKelvin) / (Math.PI * mKg));
}

/** Mean free path in an ideal gas, m:
 *  lambda = k T / (sqrt(2) pi d^2 P). */
export function meanFreePath(TKelvin: number, PPa: number, dM: number): number {
  return (KB * TKelvin) / (Math.SQRT2 * Math.PI * dM * dM * PPa);
}

/** Collisions per second experienced by one molecule, 1/s: v_bar / lambda. */
export function collisionRate(
  TKelvin: number,
  PPa: number,
  dM: number,
  mKg: number,
): number {
  return meanSpeed(TKelvin, mKg) / meanFreePath(TKelvin, PPa, dM);
}

/** How many of its own diameters a molecule flies between collisions —
 *  the number this whole module exists to make visible. ~180 for air. */
export function flightInDiameters(TKelvin: number, PPa: number, dM: number): number {
  return meanFreePath(TKelvin, PPa, dM) / dM;
}

/**
 * Gas-phase self-diffusivity from elementary kinetic theory, cm^2/s:
 *  D = (1/3) lambda v_bar.
 * Lands within a factor of ~2 of measured values (the rigorous
 * Chapman–Enskog treatment closes the gap) — close enough to explain WHY
 * gas D sits near 0.1–1 cm^2/s while liquid D sits near 1e-5.
 */
export function gasDiffusivity(
  TKelvin: number,
  PPa: number,
  dM: number,
  mKg: number,
): number {
  const D_SI = (1 / 3) * meanFreePath(TKelvin, PPa, dM) * meanSpeed(TKelvin, mKg);
  return D_SI * 1e4; // m^2/s -> cm^2/s
}
