import { useEffect, useRef, useState, type RefObject } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import {
  dollarWeightedRate,
  fluxWeightedY,
  ouStep,
  priceTrend,
  profileVelocity,
  reynoldsCovariance,
  stepParcels,
  timeWeightedRate,
  type Box,
  type CashFlow,
  type Parcel,
  type Source,
} from '../../lib/rtt';
import { applyZoom, chip2d, gauss, useWheelZoom } from '../FicksLaw/FickCanvas';
import { CP_WATER, DUCT_AREA, RHO_WATER, type RttParams } from './presets';

/**
 * A duct, a box, and a stream of parcels carrying b through it.
 *
 * The box is the CONTROL VOLUME — drag either face and it moves. The dyed
 * parcels are the SYSTEM: whatever was inside the box the instant it was
 * tagged, followed wherever it goes. The theorem is measured three ways every
 * frame and printed as a ledger:
 *
 *   source (what the device inside adds to the contents)
 *   storage (the contents, differenced)
 *   flux (parcels counted through the two faces, carrying their b)
 *
 * and the residual is zero to floating point — lib/rtt.ts arranges the
 * bookkeeping so that it is, and verify.ts pins it. Nothing on screen is
 * computed from the theorem; the theorem is what the counts turn out to obey.
 *
 * Every face runs the identical machine. Only the meaning of b, the device
 * in the box, and the units on the chips change:
 *   mass      b = 1          no device        kg/s
 *   momentum  b = u          a push, F        N
 *   energy    b = T          a heater, Q      W (× c_p on the way out)
 *   wealth    b = price      the market, μ    $/yr — and "flux" is deposits
 *
 * Honest compromises, stated on the canvas: the drawing speed is to scale
 * for the physics faces (a 1 m duct at ṁ/ρA); on the wealth face one screen
 * second is a fixed fraction of the holding period. The momentum face is a
 * DILUTE stream — parcels really do speed up through the push and spread
 * out, which a liquid in a constant-area duct would not do (it would raise
 * the pressure instead). The wealth face's price mean-reverts around an
 * exponential trend; the Lone Walker's price face shows the other model.
 */

/** Parcels injected per screen second — the visual density knob. */
const PPS = 40;
/** Screen seconds the fluctuation EMAs remember. */
const EMA_TAU = 0.6;
/** Screen seconds between stats emits. */
const EMIT_EVERY = 0.15;
/** Samples kept for the Reynolds covariance (~20 screen seconds). */
const REY_WINDOW = 140;

export interface RttStats {
  /** Physical time since the last reset (s, or years). */
  tPhys: number;
  /** Ledger rates in Σ m·b per unit physical time. Multiply by c_p for W. */
  source: number;
  storage: number;
  influx: number;
  outflux: number;
  residual: number;
  /** Mass (or share) rates through the faces, and the contents. */
  mIn: number;
  mOut: number;
  massInBox: number;
  /** Mass-weighted b of recent crossings at each face. */
  bInAvg: number;
  bOutAvg: number;
  /** Reynolds decomposition at the inlet: ⟨n b⟩ = ⟨n⟩⟨b⟩ + cov. */
  meanN: number;
  meanB: number;
  meanNB: number;
  cov: number;
  /** The tagged system. */
  tagCount: number;
  tagInBox: number;
  tagB: number;
  tagB0: number;
  tagSource: number;
  tagOut: number;
  /** Wealth face only. */
  V: number;
  P: number;
  Ptrend: number;
  twr: number;
  dwr: number;
  deposits: number;
  withdrawals: number;
}

interface Ema {
  source: number;
  storage: number;
  influx: number;
  outflux: number;
  residual: number;
  mIn: number;
  mOut: number;
  bIn: number;
  bOut: number;
}

interface Sim {
  key: string;
  parcels: Parcel[];
  eta: number;
  zeta: number;
  tPhys: number;
  injAcc: number;
  /** Mass (or shares) per parcel. */
  unit: number;
  /** Current market price (wealth). */
  P: number;
  ema: Ema;
  /** Ring buffers for the inlet covariance. */
  reyN: number[];
  reyB: number[];
  reyAcc: number;
  // The tagged system.
  tagB0: number;
  tagSource: number;
  tagOut: number;
  // The account (wealth).
  V0: number;
  P0: number;
  flows: CashFlow[];
  flowAcc: number;
  deposits: number;
  withdrawals: number;
  /** Physical time at which the current account window opened. */
  windowStart: number;
  emitAcc: number;
}

/** Screen-seconds → physical time. 1 for the physics faces; on the wealth
 *  face the holding period plays in five seconds. */
function timeScale(p: RttParams): number {
  return p.face === 'wealth' ? p.L / 5 : 1;
}

/** Mean velocity along the duct: ṁ/ρA for water, 1 yr/yr for shares. */
function meanVelocity(p: RttParams): number {
  return p.face === 'wealth' ? 1 : p.mdot / (RHO_WATER * DUCT_AREA);
}

function seedKey(p: RttParams, resetTick: number): string {
  // The box is deliberately NOT here: dragging it must not reseed.
  return [
    p.face, p.mdot, p.bIn, p.bFluct, p.flowFluct, p.rho, p.source, p.L, p.tauC, p.V0,
    p.parabolic, resetTick,
  ].join('|');
}

function seed(p: RttParams, key: string): Sim {
  const K = timeScale(p);
  const u = meanVelocity(p);
  const parcels: Parcel[] = [];
  // Fill the duct at the steady density: PPS per screen second, moving at u.
  const transitVis = p.L / (u * K);
  const count = Math.round(PPS * transitVis);
  const bIn = p.face === 'mass' ? 1 : p.face === 'momentum' ? u : p.bIn;
  // A steady stream fills the whole duct at every holding age. A LUMP SUM
  // (wealth, no buying) is different: every share was bought at once, so the
  // opening balance sits as one blob just inside the upstream face and
  // nothing waits upstream to age in. Seed it spread over the ages and
  // shares keep entering and leaving the box during the window — flows —
  // and the "no flows ⟹ no gap" promise fails by a fraction of a percent.
  const lump = p.face === 'wealth' && p.mdot === 0;
  for (let i = 0; i < count; i++) {
    const y = 0.06 + 0.88 * fluxWeightedY(Math.random(), p.parabolic);
    parcels.push({
      x: lump
        ? (p.box0 + 0.015 + 0.05 * Math.random()) * p.L
        : -0.02 * p.L + Math.random() * 1.04 * p.L,
      y,
      u: profileVelocity(y, u, p.parabolic),
      b: bIn,
      m: 1,
      tagged: false,
    });
  }
  // Mass per parcel. Physics: the flow rate spread over PPS parcels per
  // screen second. Wealth: the opening balance spread over the parcels
  // that start inside the box, so V₀ means what the slider says.
  let unit: number;
  if (p.face === 'wealth') {
    const inside = parcels.filter((q) => q.x >= p.box0 * p.L && q.x < p.box1 * p.L).length;
    unit = inside > 0 ? p.V0 / p.bIn / inside : 1;
  } else {
    unit = (p.mdot * K) / PPS;
  }
  for (const q of parcels) q.m = unit;

  const V0 = parcels
    .filter((q) => q.x >= p.box0 * p.L && q.x < p.box1 * p.L)
    .reduce((s, q) => s + q.m * q.b, 0);

  return {
    key,
    parcels,
    eta: 0,
    zeta: 0,
    tPhys: 0,
    injAcc: 0,
    unit,
    P: p.bIn,
    ema: { source: 0, storage: 0, influx: 0, outflux: 0, residual: 0, mIn: 0, mOut: 0, bIn: bIn, bOut: bIn },
    reyN: [],
    reyB: [],
    reyAcc: 0,
    tagB0: 0,
    tagSource: 0,
    tagOut: 0,
    V0,
    P0: p.bIn,
    flows: [],
    flowAcc: 0,
    deposits: 0,
    withdrawals: 0,
    windowStart: 0,
    emitAcc: 0,
  };
}

/** Tag everything inside the box as the system; untag the old dye. */
function retag(sim: Sim, box: Box) {
  let B0 = 0;
  for (const q of sim.parcels) {
    q.tagged = q.x >= box.x0 && q.x < box.x1;
    if (q.tagged) B0 += q.m * q.b;
  }
  sim.tagB0 = B0;
  sim.tagSource = 0;
  sim.tagOut = 0;
}

export function RttCanvas({
  params,
  running,
  dark,
  resetTick,
  onStats,
  onBoxChange,
}: {
  params: RttParams;
  running: boolean;
  dark: boolean;
  /** Bump to reseed and restart the accounting. */
  resetTick: number;
  onStats?: (s: RttStats) => void;
  /** The control surface was dragged. Fractions of L. */
  onBoxChange?: (box0: number, box1: number) => void;
}) {
  const simRef = useRef<Sim | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const zoomRef = useRef(1);
  const [zoomTick, setZoomTick] = useState(0);
  /** Screen (CSS px) positions of the two faces, refreshed every draw. */
  const handlesRef = useRef({ x0: 0, x1: 0, yTop: 0, yBot: 0, pxPerM: 1 });

  const redrawKey = `${JSON.stringify(params)}|${dark}|${zoomTick}|${resetTick}`;

  const canvasRef = useCanvas((ctx, frame) => {
    const p = paramsRef.current;
    const { width: W, height: H } = frame;
    const dpr = ctx.getTransform().a;
    applyZoom(ctx, zoomRef.current, W, H);
    const full = ctx.getTransform();

    const key = seedKey(p, resetTick);
    let sim = simRef.current;
    if (!sim || sim.key !== key) {
      sim = seed(p, key);
      simRef.current = sim;
      retag(sim, { x0: p.box0 * p.L, x1: p.box1 * p.L });
    }

    const K = timeScale(p);
    const uBar = meanVelocity(p);
    const box: Box = { x0: p.box0 * p.L, x1: p.box1 * p.L };
    const dtVis = running ? frame.dt : 0;
    const dt = dtVis * K;

    // ------------------------------------------------------------ step
    if (dt > 0) {
      // Two unit-variance OU processes; the inflow rides a mix of them so
      // its correlation with the inlet property is exactly ρ.
      sim.eta = ouStep(sim.eta, dt, p.tauC, gauss());
      sim.zeta = ouStep(sim.zeta, dt, p.tauC, gauss());
      const rho = p.face === 'momentum' ? 1 : p.face === 'mass' ? 0 : p.rho;
      const xi = rho * sim.eta + Math.sqrt(Math.max(0, 1 - rho * rho)) * sim.zeta;

      // The market, on the wealth face: trend times a mean-reverting swing.
      const Pprev = sim.P;
      if (p.face === 'wealth') {
        sim.P = priceTrend(p.bIn, p.source, sim.tPhys + dt) * Math.exp(p.bFluct * sim.eta);
      }

      // The device in the box.
      let source: Source;
      if (p.face === 'energy') source = { kind: 'inBox', total: p.source / CP_WATER };
      else if (p.face === 'momentum') source = { kind: 'inBox', total: p.source };
      else if (p.face === 'wealth') source = { kind: 'everywhere', factor: sim.P / Pprev };
      else source = { kind: 'none' };

      // Remember which dyed parcels are inside, for the system ledger.
      const tagWasIn = new Uint8Array(sim.parcels.length);
      let tagMassIn = 0;
      for (let i = 0; i < sim.parcels.length; i++) {
        const q = sim.parcels[i];
        if (q.tagged && q.x >= box.x0 && q.x < box.x1) {
          tagWasIn[i] = 1;
          tagMassIn += q.m;
        }
      }
      const tagBBefore = sim.parcels.reduce((s, q) => (q.tagged ? s + q.m * q.b : s), 0);

      const r = stepParcels(sim.parcels, dt, box, source, p.face === 'momentum');

      // The dye's own ledger: what it received, what it carried out.
      let tagBAfter = 0;
      for (let i = 0; i < sim.parcels.length; i++) {
        const q = sim.parcels[i];
        if (!q.tagged) continue;
        tagBAfter += q.m * q.b;
        const isIn = q.x >= box.x0 && q.x < box.x1;
        if (tagWasIn[i] && !isIn) sim.tagOut += q.m * q.b;
      }
      if (source.kind === 'inBox' && r.massInBox > 0) {
        sim.tagSource += source.total * dt * (tagMassIn / r.massInBox);
      } else if (source.kind === 'everywhere') {
        sim.tagSource += tagBAfter - tagBBefore;
      }

      // Inject at the inlet. Rate rides ξ; property rides η.
      const flowNow = p.mdot * Math.max(0, 1 + p.flowFluct * xi);
      const uIn = p.face === 'momentum' ? uBar * Math.max(0.05, 1 + p.flowFluct * sim.eta) : uBar;
      const bInNow =
        p.face === 'mass' ? 1
          : p.face === 'momentum' ? uIn
            : p.face === 'energy' ? p.bIn + p.bFluct * sim.eta
              : sim.P;
      if (sim.unit > 0) {
        sim.injAcc += (flowNow / sim.unit) * dt;
        let guard = 0;
        while (sim.injAcc >= 1 && guard++ < 400) {
          sim.injAcc -= 1;
          const y = 0.06 + 0.88 * fluxWeightedY(Math.random(), p.parabolic);
          const u = profileVelocity(y, uIn, p.parabolic);
          sim.parcels.push({
            x: -0.03 * p.L + Math.random() * u * dt,
            y,
            u,
            b: p.face === 'momentum' ? u : bInNow,
            m: sim.unit,
            tagged: false,
          });
        }
      }
      // Recycle what has left the duct; the dye is kept until it re-tags.
      sim.parcels = sim.parcels.filter((q) => q.tagged || q.x < 1.06 * p.L);
      // Re-tag once the whole system has cleared the box.
      const anyTag = sim.parcels.some((q) => q.tagged);
      const allClear = sim.parcels.every((q) => !q.tagged || q.x >= box.x1 + 0.12 * p.L || q.x >= p.L);
      if (!anyTag || allClear) {
        sim.parcels = sim.parcels.filter((q) => q.x < 1.06 * p.L);
        retag(sim, box);
      }

      // The ledger, as rates, smoothed on the screen clock.
      const a = 1 - Math.exp(-dtVis / EMA_TAU);
      const e = sim.ema;
      const rate = (amt: number) => amt / dt;
      e.source += a * (rate(r.source) - e.source);
      e.storage += a * (rate(r.storage) - e.storage);
      e.influx += a * (rate(r.influx) - e.influx);
      e.outflux += a * (rate(r.outflux) - e.outflux);
      e.residual += a * (rate(r.residual) - e.residual);
      // Mass through the faces and the b it carried, for T_out / u_out.
      let mIn = 0;
      let mOut = 0;
      for (let i = 0; i < sim.parcels.length; i++) {
        // Approximate: crossings this step are parcels within u·dt of a face.
        const q = sim.parcels[i];
        if (q.x >= box.x0 && q.x - q.u * dt < box.x0) mIn += q.m;
        if (q.x >= box.x1 && q.x - q.u * dt < box.x1) mOut += q.m;
      }
      e.mIn += a * (rate(mIn) - e.mIn);
      e.mOut += a * (rate(mOut) - e.mOut);
      if (mIn > 0) e.bIn += a * (r.influx / mIn - e.bIn);
      if (mOut > 0) e.bOut += a * (r.outflux / mOut - e.bOut);

      // Reynolds samples at the inlet: the rate the device sees, and the
      // property it carries. On the wealth face, price in today's dollars so
      // the trend does not masquerade as a correlation.
      sim.reyAcc += dtVis;
      if (sim.reyAcc >= EMIT_EVERY) {
        sim.reyAcc = 0;
        const bSample =
          p.face === 'wealth' ? bInNow / priceTrend(p.bIn, p.source, sim.tPhys) : bInNow;
        sim.reyN.push(flowNow);
        sim.reyB.push(bSample);
        if (sim.reyN.length > REY_WINDOW) {
          sim.reyN.shift();
          sim.reyB.shift();
        }
      }

      // The account: flows in dollars, aggregated per emit.
      sim.flowAcc += r.influx - r.outflux;
      sim.deposits += r.influx;
      sim.withdrawals += r.outflux;
      sim.tPhys += dt;

      sim.emitAcc += dtVis;
      if (sim.emitAcc >= EMIT_EVERY) {
        sim.emitAcc = 0;
        sim.flows.push({ t: sim.tPhys, f: sim.flowAcc });
        sim.flowAcc = 0;
        const V = sim.parcels.reduce((s, q) => (q.x >= box.x0 && q.x < box.x1 ? s + q.m * q.b : s), 0);
        if (sim.flows.length > 1600) {
          // Four screen minutes of history: restart the account window with
          // today's balance and price rather than carry a truncated one, so
          // both returns keep measuring the same span.
          sim.flows = [];
          sim.V0 = V;
          sim.P0 = sim.P;
          sim.deposits = 0;
          sim.withdrawals = 0;
          sim.windowStart = sim.tPhys;
        }
        if (onStats) {
          const rey = reynoldsCovariance(sim.reyN, sim.reyB);
          const trendNow = priceTrend(p.bIn, p.source, sim.tPhys);
          const T = sim.tPhys;
          const t0 = sim.windowStart;
          const windowT = T - t0;
          let twr = 0;
          let dwr = 0;
          if (p.face === 'wealth' && windowT > 0.05) {
            twr = timeWeightedRate(sim.P0, sim.P, windowT);
            dwr = dollarWeightedRate(
              sim.V0,
              sim.flows.map((c) => ({ t: c.t - t0, f: c.f })),
              V,
              windowT,
            );
          }
          let tagCount = 0;
          let tagInBox = 0;
          let tagB = 0;
          for (const q of sim.parcels) {
            if (!q.tagged) continue;
            tagCount++;
            tagB += q.m * q.b;
            if (q.x >= box.x0 && q.x < box.x1) tagInBox++;
          }
          onStats({
            tPhys: sim.tPhys,
            source: e.source,
            storage: e.storage,
            influx: e.influx,
            outflux: e.outflux,
            residual: e.residual,
            mIn: e.mIn,
            mOut: e.mOut,
            massInBox: r.massInBox,
            bInAvg: e.bIn,
            bOutAvg: e.bOut,
            meanN: rey.meanN,
            meanB: rey.meanB * (p.face === 'wealth' ? trendNow : 1),
            meanNB: rey.meanNB * (p.face === 'wealth' ? trendNow : 1),
            cov: rey.cov * (p.face === 'wealth' ? trendNow : 1),
            tagCount,
            tagInBox,
            tagB,
            tagB0: sim.tagB0,
            tagSource: sim.tagSource,
            tagOut: sim.tagOut,
            V,
            P: sim.P,
            Ptrend: trendNow,
            twr,
            dwr,
            deposits: sim.deposits,
            withdrawals: sim.withdrawals,
          });
        }
      }
    }

    // ------------------------------------------------------------ draw
    const pad = 8;
    const x0px = pad + 30;
    const x1px = W - pad - 30;
    const ductH = Math.min(150, H * 0.5);
    const yTop = H / 2 - ductH / 2 + 6;
    const yBot = yTop + ductH;
    const pxPerM = (x1px - x0px) / p.L;
    const sx = (x: number) => x0px + x * pxPerM;
    const sy = (y: number) => yTop + 6 + y * (ductH - 12);

    // Hand the pointer hook the faces in CSS pixels, through the camera.
    {
      const a = full.transformPoint(new DOMPoint(sx(box.x0), yTop));
      const b = full.transformPoint(new DOMPoint(sx(box.x1), yBot));
      handlesRef.current = {
        x0: a.x / dpr, x1: b.x / dpr, yTop: a.y / dpr, yBot: b.y / dpr,
        pxPerM: pxPerM * (full.a / dpr),
      };
    }

    // The duct.
    ctx.fillStyle = dark ? 'rgba(30,41,59,0.45)' : 'rgba(241,245,249,0.9)';
    ctx.fillRect(x0px, yTop, x1px - x0px, ductH);
    ctx.strokeStyle = dark ? '#475569' : '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0px, yTop); ctx.lineTo(x1px, yTop);
    ctx.moveTo(x0px, yBot); ctx.lineTo(x1px, yBot);
    ctx.stroke();

    // The device, drawn under the parcels.
    const bx0 = sx(box.x0);
    const bx1 = sx(box.x1);
    if (p.face === 'energy' && p.source !== 0) {
      // A heater coil along the floor of the box.
      ctx.strokeStyle = dark ? 'rgba(248,113,113,0.7)' : 'rgba(220,38,38,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const n = Math.max(3, Math.floor((bx1 - bx0) / 14));
      for (let i = 0; i <= n; i++) {
        const xx = bx0 + 6 + ((bx1 - bx0 - 12) * i) / n;
        const yy = yBot - 6 - (i % 2 === 0 ? 0 : 7);
        if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    } else if (p.face === 'momentum' && p.source !== 0) {
      // A row of pushers: chevrons pointing downstream.
      ctx.strokeStyle = dark ? 'rgba(52,211,153,0.55)' : 'rgba(5,150,105,0.5)';
      ctx.lineWidth = 2;
      const n = Math.max(2, Math.floor((bx1 - bx0) / 28));
      for (let i = 0; i < n; i++) {
        const xx = bx0 + 10 + ((bx1 - bx0 - 20) * (i + 0.5)) / n;
        ctx.beginPath();
        ctx.moveTo(xx - 4, yBot - 16); ctx.lineTo(xx + 3, yBot - 10); ctx.lineTo(xx - 4, yBot - 4);
        ctx.stroke();
      }
    }

    // Colour by b, per face. Adaptive ranges so the picture never goes flat.
    const cp = colorPalette(p, sim, uBar, dark);

    // Parcels. Untagged first, the dye on top.
    const rad = 3;
    for (const pass of [0, 1]) {
      for (const q of sim.parcels) {
        if ((pass === 1) !== q.tagged) continue;
        if (q.x < -0.03 * p.L || q.x > 1.06 * p.L) continue;
        const px = sx(q.x);
        const py = sy(q.y);
        ctx.fillStyle = cp(q.b, q.tagged ? 1 : 0.62);
        ctx.beginPath();
        ctx.arc(px, py, q.tagged ? rad + 0.8 : rad, 0, Math.PI * 2);
        ctx.fill();
        if (q.tagged) {
          ctx.strokeStyle = dark ? 'rgba(248,250,252,0.85)' : 'rgba(15,23,42,0.7)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
    }

    // The control volume: dashed, with the two active faces coloured and
    // grips to drag them by.
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = dark ? 'rgba(226,232,240,0.55)' : 'rgba(15,23,42,0.45)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx0, yTop - 10, bx1 - bx0, ductH + 20);
    ctx.setLineDash([]);
    const inCol = dark ? '#818cf8' : '#4f46e5';
    const outCol = dark ? '#fbbf24' : '#d97706';
    ctx.lineWidth = 3;
    ctx.strokeStyle = inCol;
    ctx.beginPath(); ctx.moveTo(bx0, yTop - 10); ctx.lineTo(bx0, yBot + 10); ctx.stroke();
    ctx.strokeStyle = outCol;
    ctx.beginPath(); ctx.moveTo(bx1, yTop - 10); ctx.lineTo(bx1, yBot + 10); ctx.stroke();
    // Grips.
    for (const [gx, col] of [[bx0, inCol], [bx1, outCol]] as const) {
      ctx.fillStyle = dark ? '#0f172a' : '#ffffff';
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      roundRect(ctx, gx - 5, H / 2 - 11, 10, 22, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = col;
      for (let k = -1; k <= 1; k++) ctx.fillRect(gx - 0.75, H / 2 + k * 5 - 1, 1.5, 2);
    }

    // Flux arrows at the faces, to a common scale.
    const e = sim.ema;
    const fluxScale = Math.max(1e-12, Math.abs(e.influx), Math.abs(e.outflux), Math.abs(e.source), Math.abs(e.storage));
    const arrowLen = (v: number) => 14 + 50 * Math.min(1, Math.abs(v) / fluxScale);
    const ay = yTop - 22;
    arrow(ctx, bx0 - arrowLen(e.influx), ay, bx0 - 2, ay, inCol, 2.5);
    arrow(ctx, bx1 + 2, ay, bx1 + arrowLen(e.outflux), ay, outCol, 2.5);

    // Chips: the four terms in the face's own units.
    const fmt = rateFormatter(p);
    chip2d(ctx, bx0 - arrowLen(e.influx) / 2 - 2, ay - 16, `in ${fmt(e.influx)}`, dark);
    chip2d(ctx, bx1 + arrowLen(e.outflux) / 2 + 2, ay - 16, `out ${fmt(e.outflux)}`, dark);
    chip2d(ctx, (bx0 + bx1) / 2, yTop - 24, `storage ${fmt(e.storage)}`, dark);
    const srcLabel =
      p.face === 'mass' ? 'no source — b is conserved'
        : p.face === 'momentum' ? `push ${fmt(e.source)}`
          : p.face === 'energy' ? `heater ${fmt(e.source)}`
            : `market ${fmt(e.source)}`;
    chip2d(ctx, (bx0 + bx1) / 2, yBot + 24, srcLabel, dark);

    // The system, as a sentence.
    let tagIn = 0;
    let tagGone = 0;
    for (const q of sim.parcels) {
      if (!q.tagged) continue;
      if (q.x >= box.x0 && q.x < box.x1) tagIn++; else if (q.x >= box.x1) tagGone++;
    }
    chip2d(
      ctx, (bx0 + bx1) / 2, H - 14,
      `the dye is the system: ${tagIn} still inside · ${tagGone} carried out`,
      dark,
    );

    // Inlet and outlet readings.
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = dark ? '#94a3b8' : '#64748b';
    ctx.fillText(inletLabel(p, sim, e.bIn), x0px, yBot + 16);
    ctx.textAlign = 'right';
    ctx.fillText(outletLabel(p, e.bOut), x1px, yBot + 16);
    ctx.textAlign = 'left';
    ctx.fillText(p.face === 'wealth'
      ? `1 s on screen = ${(timeScale(p)).toPrecision(2)} yr · price mean-reverts around its trend`
      : p.face === 'momentum'
        ? 'a dilute stream: the push really speeds it up (a liquid would raise pressure instead)'
        : `${p.L} m of duct, played to scale`, x0px, 14);
    ctx.textAlign = 'right';
    ctx.fillText(`t = ${p.face === 'wealth' ? `${sim.tPhys.toFixed(1)} yr` : `${sim.tPhys.toFixed(1)} s`}`, x1px, 14);
    ctx.textAlign = 'left';
  }, { running, redrawKey });

  // The grips must win over the pan: registered first, and they stop the
  // event before the shared camera sees it.
  useBoxDrag(canvasRef, handlesRef, zoomRef, paramsRef, onBoxChange);
  useWheelZoom(canvasRef, zoomRef, setZoomTick);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label={`A stream of parcels flowing through a draggable control volume, with the ${params.face} ledger measured at its two faces`}
    />
  );
}

// ------------------------------------------------------------- pieces

function useBoxDrag(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  handlesRef: RefObject<{ x0: number; x1: number; yTop: number; yBot: number; pxPerM: number }>,
  zoomRef: RefObject<number>,
  paramsRef: RefObject<RttParams>,
  onBoxChange?: (box0: number, box1: number) => void,
) {
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    let edge: 0 | 1 | null = null;
    // The drag accumulates from where it STARTED, not from the last render:
    // React batches pointermoves, so reading box0 back out of the params ref
    // on every move sees a stale value and drops every delta but the last.
    let startX = 0;
    let startBox0 = 0;
    let startBox1 = 0;
    const hit = (e: PointerEvent): 0 | 1 | null => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const h = handlesRef.current!;
      if (y < h.yTop - 14 || y > h.yBot + 14) return null;
      if (Math.abs(x - h.x0) < 9) return 0;
      if (Math.abs(x - h.x1) < 9) return 1;
      return null;
    };
    const down = (e: PointerEvent) => {
      const which = hit(e);
      if (which === null) return;
      edge = which;
      startX = e.clientX;
      startBox0 = paramsRef.current!.box0;
      startBox1 = paramsRef.current!.box1;
      e.stopImmediatePropagation();
      try { el.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
      el.style.cursor = 'ew-resize';
    };
    const move = (e: PointerEvent) => {
      if (edge === null) {
        el.style.cursor = hit(e) === null ? '' : 'ew-resize';
        return;
      }
      const p = paramsRef.current!;
      const df = (e.clientX - startX) / handlesRef.current!.pxPerM / p.L;
      let b0 = startBox0;
      let b1 = startBox1;
      if (edge === 0) b0 = Math.min(b1 - 0.08, Math.max(0.05, startBox0 + df));
      else b1 = Math.max(b0 + 0.08, Math.min(0.95, startBox1 + df));
      onBoxChange?.(b0, b1);
      e.stopImmediatePropagation();
    };
    const up = (e: PointerEvent) => {
      if (edge === null) return;
      edge = null;
      try { el.releasePointerCapture(e.pointerId); } catch { /* synthetic */ }
      el.style.cursor = '';
      e.stopImmediatePropagation();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [canvasRef, handlesRef, zoomRef, paramsRef, onBoxChange]);
}

/** A colour for b on the current face, with an alpha. */
function colorPalette(p: RttParams, sim: Sim, uBar: number, dark: boolean): (b: number, alpha: number) => string {
  const mix = (a: [number, number, number], c: [number, number, number], t: number): [number, number, number] => [
    a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t,
  ];
  const rgba = (c: [number, number, number], al: number) =>
    `rgba(${c[0].toFixed(0)},${c[1].toFixed(0)},${c[2].toFixed(0)},${al})`;
  const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
  switch (p.face) {
    case 'mass': {
      const c: [number, number, number] = dark ? [129, 140, 248] : [79, 70, 229];
      return (_b, al) => rgba(c, al);
    }
    case 'momentum': {
      // Slow: deep emerald. Fast: mint. Range from 0.7 ū to the steady outlet.
      const lo = 0.7 * uBar;
      const hi = Math.max(1.3 * uBar, uBar + (p.mdot > 0 ? p.source / p.mdot : 0) * 1.1);
      const a: [number, number, number] = dark ? [6, 95, 70] : [4, 120, 87];
      const c: [number, number, number] = dark ? [110, 231, 183] : [16, 185, 129];
      return (b, al) => rgba(mix(a, c, clamp01((b - lo) / (hi - lo))), al);
    }
    case 'energy': {
      const dT = p.mdot > 0 ? p.source / (p.mdot * CP_WATER) : 0;
      const lo = p.bIn - 2 * p.bFluct - 0.2;
      const hi = p.bIn + Math.max(dT, 0) + 2 * p.bFluct + 0.2;
      const a: [number, number, number] = dark ? [158, 142, 72] : [217, 119, 6];
      const c: [number, number, number] = dark ? [255, 58, 32] : [220, 38, 38];
      return (b, al) => rgba(mix(a, c, clamp01((b - lo) / (hi - lo))), al);
    }
    case 'wealth': {
      // Below trend: sky. On trend: slate. Above: rose. ±2 swings.
      const trend = priceTrend(p.bIn, p.source, sim.tPhys);
      const span = Math.max(0.02, 2 * p.bFluct);
      const cheap: [number, number, number] = dark ? [56, 189, 248] : [2, 132, 199];
      const mid: [number, number, number] = dark ? [148, 163, 184] : [100, 116, 139];
      const dear: [number, number, number] = dark ? [251, 113, 133] : [225, 29, 72];
      return (b, al) => {
        const t = clamp01(0.5 + Math.log(Math.max(1e-9, b / trend)) / (2 * span));
        return rgba(t < 0.5 ? mix(cheap, mid, t * 2) : mix(mid, dear, (t - 0.5) * 2), al);
      };
    }
  }
}

function rateFormatter(p: RttParams): (v: number) => string {
  const s = (v: number, digits = 3) => {
    if (!Number.isFinite(v)) return '—';
    const a = Math.abs(v);
    if (a === 0) return '0';
    if (a >= 1e4 || a < 1e-2) return v.toExponential(1);
    return Number(v.toPrecision(digits)).toString();
  };
  switch (p.face) {
    case 'mass': return (v) => `${s(v)} kg/s`;
    case 'momentum': return (v) => `${s(v)} N`;
    case 'energy': return (v) => `${s(v * CP_WATER, 3)} W`;
    case 'wealth': return (v) => `$${s(v, 3)}/yr`;
  }
}

function inletLabel(p: RttParams, sim: Sim, bIn: number): string {
  switch (p.face) {
    case 'mass': return 'inlet: b = 1 for every parcel';
    case 'momentum': return `inlet u = ${bIn.toFixed(3)} m/s`;
    case 'energy': return `inlet T = ${bIn.toFixed(2)} °C`;
    case 'wealth': return `price now $${sim.P.toFixed(2)} · trend $${priceTrend(p.bIn, p.source, sim.tPhys).toFixed(2)}`;
  }
}

function outletLabel(p: RttParams, bOut: number): string {
  switch (p.face) {
    case 'mass': return 'outlet: the same parcels, later';
    case 'momentum': return `outlet u = ${bOut.toFixed(3)} m/s`;
    case 'energy': return `outlet T = ${bOut.toFixed(2)} °C`;
    case 'wealth': return `sold at $${bOut.toFixed(2)}/share`;
  }
}

function arrow(ctx: CanvasRenderingContext2D, xa: number, ya: number, xb: number, yb: number, color: string, w: number) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(xa, ya);
  ctx.lineTo(xb, yb);
  ctx.stroke();
  const d = Math.sign(xb - xa) || 1;
  ctx.beginPath();
  ctx.moveTo(xb, yb);
  ctx.lineTo(xb - d * 7, yb - 4.5);
  ctx.lineTo(xb - d * 7, yb + 4.5);
  ctx.closePath();
  ctx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
