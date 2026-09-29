/**
 * Elementary kinetic theory of gases — the statistical mechanics UNDER the
 * diffusion coefficient. Where lib/fick.ts takes D as given, this file says
 * where it comes from: molecules in a gas fly hundreds of diameters between
 * collisions (long mean free path), molecules in a liquid never leave contact
 * with their neighbors (caged rattling), and that one difference is the four
 * decades between D ~ 0.1 cm^2/s in air and D ~ 1e-5 cm^2/s in water.
 *
 * SI inputs (kg, m, Pa, K) because that is how the constants are tabulated;
 * gasDiffusivity converts its answer to cm^2/s to match the course's CGS
 * convention for mass transfer (lib/fick.ts, non-negotiable #6).
 */

export const KB = 1.380649e-23; // J/K

/** Boltzmann in CGS (erg/K), for the continuum side. Same constant as
 *  lib/fick.BOLTZMANN_CGS; re-derived here so this file stays standalone. */
export const BOLTZMANN_CGS = 1.380649e-16;

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

/* ------------------------------------------------------------------ *
 * The step length, and where it stops existing
 *
 * Everything above is the GAS side: a molecule flies a mean free path
 * lambda between collisions, and D = (1/3) lambda v_bar counts those
 * flights. That construction needs one thing to be true — lambda has to
 * be longer than the molecule itself. When it is not, there is no
 * "flight" to average over, the collision-volume picture has nothing to
 * count, and the honest description switches to a CONTINUUM: a sphere
 * dragged through a viscous fluid, with D = k_B T / zeta.
 *
 * lambda/d is what decides which of those two descriptions you are
 * allowed to use, and it is the quantity this module puts on screen for
 * both boxes.
 * ------------------------------------------------------------------ */

/**
 * Mean free path of a hard DISK gas — the 2D analogue of the formula
 * above, in whatever length unit `dCollision` is given in:
 *
 *   lambda = 1 / (2 sqrt(2) n d)
 *
 * The on-screen boxes are two-dimensional, so this — not the 3D
 * 1/(sqrt(2) pi n d^2) — is the law their measured flights should obey.
 * In 2D the swept "volume" per unit path is a WIDTH, and the density that
 * matters is a number per unit AREA.
 *
 * The width is 2d, not d, and that factor of two is easy to lose: map the
 * problem onto the test disk CENTER moving among exclusion circles of
 * radius d = r_test + r_target. A point hits such a circle if it passes
 * within d on either side, so the cross-section is that circle DIAMETER,
 * 2d. Writing 1/(sqrt2 n d) instead makes every prediction twice the truth;
 * the simulation caught it immediately (measured/predicted sat
 * at 0.5 across a tenfold range of density, flat — the signature of a wrong
 * constant rather than of a failing assumption).
 *
 * Like its 3D parent this is a DILUTE-gas result: it assumes a molecule
 * is far more likely to be flying than touching. Crowd the box and the
 * measured flight falls below it — which is the regime boundary showing
 * itself, not an error.
 */
export function meanFreePath2D(nPerArea: number, dCollision: number): number {
  return 1 / (2 * Math.SQRT2 * nPerArea * dCollision);
}

/** How many of its own diameters the molecule covers between collisions. */
export function stepRatio(lambda: number, dMolecule: number): number {
  return lambda / dMolecule;
}

export type StepRegime = 'dilute' | 'dense' | 'continuum';

/**
 * Which description of transport the step length licenses.
 *
 *   lambda/d > 100  'dilute'     textbook kinetic theory; air sits at ~180
 *   1 to 100        'dense'      flights still exist but are short, and the
 *                                dilute formula starts to overpredict them
 *   below 1         'continuum'  no free flight at all: the molecule never
 *                                clears its own body before being turned
 *                                around, so nothing is left to count and
 *                                drag takes over as the honest description
 *
 * The boundary that matters is lambda/d = 1. The 100 is a soft marker for
 * where the dilute assumption is comfortable rather than merely survivable.
 */
export function stepRegime(lambdaOverD: number): StepRegime {
  if (lambdaOverD < 1) return 'continuum';
  if (lambdaOverD > 100) return 'dilute';
  return 'dense';
}

/**
 * Stokes drag coefficient zeta = 6 pi mu a, CGS (g/s): the constant tying
 * drag force to velocity, F = zeta v. Kept separate from Stokes-Einstein
 * on purpose — it is the ONLY place 6 pi mu a enters diffusion, and the
 * point of the continuum view is to show it entering.
 */
export function dragCoefficient(aCm: number, muPoise: number): number {
  return 6 * Math.PI * muPoise * aCm;
}

/**
 * The Einstein relation, D = k_B T / zeta, cm^2/s. Thermal agitation in the
 * numerator, dissipation in the denominator — the fluctuation-dissipation
 * statement that the same molecular buffeting which drives the walk is what
 * resists it. Feed it zeta = 6 pi mu a and you have Stokes-Einstein
 * (lib/fick's stokesEinstein); verify.ts pins that identity.
 */
export function einsteinD(zeta: number, TKelvin: number): number {
  return (BOLTZMANN_CGS * TKelvin) / zeta;
}

/**
 * Exact Ornstein-Uhlenbeck update coefficients for the Langevin velocity
 *
 *     m dv = -zeta v dt + sqrt(2 zeta k_B T) dW,   tau_p = m / zeta
 *
 * advanced by a step h as  v' = decay * v + kick * N(0,1).
 *
 * "Exact" means the update reproduces the true stationary distribution and
 * autocorrelation at ANY h, rather than converging to them as h -> 0: the
 * stationary variance is k_B T / m for every step size, and the velocity
 * autocorrelation over h is exactly exp(-h/tau_p). That matters here because
 * the continuum view has to stay honest at whatever frame rate it is handed.
 *
 * Integrating x with this v gives a walk whose long-time diffusivity is
 * D = k_B T / zeta — the Einstein relation, emerging from the trajectory
 * rather than being imposed on it. verify.ts marches this and measures it.
 */
export function ouCoefficients(h: number, tauP: number, kT: number, m: number) {
  const decay = Math.exp(-h / tauP);
  return { decay, kick: Math.sqrt(kT / m) * Math.sqrt(1 - decay * decay) };
}
