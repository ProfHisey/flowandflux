import { useEffect, useRef } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { alphaOf, contactTemp, erf, type ContactBody } from '../../lib/transient';
import { rampWarm } from '../FourierLaw/FourierCanvas';
import {
  FAINT,
  makePainter,
  useOrbitCam,
  useOrbitControls,
  wireBox,
  type OrbitCam,
} from '../shared/paint3d';

/**
 * The moment of touch, in 3D: two solid blocks meet at a plane, the
 * interface locks onto the effusivity-weighted contact temperature, and
 * the two thermal fronts march inward as translucent sheets — each at its
 * own pace (the real alpha ratio, compressed, as in the 2D view).
 */

const TAU_REF = 30;

export function Touch3DCanvas({
  left,
  right,
  resetTick,
  running,
  dark,
  cam: camProp,
}: {
  left: ContactBody;
  right: ContactBody;
  resetTick: number;
  running: boolean;
  dark: boolean;
  /** Optional shared camera for the seamless 2D-to-3D handoff. */
  cam?: OrbitCam;
}) {
  const tRef = useRef(0.02);
  const internalCam = useOrbitCam(0.55, -0.3);
  const cam = camProp ?? internalCam;

  const redrawKey = `${JSON.stringify(left)}|${JSON.stringify(right)}|${resetTick}|${dark}|${cam.camTick}`;

  useEffect(() => {
    tRef.current = 0.02;
  }, [resetTick, left.name, right.name, left.T, right.T]);

  const canvasRef = useCanvas((ctx, frame) => {
    const { width: W, height: H } = frame;
    const pt = makePainter(ctx, W, H, cam.yawRef.current, cam.pitchRef.current, cam.zoomRef.current);
    const fit = Math.min(W, H) / 2 - 26;
    const faint = FAINT(dark);
    if (running) tRef.current += frame.dt;
    const t = tRef.current;

    const u = fit / 0.96;
    const BW = 1.6 * u; // total span, interface at x = 0
    const BH = 0.62 * u;
    const BD = 0.62 * u;
    const half = BW / 2;

    const aL = alphaOf(left.k, left.rho, left.c);
    const aR = alphaOf(right.k, right.rho, right.c);
    const comp = Math.pow(Math.sqrt(aR / aL), 0.5);
    const base = (half * 0.32) ** 2 / TAU_REF;
    const aVisL = base / Math.max(comp, 1 / 4);
    const aVisR = base * Math.min(Math.max(comp, 1 / 4), 4);

    const Tc = contactTemp(left, right);
    const tLo = Math.min(left.T, right.T, Tc);
    const span = Math.max(left.T, right.T, Tc) - tLo || 1;
    const norm = (T: number) => Math.min(1, Math.max(0, (T - tLo) / span));
    const Tat = (x: number): number =>
      x < 0
        ? Tc + (left.T - Tc) * erf(-x / (2 * Math.sqrt(aVisL * t)))
        : Tc + (right.T - Tc) * erf(x / (2 * Math.sqrt(aVisR * t)));

    // Both blocks, banded by the live temperature field on all four long
    // faces (translucent so the far side reads through).
    const NS = 30;
    const sw = BW / NS;
    for (let i = 0; i < NS; i++) {
      const xa = -half + i * sw;
      const xb = xa + sw;
      const col = rampWarm(norm(Tat(xa + sw / 2)), dark, 0.6);
      pt.quad([[xa, -BH / 2, -BD / 2], [xb, -BH / 2, -BD / 2], [xb, -BH / 2, BD / 2], [xa, -BH / 2, BD / 2]], col);
      pt.quad([[xa, BH / 2, -BD / 2], [xb, BH / 2, -BD / 2], [xb, BH / 2, BD / 2], [xa, BH / 2, BD / 2]], col);
      pt.quad([[xa, -BH / 2, -BD / 2], [xb, -BH / 2, -BD / 2], [xb, BH / 2, -BD / 2], [xa, BH / 2, -BD / 2]], col);
      pt.quad([[xa, -BH / 2, BD / 2], [xb, -BH / 2, BD / 2], [xb, BH / 2, BD / 2], [xa, BH / 2, BD / 2]], col);
    }
    // End caps at the undisturbed temperatures.
    for (const [x, T] of [[-half, left.T], [half, right.T]] as const) {
      pt.quad(
        [[x, -BH / 2, -BD / 2], [x, BH / 2, -BD / 2], [x, BH / 2, BD / 2], [x, -BH / 2, BD / 2]],
        rampWarm(norm(T), dark, 0.6),
      );
    }

    // The interface plane and the two marching fronts.
    const plane = (x: number, fill: string) =>
      pt.quad(
        [[x, -BH / 2, -BD / 2], [x, BH / 2, -BD / 2], [x, BH / 2, BD / 2], [x, -BH / 2, BD / 2]],
        fill,
      );
    plane(0, dark ? 'rgba(226,232,240,0.18)' : 'rgba(15,23,42,0.1)');
    const fL = -3.6428 * Math.sqrt(aVisL * t);
    const fR = 3.6428 * Math.sqrt(aVisR * t);
    const frontCol = dark ? 'rgba(251,191,36,0.25)' : 'rgba(217,119,6,0.2)';
    if (fL > -half) plane(fL, frontCol);
    if (fR < half) plane(fR, frontCol);

    wireBox(pt, -half, -BH / 2, -BD / 2, 0, BH / 2, BD / 2, faint);
    wireBox(pt, 0, -BH / 2, -BD / 2, half, BH / 2, BD / 2, faint);
    pt.flush();

    pt.chip([-half / 2, BH / 2 + 14, 0], `${left.name} · started at ${fmt(left.T)} °C`, dark);
    pt.chip([half / 2, BH / 2 + 14, 0], `${right.name} · started at ${fmt(right.T)} °C`, dark);
    pt.chip([0, 0, 0], `contact: ${fmt(Tc)} °C — instantly, and it stays`, dark);
    pt.hint(dark, `t = ${t.toFixed(1)} s visual · amber planes: the two thermal fronts`);
  }, { running, redrawKey });

  useOrbitControls(canvasRef, cam, running);

  return (
    <canvas
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label="Two solid blocks touching in 3D, with thermal fronts marching from an interface pinned at the contact temperature"
    />
  );
}

function fmt(v: number): string {
  return String(Number(v.toPrecision(3)));
}
