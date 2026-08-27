import { useEffect, useRef } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { theta } from '../../lib/peclet';
import { D_VIS, gauss, rampColor } from '../FicksLaw/FickCanvas';
import {
  FAINT,
  makePainter,
  useOrbitCam,
  useOrbitControls,
  wireBox,
  type OrbitCam,
} from '../shared/paint3d';

/**
 * The wander-plus-drift channel as a volume: walkers diffuse in all three
 * dimensions while the flow carries them along x, between two maintained
 * baths. The same honest trick as 2D — visual Pe equals physical Pe,
 * clamped for watchability — with the box faces tinted by the analytic
 * profile the walkers keep reproducing.
 */

const BINS = 24;
const BUDGET = 800;
const PE_CAP = 60;

interface P3 {
  x: number;
  y: number;
  z: number;
}

export function Peclet3DCanvas({
  Pe,
  running,
  dark,
  cam: camProp,
}: {
  Pe: number;
  running: boolean;
  dark: boolean;
  /** Optional shared camera for the seamless 2D-to-3D handoff. */
  cam?: OrbitCam;
}) {
  const listRef = useRef<P3[]>([]);
  const peRef = useRef(Pe);
  peRef.current = Pe;
  const internalCam = useOrbitCam(0.55, -0.3);
  const cam = camProp ?? internalCam;

  const peVis = Math.max(-PE_CAP, Math.min(PE_CAP, Pe));
  const seedKey = `${peVis.toFixed(3)}`;
  const redrawKey = `${seedKey}|${dark}|${cam.camTick}`;

  useEffect(() => {
    listRef.current = [];
  }, [seedKey]);

  const canvasRef = useCanvas((ctx, frame) => {
    const { width: W, height: H } = frame;
    const pt = makePainter(ctx, W, H, cam.yawRef.current, cam.pitchRef.current, cam.zoomRef.current);
    const fit = Math.min(W, H) / 2 - 26;
    const faint = FAINT(dark);
    const dt = running ? frame.dt : 0;

    const u = fit / 0.96;
    const BW = 1.55 * u;
    const BH = 0.7 * u;
    const BD = 0.7 * u;
    const half = BW / 2;

    const peV = Math.max(-PE_CAP, Math.min(PE_CAP, peRef.current));
    const vVis = (peV * D_VIS) / BW;
    const norm = (xi: number) => 1 - theta(peV, xi);

    // Face tint from the analytic profile (floor + back face).
    const NS = 26;
    const sw = BW / NS;
    for (let i = 0; i < NS; i++) {
      const xa = -half + i * sw;
      const col = rampColor(norm((i + 0.5) / NS) * 0.9, dark, 0.3);
      pt.quad(
        [[xa, -BH / 2, -BD / 2], [xa + sw, -BH / 2, -BD / 2], [xa + sw, -BH / 2, BD / 2], [xa, -BH / 2, BD / 2]],
        col,
      );
      pt.quad(
        [[xa, -BH / 2, BD / 2], [xa + sw, -BH / 2, BD / 2], [xa + sw, BH / 2, BD / 2], [xa, BH / 2, BD / 2]],
        col,
      );
    }

    // Walkers: drift + wander, Dirichlet edge bins.
    const list = listRef.current;
    const binW = BW / BINS;
    const perBin = BUDGET / BINS;
    const targetFor = (bin: number) => Math.round(perBin * norm((bin + 0.5) / BINS) * 2);
    const spawn = (bin: number): P3 => ({
      x: -half + binW * (bin + Math.random()),
      y: (Math.random() - 0.5) * BH,
      z: (Math.random() - 0.5) * BD,
    });
    if (list.length === 0) {
      for (let bin = 0; bin < BINS; bin++) {
        const want = targetFor(bin);
        for (let k = 0; k < want; k++) list.push(spawn(bin));
      }
    }
    const s = Math.sqrt(2 * D_VIS * dt);
    for (const q of list) {
      if (dt > 0) {
        q.x += vVis * dt + s * gauss();
        q.y += s * gauss();
        q.z += s * gauss();
        if (q.y < -BH / 2) q.y = -BH - q.y;
        if (q.y > BH / 2) q.y = BH - q.y;
        if (q.z < -BD / 2) q.z = -BD - q.z;
        if (q.z > BD / 2) q.z = BD - q.z;
      }
    }
    for (let i = list.length - 1; i >= 0; i--) {
      const bin = Math.floor((list[i].x + half) / binW);
      if (bin <= 0 || bin >= BINS - 1) list.splice(i, 1);
    }
    for (const bin of [0, BINS - 1]) {
      const want = targetFor(bin);
      for (let k = 0; k < want; k++) list.push(spawn(bin));
    }
    for (const q of list) {
      pt.dot([q.x, q.y, q.z], fit, dark ? '226,232,240' : '15,23,42', 1, 0.9);
    }

    // Flow arrow along the top edge.
    const arrowCol = dark ? '#34d399' : '#047857';
    pt.seg([-40, BH / 2 + 14, 0], [40, BH / 2 + 14, 0], arrowCol, 2);
    pt.seg([40, BH / 2 + 14, 0], [30, BH / 2 + 10, 0], arrowCol, 2);
    pt.seg([40, BH / 2 + 14, 0], [30, BH / 2 + 18, 0], arrowCol, 2);

    wireBox(pt, -half, -BH / 2, -BD / 2, half, BH / 2, BD / 2, faint);
    pt.flush();

    pt.chip([-half, 0, 0], 'C₀ bath', dark);
    pt.chip([half, 0, 0], 'C_L bath', dark);
    pt.hint(
      dark,
      Math.abs(peRef.current) > PE_CAP
        ? `visual Pe clamped to ${PE_CAP} (physical ${fmt(peRef.current)})`
        : `visual Pe = physical Pe = ${fmt(peRef.current)}`,
    );
  }, { running, redrawKey });

  useOrbitControls(canvasRef, cam, running);

  return (
    <canvas
      role="img"
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label="A 3D channel of walkers that both diffuse and ride a flow between two maintained baths"
    />
  );
}

function fmt(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e4) return v.toExponential(1);
  return String(Number(v.toPrecision(3)));
}
