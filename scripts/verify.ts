/* Physics regression checks. Run: npx tsx scripts/verify.ts */
import {
  areaAt, concentration, domain, flux, holdup, mMToMolPerCm3,
  resistance, transferRate, stokesEinstein, stokesEinsteinRadius,
  type FickParams,
} from '../src/lib/fick';
import {
  areaAt as areaAtF, domain as domainF, gradient as gradientF,
  heatFlux, heatRate, resistance as resistanceF, temperature,
  thermalDiffusivity, type FourierParams,
} from '../src/lib/fourier';
import {
  dragForce, kinematicViscosity, poiseToPaS, profile as newtonProfile,
  shearRate, shearStress, velocity, type NewtonParams,
} from '../src/lib/newton';
import {
  concentration as unsteadyC, concentrationPoint, diffusionTime,
  peak as unsteadyPeak, peakPoint, sigma as unsteadySigma, sigmaPoint,
  type UnsteadyParams,
} from '../src/lib/unsteady';
import {
  biot, halfLife, heatRate as coolQ, massFlux, tau,
  temperature as coolT, totalEnergy, type CoolingParams,
} from '../src/lib/cooling';
import {
  budget, dominant, elements, heatRate as wallQ, nodeTemps,
  totalResistance, uValue, type WallParams,
} from '../src/lib/network';
import {
  alphaOf, biotOf, centerTemp, coefC1, contactTemp, effusivity, erf,
  fourierOf, penetrationDepth, semiInfFlux, semiInfT, tempAt,
  transientRegime, zeta1,
  type ContactBody, type HeislerParams, type SemiInfParams,
} from '../src/lib/transient';
import {
  area, drivingGradient, flowRate, hydraulicResistance, reynolds,
  shear, vAvg, velocity as pvel, vMax, wallShear, type PoiseuilleParams,
} from '../src/lib/poiseuille';
import {
  dragCoefficient, dragForce as stokesDrag, mass as stokesMass, netWeight,
  particleReynolds, settlingTime, terminalVelocity, timeConstant,
  velocityAt, type StokesParams,
} from '../src/lib/stokes';
import {
  concentration as pecC, convectionTime, diffusionTime as pecTdiff,
  peclet, theta, totalFlux, type PecletParams,
} from '../src/lib/peclet';
import {
  bareHeat, finEffectiveness, finHeat, finML, finTemp, type FinParams,
} from '../src/lib/fin';
import {
  FLUIDS, hOf, hmOf, nusselt, nusseltOf, prandtl, reynolds as corrRe,
  schmidt, sherwood, type CorrParams,
} from '../src/lib/correlations';
import {
  aliveFraction, axialPeclet, deathOnset, extraction, flowQ, minC,
  supplyC, tissueC, tissueDrop, type PerfusionParams,
} from '../src/lib/perfusion';
import {
  N2, collisionRate, flightInDiameters, gasDiffusivity, meanFreePath, meanSpeed,
} from '../src/lib/kinetics';
import {
  areaAvgT, areaAvgTNumeric, mixingCupT, mixingCupTNumeric, tempAt as mcTempAt,
  velocityAt as mcVelocityAt, type MixingCupParams,
} from '../src/lib/mixingcup';

let failures = 0;
/** Relative comparison. For a target of exactly zero the tolerance is
 *  absolute (there is no scale to be relative to). No Math.max(1, ...)
 *  floor: with it, every check against a value << 1 silently became an
 *  absolute comparison and could not catch the value being wrong by orders
 *  of magnitude — the audit of Aug 2026 found the flux checks vacuous. */
const close = (a: number, b: number, tol = 1e-6) => {
  if (b === 0) return Math.abs(a) <= tol;
  return Math.abs(a - b) <= tol * Math.max(Math.abs(a), Math.abs(b));
};

function check(name: string, ok: boolean, detail = '') {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures++; console.log(`  FAIL  ${name}  ${detail}`); }
}

// --- 1. Transdermal drug delivery, worked by hand --------------------------
// D = 1e-8 cm^2/s, C_s = 7 mM = 7e-6 mol/cm^3, L = 100 um = 0.01 cm, A = 1 cm^2
// j = D dC/L = 1e-8 * 7e-6 / 0.01 = 7e-12 mol/cm^2/s
// holdup = average C * volume = 3.5e-6 * 0.01 = 3.5e-8 mol
const skin: FickParams = {
  geometry: 'slab', D: 1e-8, C1: mMToMolPerCm3(7), C2: 0,
  L: 0.01, A: 1, r1: 0.005, r2: 0.05,
};
console.log('Transdermal patch — drug through the epidermis');
check('flux = 7e-12 mol/cm^2/s', close(flux(skin, 0), 7e-12, 1e-9), String(flux(skin, 0)));
check('J = 7e-12 mol/s', close(transferRate(skin), 7e-12, 1e-9), String(transferRate(skin)));
check('holdup = 3.5e-8 mol', close(holdup(skin), 3.5e-8, 1e-6), String(holdup(skin)));
check('R_D = L/AD = 1e6 s/cm^3', close(resistance(skin), 1e6, 1e-9), String(resistance(skin)));

// --- 2. J is constant through the wall, in every geometry -----------------
// This is the whole content of steady-state species conservation.
console.log('\nJ constant across the wall (species conservation)');
for (const geometry of ['slab', 'cylinder', 'sphere'] as const) {
  const p: FickParams = {
    geometry, D: 3.2e-6, C1: mMToMolPerCm3(4.5), C2: mMToMolPerCm3(0.6),
    L: 2.4, A: 3.1, r1: 0.14, r2: 0.83,
  };
  const J = transferRate(p);
  const [a, b] = domain(p);
  let worst = 0;
  for (let i = 0; i <= 50; i++) {
    const s = a + ((b - a) * i) / 50;
    const local = flux(p, s) * areaAt(p, s);
    worst = Math.max(worst, Math.abs(local - J) / Math.abs(J));
  }
  check(`${geometry}: j(s)·A(s) = J everywhere`, worst < 1e-12, `worst rel. error ${worst}`);
}

// --- 3. Profile satisfies the governing ODE ------------------------------
// d/ds [ A(s) dC/ds ] = 0 at steady state with no generation.
console.log('\nProfile satisfies d/ds[A(s) dC/ds] = 0');
for (const geometry of ['slab', 'cylinder', 'sphere'] as const) {
  const p: FickParams = {
    geometry, D: 1e-5, C1: mMToMolPerCm3(9), C2: mMToMolPerCm3(1),
    L: 1.7, A: 2, r1: 0.3, r2: 1.9,
  };
  const [a, b] = domain(p);
  const h = (b - a) / 4000;
  const AdCds = (s: number) => areaAt(p, s) * (concentration(p, s + h) - concentration(p, s - h)) / (2 * h);
  let worst = 0;
  const ref = Math.abs(AdCds((a + b) / 2));
  for (let i = 5; i <= 45; i++) {
    const s = a + ((b - a) * i) / 50;
    worst = Math.max(worst, Math.abs(AdCds(s + h) - AdCds(s - h)) / ref);
  }
  check(`${geometry}: flat to ${worst.toExponential(1)}`, worst < 1e-5, `worst ${worst}`);
}

// --- 4. Boundary conditions are actually satisfied -----------------------
console.log('\nDirichlet boundary conditions');
for (const geometry of ['slab', 'cylinder', 'sphere'] as const) {
  const p: FickParams = {
    geometry, D: 1e-6, C1: mMToMolPerCm3(2.75), C2: mMToMolPerCm3(0.4),
    L: 0.9, A: 1, r1: 0.2, r2: 1.1,
  };
  const [a, b] = domain(p);
  check(`${geometry}: C(s₁) = C₁ and C(s₂) = C₂`,
    close(concentration(p, a), p.C1, 1e-12) && close(concentration(p, b), p.C2, 1e-12));
}

// --- 5. Analytic resistance formulas match ΔC/J --------------------------
console.log('\nResistance formulas');
for (const geometry of ['slab', 'cylinder', 'sphere'] as const) {
  const p: FickParams = {
    geometry, D: 7e-7, C1: mMToMolPerCm3(6), C2: mMToMolPerCm3(1.5),
    L: 3, A: 0.5, r1: 0.11, r2: 0.62,
  };
  check(`${geometry}: R = ΔC/J`,
    close(resistance(p), (p.C1 - p.C2) / transferRate(p), 1e-12));
}

// --- 6. Equal concentrations give zero net flux --------------------------
console.log('\nDegenerate cases');
const flat: FickParams = { ...skin, C2: skin.C1 };
check('C₁ = C₂ ⇒ J = 0', transferRate(flat) === 0);

// --- 7. Stokes-Einstein round trip, and Einstein's sugar result ----------
// Einstein's classic move: back-compute a ~1 nm molecular radius from a known D.
console.log('\nStokes–Einstein');
const mu = 0.01;      // water at ~20 C, poise
const T = 293.15;     // K
const a1nm = 1e-7;    // 1 nm in cm
const D1nm = stokesEinstein(a1nm, mu, T);
check('D(a = 1 nm) is ~2e-6 cm²/s', D1nm > 1e-6 && D1nm < 5e-6, D1nm.toExponential(2));
check('round trip a → D → a', close(stokesEinsteinRadius(D1nm, mu, T), a1nm, 1e-9));
// Albumin: D ~ 8e-7 cm^2/s should imply a few nm.
const aAlb = stokesEinsteinRadius(8e-7, mu, T) * 1e7;
check('albumin radius lands at a few nm', aAlb > 1 && aAlb < 10, `${aAlb.toFixed(2)} nm`);

// ==========================================================================
// Fourier's law
// ==========================================================================

// --- 8. Window pane, worked by hand ---------------------------------------
// k = 1.0 W/mK, L = 5 mm, A = 1 m^2, T1 = 20 C inside, T2 = 0 C outside
// R = L/kA = 0.005 K/W;  Q = 20/0.005 = 4000 W;  q'' = 4000 W/m^2
const pane: FourierParams = {
  geometry: 'slab', k: 1.0, T1: 20, T2: 0, L: 0.005, A: 1, r1: 0.02, r2: 0.05,
};
console.log('\nWindow pane, worked by hand');
check('R_th = 0.005 K/W', close(resistanceF(pane), 0.005, 1e-12), String(resistanceF(pane)));
check('Q = 4000 W', close(heatRate(pane), 4000, 1e-12), String(heatRate(pane)));
check("q'' = 4000 W/m^2", close(heatFlux(pane, 0), 4000, 1e-12), String(heatFlux(pane, 0)));
check('dT/dx = -4000 K/m', close(gradientF(pane, 0), -4000, 1e-9), String(gradientF(pane, 0)));

// --- 9. Insulated pipe (cylinder), worked by hand --------------------------
// k = 0.05, r1 = 2 cm, r2 = 5 cm, L = 1 m, 120 C -> 25 C
// R = ln(2.5)/(2 pi * 1 * 0.05) = 2.91664 K/W;  Q = 95/R = 32.572 W
const pipe: FourierParams = {
  geometry: 'cylinder', k: 0.05, T1: 120, T2: 25, L: 1, A: 1, r1: 0.02, r2: 0.05,
};
console.log('\nInsulated pipe, worked by hand');
check('R_th = 2.9166 K/W', close(resistanceF(pipe), 2.91664, 1e-4), String(resistanceF(pipe)));
check('Q = 32.57 W', close(heatRate(pipe), 32.5717, 1e-4), String(heatRate(pipe)));

// --- 10. Q constant across the wall, every geometry ------------------------
console.log('\nQ constant across the wall (energy conservation)');
for (const geometry of ['slab', 'cylinder', 'sphere'] as const) {
  const p: FourierParams = {
    geometry, k: 0.37, T1: 68, T2: 12.5, L: 0.4, A: 2.2, r1: 0.06, r2: 0.31,
  };
  const Q = heatRate(p);
  const [a, b] = domainF(p);
  let worst = 0;
  for (let i = 0; i <= 50; i++) {
    const s = a + ((b - a) * i) / 50;
    const local = heatFlux(p, s) * areaAtF(p, s);
    worst = Math.max(worst, Math.abs(local - Q) / Math.abs(Q));
  }
  check(`${geometry}: q''(s)*A(s) = Q everywhere`, worst < 1e-12, `worst rel. error ${worst}`);
}

// --- 11. Boundary conditions and resistance identity ------------------------
console.log('\nFourier Dirichlet BCs and R = dT/Q');
for (const geometry of ['slab', 'cylinder', 'sphere'] as const) {
  const p: FourierParams = {
    geometry, k: 4.2, T1: 55, T2: 21, L: 0.75, A: 1.4, r1: 0.09, r2: 0.4,
  };
  const [a, b] = domainF(p);
  check(`${geometry}: T(s1) = T1 and T(s2) = T2`,
    close(temperature(p, a), p.T1, 1e-12) && close(temperature(p, b), p.T2, 1e-12));
  check(`${geometry}: R = dT/Q`,
    close(resistanceF(p), (p.T1 - p.T2) / heatRate(p), 1e-12));
}
const isoT: FourierParams = { ...pane, T2: pane.T1 };
check('T1 = T2 => Q = 0', heatRate(isoT) === 0);

// --- 12. The mass<->heat analogy, literally --------------------------------
// Same geometry, same wall: the dimensionless profiles must be identical.
console.log('\nMass<->heat analogy: dimensionless profiles coincide');
for (const geometry of ['slab', 'cylinder', 'sphere'] as const) {
  const pm: FickParams = {
    geometry, D: 1e-6, C1: mMToMolPerCm3(8), C2: mMToMolPerCm3(2),
    L: 1.3, A: 1, r1: 0.2, r2: 0.9,
  };
  const ph: FourierParams = {
    geometry, k: 15, T1: 90, T2: 30, L: 1.3, A: 1, r1: 0.2, r2: 0.9,
  };
  const [a, b] = domainF(ph);
  let worst = 0;
  for (let i = 0; i <= 20; i++) {
    const s = a + ((b - a) * i) / 20;
    const thetaC = (concentration(pm, s) - pm.C1) / (pm.C2 - pm.C1);
    const thetaT = (temperature(ph, s) - ph.T1) / (ph.T2 - ph.T1);
    worst = Math.max(worst, Math.abs(thetaC - thetaT));
  }
  check(`${geometry}: theta_C(s) = theta_T(s)`, worst < 1e-12, `worst ${worst}`);
}

// --- 13. Thermal diffusivity of water --------------------------------------
// k = 0.6 W/mK, rho = 1000, cp = 4186 -> alpha = 1.43e-7 m^2/s. About 100x a
// typical solute D (1e-9 m^2/s = 1e-5 cm^2/s): heat outruns mass in water.
const alphaWater = thermalDiffusivity(0.6, 1000, 4186);
check('alpha(water) ~ 1.4e-7 m^2/s',
  alphaWater > 1.3e-7 && alphaWater < 1.6e-7, alphaWater.toExponential(2));

// ==========================================================================
// Newton's law of viscosity
// ==========================================================================

// --- 14. Slide on a water film, worked by hand ------------------------------
// mu = 1e-3 Pa s, U = 1 cm/s, H = 100 um, A = 20 cm^2
// du/dy = 100 /s;  tau = 0.1 Pa;  F = 2e-4 N
const film: NewtonParams = { mu: 1e-3, U: 0.01, H: 1e-4, A: 2e-3, rho: 1000 };
console.log('\nSlide on a water film, worked by hand');
check('du/dy = 100 /s', close(shearRate(film), 100, 1e-12), String(shearRate(film)));
check('tau = 0.1 Pa', close(shearStress(film), 0.1, 1e-12), String(shearStress(film)));
check('F = 2e-4 N', close(dragForce(film), 2e-4, 1e-12), String(dragForce(film)));

// --- 15. Honey on a knife, worked by hand -----------------------------------
// mu = 10 Pa s, U = 5 cm/s, H = 2 mm, A = 10 cm^2
// tau = 10 * 25 = 250 Pa;  F = 0.25 N
const honey: NewtonParams = { mu: 10, U: 0.05, H: 0.002, A: 1e-3, rho: 1400 };
console.log('\nHoney on a knife, worked by hand');
check('tau = 250 Pa', close(shearStress(honey), 250, 1e-12), String(shearStress(honey)));
check('F = 0.25 N', close(dragForce(honey), 0.25, 1e-12), String(dragForce(honey)));

// --- 16. Couette structure ---------------------------------------------------
console.log('\nCouette flow structure');
check('u(0) = 0 and u(H) = U',
  velocity(film, 0) === 0 && close(velocity(film, film.H), film.U, 1e-12));
const prof = newtonProfile(film, 40);
check('tau is the same at every height',
  prof.every((pt) => close(pt.tau, shearStress(film), 1e-12)));
check('U = 0 => tau = 0', shearStress({ ...film, U: 0 }) === 0);
check('nu(water) = 1e-6 m^2/s', close(kinematicViscosity(film), 1e-6, 1e-12));
check('1 poise = 0.1 Pa s', close(poiseToPaS(1), 0.1, 1e-12));

// ==========================================================================
// Unsteady diffusion (the time-release capsule)
// ==========================================================================

console.log('\nUnsteady diffusion: the spreading Gaussian');
const pulse: UnsteadyParams = { D: 1e-6, M: 1e-8, A: 1, t: 100, Lint: 0.01 };

// --- 17. Conservation: the area under C(x,t) is M/A at every instant -------
for (const t of [10, 100, 1000]) {
  const p = { ...pulse, t };
  const s = unsteadySigma(p.D, t);
  const h = (12 * s) / 4000;
  let area = 0;
  for (let i = 0; i < 4000; i++) {
    const x = -6 * s + h * (i + 0.5);
    area += unsteadyC(p, x) * h;
  }
  check(`area under C at t = ${t} s equals M/A`,
    close(area * p.A, p.M, 1e-6), String(area * p.A));
}

// --- 18. The solution satisfies dC/dt = D d2C/dx2 ---------------------------
{
  const p = pulse;
  const s = unsteadySigma(p.D, p.t);
  const dx = s / 200;
  const dtt = p.t / 1e6;
  let worst = 0;
  for (let i = -8; i <= 8; i++) {
    const x = i * s * 0.25;
    const dCdt = (unsteadyC({ ...p, t: p.t + dtt }, x) - unsteadyC({ ...p, t: p.t - dtt }, x)) / (2 * dtt);
    const d2C = (unsteadyC(p, x + dx) - 2 * unsteadyC(p, x) + unsteadyC(p, x - dx)) / (dx * dx);
    worst = Math.max(worst, Math.abs(dCdt - p.D * d2C) / Math.abs(unsteadyPeak(p) / p.t));
  }
  check('dC/dt = D d2C/dx2 (numerically)', worst < 1e-3, `worst ${worst}`);
}

// --- 19. Second moment: <x^2> = 2Dt, i.e. sigma = sqrt(2Dt) -----------------
{
  const p = { ...pulse, t: 5000, D: 1e-5 };
  const s = unsteadySigma(p.D, p.t);
  check('sigma(D = 1e-5, t = 5000 s) = 0.3162 cm', close(s, Math.sqrt(0.1), 1e-9), String(s));
  const h = (12 * s) / 4000;
  let m0 = 0, m2 = 0;
  for (let i = 0; i < 4000; i++) {
    const x = -6 * s + h * (i + 0.5);
    const c = unsteadyC(p, x);
    m0 += c * h;
    m2 += x * x * c * h;
  }
  check('<x^2> under the profile = 2Dt', close(m2 / m0, 2 * p.D * p.t, 1e-4), String(m2 / m0));
}

// --- 20. Peak halves when time quadruples (1/sqrt(t) decay) -----------------
check('C(0, 4t) = C(0, t)/2',
  close(unsteadyPeak({ ...pulse, t: 400 }), unsteadyPeak(pulse) / 2, 1e-12));

// --- 21. The diffusion clock, worked by hand --------------------------------
// 100 um at D = 1e-6: t = (0.01)^2 / (2e-6) = 50 s
// synapse, 20 nm at D = 4e-6: t = (2e-6)^2 / (8e-6) = 5e-7 s
// tea, 1 cm at D = 5e-6: t = 1e5 s ~ 28 h;  room, 3 m at D = 0.1: 4.5e5 s
console.log('\nThe diffusion clock, worked by hand');
check('100 um in tissue: 50 s', close(diffusionTime(0.01, 1e-6), 50, 1e-12));
check('synapse (20 nm): 0.5 us', close(diffusionTime(2e-6, 4e-6), 5e-7, 1e-9));
check('tea (1 cm, unstirred): 1e5 s', close(diffusionTime(1, 5e-6), 1e5, 1e-12));
check('still room (3 m): 4.5e5 s', close(diffusionTime(300, 0.1), 4.5e5, 1e-12));

// The heat-cargo presets run the SAME clock with alpha = k/(rho c) in cm^2/s:
// steel 45/(7800*490) = 1.18e-5 m^2/s = 0.118 cm^2/s; copper 400/(8960*385)
// = 1.16e-4 m^2/s = 1.16 cm^2/s; water 0.6/(1000*4186) = 1.43e-3 cm^2/s.
check('weld: back of a 1 cm steel plate in ~4 s',
  close(diffusionTime(1, 0.118), 4.24, 1e-2), String(diffusionTime(1, 0.118)));
check('copper handle: 10 cm in ~43 s',
  close(diffusionTime(10, 1.16), 43.1, 1e-2), String(diffusionTime(10, 1.16)));
check('steel handle of the same length: ~7 minutes',
  diffusionTime(10, 0.118) > 6 * 60 && diffusionTime(10, 0.118) < 8 * 60,
  String(diffusionTime(10, 0.118)));
check('still water: ~6 min per centimeter',
  close(diffusionTime(1, 1.43e-3), 350, 1e-2), String(diffusionTime(1, 1.43e-3)));

// --- 22. Point release: conservation in 3D ----------------------------------
{
  const D = 1e-6, t = 200, M = 1e-9;
  const s = Math.sqrt(2 * D * t);
  const h = (10 * s) / 4000;
  let total = 0;
  for (let i = 0; i < 4000; i++) {
    const r = h * (i + 0.5);
    total += concentrationPoint(M, D, t, r) * 4 * Math.PI * r * r * h;
  }
  check('point release: integral of C over all space = M', close(total, M, 1e-5), String(total));
}

// --- 22b. Point release: the depot injection, worked by hand ----------------
// M = 1 nmol at a point in tissue, D = 2e-6 cm^2/s, t = 1 h = 3600 s.
// sigma_r = sqrt(6 D t) = sqrt(0.0432) = 0.2078 cm ~ 2 mm.
// C(0) = M / (4 pi D t)^{3/2} = 1e-9 / 0.090478^{1.5} = 3.674e-8 mol/cm^3.
{
  const M = 1e-9, D = 2e-6, t = 3600;
  check('depot: sigma_r = sqrt(6Dt) = 0.208 cm (~2 mm in an hour)',
    close(sigmaPoint(D, t), 0.20785, 1e-4), String(sigmaPoint(D, t)));
  check('depot: C(0) = 3.674e-8 mol/cm^3',
    close(peakPoint(M, D, t), 3.674e-8, 1e-3), String(peakPoint(M, D, t)));
  check('peak falls as t^{-3/2}: C(0, 2t)/C(0, t) = 2^{-3/2}',
    close(peakPoint(M, D, 2 * t) / peakPoint(M, D, t), Math.pow(2, -1.5), 1e-9));
  check('sigma_r^2 = 3 x sigma_planar^2 — 2Dt per axis, three axes',
    close(sigmaPoint(D, t) ** 2, 3 * unsteadySigma(D, t) ** 2, 1e-12));
  // <r^2> = 6Dt by direct integration against the profile.
  const s1 = unsteadySigma(D, t);
  const h = (10 * s1) / 4000;
  let num = 0;
  for (let i = 0; i < 4000; i++) {
    const r = h * (i + 0.5);
    num += r * r * concentrationPoint(M, D, t, r) * 4 * Math.PI * r * r * h;
  }
  check('<r^2> integrates to 6Dt', close(num / M, 6 * D * t, 1e-4),
    `${num / M} vs ${6 * D * t}`);
  // The spherical diffusion equation: dC/dt = D (1/r^2) d/dr (r^2 dC/dr).
  const r0 = 0.7 * s1;
  const dr = 1e-4 * s1;
  const dtn = 1e-4 * t;
  const lhs = (concentrationPoint(M, D, t + dtn, r0) - concentrationPoint(M, D, t - dtn, r0)) / (2 * dtn);
  const flux2 = (r: number) =>
    r * r * ((concentrationPoint(M, D, t, r + dr) - concentrationPoint(M, D, t, r - dr)) / (2 * dr));
  const rhs = (D / (r0 * r0)) * ((flux2(r0 + dr) - flux2(r0 - dr)) / (2 * dr));
  check('satisfies the spherical diffusion equation', close(lhs, rhs, 1e-3),
    `${lhs} vs ${rhs}`);
}

// ==========================================================================
// Newton's law of cooling (lumped convection)
// ==========================================================================

// --- 23. Forgotten coffee, worked by hand -----------------------------------
// 250 mL of water (rho = 1000, cp = 4186), mug surface 0.05 m^2, still air
// h = 10 W/m^2 K:  tau = rho V cp / h A = 1046.5 / 0.5 = 2093 s ~ 35 min.
const mug: CoolingParams = {
  h: 10, A: 0.05, V: 2.5e-4, rho: 1000, cp: 4186, k: 0.6, T0: 90, Tinf: 22, t: 0,
};
console.log('\nForgotten coffee, worked by hand');
check('tau = 2093 s', close(tau(mug), 2093, 1e-4), String(tau(mug)));
check('T(tau) has closed 63.2% of the gap',
  close(coolT(mug, tau(mug)) - mug.Tinf, (mug.T0 - mug.Tinf) * Math.exp(-1), 1e-9));
check('half-life = tau ln 2', close(halfLife(mug), 2093 * Math.LN2, 1e-3));
check('Bi(coffee) < 0.1: lumped OK', biot(mug) < 0.1, String(biot(mug)));

// --- 24. The exponential actually solves the energy balance -----------------
{
  const dtn = tau(mug) / 1e6;
  let worst = 0;
  for (const t of [0, 500, 2000, 6000]) {
    const dTdt = (coolT(mug, t + dtn) - coolT(mug, t - dtn)) / (2 * dtn);
    const rhs = (-mug.h * mug.A * (coolT(mug, t) - mug.Tinf)) / (mug.rho * mug.V * mug.cp);
    worst = Math.max(worst, Math.abs(dTdt - rhs) / Math.abs(rhs || 1));
  }
  check('rho V cp dT/dt = -h A (T - Tinf)', worst < 1e-5, `worst ${worst}`);
}

// --- 25. Energy bookkeeping: integral of Q equals the stored energy ---------
{
  const T8 = 8 * tau(mug);
  const n = 20000;
  const hstep = T8 / n;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += coolQ(mug, hstep * (i + 0.5)) * hstep;
  const expected = totalEnergy(mug) * (1 - Math.exp(-8));
  check('integral of Q dt = rho V cp dT (to e^-8)',
    close(sum, expected, 1e-4), `${sum} vs ${expected}`);
}

// --- 26. Warming works too (thermometer), and Bi flags the roast ------------
const thermo: CoolingParams = {
  h: 100, A: 5.03e-5, V: 3.35e-8, rho: 2500, cp: 840, k: 1.0, T0: 22, Tinf: 37, t: 0,
};
check('thermometer tau ~ 14 s', tau(thermo) > 12 && tau(thermo) < 16, String(tau(thermo)));
check('thermometer warms toward Tinf', coolT(thermo, 60) > 36 && coolT(thermo, 60) < 37);
const roast: CoolingParams = {
  h: 15, A: 0.12, V: 3e-3, rho: 1050, cp: 3500, k: 0.45, T0: 80, Tinf: 22, t: 0,
};
check('Bi(roast) >> 0.1: lumped fails, and we say so', biot(roast) > 0.5, String(biot(roast)));

// --- 27. The mass twin -------------------------------------------------------
check('j = h_m dC, sign and magnitude',
  close(massFlux(1e-5, 2, 0.5), 1.5e-5, 1e-12) && massFlux(1e-5, 0.5, 2) < 0);

// ==========================================================================
// Resistance networks (the composite wall)
// ==========================================================================

// --- 28. Single vs double glazing, worked by hand ----------------------------
// 1 m^2 window, 20 C inside, 0 C outside, hIn = 8, hOut = 25 W/m^2 K.
// Single (4 mm glass, k = 1): R = 1/8 + 0.004 + 1/25 = 0.169 K/W, U = 5.92
// Double (glass + 12 mm still air k = 0.026 + glass):
//   R = 0.125 + 0.004 + 0.4615 + 0.004 + 0.040 = 0.6345 K/W, U = 1.576
console.log('\nSingle vs double glazing, worked by hand');
const single: WallParams = {
  layers: [{ name: 'Glass', k: 1.0, L: 0.004 }],
  A: 1, Tin: 20, Tout: 0, useFilmIn: true, hIn: 8, useFilmOut: true, hOut: 25,
};
const double: WallParams = {
  ...single,
  layers: [
    { name: 'Glass', k: 1.0, L: 0.004 },
    { name: 'Air gap', k: 0.026, L: 0.012 },
    { name: 'Glass', k: 1.0, L: 0.004 },
  ],
};
check('single: R = 0.169 K/W', close(totalResistance(single), 0.169, 1e-6), String(totalResistance(single)));
check('single: U = 5.92 W/m^2K', close(uValue(single), 1 / 0.169, 1e-6), String(uValue(single)));
check('double: R = 0.6345 K/W',
  close(totalResistance(double), 0.125 + 0.004 + 0.012 / 0.026 + 0.004 + 0.04, 1e-9),
  String(totalResistance(double)));
check('double: U ~ 1.58 W/m^2K', close(uValue(double), 1.576, 2e-3), String(uValue(double)));
check('the air gap dominates the budget',
  elements(double)[dominant(double).index].label === 'Air gap' && dominant(double).share > 0.7,
  `${dominant(double).share}`);

// --- 29. Circuit identities ---------------------------------------------------
{
  const temps = nodeTemps(double);
  const Q = wallQ(double);
  check('node temps start at Tin and end at Tout',
    close(temps[0], double.Tin, 1e-12) && close(temps[temps.length - 1], double.Tout, 1e-9));
  let ok = true;
  elements(double).forEach((e, i) => {
    if (!close(temps[i] - temps[i + 1], Q * e.R, 1e-9)) ok = false;
  });
  check('each element drops exactly Q*R_i', ok);
  check('budget shares sum to 1',
    close(budget(double).reduce((s, b) => s + b, 0), 1, 1e-12));
  check('film resistor matches the law of cooling: Q = hA dT when film is all there is',
    close(
      wallQ({ ...single, layers: [], useFilmOut: false }),
      single.hIn * single.A * (single.Tin - single.Tout),
      1e-12,
    ));
}

// ==========================================================================
// Transient conduction (semi-infinite, contact, one-term Heisler)
// ==========================================================================

// --- 30. erf against table values --------------------------------------------
console.log('\nTransient conduction');
check('erf(1) = 0.842701', close(erf(1), 0.8427007929, 1e-6), String(erf(1)));
check('erf(-x) = -erf(x)', close(erf(-0.5), -erf(0.5), 1e-12));
check('erf(2) = 0.995322', close(erf(2), 0.9953222650, 1e-6), String(erf(2)));

// --- 31. Semi-infinite solution: BCs, PDE, flux -------------------------------
const slabSI: SemiInfParams = { k: 0.37, rho: 1000, c: 3800, Ti: 33, Ts: 60 };
{
  const a = alphaOf(slabSI.k, slabSI.rho, slabSI.c);
  check('x = 0 face sits at Ts', close(semiInfT(slabSI, 0, 10), slabSI.Ts, 1e-9));
  check('deep interior still at Ti', close(semiInfT(slabSI, 0.05, 10), slabSI.Ti, 1e-6));
  // PDE: dT/dt = alpha d2T/dx2 at a few stations.
  const t0 = 30;
  const dx = 1e-5;
  const dtn = 1e-4;
  let worst = 0;
  for (const x of [0.0005, 0.001, 0.002]) {
    const dTdt = (semiInfT(slabSI, x, t0 + dtn) - semiInfT(slabSI, x, t0 - dtn)) / (2 * dtn);
    const d2T =
      (semiInfT(slabSI, x + dx, t0) - 2 * semiInfT(slabSI, x, t0) + semiInfT(slabSI, x - dx, t0)) /
      (dx * dx);
    worst = Math.max(worst, Math.abs(dTdt - a * d2T) / Math.abs(dTdt || 1));
  }
  check('semi-infinite T satisfies dT/dt = alpha d2T/dx2', worst < 1e-3, `worst ${worst}`);
  // Surface flux vs numerical gradient at the face.
  const qNum = -slabSI.k * ((semiInfT(slabSI, 1e-6, t0) - semiInfT(slabSI, 0, t0)) / 1e-6);
  check("q''_s = k dT/dx at the face (Ts hotter: flux INTO the body)",
    close(Math.abs(qNum), semiInfFlux(slabSI, t0), 1e-3),
    `${qNum} vs ${semiInfFlux(slabSI, t0)}`);
  check('penetration depth grows as sqrt(t)',
    close(penetrationDepth(slabSI.k, slabSI.rho, slabSI.c, 400),
      2 * penetrationDepth(slabSI.k, slabSI.rho, slabSI.c, 100), 1e-9));
}

// --- 32. Contact temperature: the 60 degC finger — the COURSE's own table -----
// Lecture "skin temperature" deck: skin k=0.21, rho=1200, cp=3600 (e ~ 952),
// finger at 37 degC, pain above 44 degC. Table values: steel (k=14.9,
// rho=7900, c=477, e ~ 7493) -> 57.4 degC; wood (0.16, 720, 1255, e ~ 380)
// -> 43.6 degC; aluminum (250, 2700, 903) -> 59.1 degC.
console.log('\nThe 60 degC finger — matching the course table');
const skinBody: ContactBody = { name: 'Skin', k: 0.21, rho: 1200, c: 3600, T: 37 };
const steel60: ContactBody = { name: 'Steel', k: 14.9, rho: 7900, c: 477, T: 60 };
const wood60: ContactBody = { name: 'Wood', k: 0.16, rho: 720, c: 1255, T: 60 };
const alu60: ContactBody = { name: 'Aluminum', k: 250, rho: 2700, c: 903, T: 60 };
check('e(skin) ~ 952', close(effusivity(0.21, 1200, 3600), 952, 2e-3), String(effusivity(0.21, 1200, 3600)));
check('steel at 60: contact ~ 57.4 degC', close(contactTemp(skinBody, steel60), 57.4, 2e-3), String(contactTemp(skinBody, steel60)));
check('wood at 60: contact ~ 43.6 degC (just under the 44 pain line)',
  close(contactTemp(skinBody, wood60), 43.6, 2e-3), String(contactTemp(skinBody, wood60)));
check('aluminum at 60: contact ~ 59.1 degC', close(contactTemp(skinBody, alu60), 59.1, 2e-3), String(contactTemp(skinBody, alu60)));
check('equal temperatures => contact at that temperature',
  close(contactTemp({ ...skinBody, T: 25 }, { ...steel60, T: 25 }), 25, 1e-12));

// --- 33. One-term eigenvalues against the standard tables ---------------------
console.log('\nOne-term (Heisler) coefficients vs tables');
check('wall Bi=1: zeta1 = 0.8603', close(zeta1('wall', 1), 0.8603, 2e-4), String(zeta1('wall', 1)));
check('wall Bi=1: C1 = 1.1191', close(coefC1('wall', 1), 1.1191, 2e-4), String(coefC1('wall', 1)));
check('wall Bi=10: zeta1 = 1.4289', close(zeta1('wall', 10), 1.4289, 2e-4), String(zeta1('wall', 10)));
check('sphere Bi=1: zeta1 = pi/2', close(zeta1('sphere', 1), Math.PI / 2, 2e-4), String(zeta1('sphere', 1)));
check('sphere Bi=1: C1 = 1.2732', close(coefC1('sphere', 1), 1.2732, 2e-4), String(coefC1('sphere', 1)));
// The limit's truncation term is O(Bi/3): zeta1^2 = Bi(1 - Bi/3 + ...), so
// at Bi = 0.01 the relative deviation is ~0.33% — real asymptotics, not error.
check('small Bi limit: zeta1^2 -> Bi (wall becomes lumped, to O(Bi/3))',
  close(zeta1('wall', 0.01) ** 2, 0.01, 5e-3), String(zeta1('wall', 0.01) ** 2));
// And the sphere's counterpart: zeta1^2 -> 3Bi, which is exactly what makes
// tau_lumped = rho c (R/3) / h fall out (V/A = R/3).
check('small Bi limit: zeta1^2 -> 3Bi (sphere becomes lumped, to O(Bi))',
  close(zeta1('sphere', 0.01) ** 2, 0.03, 5e-3), String(zeta1('sphere', 0.01) ** 2));

// --- 33b. The boiled egg, worked by hand ---------------------------------------
// 2 cm-radius egg (k = 0.5, rho = 1030, c = 3400) from 4 C into boiling
// water, h = 1200: Bi = hR/k = 48 (surface capitulates at once). At
// t = 560 s, Fo = alpha t / R^2 ~ 0.20 and the one-term solution puts the
// center near 71 C — a just-set yolk in about nine minutes.
{
  const egg: HeislerParams = {
    geometry: 'sphere', L: 0.02, k: 0.5, rho: 1030, c: 3400,
    h: 1200, Ti: 4, Tinf: 100, t: 560,
  };
  check('egg: Bi = 48', close(biotOf(egg), 48, 1e-9), String(biotOf(egg)));
  check('egg: Fo(560 s) ~ 0.20', close(fourierOf(egg), 0.2, 3e-2), String(fourierOf(egg)));
  const Tc = centerTemp(egg);
  check('egg center ~ 71 C after ~9 min', Tc > 68 && Tc < 74, String(Tc));
}

// --- 34. Heisler structure -----------------------------------------------------
{
  const p: HeislerParams = {
    geometry: 'wall', L: 0.02, k: 0.5, rho: 1050, c: 3500,
    h: 100, Ti: 5, Tinf: 95, t: 600,
  };
  check('Bi and Fo compute', close(biotOf(p), (100 * 0.02) / 0.5, 1e-12) && fourierOf(p) > 0);
  check('surface sits closer to the fluid than the center',
    Math.abs(tempAt(p, 1) - p.Tinf) < Math.abs(centerTemp(p) - p.Tinf));
  check('center approaches Tinf as t grows',
    Math.abs(centerTemp({ ...p, t: 20000 }) - p.Tinf) < 0.5);
  check('theta never exceeds 1 (clamped near t = 0)',
    Math.abs(centerTemp({ ...p, t: 1e-6 }) - p.Ti) < 1e-6);
}

// --- 34a2. Concrete wall in a heat wave (preset hand-check) ------------------
// alpha = 1.4/(2400*880) = 6.63e-7 m^2/s; Fo = 0.2 at t = 0.2*L^2/alpha ~ 50 min
// (the original blurb claimed ~8 hours — off by ~10x; caught in the Aug 2026
// audit). At the preset's t = 8 h, Fo ~ 1.9 and the midplane has closed about
// two-thirds of the 15->35 degC gap.
{
  const wall: HeislerParams = {
    geometry: 'wall', L: 0.1, k: 1.4, rho: 2400, c: 880,
    h: 10, Ti: 15, Tinf: 35, t: 3017,
  };
  check('concrete: Fo = 0.2 at ~50 min', close(fourierOf(wall), 0.2, 1e-2),
    String(fourierOf(wall)));
  check('concrete: Fo ~ 1.9 at 8 h', close(fourierOf({ ...wall, t: 28800 }), 1.909, 1e-2),
    String(fourierOf({ ...wall, t: 28800 })));
  const T8h = centerTemp({ ...wall, t: 28800 });
  check('concrete: midplane ~2/3 closed after 8 h', T8h > 27 && T8h < 28.5, String(T8h));
}

// --- 34b. The Bi-Fo triage ---------------------------------------------------
check('triage: small Bi, long time -> lumped', transientRegime(0.05, 5) === 'lumped');
check('triage: big Bi, early time -> semi-infinite', transientRegime(10, 0.05) === 'semi');
check('triage: small Bi AND early time -> either shortcut', transientRegime(0.05, 0.1) === 'either');
check('triage: the middle ground is the one-term page', transientRegime(1, 1) === 'oneterm');
check('triage boundaries are Bi = 0.1 and Fo = 0.2 exactly',
  transientRegime(0.1, 5) === 'oneterm' && transientRegime(5, 0.2) === 'oneterm');

// ==========================================================================
// Pressure-driven laminar flow (Poiseuille and friends)
// ==========================================================================

// --- 35. Water in a capillary, worked by hand ---------------------------------
// mu = 1e-3 Pa s, R = 0.5 mm, L = 10 cm, dP = 1000 Pa:
// Q = pi dP R^4 / 8 mu L = 2.454e-7 m^3/s ~ 0.245 mL/s; v-bar = 0.3125 m/s;
// v_max = 2 v-bar; Re = rho v-bar 2R / mu = 313 (laminar).
console.log('\nWater in a capillary, worked by hand');
const cap: PoiseuilleParams = {
  geometry: 'tube', mu: 1e-3, rho: 1000, dP: 1000, L: 0.1, R: 5e-4, h: 1e-3, W: 0.01,
};
check('Q = 2.454e-7 m^3/s', close(flowRate(cap), 2.4544e-7, 1e-4), String(flowRate(cap)));
check('v-bar = 0.3125 m/s', close(vAvg(cap), 0.3125, 1e-6), String(vAvg(cap)));
check('v_max = 2 v-bar (tube)', close(vMax(cap), 2 * vAvg(cap), 1e-12));
check('Re = 313, laminar', close(reynolds(cap), 312.5, 1e-3), String(reynolds(cap)));
check('R_hyd = dP/Q', close(hydraulicResistance(cap), cap.dP / flowRate(cap), 1e-9));

// --- 36. The R^4 law: shrink the radius 20%, keep 41% of the flow -------------
check('Q(0.8R)/Q(R) = 0.4096',
  close(flowRate({ ...cap, R: 0.8 * cap.R }) / flowRate(cap), 0.8 ** 4, 1e-12));

// --- 37. Q equals the integral of the profile, every geometry -----------------
console.log('\nQ = integral of v dA, all three geometries');
for (const geometry of ['tube', 'plates', 'film'] as const) {
  const p: PoiseuilleParams = {
    geometry, mu: 3e-3, rho: 1050, dP: 800, L: 0.2, R: 1e-3, h: 6e-4, W: 0.02,
  };
  const n = 20000;
  let q = 0;
  if (geometry === 'tube') {
    const dr = p.R / n;
    for (let i = 0; i < n; i++) {
      const r = dr * (i + 0.5);
      q += pvel(p, r) * 2 * Math.PI * r * dr;
    }
  } else {
    const ds = p.h / n;
    for (let i = 0; i < n; i++) q += pvel(p, ds * (i + 0.5)) * p.W * ds;
  }
  check(`${geometry}: integral matches flowRate()`, close(q, flowRate(p), 1e-6),
    `${q} vs ${flowRate(p)}`);
  const ratio = vMax(p) / vAvg(p);
  check(`${geometry}: v_max / v-bar = ${geometry === 'tube' ? 2 : 1.5}`,
    close(ratio, geometry === 'tube' ? 2 : 1.5, 1e-9), String(ratio));
}

// --- 38. Wall shear closes the force balance -----------------------------------
// Tube: tau_w (2 pi R L) = dP (pi R^2). Plates: tau_w (2 W L) = dP (W h).
// Film: tau_w = rho g h (the wall carries the film's whole weight).
console.log('\nWall shear force balances');
{
  const t: PoiseuilleParams = { ...cap };
  check('tube: tau_w 2piRL = dP piR^2',
    close(wallShear(t) * 2 * Math.PI * t.R * t.L, t.dP * Math.PI * t.R * t.R, 1e-9));
  const pl: PoiseuilleParams = { ...cap, geometry: 'plates' };
  check('plates: tau_w 2WL = dP W h',
    close(wallShear(pl) * 2 * pl.W * pl.L, pl.dP * pl.W * pl.h, 1e-9));
  const f: PoiseuilleParams = { ...cap, geometry: 'film' };
  check('film: tau_w = rho g h (wall holds the weight)',
    close(wallShear(f), f.rho * 9.81 * f.h, 1e-9));
  check('shear vanishes where the profile peaks',
    close(shear(t, 0), 0, 1e-12) && close(shear(pl, pl.h / 2), 0, 1e-12) &&
    close(shear(f, f.h), 0, 1e-12));
  check('no-slip: v = 0 at every wall',
    close(pvel(t, t.R), 0, 1e-12) && close(pvel(pl, 0), 0, 1e-12) &&
    close(pvel(pl, pl.h), 0, 1e-12) && close(pvel(f, 0), 0, 1e-12));
  check('film free surface: v is the maximum there',
    close(pvel(f, f.h), vMax(f), 1e-12));
  check('area() consistent with vAvg', close(vAvg(t) * area(t), flowRate(t), 1e-12));
  check('drivingGradient: film uses rho g', close(drivingGradient(f), f.rho * 9.81, 1e-12));
}

// ==========================================================================
// Stokes drag and settling
// ==========================================================================

// --- 39. A cell-sized particle, worked by hand ---------------------------------
// a = 1 um, rho_p = 1050, water: v_inf = 2 (50)(9.81) a^2 / 9 mu = 1.09e-7 m/s
// (~1 cm/day), tau = 2 rho_p a^2 / 9 mu = 2.33e-7 s, Re ~ 2e-7.
console.log('\nA cell-sized particle, worked by hand');
const cell: StokesParams = {
  a: 1e-6, rhoP: 1050, rhoF: 1000, mu: 1e-3, gFactor: 1, Lint: 0.01,
};
check('v_inf = 1.09e-7 m/s (~1 cm/day)',
  close(terminalVelocity(cell), 1.09e-7, 1e-3), String(terminalVelocity(cell)));
check('settles 1 cm in ~1 day',
  settlingTime(cell) > 0.8 * 86400 && settlingTime(cell) < 1.3 * 86400, String(settlingTime(cell)));
check('tau = 2.33e-7 s — terminal velocity is instant',
  close(timeConstant(cell), 2.333e-7, 1e-3), String(timeConstant(cell)));
check('Re ~ 2e-7: deep in the Stokes regime',
  particleReynolds(cell) < 1e-6, String(particleReynolds(cell)));

// --- 40. The centrifuge: v_inf scales with g -----------------------------------
check('at 100,000 g the same cell moves 1e5 times faster',
  close(terminalVelocity({ ...cell, gFactor: 1e5 }), 1e5 * terminalVelocity(cell), 1e-12));

// --- 41. Force balance and the ODE ----------------------------------------------
{
  const p = cell;
  check('at terminal velocity, drag = weight - buoyancy',
    close(stokesDrag(p.mu, p.a, terminalVelocity(p)), netWeight(p), 1e-9));
  // m dv/dt = F_net - 6 pi mu a v, checked numerically along v(t).
  const tau = timeConstant(p);
  const dtn = tau / 1e5;
  let worst = 0;
  for (const t of [0.1 * tau, tau, 3 * tau]) {
    const dvdt = (velocityAt(p, t + dtn) - velocityAt(p, t - dtn)) / (2 * dtn);
    const rhs = (netWeight(p) - stokesDrag(p.mu, p.a, velocityAt(p, t))) / stokesMass(p);
    worst = Math.max(worst, Math.abs(dvdt - rhs) / Math.abs(rhs || 1));
  }
  check('v(t) solves m dv/dt = F_net - 6 pi mu a v', worst < 1e-4, `worst ${worst}`);
  check('C_D (1/2 rho v^2)(pi a^2) = 6 pi mu a v when C_D = 24/Re',
    close(
      dragCoefficient(p) * 0.5 * p.rhoF * terminalVelocity(p) ** 2 * Math.PI * p.a ** 2,
      stokesDrag(p.mu, p.a, terminalVelocity(p)),
      1e-9,
    ));
}

// --- 42. Clinical and honest-failure presets ------------------------------------
const rbc: StokesParams = { a: 4e-6, rhoP: 1100, rhoF: 1025, mu: 1.6e-3, gFactor: 1, Lint: 0.01 };
{
  const mmPerHour = Math.abs(terminalVelocity(rbc)) * 1000 * 3600;
  check('RBC settles a few mm/h — the clinical ESR range',
    mmPerHour > 2 && mmPerHour < 15, `${mmPerHour} mm/h`);
}
const raindrop: StokesParams = { a: 1e-3, rhoP: 1000, rhoF: 1.2, mu: 1.8e-5, gFactor: 1, Lint: 1 };
check('1 mm raindrop: Stokes predicts >100 m/s — and Re >> 1 exposes the lie',
  Math.abs(terminalVelocity(raindrop)) > 100 && particleReynolds(raindrop) > 1000,
  `v = ${terminalVelocity(raindrop)}, Re = ${particleReynolds(raindrop)}`);

// ==========================================================================
// Peclet: convection vs diffusion in a channel
// ==========================================================================

console.log('\nPeclet channel, structure and limits');
const pore: PecletParams = { D: 1e-5, v: 3e-4, L: 0.1, C0: 5e-6, CL: 1e-6 };
check('Pe = vL/D = 3', close(peclet(pore), 3, 1e-12), String(peclet(pore)));
check('BCs: C(0) = C0, C(L) = CL',
  close(pecC(pore, 0), pore.C0, 1e-15) && close(pecC(pore, pore.L), pore.CL, 1e-15));

// --- 43. The profile solves v C' = D C'' -----------------------------------------
{
  const dx = pore.L / 1e5;
  let worst = 0;
  for (const xi of [0.2, 0.5, 0.8]) {
    const x = xi * pore.L;
    const C1 = (pecC(pore, x + dx) - pecC(pore, x - dx)) / (2 * dx);
    const C2 = (pecC(pore, x + dx) - 2 * pecC(pore, x) + pecC(pore, x - dx)) / (dx * dx);
    worst = Math.max(worst, Math.abs(pore.v * C1 - pore.D * C2) / Math.abs(pore.v * C1));
  }
  check("v C' = D C'' (numerically)", worst < 1e-4, `worst ${worst}`);
}

// --- 44. Total flux constant along the channel, matching the formula -------------
{
  const dx = pore.L / 1e5;
  const N = totalFlux(pore);
  let worst = 0;
  for (const xi of [0.1, 0.5, 0.9]) {
    const x = xi * pore.L;
    const C1 = (pecC(pore, x + dx) - pecC(pore, x - dx)) / (2 * dx);
    const local = pore.v * pecC(pore, x) - pore.D * C1;
    worst = Math.max(worst, Math.abs(local - N) / Math.abs(N));
  }
  check("N = vC - DC' is the same at every station", worst < 1e-4, `worst ${worst}`);
}

// --- 45. The limits ----------------------------------------------------------------
check('Pe -> 0: N -> D(C0-CL)/L + v(C0+CL)/2',
  close(
    totalFlux({ ...pore, v: 1e-12 }),
    (pore.D * (pore.C0 - pore.CL)) / pore.L + (1e-12 * (pore.C0 + pore.CL)) / 2,
    1e-6,
  ));
check('Pe >> 1: N -> v C0 (the upwind value rides the flow)',
  close(totalFlux({ ...pore, v: 1 }), 1 * pore.C0, 1e-6), String(totalFlux({ ...pore, v: 1 })));
check('theta stays finite at extreme Pe: 0 in the bulk, 1 at the outlet',
  Number.isFinite(theta(1e7, 0.5)) && theta(1e7, 0.5) === 0 &&
  close(theta(1e7, 1), 1, 1e-12) && theta(1e7, 1 - 1e-8) > 0);
check('the two clocks: Pe = 2 t_diff / t_conv',
  close(peclet(pore), (2 * pecTdiff(pore)) / convectionTime(pore), 1e-12));
check('perfume with a draft: Pe = 30,000',
  close(peclet({ D: 0.1, v: 10, L: 300, C0: 1e-9, CL: 0 }), 30000, 1e-12));

// ==========================================================================
// The pin fin
// ==========================================================================

// --- 46. Steel rod fin, worked by hand -----------------------------------------
// Steel k = 45, R = 4 mm, h = 50, L = 8 cm, base 80 C in 20 C air:
// m = sqrt(2*50/(45*0.004)) = 23.57 /m, mL = 1.886
// Q = sqrt(hPkA) dT tanh(mL) = 0.0533 * 60 * 0.955 ~ 3.05 W
console.log('\nSteel rod fin, worked by hand');
const rod: FinParams = { h: 50, k: 45, R: 0.004, L: 0.08, T0: 80, Tinf: 20 };
check('mL = 1.886', close(finML(rod), 1.8856, 1e-3), String(finML(rod)));
check('Q_fin ~ 3.05 W', close(finHeat(rod), 3.05, 5e-3), String(finHeat(rod)));
check('base sits at T0', close(finTemp(rod, 0), 80, 1e-12));
check('tip is cooler than base but warmer than air',
  finTemp(rod, rod.L) < 80 && finTemp(rod, rod.L) > 20, String(finTemp(rod, rod.L)));
{
  // Insulated tip: dT/dx = 0 at x = L.
  const dx = rod.L / 1e6;
  const slope = (finTemp(rod, rod.L) - finTemp(rod, rod.L - dx)) / dx;
  check('insulated tip: dT/dx ~ 0 at x = L', Math.abs(slope) < 1e-2, String(slope));
  // The fin ODE: T'' = m^2 (T - Tinf), checked numerically mid-fin.
  const x = rod.L / 2;
  const h2 = rod.L / 1e4;
  const T2 = (finTemp(rod, x + h2) - 2 * finTemp(rod, x) + finTemp(rod, x - h2)) / (h2 * h2);
  const rhs = finML(rod) ** 2 / rod.L ** 2 * (finTemp(rod, x) - rod.Tinf);
  check("fin ODE: T'' = m^2 (T - Tinf)", close(T2, rhs, 1e-4), `${T2} vs ${rhs}`);
}
check('long-fin limit: profile -> e^{-mx}',
  close(
    finTemp({ ...rod, L: 10 }, 0.1),
    rod.Tinf + (rod.T0 - rod.Tinf) * Math.exp(-Math.sqrt(2 * rod.h / (rod.k * rod.R)) * 0.1),
    1e-6,
  ), String(finTemp({ ...rod, L: 10 }, 0.1)));
check('effectiveness = Q_fin / Q_bare and is >> 1 here',
  close(finEffectiveness(rod), finHeat(rod) / bareHeat(rod), 1e-12) && finEffectiveness(rod) > 10,
  String(finEffectiveness(rod)));

// --- 46b. Rectangular (plate) fin, worked by hand ---------------------------
// Aluminum plate: k = 205, h = 20, w = 10 cm, t = 2 mm, L = 5 cm, theta0 = 80.
// P = 2(w + t) = 0.204 m, A = wt = 2e-4 m^2
// m = sqrt(hP/kA) = sqrt(4.08 / 0.041) = 9.9756 1/m, mL = 0.49878
// Q = sqrt(hPkA) * theta0 * tanh(mL) = 0.40900 * 80 * 0.46116 = 15.090 W
// T_tip = 20 + 80 / cosh(mL) = 90.99 degC
console.log('\nAluminum plate fin, worked by hand');
const plateFin: FinParams = {
  h: 20, k: 205, R: 0.004, L: 0.05, T0: 100, Tinf: 20,
  shape: 'rect', w: 0.1, t: 0.002,
};
check('m = 9.976 1/m', close(finML(plateFin) / plateFin.L, 9.9756, 1e-4),
  String(finML(plateFin) / plateFin.L));
check('Q_fin = 15.09 W', close(finHeat(plateFin), 15.090, 1e-3), String(finHeat(plateFin)));
check('tip at 90.99 degC', close(finTemp(plateFin, plateFin.L), 90.99, 1e-3),
  String(finTemp(plateFin, plateFin.L)));
check('thin-wide limit: m -> sqrt(2h/kt) within 1% when w >> t',
  close(finML(plateFin) / plateFin.L,
    Math.sqrt((2 * plateFin.h) / (plateFin.k * plateFin.t!)), 1.1e-2),
  String(Math.sqrt((2 * plateFin.h) / (plateFin.k * plateFin.t!))));
check("explicit shape:'pin' matches the legacy pin formulas",
  close(finML({ ...rod, shape: 'pin' }), finML(rod), 1e-12) &&
    close(finHeat({ ...rod, shape: 'pin' }), finHeat(rod), 1e-12));
check('plate effectiveness = Q_fin/Q_bare and is >> 1 here',
  close(finEffectiveness(plateFin), finHeat(plateFin) / bareHeat(plateFin), 1e-12) &&
    finEffectiveness(plateFin) > 10,
  String(finEffectiveness(plateFin)));

// ==========================================================================
// Nu & Sh correlations
// ==========================================================================

console.log('\nCorrelations against known values');
const air = FLUIDS[0];
const water = FLUIDS[1];
check('Pr(air) ~ 0.70', close(prandtl(air), 0.6965, 1e-3), String(prandtl(air)));
check('Pr(water) ~ 7', close(prandtl(water), 6.97, 1e-2), String(prandtl(water)));
{
  const p: CorrParams = { geometry: 'plate', fluid: water, v: 0.01, L: 0.1, D: 1e-9 };
  check('Sc(water, small solute) ~ 1000 — the liquid-phase signature',
    schmidt(p) > 900 && schmidt(p) < 1100, String(schmidt(p)));
}
check('plate: Nu(Re=1e4, Pr=0.7) = 58.9',
  close(nusseltOf('plate', 1e4, 0.7), 58.94, 2e-3), String(nusseltOf('plate', 1e4, 0.7)));
check('cylinder: Churchill-Bernstein Nu(1e4, 0.7) lands ~53',
  nusseltOf('cylinder', 1e4, 0.7) > 50 && nusseltOf('cylinder', 1e4, 0.7) < 57,
  String(nusseltOf('cylinder', 1e4, 0.7)));
check('tube turbulent: Dittus-Boelter Nu(1e4, 0.7) = 31.6',
  close(nusseltOf('tube', 1e4, 0.7), 31.62, 5e-3), String(nusseltOf('tube', 1e4, 0.7)));
check('tube laminar: Nu = 3.66, full stop', nusseltOf('tube', 1000, 7) === 3.66);

// --- The stagnant-sphere limit is EXACT, and matches the Fourier library ---
{
  const p: CorrParams = { geometry: 'sphere', fluid: water, v: 0, L: 0.01, D: 1e-9 };
  check('sphere at Re = 0: Nu = 2 exactly', close(nusselt(p), 2, 1e-12));
  const h = hOf(p); // = 2 k / d = k / R
  // Conduction from a sphere r1 into an infinite medium, via lib/fourier:
  // R_th -> 1/(4 pi k r1); h_equiv = 1/(R_th * 4 pi r1^2) = k/r1.
  const Rth = resistanceF({
    geometry: 'sphere', k: water.k, T1: 1, T2: 0, L: 1, A: 1, r1: 0.005, r2: 1e6,
  });
  const hCond = 1 / (Rth * 4 * Math.PI * 0.005 ** 2);
  check('Nu = 2 IS the infinite-medium conduction solution (cross-library)',
    close(h, hCond, 1e-4), `${h} vs ${hCond}`);
}

// --- Chilton-Colburn: Sh/Nu = (Sc/Pr)^{1/3} for the cbrt family -----------
{
  const p: CorrParams = { geometry: 'plate', fluid: water, v: 0.05, L: 0.2, D: 1e-9 };
  const ratio = sherwood(p) / nusselt(p);
  const cc = Math.cbrt(schmidt(p) / prandtl(p.fluid));
  check('plate: Sh/Nu = (Sc/Pr)^(1/3) exactly', close(ratio, cc, 1e-12), `${ratio} vs ${cc}`);
  check('h and h_m reconstruct from Nu and Sh',
    close(hOf(p), (nusselt(p) * water.k) / p.L, 1e-12) &&
    close(hmOf(p), (sherwood(p) * p.D) / p.L, 1e-12));
}

// ==========================================================================
// The perfused channel (lethal corner)
// ==========================================================================

// Hand-workable numbers: D = 2e-5 cm^2/s, v = 1 cm/s, h1 = 20 um, h2 = 25 um,
// W = 2 cm, L = 2 cm, C0 = 5e-6 mol/cm^3, R = 2e-6 mol/cm^3 s.
// Tissue drop: R h2^2 / 2D = 2e-6 * 6.25e-6 / 4e-5 = 3.125e-7.
// Q = 1 * 0.002 * 2 = 0.004 cm^3/s. Axial drain: R h2 W/Q = 2e-6*0.0025*2/0.004
// = 2.5e-6 per cm. Corner at L = 2: Cs = 5e-6 - 5e-6 = 0 -> corner DEAD.
console.log('\nThe perfused channel, worked by hand');
const chan: PerfusionParams = {
  D: 2e-5, v: 1, h1: 0.002, h2: 0.0025, W: 2, L: 2,
  C0: 5e-6, R: 2e-6, Ccrit: 0,
};
check('Q = 0.004 cm^3/s', close(flowQ(chan), 0.004, 1e-12), String(flowQ(chan)));
check('tissue drop = 3.125e-7', close(tissueDrop(chan), 3.125e-7, 1e-9), String(tissueDrop(chan)));
check('supply drains 2.5e-6 per cm',
  close(supplyC(chan, 0) - supplyC(chan, 1), 2.5e-6, 1e-9));
check('outlet supply hits zero at x = L', close(supplyC(chan, 2), 0, 1e-12));
check('the lethal corner is dead (C_min(L) < 0)', minC(chan, 2) < 0, String(minC(chan, 2)));
check('death onset x* = (C0 - drop) Q / (R h2 W)',
  close(deathOnset(chan), ((5e-6 - 3.125e-7) * 0.004) / (2e-6 * 0.0025 * 2), 1e-9),
  String(deathOnset(chan)));
check('alive fraction between 0 and 1, matches x*/L',
  close(aliveFraction(chan), deathOnset(chan) / 2, 1e-12));
check('double the flow, halve the axial drain',
  close(supplyC({ ...chan, v: 2 }, 2), 5e-6 - 5e-6 / 2, 1e-9));
check('tissue profile: no-flux floor (dC/dy = 0 at y = h2)',
  close(
    (tissueC(chan, 0, chan.h2) - tissueC(chan, 0, chan.h2 - 1e-7)) / 1e-7,
    0, 1e-2,
  ));
check('axial Pe is enormous — dropping axial diffusion is licensed',
  close(axialPeclet(chan), 1e5, 1e-9), String(axialPeclet(chan)));
check('extraction = fraction of the feed the tissue eats',
  close(extraction(chan), (2e-6 * 0.0025 * 2 * 2) / (0.004 * 5e-6), 1e-12),
  String(extraction(chan)));

// ==========================================================================
// Kinetic theory — why D is what it is (gases vs liquids)
// ==========================================================================

// N2 at 300 K, 1 atm, hand-worked:
// v_bar = sqrt(8kT/pi m) = sqrt(8 * 1.380649e-23 * 300 / (pi * 4.6518e-26))
//       = 476.2 m/s
// lambda = kT / (sqrt2 pi d^2 P) = 4.1419e-21 / 6.1629e-14 = 67.2 nm
// lambda/d = 67.2 nm / 0.37 nm = 182 diameters per flight
// D = (1/3) lambda v_bar = 1.067e-5 m^2/s = 0.107 cm^2/s (within 2x of the
// measured 0.2 — elementary kinetic theory's known accuracy)
console.log('\nKinetic theory — N2 at 300 K, 1 atm, worked by hand');
const T0 = 300;
const P0 = 101325;
check('mean speed = 476 m/s', close(meanSpeed(T0, N2.m), 476.2, 1e-3),
  String(meanSpeed(T0, N2.m)));
check('mean free path = 67.2 nm', close(meanFreePath(T0, P0, N2.d), 6.72e-8, 1e-3),
  String(meanFreePath(T0, P0, N2.d)));
check('a flight covers ~180 diameters',
  close(flightInDiameters(T0, P0, N2.d), 181.6, 1e-2),
  String(flightInDiameters(T0, P0, N2.d)));
check('~7 billion collisions per second',
  close(collisionRate(T0, P0, N2.d, N2.m), 7.086e9, 1e-2),
  String(collisionRate(T0, P0, N2.d, N2.m)));
check('D_gas = (1/3) lambda v_bar = 0.107 cm^2/s',
  close(gasDiffusivity(T0, P0, N2.d, N2.m), 0.1067, 1e-2),
  String(gasDiffusivity(T0, P0, N2.d, N2.m)));
check('mean free path scales as 1/P (compress -> liquid-ward)',
  close(meanFreePath(T0, 10 * P0, N2.d), meanFreePath(T0, P0, N2.d) / 10, 1e-12));
{
  // The four-decade punchline, cross-library: gas D from kinetic theory vs
  // liquid D from Stokes-Einstein (small solute, a = 0.2 nm, water at 25 C).
  const Dliq = stokesEinstein(2e-8, 0.0089, 298);
  const ratio = gasDiffusivity(T0, P0, N2.d, N2.m) / Dliq;
  check('liquid D ~ 1.2e-5 cm^2/s (Stokes-Einstein)', close(Dliq, 1.226e-5, 1e-2),
    String(Dliq));
  check('gas/liquid D ratio ~ 1e4 — the four decades of lecture values',
    ratio > 3e3 && ratio < 3e4, String(ratio));
}

// ==========================================================================
// The mixing cup
// ==========================================================================

// Hand-workable: parabolic T (n = 2), wall at 80, center at 20.
// T_avg = 80 + (20-80)*2/4 = 50 exactly.
// T_mc  = 80 + (20-80)*(1 - 4/4 + 4/6) = 80 - 40 = 40 exactly.
// The slow hot rim is over-counted by the area average by a full 10 degC.
console.log('\nThe mixing cup, worked by hand');
const cup: MixingCupParams = { Tw: 80, Tc: 20, n: 2 };
check('parabolic: T_avg = 50 degC exactly', close(areaAvgT(cup), 50, 1e-12), String(areaAvgT(cup)));
check('parabolic: T_mc = 40 degC exactly', close(mixingCupT(cup), 40, 1e-12), String(mixingCupT(cup)));
check('hot wall: the cup runs COOLER than the area average (slow rim undercounted)',
  mixingCupT(cup) < areaAvgT(cup));
check('closed forms equal their defining integrals',
  close(mixingCupT(cup), mixingCupTNumeric(cup), 1e-6) &&
    close(areaAvgT(cup), areaAvgTNumeric(cup), 1e-6),
  `${mixingCupT(cup)} vs ${mixingCupTNumeric(cup)}`);
{
  const odd: MixingCupParams = { Tw: 95, Tc: 5, n: 3.7 };
  check('closed forms hold at non-integer n too',
    close(mixingCupT(odd), mixingCupTNumeric(odd), 1e-5) &&
      close(areaAvgT(odd), areaAvgTNumeric(odd), 1e-5));
}
// The gap between the two averages is exactly 2n(Tw - Tc)/((n+2)(n+4)); its
// derivative goes as (8 - n^2), so it PEAKS at n = sqrt(8) = 2.8284. Both the
// peak and the "still 8 degC of the parabolic 10 at n = 8" line are quoted on
// the page and in the socratic set, so pin them here.
{
  const gap = (n: number) => areaAvgT({ Tw: 80, Tc: 20, n }) - mixingCupT({ Tw: 80, Tc: 20, n });
  const peak = gap(Math.sqrt(8));
  let sampledMax = -Infinity;
  for (let n = 1; n <= 40; n += 0.001) sampledMax = Math.max(sampledMax, gap(n));
  check('mixing-cup gap peaks at n = sqrt(8) = 2.828', close(peak, sampledMax, 1e-6), String(peak));
  check('mixing-cup gap: 10 degC at n = 2 and n = 4, 8 degC at n = 8',
    close(gap(2), 10, 1e-9) && close(gap(4), 10, 1e-9) && close(gap(8), 8, 1e-9),
    `${gap(2)} / ${gap(4)} / ${gap(8)}`);
  check('closed-form gap equals 2n dT/((n+2)(n+4))',
    close(gap(3.7), (2 * 3.7 * 60) / ((3.7 + 2) * (3.7 + 4)), 1e-9));
}

// The three bolus heat presets quote alpha values that are only tied to
// k/(rho c) in a comment. Bind them.
check('bolus heat presets: alpha = k/(rho c) for steel, copper, water',
  close(thermalDiffusivity(45, 7800, 490) * 1e4, 0.118, 2e-2) &&
    close(thermalDiffusivity(401, 8933, 385) * 1e4, 1.16, 1e-2) &&
    close(thermalDiffusivity(0.598, 998, 4182) * 1e4, 1.43e-3, 1e-2),
  `${thermalDiffusivity(45, 7800, 490) * 1e4} / ${thermalDiffusivity(401, 8933, 385) * 1e4}`);

check('uniform temperature: both averages are that temperature',
  close(mixingCupT({ Tw: 37, Tc: 37, n: 2 }), 37, 1e-12) &&
    close(areaAvgT({ Tw: 37, Tc: 37, n: 2 }), 37, 1e-12));
check('flat-core limit (n large): both averages approach the core temperature',
  Math.abs(mixingCupT({ Tw: 80, Tc: 20, n: 400 }) - 20) < 1 &&
    Math.abs(areaAvgT({ Tw: 80, Tc: 20, n: 400 }) - 20) < 1);
check('profile endpoints: T(0) = Tc, T(1) = Tw; v(0) = 2v̄, v(1) = 0 (no-slip)',
  close(mcTempAt(cup, 0), 20, 1e-12) && close(mcTempAt(cup, 1), 80, 1e-12) &&
    close(mcVelocityAt(0), 2, 1e-12) && close(mcVelocityAt(1), 0, 1e-12));

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
