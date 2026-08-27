import { useEffect, useRef } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { rampWarm } from '../FourierLaw/FourierCanvas';
import { tempAt, type MixingCupParams } from '../../lib/mixingcup';
import {
  FAINT,
  makePainter,
  useOrbitCam,
  useOrbitControls,
  type OrbitCam,
} from '../shared/paint3d';

/**
 * The heated tube in 3D: a translucent cylinder with tracers riding the
 * Poiseuille profile, each colored by the temperature of its own radius.
 * Rotate it end-on and the cross-section tells the whole story — a slow
 * rim wrapped around a fast core. No readouts here; the cup and
 * the numbers live on the 2D tab.
 */

interface T3 {
  ax: number; // axial position, model units
  rho: number; // r/R
  th: number; // angle
}

const COUNT = 220;

/** Area-weighted radius — the standing population (initial fill). */
function seedRho(): number {
  return Math.min(0.985, Math.sqrt(Math.random()));
}

/** Flux-weighted radius — what crosses the inlet per second (respawn).
 *  Same statistics as the 2D canvas; keeps the tube's standing density
 *  area-uniform instead of slowly silting up at the slow wall. */
function respawnRho(): number {
  return Math.min(0.985, Math.sqrt(1 - Math.sqrt(1 - Math.random())));
}

export function Mixing3DCanvas({
  params,
  speed,
  resetTick,
  running,
  dark,
  cam: camProp,
}: {
  params: MixingCupParams;
  speed: number;
  resetTick: number;
  running: boolean;
  dark: boolean;
  /** Optional shared camera for the seamless 2D-to-3D handoff. */
  cam?: OrbitCam;
}) {
  const listRef = useRef<T3[]>([]);
  const liveRef = useRef({ params, speed });
  liveRef.current = { params, speed };
  const internalCam = useOrbitCam(0.55, -0.3);
  const cam = camProp ?? internalCam;

  const redrawKey = `${JSON.stringify(params)}|${resetTick}|${dark}|${cam.camTick}`;

  useEffect(() => {
    listRef.current = [];
  }, [resetTick]);

  const canvasRef = useCanvas((ctx, frame) => {
    const p = liveRef.current.params;
    const { width: W, height: H } = frame;
    const pt = makePainter(ctx, W, H, cam.yawRef.current, cam.pitchRef.current, cam.zoomRef.current);
    const fit = Math.min(W, H) / 2 - 26;
    const faint = FAINT(dark);
    const u = fit / 0.96;
    const R = 0.4 * u;
    const halfL = 0.85 * u;

    const tLo = Math.min(p.Tw, p.Tc);
    const span = Math.abs(p.Tw - p.Tc) || 1;
    const norm = (T: number) => Math.min(1, Math.max(0, (T - tLo) / span));

    let list = listRef.current;
    if (list.length === 0) {
      list = [];
      for (let i = 0; i < COUNT; i++) {
        list.push({
          ax: -halfL + Math.random() * 2 * halfL,
          rho: seedRho(),
          th: Math.random() * Math.PI * 2,
        });
      }
      listRef.current = list;
    }

    const dt = running ? Math.min(frame.dt, 0.033) : 0;
    const vMax = 60 * liveRef.current.speed;
    if (dt > 0) {
      for (const q of list) {
        q.ax += vMax * (1 - q.rho * q.rho) * dt;
        if (q.ax > halfL) {
          q.ax = -halfL;
          q.rho = respawnRho();
          q.th = Math.random() * Math.PI * 2;
        }
      }
    }

    // The tube: end rings shaded by the wall temperature, sparse axial
    // lines, and faint intermediate rings so the cylinder reads in depth.
    const NA = 26;
    const wallCol = rampWarm(norm(p.Tw), dark, 0.45);
    for (const ax of [-halfL, halfL]) {
      for (let i = 0; i < NA; i++) {
        const a0 = (i / NA) * Math.PI * 2;
        const a1 = ((i + 1) / NA) * Math.PI * 2;
        pt.seg(
          [ax, R * Math.sin(a0), R * Math.cos(a0)],
          [ax, R * Math.sin(a1), R * Math.cos(a1)],
          wallCol,
          2,
        );
      }
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      pt.seg(
        [-halfL, R * Math.sin(a), R * Math.cos(a)],
        [halfL, R * Math.sin(a), R * Math.cos(a)],
        faint,
      );
    }
    for (let k = 1; k < 4; k++) {
      const ax = -halfL + (k / 4) * 2 * halfL;
      for (let i = 0; i < NA; i++) {
        const a0 = (i / NA) * Math.PI * 2;
        const a1 = ((i + 1) / NA) * Math.PI * 2;
        pt.seg(
          [ax, R * Math.sin(a0), R * Math.cos(a0)],
          [ax, R * Math.sin(a1), R * Math.cos(a1)],
          faint,
        );
      }
    }

    // Tracers. rampWarm returns a css color; pt.dot wants "r,g,b".
    for (const q of list) {
      const css = rampWarm(norm(tempAt(p, q.rho)), dark);
      const m = css.match(/(\d+),\s*(\d+),\s*(\d+)/);
      const rgb = m ? `${m[1]},${m[2]},${m[3]}` : '226,232,240';
      pt.dot(
        [q.ax, q.rho * R * Math.sin(q.th), q.rho * R * Math.cos(q.th)],
        fit,
        rgb,
        1.5,
        1.15,
      );
    }
    pt.flush();

    pt.chip([0, R + 16, 0], `wall: slow, ${fmt(p.Tw)} °C`, dark);
    pt.chip([halfL, -R - 16, 0], `core: fast, ${fmt(p.Tc)} °C`, dark);
    pt.hint(dark, 'rotate end-on: a slow rim wrapped around a fast core');
  }, { running, redrawKey });

  useOrbitControls(canvasRef, cam, running);

  return (
    <canvas
      role="img"
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label="A 3D tube with tracers riding the parabolic velocity profile, colored by the temperature at their radius"
    />
  );
}

function fmt(v: number): string {
  return String(Number(v.toPrecision(3)));
}
