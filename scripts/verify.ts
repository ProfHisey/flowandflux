/* Physics regression checks. Run: npx tsx scripts/verify.ts */
import {
  areaAt, concentration, domain, flux, holdup, mMToMolPerCm3,
  resistance, transferRate, stokesEinstein, stokesEinsteinRadius,
  type FickParams,
} from '../src/lib/fick';

let failures = 0;
const close = (a: number, b: number, tol = 1e-6) =>
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

function check(name: string, ok: boolean, detail = '') {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures++; console.log(`  FAIL  ${name}  ${detail}`); }
}

// --- 1. HW1 #2, worked by hand -------------------------------------------
// D = 1e-8 cm^2/s, C_s = 7 mM = 7e-6 mol/cm^3, L = 100 um = 0.01 cm, A = 1 cm^2
// j = D dC/L = 1e-8 * 7e-6 / 0.01 = 7e-12 mol/cm^2/s
// holdup = average C * volume = 3.5e-6 * 0.01 = 3.5e-8 mol
const skin: FickParams = {
  geometry: 'slab', D: 1e-8, C1: mMToMolPerCm3(7), C2: 0,
  L: 0.01, A: 1, r1: 0.005, r2: 0.05,
};
console.log('HW1 #2 — drug through epidermis');
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
// Lecture 3: Einstein back-computed a ~1 nm molecular radius from a known D.
console.log('\nStokes–Einstein (Lecture 3)');
const mu = 0.01;      // water at ~20 C, poise
const T = 293.15;     // K
const a1nm = 1e-7;    // 1 nm in cm
const D1nm = stokesEinstein(a1nm, mu, T);
check('D(a = 1 nm) is ~2e-6 cm²/s', D1nm > 1e-6 && D1nm < 5e-6, D1nm.toExponential(2));
check('round trip a → D → a', close(stokesEinsteinRadius(D1nm, mu, T), a1nm, 1e-9));
// Albumin: D ~ 8e-7 cm^2/s (Lecture 3) should imply a few nm.
const aAlb = stokesEinsteinRadius(8e-7, mu, T) * 1e7;
check('albumin radius lands at a few nm', aAlb > 1 && aAlb < 10, `${aAlb.toFixed(2)} nm`);

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
