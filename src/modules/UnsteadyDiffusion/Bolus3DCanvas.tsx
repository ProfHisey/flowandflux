import { useEffect, useRef } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { D_VIS, gauss } from '../FicksLaw/FickCanvas';
import {
  FAINT,
  makePainter,
  useOrbitCam,
  useOrbitControls,
  wireBox,
  type Vec3,
} from '../shared/paint3d';

/**
 * The burst, in the geometry it truly happens in: a POINT release in 3D.
 * All the walkers start at the centre and wander out into a sphere — and
 * the amber wireframe sphere riding with them is the prediction,
 * r = sigma = sqrt(6 D t), the three-dimensional diffusion clock (2Dt per
 * axis, three axes). Watching the cloud keep pace with its own theory is
 * the whole show.
 */

const COUNT = 900;

export function Bolus3DCanvas({
  releaseTick,
  running,
  dark,
}: {
  releaseTick: number;
  running: boolean;
  dark: boolean;
}) {
  const listRef = useRef<Vec3[]>([]);
  const tRef = useRef(0);
  const cam = useOrbitCam(0.55, -0.3);

  const redrawKey = `${releaseTick}|${dark}|${cam.camTick}`;

  useEffect(() => {
    listRef.current = [];
    tRef.current = 0;
  }, [releaseTick]);

  const canvasRef = useCanvas((ctx, frame) => {
    const { width: W, height: H } = frame;
    const pt = makePainter(ctx, W, H, cam.yawRef.current, cam.pitchRef.current, cam.zoomRef.current);
    const fit = Math.min(W, H) / 2 - 26;
    const faint = FAINT(dark);
    const dt = running ? frame.dt : 0;

    const B = 0.92 * fit; // half-box
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
    const t = Math.max(tRef.current, 0.02);

    for (const q of list) {
      pt.dot(q, fit, dark ? '226,232,240' : '15,23,42', 1, 0.9);
    }

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

    pt.chip([0, sigma + 16, 0], `amber sphere: σ = √(6Dt) — the 3-D diffusion clock`, dark);
    pt.hint(
      dark,
      Math.sqrt(6 * D_VIS * t) > 1.1 * B
        ? `t = ${t.toFixed(1)} s · the cloud is feeling the walls — the open-medium σ no longer applies`
        : `t = ${t.toFixed(1)} s (visual clock) · a point burst spreads as a sphere`,
    );
  }, { running, redrawKey });

  useOrbitControls(canvasRef, cam, running);

  return (
    <canvas
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label="A point burst of particles spreading spherically in 3D, tracked by the predicted sigma sphere"
    />
  );
}
