import { useRef } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import {
  fluxWeightedY,
  ouStep,
  priceTrend,
  profileVelocity,
  stepParcels,
  type Box,
  type Parcel,
  type Source,
} from '../../lib/rtt';
import {
  FAINT,
  makePainter,
  useOrbitCam,
  useOrbitControls,
  wireBox,
  type OrbitCam,
  type Vec3,
} from '../shared/paint3d';
import { gauss } from '../FicksLaw/FickCanvas';
import { CP_WATER, DUCT_AREA, RHO_WATER, type RttParams } from './presets';

/**
 * The control volume as a volume. The surface integral in the theorem is
 * over a CLOSED surface — six faces, not two — and every textbook then says
 * "the side walls contribute nothing because v·n = 0 there" without ever
 * drawing it. Here the four passive faces are on screen, labeled, and you
 * can rotate the box until you believe them. The two active faces carry the
 * flux arrows; the dye is the system, drifting out through the downstream
 * one.
 *
 * Geometric intuition only: no ledger here, the 2D tab keeps the numbers.
 * Same parcel step as the 2D view (lib/rtt.stepParcels), so the device in
 * the box does the same thing to the same parcels.
 */

const PPS = 34;

interface P3 extends Parcel {
  z: number;
}

interface Sim3 {
  key: string;
  parcels: P3[];
  eta: number;
  tPhys: number;
  injAcc: number;
  P: number;
}

function timeScale(p: RttParams): number {
  return p.face === 'wealth' ? p.L / 5 : 1;
}
function meanVelocity(p: RttParams): number {
  return p.face === 'wealth' ? 1 : p.mdot / (RHO_WATER * DUCT_AREA);
}

export function Rtt3DCanvas({
  params,
  running,
  dark,
  resetTick,
  cam: camProp,
}: {
  params: RttParams;
  running: boolean;
  dark: boolean;
  resetTick: number;
  cam?: OrbitCam;
}) {
  const simRef = useRef<Sim3 | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const internalCam = useOrbitCam(0.62, -0.3);
  const cam = camProp ?? internalCam;

  const redrawKey = `${JSON.stringify(params)}|${dark}|${cam.camTick}|${resetTick}`;

  const canvasRef = useCanvas((ctx, frame) => {
    const p = paramsRef.current;
    const { width: W, height: H } = frame;
    const pt = makePainter(ctx, W, H, cam.yawRef.current, cam.pitchRef.current, cam.zoomRef.current);
    const fit = Math.min(W, H) / 2 - 26;
    const faint = FAINT(dark);

    const K = timeScale(p);
    const uBar = meanVelocity(p);
    const key = [p.face, p.mdot, p.bIn, p.bFluct, p.source, p.L, p.parabolic, resetTick].join('|');
    let sim = simRef.current;
    if (!sim || sim.key !== key) {
      const parcels: P3[] = [];
      const transitVis = p.L / (uBar * K);
      const count = Math.round(PPS * transitVis);
      const bIn = p.face === 'mass' ? 1 : p.face === 'momentum' ? uBar : p.bIn;
      const lump = p.face === 'wealth' && p.mdot === 0; // one blob, bought at once — see RttCanvas
      for (let i = 0; i < count; i++) {
        const y = 0.08 + 0.84 * fluxWeightedY(Math.random(), p.parabolic);
        parcels.push({
          x: lump ? (p.box0 + 0.015 + 0.05 * Math.random()) * p.L : Math.random() * p.L, y, z: Math.random(),
          u: profileVelocity(y, uBar, p.parabolic), b: bIn, m: 1, tagged: false,
        });
      }
      sim = { key, parcels, eta: 0, tPhys: 0, injAcc: 0, P: p.bIn };
      simRef.current = sim;
      for (const q of sim.parcels) q.tagged = q.x >= p.box0 * p.L && q.x < p.box1 * p.L;
    }

    const box: Box = { x0: p.box0 * p.L, x1: p.box1 * p.L };
    const dt = (running ? frame.dt : 0) * K;
    if (dt > 0) {
      sim.eta = ouStep(sim.eta, dt, p.tauC, gauss());
      const Pprev = sim.P;
      if (p.face === 'wealth') {
        sim.P = priceTrend(p.bIn, p.source, sim.tPhys + dt) * Math.exp(p.bFluct * sim.eta);
      }
      let source: Source;
      if (p.face === 'energy') source = { kind: 'inBox', total: (p.source / CP_WATER) * (sim.parcels.length > 0 ? 1 : 0) };
      else if (p.face === 'momentum') source = { kind: 'inBox', total: p.source };
      else if (p.face === 'wealth') source = { kind: 'everywhere', factor: sim.P / Pprev };
      else source = { kind: 'none' };
      // The inBox source is shared per unit mass; parcels here have m = 1,
      // so scale the total so the per-parcel Δb matches the 2D view's
      // per-kilogram Δb: total_3D = total_2D · (parcels in box / kg in box).
      if (source.kind === 'inBox') {
        const massPerParcel2D = (p.mdot * K) / 40;
        source = { kind: 'inBox', total: source.total / Math.max(1e-12, massPerParcel2D) };
      }
      stepParcels(sim.parcels, dt, box, source, p.face === 'momentum');

      const bInNow =
        p.face === 'mass' ? 1
          : p.face === 'momentum' ? uBar * Math.max(0.05, 1 + p.flowFluct * sim.eta)
            : p.face === 'energy' ? p.bIn + p.bFluct * sim.eta
              : sim.P;
      // No buying means no shares arriving — the 3D view must not show flows
      // the 2D ledger says do not exist.
      const perSec = p.face === 'wealth' && p.mdot === 0 ? 0 : PPS;
      sim.injAcc += (perSec * dt) / K;
      let guard = 0;
      while (sim.injAcc >= 1 && guard++ < 200) {
        sim.injAcc -= 1;
        const y = 0.08 + 0.84 * fluxWeightedY(Math.random(), p.parabolic);
        const uIn = p.face === 'momentum' ? bInNow : uBar;
        const u = profileVelocity(y, uIn, p.parabolic);
        sim.parcels.push({ x: -0.02 * p.L, y, z: 0.06 + 0.88 * Math.random(), u, b: p.face === 'momentum' ? u : bInNow, m: 1, tagged: false });
      }
      sim.parcels = sim.parcels.filter((q) => q.tagged || q.x < 1.04 * p.L);
      const anyTag = sim.parcels.some((q) => q.tagged);
      const allClear = sim.parcels.every((q) => !q.tagged || q.x >= box.x1 + 0.12 * p.L || q.x >= p.L);
      if (!anyTag || allClear) {
        sim.parcels = sim.parcels.filter((q) => q.x < 1.04 * p.L);
        for (const q of sim.parcels) q.tagged = q.x >= box.x0 && q.x < box.x1;
      }
      sim.tPhys += dt;
    }

    // ------------------------------------------------------------ draw
    // Model: x along the duct, y up, z toward the viewer.
    const LX = 1.7 * fit;
    const HY = 0.32 * fit;
    const DZ = 0.5 * fit;
    const mx = (x: number) => -LX / 2 + (x / p.L) * LX;
    const my = (y: number) => -HY / 2 + y * HY;
    const mz = (z: number) => -DZ / 2 + z * DZ;

    // Parcels.
    const pal = palette(p, sim, uBar, dark);
    for (const q of sim.parcels) {
      if (q.x < -0.02 * p.L || q.x > 1.04 * p.L) continue;
      pt.dot([mx(q.x), my(q.y), mz(q.z)], fit, pal(q.b), q.tagged ? 1.35 : 0.95, q.tagged ? 1 : 0.55);
    }

    // The control volume, six faces. Active faces tinted; passive faces
    // faint but present — they are the point.
    const X0 = mx(box.x0);
    const X1 = mx(box.x1);
    const Y0 = -HY / 2 - 4;
    const Y1 = HY / 2 + 4;
    const Z0 = -DZ / 2 - 4;
    const Z1 = DZ / 2 + 4;
    const inFill = dark ? 'rgba(129,140,248,0.28)' : 'rgba(79,70,229,0.22)';
    const outFill = dark ? 'rgba(251,191,36,0.28)' : 'rgba(217,119,6,0.22)';
    const sideFill = dark ? 'rgba(148,163,184,0.09)' : 'rgba(100,116,139,0.08)';
    pt.quad([[X0, Y0, Z0], [X0, Y1, Z0], [X0, Y1, Z1], [X0, Y0, Z1]], inFill);
    pt.quad([[X1, Y0, Z0], [X1, Y1, Z0], [X1, Y1, Z1], [X1, Y0, Z1]], outFill);
    pt.quad([[X0, Y1, Z0], [X1, Y1, Z0], [X1, Y1, Z1], [X0, Y1, Z1]], sideFill);
    pt.quad([[X0, Y0, Z0], [X1, Y0, Z0], [X1, Y0, Z1], [X0, Y0, Z1]], sideFill);
    pt.quad([[X0, Y0, Z1], [X1, Y0, Z1], [X1, Y1, Z1], [X0, Y1, Z1]], sideFill);
    pt.quad([[X0, Y0, Z0], [X1, Y0, Z0], [X1, Y1, Z0], [X0, Y1, Z0]], sideFill);
    wireBox(pt, X0, Y0, Z0, X1, Y1, Z1, dark ? 'rgba(226,232,240,0.6)' : 'rgba(15,23,42,0.5)');

    // The duct.
    wireBox(pt, -LX / 2, -HY / 2, -DZ / 2, LX / 2, HY / 2, DZ / 2, faint);

    // Flux arrows through the active faces, along the flow.
    const aCol = dark ? '#c7d2fe' : '#4338ca';
    const bCol = dark ? '#fde68a' : '#b45309';
    const yA = Y1 + 12;
    pt.seg([X0 - 46, yA, 0], [X0 - 4, yA, 0], aCol, 2.5);
    pt.seg([X0 - 4, yA, 0], [X0 - 12, yA + 5, 0], aCol, 2.5);
    pt.seg([X0 - 4, yA, 0], [X0 - 12, yA - 5, 0], aCol, 2.5);
    pt.seg([X1 + 4, yA, 0], [X1 + 46, yA, 0], bCol, 2.5);
    pt.seg([X1 + 46, yA, 0], [X1 + 38, yA + 5, 0], bCol, 2.5);
    pt.seg([X1 + 46, yA, 0], [X1 + 38, yA - 5, 0], bCol, 2.5);
    // Flow direction along the duct floor.
    pt.seg([-LX / 2 + 10, -HY / 2 - 14, DZ / 2], [-LX / 2 + 60, -HY / 2 - 14, DZ / 2], faint, 1.5);

    pt.flush();

    pt.chip([X0, yA + 14, 0], 'in: ρb(v·n) < 0', dark);
    pt.chip([X1, yA + 14, 0], 'out: ρb(v·n) > 0', dark);
    pt.chip([(X0 + X1) / 2, Y1 + 2, 0], 'top: v·n = 0', dark);
    pt.chip([(X0 + X1) / 2, 0, Z1 + 2], 'side: v·n = 0', dark);
    pt.chip([(X0 + X1) / 2, Y0 - 12, 0], 'bottom: v·n = 0', dark);
    pt.chip([-LX / 2 + 35, -HY / 2 - 26, DZ / 2], 'flow →', dark);
    pt.hint(dark, 'six faces, only two carry flux — rotate until the side walls convince you');
  }, { running, redrawKey });

  useOrbitControls(canvasRef, cam, running);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label="A 3D control volume inside a duct, its two active faces tinted and its four passive faces labeled v·n = 0, with the dyed system drifting out"
    />
  );
}

function palette(p: RttParams, sim: Sim3, uBar: number, dark: boolean): (b: number) => string {
  const mix = (a: number[], c: number[], t: number) =>
    `${(a[0] + (c[0] - a[0]) * t).toFixed(0)},${(a[1] + (c[1] - a[1]) * t).toFixed(0)},${(a[2] + (c[2] - a[2]) * t).toFixed(0)}`;
  const c01 = (t: number) => Math.min(1, Math.max(0, t));
  switch (p.face) {
    case 'mass': return () => (dark ? '129,140,248' : '79,70,229');
    case 'momentum': {
      const lo = 0.7 * uBar;
      const hi = Math.max(1.3 * uBar, uBar + (p.mdot > 0 ? p.source / p.mdot : 0) * 1.1);
      return (b) => mix(dark ? [6, 95, 70] : [4, 120, 87], dark ? [110, 231, 183] : [16, 185, 129], c01((b - lo) / (hi - lo)));
    }
    case 'energy': {
      const dT = p.mdot > 0 ? p.source / (p.mdot * CP_WATER) : 0;
      const lo = p.bIn - 2 * p.bFluct - 0.2;
      const hi = p.bIn + Math.max(dT, 0) + 2 * p.bFluct + 0.2;
      return (b) => mix(dark ? [158, 142, 72] : [217, 119, 6], dark ? [255, 58, 32] : [220, 38, 38], c01((b - lo) / (hi - lo)));
    }
    case 'wealth': {
      const trend = priceTrend(p.bIn, p.source, sim.tPhys);
      const span = Math.max(0.02, 2 * p.bFluct);
      return (b) => {
        const t = c01(0.5 + Math.log(Math.max(1e-9, b / trend)) / (2 * span));
        return t < 0.5
          ? mix(dark ? [56, 189, 248] : [2, 132, 199], dark ? [148, 163, 184] : [100, 116, 139], t * 2)
          : mix(dark ? [148, 163, 184] : [100, 116, 139], dark ? [251, 113, 133] : [225, 29, 72], (t - 0.5) * 2);
      };
    }
  }
}

export type { Vec3 };
