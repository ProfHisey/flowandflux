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
 * The burst, in the geometry it truly happens in: a POINT release in 3D.
 *
 * Mass cargo: all the walkers start at the centre and wander out into a
 * sphere — and the amber wireframe sphere riding with them is the
 * prediction, r = sigma = sqrt(6 D t), the three-dimensional diffusion
 * clock (2Dt per axis, three axes).
 *
 * Heat cargo: the matter is ALREADY everywhere and never moves. A fixed
 * cloud of anchored molecules fills the box; a hot spot is deposited at
 * the centre, and each molecule's colour and jiggle follow the spreading
 * temperature field (painted from the point-release solution on the same
 * visual clock — the on-page hint says so). Same sigma sphere, same
 * theory, opposite cargo.
 */

const COUNT = 900;
const HEAT_COUNT = 650;

interface HMol {
  x: number;
  y: number;
  z: number;
  ox: number;
  oy: number;
  oz: number;
}

export function Bolus3DCanvas({
  cargo = 'mass',
  releaseTick,
  running,
  dark,
  cam: camProp,
}: {
  cargo?: 'mass' | 'heat';
  releaseTick: number;
  running: boolean;
  dark: boolean;
  /** Optional shared camera for the seamless 2D-to-3D handoff. */
  cam?: OrbitCam;
}) {
  const listRef = useRef<Vec3[]>([]);
  const heatRef = useRef<HMol[]>([]);
  const tRef = useRef(0);
  const internalCam = useOrbitCam(0.55, -0.3);
  const cam = camProp ?? internalCam;

  const redrawKey = `${cargo}|${releaseTick}|${dark}|${cam.camTick}`;

  useEffect(() => {
    listRef.current = [];
    heatRef.current = [];
    tRef.current = 0;
  }, [releaseTick, cargo]);

  const canvasRef = useCanvas((ctx, frame) => {
    const { width: W, height: H } = frame;
    const pt = makePainter(ctx, W, H, cam.yawRef.current, cam.pitchRef.current, cam.zoomRef.current);
    const fit = Math.min(W, H) / 2 - 26;
    const faint = FAINT(dark);
    const dt = running ? frame.dt : 0;

    const B = 0.92 * fit; // half-box

    if (cargo === 'heat') {
      // Anchored molecules everywhere; only the ENERGY spreads.
      let mols = heatRef.current;
      if (mols.length === 0) {
        mols = [];
        for (let i = 0; i < HEAT_COUNT; i++) {
          mols.push({
            x: (Math.random() - 0.5) * 2 * B,
            y: (Math.random() - 0.5) * 2 * B,
            z: (Math.random() - 0.5) * 2 * B,
            ox: 0, oy: 0, oz: 0,
          });
        }
        heatRef.current = mols;
      }
      if (dt > 0) tRef.current += dt;
      const tH = Math.max(tRef.current, 0.02);
      // Normalized temperature field of the point release on the visual
      // clock — the field is painted from the solution here (the 2D tab's
      // lattice earns it emergently); the hint owns that.
      const s4 = 4 * D_VIS * tH;
      for (const q of mols) {
        const r2 = q.x * q.x + q.y * q.y + q.z * q.z;
        const u = Math.exp(-r2 / s4);
        const amp = 0.5 + 4.5 * u;
        if (dt > 0) {
          q.ox = 0.55 * q.ox + 0.45 * amp * gauss() * 0.8;
          q.oy = 0.55 * q.oy + 0.45 * amp * gauss() * 0.8;
          q.oz = 0.55 * q.oz + 0.45 * amp * gauss() * 0.8;
        }
        const css = rampWarm(u, dark);
        const m = css.match(/(\d+),(\d+),(\d+)/);
        pt.dot(
          [q.x + q.ox, q.y + q.oy, q.z + q.oz],
          fit,
          m ? `${m[1]},${m[2]},${m[3]}` : '226,232,240',
          1.2,
          0.55 + 0.6 * u,
        );
      }
    } else {
      const list = listRef.current;
      if (list.length === 0) {
        for (let i = 0; i < COUNT; i++) {
          list.push([(Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4]);
        }
      }
      if (dt > 0) {
        tRef.current += dt;
        const s = Math.sqrt(2 * D_VIS * dt);
        for (const q of list) {
          q[0] += s * gauss();
          q[1] += s * gauss();
          q[2] += s * gauss();
          for (let k = 0; k < 3; k++) {
            if (q[k] < -B) q[k] = -2 * B - q[k];
            if (q[k] > B) q[k] = 2 * B - q[k];
          }
        }
      }
      for (const q of list) {
        pt.dot(q, fit, dark ? '226,232,240' : '15,23,42', 1, 0.9);
      }
    }
    const t = Math.max(tRef.current, 0.02);

    // The prediction: sigma = sqrt(6 D t), drawn as three great circles.
    const sigma = Math.min(1.6 * B, Math.sqrt(6 * D_VIS * t));
    const amber = dark ? 'rgba(251,191,36,0.7)' : 'rgba(217,119,6,0.65)';
    const NC = 40;
    for (let j = 0; j < NC; j++) {
      const a0 = (j / NC) * Math.PI * 2;
      const a1 = ((j + 1) / NC) * Math.PI * 2;
      pt.seg(
        [sigma * Math.cos(a0), sigma * Math.sin(a0), 0],
        [sigma * Math.cos(a1), sigma * Math.sin(a1), 0], amber, 1.5,
      );
      pt.seg(
        [sigma * Math.cos(a0), 0, sigma * Math.sin(a0)],
        [sigma * Math.cos(a1), 0, sigma * Math.sin(a1)], amber, 1.5,
      );
      pt.seg(
        [0, sigma * Math.cos(a0), sigma * Math.sin(a0)],
        [0, sigma * Math.cos(a1), sigma * Math.sin(a1)], amber, 1.5,
      );
    }
    wireBox(pt, -B, -B, -B, B, B, B, faint);
    pt.flush();

    pt.chip([0, sigma + 16, 0], `amber sphere: σ = √(6Dt) — the 3D diffusion clock`, dark);
    pt.hint(
      dark,
      cargo === 'heat'
        ? `t = ${t.toFixed(1)} s · the molecules never move — glow painted from the point solution`
        : Math.sqrt(6 * D_VIS * t) > 1.1 * B
          ? `t = ${t.toFixed(1)} s · the cloud is feeling the walls — the open-medium σ no longer applies`
          : `t = ${t.toFixed(1)} s (visual clock) · a point burst spreads as a sphere`,
    );
  }, { running, redrawKey });

  useOrbitControls(canvasRef, cam, running);

  return (
    <canvas
      role="img"
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label={
        cargo === 'heat'
          ? 'A fixed 3D cloud of molecules with a hot spot of energy spreading through it, tracked by the predicted sigma sphere'
          : 'A point burst of particles spreading spherically in 3D, tracked by the predicted sigma sphere'
      }
    />
  );
}
