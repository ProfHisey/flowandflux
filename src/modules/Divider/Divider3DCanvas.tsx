import { useEffect, useRef } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { D_VIS, gauss } from '../FicksLaw/FickCanvas';
import { rampWarm } from '../FourierLaw/FourierCanvas';
import {
  FAINT,
  makePainter,
  useOrbitCam,
  useOrbitControls,
  wireBox,
  type OrbitCam,
  type Vec3,
} from '../shared/paint3d';

/**
 * The mixing box in 3D — same experiment, full volume. Mass mode: two
 * species wander in a glass box with a translucent green divider plane.
 * Heat mode: molecules stay anchored on a lattice and only their jiggle
 * crosses... or rather doesn't cross, until the divider goes.
 */

interface P3 {
  x: number;
  y: number;
  z: number;
  sp: 0 | 1;
}
interface M3 {
  x: number;
  y: number;
  z: number;
  ox: number;
  oy: number;
  oz: number;
  col: number; // lattice column index
}

const NXE = 20; // heat-mode energy columns

export function Divider3DCanvas({
  mode,
  nLeft,
  nRight,
  dCyan,
  dOrange,
  temp,
  TLeft,
  TRight,
  kScale,
  dividerIn,
  resetTick,
  running,
  dark,
  cam: camProp,
}: {
  mode: 'mass' | 'heat';
  nLeft: number;
  nRight: number;
  dCyan: number;
  dOrange: number;
  temp: number;
  TLeft: number;
  TRight: number;
  kScale: number;
  dividerIn: boolean;
  resetTick: number;
  running: boolean;
  dark: boolean;
  /** Optional shared camera, so a parent can hand off a drag that began
   *  on the 2D view (the seamless 2D-to-3D prototype). */
  cam?: OrbitCam;
}) {
  const massRef = useRef<P3[]>([]);
  const molsRef = useRef<M3[]>([]);
  const energyRef = useRef<Float64Array | null>(null);
  const liveRef = useRef({ dividerIn, dCyan, dOrange, temp, kScale });
  liveRef.current = { dividerIn, dCyan, dOrange, temp, kScale };
  const internalCam = useOrbitCam(0.55, -0.32);
  const cam = camProp ?? internalCam;

  const redrawKey = `${mode}|${nLeft}|${nRight}|${TLeft}|${TRight}|${dividerIn}|${resetTick}|${dark}|${cam.camTick}`;

  useEffect(() => {
    massRef.current = [];
    molsRef.current = [];
    energyRef.current = null;
  }, [mode, nLeft, nRight, TLeft, TRight, resetTick]);

  const canvasRef = useCanvas((ctx, frame) => {
    const { width: W, height: H } = frame;
    const pt = makePainter(ctx, W, H, cam.yawRef.current, cam.pitchRef.current, cam.zoomRef.current);
    const fit = Math.min(W, H) / 2 - 26;
    const faint = FAINT(dark);
    const dt = running ? frame.dt : 0;
    const live = liveRef.current;

    const u = fit / 0.96;
    const BW = 1.55 * u;
    const BH = 0.8 * u;
    const BD = 0.8 * u;
    const half = BW / 2;

    if (mode === 'mass') {
      const list = massRef.current;
      if (list.length === 0) {
        for (let i = 0; i < nLeft; i++) {
          list.push({ x: -half + Math.random() * (half - 3), y: rnd(BH), z: rnd(BD), sp: 0 });
        }
        for (let i = 0; i < nRight; i++) {
          list.push({ x: 3 + Math.random() * (half - 3), y: rnd(BH), z: rnd(BD), sp: 1 });
        }
      }
      const sC = Math.sqrt(2 * D_VIS * live.dCyan * live.temp * dt);
      const sO = Math.sqrt(2 * D_VIS * live.dOrange * live.temp * dt);
      for (const q of list) {
        if (dt > 0) {
          const s = q.sp === 0 ? sC : sO;
          const xPrev = q.x;
          q.x += s * gauss();
          q.y += s * gauss();
          q.z += s * gauss();
          // The divider is a wall at x = 0 while it is in.
          if (live.dividerIn && xPrev < 0 !== q.x < 0) q.x = -q.x;
          if (q.x < -half) q.x = -2 * half - q.x;
          if (q.x > half) q.x = 2 * half - q.x;
          if (q.y < -BH / 2) q.y = -BH - q.y;
          if (q.y > BH / 2) q.y = BH - q.y;
          if (q.z < -BD / 2) q.z = -BD - q.z;
          if (q.z > BD / 2) q.z = BD - q.z;
        }
        pt.dot([q.x, q.y, q.z], fit, q.sp === 0 ? '34,211,238' : '251,146,60', 1.4, 1.1);
      }
    } else {
      // Heat: a 1-D column energy field, exchanged along x, rendered as a
      // 3-D lattice of anchored jigglers.
      let E = energyRef.current;
      if (!E) {
        E = new Float64Array(NXE);
        for (let i = 0; i < NXE; i++) E[i] = (i < NXE / 2 ? TLeft : TRight) + 273.15;
        energyRef.current = E;
      }
      if (dt > 0) {
        const total = Math.min(0.5, 7 * live.kScale * dt);
        const nSub = Math.max(1, Math.ceil(total / 0.1));
        const eps = total / nSub;
        for (let s = 0; s < nSub; s++) {
          const dE = new Float64Array(NXE);
          for (let i = 0; i < NXE - 1; i++) {
            if (live.dividerIn && i === NXE / 2 - 1) continue;
            const give = eps * E[i] * (0.5 + Math.random());
            const take = eps * E[i + 1] * (0.5 + Math.random());
            dE[i] += take - give;
            dE[i + 1] += give - take;
          }
          for (let i = 0; i < NXE; i++) E[i] += dE[i];
        }
      }
      const lo = Math.min(TLeft, TRight) + 273.15;
      const span = Math.abs(TLeft - TRight) || 1;
      const norm = (e: number) => Math.min(1, Math.max(0, (e - lo) / span));

      let mols = molsRef.current;
      if (mols.length === 0) {
        mols = [];
        const NY = 6;
        const NZ = 6;
        for (let i = 0; i < NXE; i++) {
          for (let j = 0; j < NY; j++) {
            for (let k = 0; k < NZ; k++) {
              mols.push({
                x: -half + ((i + 0.5) / NXE) * BW,
                y: -BH / 2 + ((j + 0.5) / NY) * BH,
                z: -BD / 2 + ((k + 0.5) / NZ) * BD,
                ox: 0, oy: 0, oz: 0, col: i,
              });
            }
          }
        }
        molsRef.current = mols;
      }
      // Molecules wear their own energy as colour, joined by faint bonds so
      // the solid reads as a lattice (Aug 2026 review: background tinting
      // alone did not carry the field in 3D).
      const NY = 6;
      const NZ = 6;
      const bondCol = dark ? 'rgba(148,163,184,0.18)' : 'rgba(100,116,139,0.18)';
      for (const q of mols) {
        const amp = 0.7 + 4.2 * norm(E[q.col]);
        if (dt > 0) {
          q.ox = 0.55 * q.ox + 0.45 * amp * gauss() * 0.8;
          q.oy = 0.55 * q.oy + 0.45 * amp * gauss() * 0.8;
          q.oz = 0.55 * q.oz + 0.45 * amp * gauss() * 0.8;
        }
      }
      const at = (n: number): Vec3 => {
        const q = mols[n];
        return [q.x + q.ox, q.y + q.oy, q.z + q.oz];
      };
      for (let i = 0; i < NXE; i++) {
        for (let j = 0; j < NY; j++) {
          for (let k = 0; k < NZ; k++) {
            const n = (i * NY + j) * NZ + k;
            if (k < NZ - 1) pt.seg(at(n), at(n + 1), bondCol);
            if (j < NY - 1) pt.seg(at(n), at(n + NZ), bondCol);
            // The divider severs the middle bonds while it is in.
            if (i < NXE - 1 && !(live.dividerIn && i === NXE / 2 - 1)) {
              pt.seg(at(n), at(n + NY * NZ), bondCol);
            }
          }
        }
      }
      for (const q of mols) {
        const css = rampWarm(norm(E[q.col]), dark);
        const m = css.match(/(\d+),(\d+),(\d+)/);
        const rgb = m ? `${m[1]},${m[2]},${m[3]}` : '226,232,240';
        pt.dot([q.x + q.ox, q.y + q.oy, q.z + q.oz], fit, rgb, 1.4, 1.15);
      }
    }

    // The divider plane.
    const planePts: [Vec3, Vec3, Vec3, Vec3] = [
      [0, -BH / 2, -BD / 2], [0, BH / 2, -BD / 2], [0, BH / 2, BD / 2], [0, -BH / 2, BD / 2],
    ];
    if (dividerIn) {
      pt.quad(planePts, dark ? 'rgba(34,197,94,0.28)' : 'rgba(34,197,94,0.22)');
    } else {
      pt.seg([0, -BH / 2, -BD / 2], [0, BH / 2, -BD / 2], faint);
      pt.seg([0, -BH / 2, BD / 2], [0, BH / 2, BD / 2], faint);
    }
    wireBox(pt, -half, -BH / 2, -BD / 2, half, BH / 2, BD / 2, faint);
    pt.flush();

    pt.chip(
      [0, BH / 2 + 14, 0],
      dividerIn ? 'the divider is in — two worlds' : 'divider removed — one world now',
      dark,
    );
    pt.hint(dark);
  }, { running, redrawKey });

  useOrbitControls(canvasRef, cam, running);

  return (
    <canvas
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label={
        mode === 'mass'
          ? 'A 3D box of two particle species separated by a removable divider'
          : 'A 3D lattice with a hot half and a cold half, separated by a removable insulating divider'
      }
    />
  );
}

function rnd(span: number): number {
  return -span / 2 + 3 + Math.random() * (span - 6);
}
