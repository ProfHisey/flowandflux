/**
 * Regression checks for the canvases' cosmetic RATES — the site-wide rule in
 * src/lib/visual.ts (each factor of ten in a real rate is a factor of two on
 * screen) as Stokes, Newton, the Nu/Sh correlations and the cooling clock use
 * it. Run after verify.ts by `npm run verify` (and so in CI).
 *
 * Every number a caption states about these animations is pinned here: the
 * centrifuged cell falling 32x faster, the cooling clock's ~3 s and ~19 s, the
 * Newton plate's 25 px/s. And every slider's DIRECTION is pinned, because the
 * bug these replace was sliders that moved nothing at all.
 *
 * (Separate from verify.ts only for sequencing; fold it in whenever.)
 */
import { compressPinned, compressRatio } from '../src/lib/visual';
import { stokesScreenFactor, stokesScreenPinned, terminalVelocity } from '../src/lib/stokes';
import { PRESETS as STOKES } from '../src/modules/Stokes/presets';
import {
  dragForce, newtonForceFactor, newtonForcePinned, newtonSpeedFactor, NEWTON_SPEED_TOP,
} from '../src/lib/newton';
import { PRESETS as NEWTON } from '../src/modules/NewtonViscosity/presets';
import { CORR_FLOW_TOP, corrFlowFactor } from '../src/lib/correlations';
import { coolingScreenTau, tau } from '../src/lib/cooling';
import { PRESETS as COOL } from '../src/modules/Cooling/presets';

let failures = 0;
/** Relative comparison; an exact-zero target is compared absolutely. */
const close = (a: number, b: number, tol: number) =>
  b === 0 ? Math.abs(a) <= tol : Math.abs(a - b) <= tol * Math.abs(b);
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures++; console.log(`  FAIL  ${name}  ${detail}`); }
}
function byId<T extends { id: string }>(xs: T[], id: string): T {
  const x = xs.find((q) => q.id === id);
  if (!x) throw new Error(`no preset '${id}'`);
  return x;
}

console.log('\nThe shared rate rule (lib/visual)');
check('1 at the reference', close(compressRatio(3, 3, 2, 2), 1, 1e-12));
check('x10 real is x2 on screen', close(compressRatio(30, 3, 2, 2) / compressRatio(3, 3, 2, 2), 2, 1e-12));
check('pinned outside the window, and says which side',
  close(compressRatio(3e5, 3, 2, 2), 4, 1e-12) && close(compressRatio(3e-5, 3, 2, 2), 0.25, 1e-12)
    && compressPinned(3e5, 3, 2, 2) === 'fast' && compressPinned(3e-5, 3, 2, 2) === 'slow'
    && compressPinned(3, 3, 2, 2) === null);
check('nonsense (0, NaN) is the slow pin, never NaN on screen',
  close(compressRatio(0, 3, 2, 2), 0.25, 1e-12) && close(compressRatio(Number.NaN, 3, 2, 2), 0.25, 1e-12));

console.log('\nStokes: the fall speed moves with the physics');
{
  const cell = byId(STOKES, 'cell').params;
  const spin = byId(STOKES, 'spin').params;
  const rain = byId(STOKES, 'raindrop').params;
  const r = stokesScreenFactor(terminalVelocity(spin)) / stokesScreenFactor(terminalVelocity(cell));
  check('caption: a cell spun at 1e5 g falls 32 times faster on screen', close(r, 32, 1e-9), String(r));
  const cellPx = 160 * stokesScreenFactor(terminalVelocity(cell));
  check('the default cell is unpinned: a visible crawl near 4 px/s',
    stokesScreenPinned(terminalVelocity(cell)) === null && close(cellPx, 4.18, 0.01), String(cellPx));
  check('the raindrop (where Stokes fails) pins as faster than shown',
    stokesScreenPinned(terminalVelocity(rain)) === 'fast');
  const s = (d: Record<string, number>) => stokesScreenFactor(terminalVelocity({ ...cell, ...d }));
  const base = s({});
  check('bigger particle, faster fall (v ∝ a²)', s({ a: cell.a * 2 }) > base);
  check('thicker fluid, slower fall', s({ mu: cell.mu * 2 }) < base);
  check('centrifuge, faster fall', s({ gFactor: (cell.gFactor ?? 1) * 10 }) > base);
}

console.log('\nNewton: U drives the plate, μ drives the force');
{
  const d = NEWTON[0].params;
  check('U = 0 is a plate at rest', newtonSpeedFactor(0) === 0);
  check('the default plate (1 cm/s) runs at 25 px/s (200 px/s at 10 m/s)',
    close(200 * newtonSpeedFactor(d.U), 25, 1e-9), String(200 * newtonSpeedFactor(d.U)));
  check('x10 U is x2 plate speed', close(newtonSpeedFactor(0.1) / newtonSpeedFactor(0.01), 2, 1e-12));
  check('the fastest preset is the top of the scale (factor 1)',
    close(newtonSpeedFactor(NEWTON_SPEED_TOP), 1, 1e-12));
  check('μ changes the force arrow: x10 μ is x2 arrow',
    close(newtonForceFactor(dragForce({ ...d, mu: d.mu * 10 })) / newtonForceFactor(dragForce(d)), 2, 1e-9));
  check('the default force is the reference (factor 1)',
    close(newtonForceFactor(dragForce(d)), 1, 1e-9), String(newtonForceFactor(dragForce(d))));
  const honey = NEWTON.find((p) => p.params.mu === 10);
  check('honey (0.25 N) fits on the plate unpinned',
    !!honey && newtonForcePinned(dragForce(honey.params)) === null, honey ? String(dragForce(honey.params)) : 'no honey preset');
}

console.log('\nNu/Sh: the flow arrows follow v');
check('x10 v is x2 arrow speed', close(corrFlowFactor(5) / corrFlowFactor(0.5), 2, 1e-12));
check('the default 5 m/s marches at 50 px/s (100 px/s at 50 m/s)', close(100 * corrFlowFactor(5), 50, 1e-9));
check('the whole slider (1 mm/s to 50 m/s) is unpinned',
  compressPinned(1e-3, CORR_FLOW_TOP, 5, 0) === null && compressPinned(50, CORR_FLOW_TOP, 5, 0) === null);

console.log('\nCooling: the clock follows τ');
{
  const t = (id: string) => tau(byId(COOL, id).params);
  check('coffee keeps its old 14 s on screen', close(coolingScreenTau(t('coffee')), 14, 1e-3),
    String(coolingScreenTau(t('coffee'))));
  check('caption: the thermometer cools in about 3 s', close(coolingScreenTau(t('thermometer')), 3.09, 0.01),
    String(coolingScreenTau(t('thermometer'))));
  check('caption: the roast in about 19 s', close(coolingScreenTau(t('roast')), 19.3, 0.01),
    String(coolingScreenTau(t('roast'))));
  check('x10 τ is x2 on-screen τ', close(coolingScreenTau(20930) / coolingScreenTau(2093), 2, 1e-9));
  const cf = byId(COOL, 'coffee').params;
  check('more h, faster cooling on screen', coolingScreenTau(tau({ ...cf, h: cf.h * 10 })) < coolingScreenTau(tau(cf)));
  // The canvases STEP theta rather than recomputing it; with τ held still the
  // stepped state must agree with the closed form at the real time it reports.
  const tv = coolingScreenTau(t('coffee'));
  let theta = 1;
  let tReal = 0;
  for (let i = 0; i < 600; i++) {
    theta *= Math.exp(-(1 / 60) / tv);
    tReal += ((1 / 60) * t('coffee')) / tv;
  }
  check('stepped θ = exp(−t_real/τ) after 10 s of screen time', close(theta, Math.exp(-tReal / t('coffee')), 1e-9));
}

console.log(`\n${failures === 0 ? 'All rate checks passed.' : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
