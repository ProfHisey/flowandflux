import { useEffect, useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { applyZoom, gauss, useWheelZoom } from '../FicksLaw/FickCanvas';
import { meanFreePath2D, ouCoefficients } from '../../lib/kinetics';

/**
 * Two boxes of the same molecules at the same temperature — the only
 * difference is crowding. In the gas a molecule flies many diameters
 * between collisions; in the liquid it never escapes the cage of its
 * neighbors, and diffusion happens one rare cage-hop at a time. Same
 * random-walk mathematics downstream, four decades apart in D.
 *
 * The dynamics are real hard-disk collisions (elastic, equal mass), not a
 * scripted animation — the caging emerges from nothing but crowding. The
 * liquid is a BIDISPERSE mixture (radius ratio 1.4): in 2D a one-size
 * liquid crystallizes into a hexagonal solid at exactly the packings where
 * caging gets interesting, and the mixed sizes keep it honestly amorphous —
 * the standard trick of the glass-transition literature.
 *
 * SIZES and SPEEDS are schematic (a legible on-screen "gas" is still far
 * denser than a real one); the physics cards on the page carry the real
 * numbers, and the page says so.
 *
 * STEP LENGTH (Sep 2026). Both boxes report their measured free flight
 * against the DILUTE 2D law lambda = 1/(sqrt2 n d), computed from the box's
 * own density (lib/kinetics.meanFreePath2D). They sit side by side so the
 * law can be watched FAILING: rarefy the gas and measurement meets theory,
 * crowd either box and the measured flight drops below it, because the
 * dilute derivation assumes a molecule is far likelier to be flying than
 * touching. lambda/d = 1 is the boundary — below it there is no free flight
 * left to count, which is precisely the licence for the continuum view.
 *
 * CONTINUUM VIEW (Sep 2026). The liquid box can dissolve its solvent into a
 * structureless viscous medium and keep one tagged sphere, driven by the
 * Langevin equation
 *
 *     m dv = -zeta v dt + sqrt(2 zeta k_B T) dW,   zeta = 6 pi mu a
 *
 * integrated with the EXACT Ornstein-Uhlenbeck update for v (unconditionally
 * stable at any step size). Diffusion is emergent, not imposed: over times
 * long compared with tau_p = m/zeta the sphere walks with D = k_B T / zeta,
 * and the readout MEASURES that from the trajectory rather than assuming it.
 * Equipartition is matched to the molecular boxes (kT = m V0^2 temp / 2), so
 * the sphere carries the SAME thermal speed as the molecules next door —
 * raising mu does not slow it down, it shortens how long it keeps going in
 * one direction. Same sentence as the cage, different mechanism.
 *
 * The one labeled compromise: tau_p is stretched to ~6 ms of screen time so
 * the drag arrow is legible. In a real liquid momentum dies in picoseconds,
 * which is why the overdamped limit is the honest description there and why
 * the arrows are captioned as an instantaneous balance.
 */

export interface WanderStats {
  /** Mean free flight of the tagged molecule, in its own diameters. */
  gasFlight: number;
  liqFlight: number;
  /** Dilute 2D kinetic theory's prediction for the same, same units. */
  gasFlightPred: number;
  liqFlightPred: number;
  /** How many flights the measured average rests on (window holds 60).
   *  The mean needs ~30 to settle; without this a half-converged readout
   *  reads as "the theory is wrong" rather than "give it a minute". */
  gasFlightN: number;
  liqFlightN: number;
  /** Collisions per second felt by the tagged molecule (screen time). */
  gasColRate: number;
  liqColRate: number;
  /** Net displacement of the tagged molecule over the last ~10 s, diameters. */
  gasWander: number;
  liqWander: number;
  /** Continuum view only: net wander of the Langevin sphere, diameters. */
  contWander: number;
  /** Continuum view only: MEASURED D of that sphere, diameters^2/s. */
  contD: number;
  /** Continuum view only: D predicted by k_B T / zeta, same units. */
  contDPred: number;
}
interface Mol {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

interface BoxSim {
  parts: Mol[];
  /** box interior, unzoomed px */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** rolling flight bookkeeping for the tagged molecule (index 0) */
  flightAcc: number;
  flights: number[];
  collisions: number;
  elapsed: number;
  trail: { x: number; y: number }[];
  history: { t: number; x: number; y: number }[];
  t: number;
}

/** The Langevin sphere of the continuum view. */
interface ContSim {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** unconsumed frame time, s */
  acc: number;
  trail: { x: number; y: number }[];
  /** displacement samples, for the measured D */
  msd: { t: number; x: number; y: number }[];
  t: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
const V0 = 90; // base thermal speed, px/s — schematic
const R_GAS = 5;
const R_LIQ = 8; // small species; big species is 1.4x
const TRAIL = 260;

/** Continuum view: the momentum relaxation time at mu = 1x, and how finely
 *  the integrator resolves it. The step is tied to tau_p rather than fixed:
 *  a step LARGER than tau_p cannot resolve the momentum decay, and the walk
 *  then diffuses measurably faster than kT/zeta — 16% high at mu = 4x back
 *  when this was a flat 1/480 s. TAU_P0 itself is a labeled cosmetic
 *  stretch; see the header. */
const TAU_P0 = 0.006;
const CONT_SUB = 8;
const CONT_M = 1;

function makeBox(x0: number, y0: number, x1: number, y1: number): BoxSim {
  return {
    parts: [], x0, y0, x1, y1,
    flightAcc: 0, flights: [], collisions: 0, elapsed: 0,
    trail: [], history: [], t: 0,
  };
}

function seedGas(box: BoxSim, n: number) {
  box.parts = [];
  const r = R_GAS;
  for (let i = 0; i < n; i++) {
    let x = 0;
    let y = 0;
    let ok = false;
    for (let tries = 0; tries < 200 && !ok; tries++) {
      x = box.x0 + r + Math.random() * (box.x1 - box.x0 - 2 * r);
      y = box.y0 + r + Math.random() * (box.y1 - box.y0 - 2 * r);
      ok = box.parts.every((q) => (q.x - x) ** 2 + (q.y - y) ** 2 > (2.2 * r) ** 2);
    }
    box.parts.push({ x, y, vx: V0 * gauss() * 0.7, vy: V0 * gauss() * 0.7, r });
  }
}

function seedLiquid(box: BoxSim, phi: number) {
  // Hexagonal lattice at the spacing that gives the requested packing
  // fraction, alternating small/big at random. Any residual big-big overlap
  // at the highest packings is a few percent of a radius; the collision
  // pass relaxes it in the first frames and the thermostat absorbs the kick.
  box.parts = [];
  const r1 = R_LIQ;
  const r2 = 1.4 * R_LIQ;
  const meanArea = (Math.PI * (r1 * r1 + r2 * r2)) / 2;
  const s = Math.sqrt((2 * meanArea) / (phi * Math.sqrt(3)));
  const rowH = (s * Math.sqrt(3)) / 2;
  let row = 0;
  const cells: { x: number; y: number }[] = [];
  for (let y = box.y0 + r2 + 1; y <= box.y1 - r2 - 1; y += rowH, row++) {
    const off = row % 2 === 0 ? 0 : s / 2;
    for (let x = box.x0 + r2 + 1 + off; x <= box.x1 - r2 - 1; x += s) {
      cells.push({ x, y });
    }
  }
  cells.forEach((c, i) => {
    const j = 0.05 * s;
    box.parts.push({
      x: c.x + (Math.random() - 0.5) * j,
      y: c.y + (Math.random() - 0.5) * j,
      vx: V0 * gauss() * 0.7,
      vy: V0 * gauss() * 0.7,
      // The TAGGED molecule (index 0) is a small one — give it its best
      // shot at escaping the cage; even so it barely gets anywhere.
      r: i === 0 || Math.random() < 0.5 ? r1 : r2,
    });
  });
}

function makeCont(x0: number, y0: number, x1: number, y1: number): ContSim {
  return {
    x: (x0 + x1) / 2, y: (y0 + y1) / 2, vx: 0, vy: 0, acc: 0,
    trail: [], msd: [], t: 0, x0, y0, x1, y1,
  };
}

/**
 * One physics step of the continuum sphere. Exact OU update for the
 * velocity, explicit drift for the position.
 *
 *   zeta = m / tau_p,  tau_p = TAU_P0 / muRel   (zeta proportional to mu)
 *   kT   = m V0^2 temp / 2                      (matches the molecular boxes)
 *   <v^2> per axis = kT/m      — independent of mu: same thermal speed
 *   D    = kT / zeta           — falls as 1/mu: shorter persistence
 */
function stepCont(c: ContSim, dt: number, temp: number, muRel: number) {
  const tauP = TAU_P0 / muRel;
  const h = tauP / CONT_SUB;
  const kT = 0.5 * CONT_M * V0 * V0 * temp;
  const { decay, kick } = ouCoefficients(h, tauP, kT, CONT_M);
  c.acc += dt;
  let guard = 0;
  while (c.acc >= h && guard++ < 20000) {
    c.acc -= h;
    c.vx = decay * c.vx + kick * gauss();
    c.vy = decay * c.vy + kick * gauss();
    c.x += c.vx * h;
    c.y += c.vy * h;
    // Reflect at the walls. The sphere is drawn at R_LIQ, so keep its
    // center a radius clear of the border like every other tagged particle.
    if (c.x < c.x0 + R_LIQ) { c.x = c.x0 + R_LIQ; c.vx = Math.abs(c.vx); }
    if (c.x > c.x1 - R_LIQ) { c.x = c.x1 - R_LIQ; c.vx = -Math.abs(c.vx); }
    if (c.y < c.y0 + R_LIQ) { c.y = c.y0 + R_LIQ; c.vy = Math.abs(c.vy); }
    if (c.y > c.y1 - R_LIQ) { c.y = c.y1 - R_LIQ; c.vy = -Math.abs(c.vy); }
    c.t += h;
  }
  c.trail.push({ x: c.x, y: c.y });
  if (c.trail.length > TRAIL) c.trail.shift();
  const last = c.msd[c.msd.length - 1];
  if (!last || c.t - last.t > 0.1) c.msd.push({ t: c.t, x: c.x, y: c.y });
  while (c.msd.length && c.msd[0].t < c.t - 10.5) c.msd.shift();
}

/** Measured D of the Langevin sphere, px^2/s, from <r^2> = 4 D t in 2D.
 *  Averaged over every stored lag so one lucky excursion cannot set it. */
function contDiffusivity(c: ContSim): number {
  if (c.msd.length < 12) return 0;
  let sum = 0;
  let n = 0;
  const base = c.msd[0];
  for (let i = 1; i < c.msd.length; i++) {
    const s = c.msd[i];
    const lag = s.t - base.t;
    if (lag < 0.5) continue;
    const r2 = (s.x - base.x) ** 2 + (s.y - base.y) ** 2;
    sum += r2 / (4 * lag);
    n++;
  }
  return n ? sum / n : 0;
}
/** One physics step: free flight, wall reflection, pairwise elastic
 *  collisions, gentle thermostat. Mutates the box. */
function step(box: BoxSim, dt: number, temp: number) {
  const { parts } = box;
  const nSub = 2;
  const h = dt / nSub;
  for (let sub = 0; sub < nSub; sub++) {
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.x += p.vx * h;
      p.y += p.vy * h;
      if (i === 0) box.flightAcc += Math.hypot(p.vx, p.vy) * h;
      if (p.x < box.x0 + p.r) { p.x = box.x0 + p.r; p.vx = Math.abs(p.vx); }
      if (p.x > box.x1 - p.r) { p.x = box.x1 - p.r; p.vx = -Math.abs(p.vx); }
      if (p.y < box.y0 + p.r) { p.y = box.y0 + p.r; p.vy = Math.abs(p.vy); }
      if (p.y > box.y1 - p.r) { p.y = box.y1 - p.r; p.vy = -Math.abs(p.vy); }
    }
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        const a = parts[i];
        const b = parts[j];
        const rr = a.r + b.r;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        // Separate overlapping disks to contact.
        const push = (rr - d) / 2;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        // Elastic equal-mass exchange of the normal velocity components,
        // only if approaching.
        const dvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (dvn < 0) {
          a.vx += dvn * nx; a.vy += dvn * ny;
          b.vx -= dvn * nx; b.vy -= dvn * ny;
          if (i === 0 || j === 0) {
            box.flights.push(box.flightAcc / (2 * parts[0].r));
            if (box.flights.length > 60) box.flights.shift();
            box.flightAcc = 0;
            box.collisions++;
          }
        }
      }
    }
  }
  // Thermostat: relax the rms speed toward the slider's target so the
  // temperature slider acts live and numerical drift never accumulates.
  const vT = V0 * Math.sqrt(temp);
  let sum = 0;
  for (const p of parts) sum += p.vx * p.vx + p.vy * p.vy;
  const rms = Math.sqrt(sum / Math.max(1, parts.length));
  if (rms > 1e-6) {
    const f = 1 + 0.08 * (vT / rms - 1);
    for (const p of parts) { p.vx *= f; p.vy *= f; }
  }
  box.elapsed += dt;
  box.t += dt;
  // Tagged-molecule bookkeeping for the readouts.
  const tag = parts[0];
  if (tag) {
    box.trail.push({ x: tag.x, y: tag.y });
    if (box.trail.length > TRAIL) box.trail.shift();
    const last = box.history[box.history.length - 1];
    if (!last || box.t - last.t > 0.2) box.history.push({ t: box.t, x: tag.x, y: tag.y });
    while (box.history.length && box.history[0].t < box.t - 10.5) box.history.shift();
  }
}
function meanFlight(box: BoxSim): number {
  if (box.flights.length === 0) return 0;
  return box.flights.reduce((s, f) => s + f, 0) / box.flights.length;
}

function wander(box: BoxSim): number {
  const tag = box.parts[0];
  const old = box.history[0];
  if (!tag || !old || box.t - old.t < 4) return 0;
  return Math.hypot(tag.x - old.x, tag.y - old.y) / (2 * tag.r);
}

/**
 * What the DILUTE 2D law predicts for this box's tagged molecule, in tagged
 * diameters — the same units meanFlight reports, so the two are directly
 * comparable on screen. The collision diameter is the tagged radius plus the
 * mean radius of everything it can hit.
 */
function predictedFlight(box: BoxSim): number {
  const tag = box.parts[0];
  if (!tag || box.parts.length < 2) return 0;
  const area = (box.x1 - box.x0) * (box.y1 - box.y0);
  const n = box.parts.length / area;
  let rSum = 0;
  for (const p of box.parts) rSum += p.r;
  const rMean = rSum / box.parts.length;
  const dColl = tag.r + rMean;
  return meanFreePath2D(n, dColl) / (2 * tag.r);
}

function contWanderOf(c: ContSim): number {
  const old = c.msd[0];
  if (!old || c.t - old.t < 4) return 0;
  return Math.hypot(c.x - old.x, c.y - old.y) / (2 * R_LIQ);
}

/** Arrow with a head, in unzoomed px. */
function arrow(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, dx: number, dy: number,
  color: string, width = 2,
) {
  const len = Math.hypot(dx, dy);
  if (len < 2) return;
  const ux = dx / len;
  const uy = dy / len;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dx, y + dy);
  ctx.stroke();
  const hb = 6;
  ctx.beginPath();
  ctx.moveTo(x + dx, y + dy);
  ctx.lineTo(x + dx - ux * hb - uy * hb * 0.5, y + dy - uy * hb + ux * hb * 0.5);
  ctx.lineTo(x + dx - ux * hb + uy * hb * 0.5, y + dy - uy * hb - ux * hb * 0.5);
  ctx.closePath();
  ctx.fill();
}

export function GasLiquidCanvas({
  nGas,
  phi,
  temp,
  muRel,
  liquidView,
  resetTick,
  running,
  dark,
  onStats,
}: {
  nGas: number;
  phi: number;
  temp: number;
  /** Continuum view: solvent viscosity relative to the 1x reference. */
  muRel: number;
  liquidView: 'molecular' | 'continuum';
  resetTick: number;
  running: boolean;
  dark: boolean;
  onStats?: (s: WanderStats) => void;
}) {
  const gasRef = useRef<BoxSim | null>(null);
  const liqRef = useRef<BoxSim | null>(null);
  const contRef = useRef<ContSim | null>(null);
  const emitRef = useRef(0);
  const liveRef = useRef({ temp, muRel });
  liveRef.current = { temp, muRel };
  const zoomRef = useRef(1);
  const [zoomTick, setZoomTick] = useState(0);

  const redrawKey = `${nGas}|${phi}|${liquidView}|${resetTick}|${dark}|${zoomTick}`;

  useEffect(() => {
    gasRef.current = null;
    liqRef.current = null;
    contRef.current = null;
  }, [nGas, phi, resetTick]);

  const canvasRef = useCanvas((ctx, frame) => {
    const { width: W, height: H } = frame;
    applyZoom(ctx, zoomRef.current, W, H);
    const pad = 8;
    const gap = 14;
    const bw = (W - 2 * pad - gap) / 2;
    const y0 = pad + 24;
    const y1 = H - pad - 18;
    const continuum = liquidView === 'continuum';

    if (!gasRef.current) {
      const g = makeBox(pad, y0, pad + bw, y1);
      seedGas(g, nGas);
      gasRef.current = g;
      const l = makeBox(pad + bw + gap, y0, pad + bw + gap + bw, y1);
      seedLiquid(l, phi);
      liqRef.current = l;
      contRef.current = makeCont(pad + bw + gap, y0, pad + bw + gap + bw, y1);
    }
    const gas = gasRef.current;
    const liq = liqRef.current!;
    const cont = contRef.current!;

    const dt = running ? Math.min(frame.dt, 0.033) : 0;
    if (dt > 0) {
      step(gas, dt, liveRef.current.temp);
      if (continuum) stepCont(cont, dt, liveRef.current.temp, liveRef.current.muRel);
      else step(liq, dt, liveRef.current.temp);
    }

    // ---- draw
    const border = dark ? '#334155' : '#cbd5e1';
    const labelCol = dark ? '#cbd5e1' : '#475569';
    const liqLabel = continuum ? 'LIQUID — a continuum, with drag' : 'LIQUID — caged rattling';

    // The continuum solvent: a smooth wash where the molecules used to be.
    if (continuum) {
      const g = ctx.createLinearGradient(cont.x0, cont.y0, cont.x0, cont.y1);
      g.addColorStop(0, dark ? 'rgba(129,140,248,0.20)' : 'rgba(129,140,248,0.22)');
      g.addColorStop(1, dark ? 'rgba(129,140,248,0.09)' : 'rgba(129,140,248,0.10)');
      ctx.fillStyle = g;
      ctx.fillRect(cont.x0, cont.y0, cont.x1 - cont.x0, cont.y1 - cont.y0);
    }

    for (const [box, name] of [[gas, 'GAS — long flights'], [liq, liqLabel]] as const) {
      ctx.strokeStyle = border;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
      ctx.fillStyle = labelCol;
      ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(name, (box.x0 + box.x1) / 2, box.y0 - 8);
    }

    // Trails first (under the molecules), fading toward the past.
    const trails = continuum ? [gas.trail, cont.trail] : [gas.trail, liq.trail];
    for (const tr of trails) {
      for (let i = 1; i < tr.length; i++) {
        const a = (i / tr.length) * 0.75;
        ctx.strokeStyle = `rgba(249,115,22,${a.toFixed(3)})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(tr[i - 1].x, tr[i - 1].y);
        ctx.lineTo(tr[i].x, tr[i].y);
        ctx.stroke();
      }
    }

    const molBoxes = continuum
      ? ([[gas, dark ? 'rgba(34,211,238,0.85)' : 'rgba(8,145,178,0.8)']] as const)
      : ([
          [gas, dark ? 'rgba(34,211,238,0.85)' : 'rgba(8,145,178,0.8)'],
          [liq, dark ? 'rgba(167,139,250,0.8)' : 'rgba(124,58,237,0.65)'],
        ] as const);
    for (const [box, fill] of molBoxes) {
      for (let i = 1; i < box.parts.length; i++) {
        const p = box.parts[i];
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      const tag = box.parts[0];
      if (tag) {
        ctx.fillStyle = 'rgb(249,115,22)';
        ctx.beginPath();
        ctx.arc(tag.x, tag.y, tag.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = dark ? '#fed7aa' : '#7c2d12';
        ctx.lineWidth = 1.25;
        ctx.stroke();
      }
    }

    // The continuum sphere, with the force balance that moves it.
    if (continuum) {
      const speed = Math.hypot(cont.vx, cont.vy);
      if (speed > 1e-6) {
        const ux = cont.vx / speed;
        const uy = cont.vy / speed;
        // Velocity arrow tracks the thermal speed, which does NOT depend on
        // mu. Drag arrow tracks zeta*v, which does. Raising mu lengthens one
        // arrow and leaves the other alone — that is the whole mechanism.
        const vLen = Math.min(34, (speed / V0) * 26);
        const dLen = Math.min(46, vLen * liveRef.current.muRel);
        arrow(ctx, cont.x, cont.y, ux * (R_LIQ + vLen), uy * (R_LIQ + vLen),
          dark ? '#fbbf24' : '#b45309');
        arrow(ctx, cont.x, cont.y, -ux * (R_LIQ + dLen), -uy * (R_LIQ + dLen),
          dark ? '#f472b6' : '#be185d');
        ctx.font = '600 10px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = dark ? '#fbbf24' : '#b45309';
        ctx.fillText('v', cont.x + ux * (R_LIQ + vLen + 9), cont.y + uy * (R_LIQ + vLen + 9) + 3);
        ctx.fillStyle = dark ? '#f472b6' : '#be185d';
        ctx.fillText('6πμa·v', cont.x - ux * (R_LIQ + dLen + 18), cont.y - uy * (R_LIQ + dLen + 11) + 3);
      }
      ctx.fillStyle = 'rgb(249,115,22)';
      ctx.beginPath();
      ctx.arc(cont.x, cont.y, R_LIQ, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = dark ? '#fed7aa' : '#7c2d12';
      ctx.lineWidth = 1.25;
      ctx.stroke();

      ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = dark ? '#a5b4fc' : '#4f46e5';
      ctx.fillText('no molecules here — just μ', (cont.x0 + cont.x1) / 2, cont.y1 - 8);
    }

    // Honesty line: the picture is schematic; the cards carry real numbers.
    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      continuum
        ? 'two models of the same liquid — molecules on the left, a continuum on the right'
        : 'same kind of molecule, same temperature — only the crowding differs',
      pad + 2, H - pad + 4,
    );
    ctx.textAlign = 'right';
    ctx.fillText(
      continuum ? 'drag settling slowed to be visible' : 'sizes & speeds schematic',
      W - pad - 2, H - pad + 4,
    );

    emitRef.current += frame.dt;
    if (onStats && emitRef.current >= 0.5 && gas.elapsed > 0.5) {
      const kT = 0.5 * CONT_M * V0 * V0 * liveRef.current.temp;
      const zeta = CONT_M / (TAU_P0 / liveRef.current.muRel);
      const d2 = (2 * R_LIQ) ** 2;
      onStats({
        gasFlight: meanFlight(gas),
        liqFlight: meanFlight(liq),
        gasFlightPred: predictedFlight(gas),
        liqFlightPred: predictedFlight(liq),
        gasFlightN: gas.flights.length,
        liqFlightN: liq.flights.length,
        gasColRate: gas.collisions / gas.elapsed,
        liqColRate: liq.collisions / liq.elapsed,
        gasWander: wander(gas),
        liqWander: wander(liq),
        contWander: contWanderOf(cont),
        contD: contDiffusivity(cont) / d2,
        contDPred: kT / zeta / d2,
      });
      emitRef.current = 0;
    }
  }, { running, redrawKey });

  useWheelZoom(canvasRef, zoomRef, setZoomTick);

  return (
    <canvas
      role="img"
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label={
        liquidView === 'continuum'
          ? 'Two boxes: a dilute gas of colliding molecules on the left, and on the right the same liquid modeled as a structureless viscous continuum carrying one tagged sphere, with arrows for its velocity and the Stokes drag opposing it'
          : 'Two boxes of colliding molecules: a dilute gas whose tagged molecule flies long straight paths, and a dense liquid whose tagged molecule rattles in a cage of neighbors'
      }
    />
  );
}
