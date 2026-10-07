import { useCanvas } from '../../hooks/useCanvas';
import { solveProfile, valueAt, type ProfileParams } from '../../lib/bcprofile';
import {
  FAINT, makePainter, useOrbitCam, useOrbitControls, wireBox,
  type Painter, type Vec3,
} from '../shared/paint3d';
import type { Cargo } from './BCCanvas';

/**
 * The same profile, in the body it actually lives in.
 *
 * The 2D tab plots the profile against position, which is the form you solve
 * in. This one paints it onto a cut through the object, which is the form you
 * picture. The point of the pair is that a sphere's profile looks identical
 * to a slab's on a graph — a sagging curve — while in the body it is a shell
 * structure with far more surface per unit of volume to escape through, and
 * that is exactly why the same generation produces a third of the drop.
 *
 * No readouts here, per the site's convention: 2D keeps the measurements, 3D
 * is for geometric intuition.
 */

/** Cargo-family ramp: cool for mass, warm for heat, 0 = low, 1 = high. */
function ramp(u: number, cargo: Cargo, dark: boolean, alpha = 1): string {
  const t = Math.min(1, Math.max(0, u));
  let r: number, g: number, b: number;
  if (cargo === 'heat') {
    r = Math.round((dark ? 30 : 120) + t * (dark ? 225 : 135));
    g = Math.round((dark ? 30 : 140) + t * (dark ? 130 : 60));
    b = Math.round((dark ? 46 : 160) + t * (dark ? 20 : -90));
  } else {
    r = Math.round((dark ? 24 : 150) + t * (dark ? 110 : 20));
    g = Math.round((dark ? 30 : 165) + t * (dark ? 180 : 40));
    b = Math.round((dark ? 60 : 200) + t * (dark ? 170 : 30));
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Normalized 0..1 position of a value within the profile's own span, so the
 *  colors always use the full ramp rather than washing out. */
function normalizer(p: ProfileParams) {
  const sol = solveProfile(p);
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i <= 32; i++) {
    const v = valueAt(p, (i / 32) * p.L, sol);
    if (!Number.isFinite(v)) continue;
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  if (!Number.isFinite(lo) || hi - lo < 1e-12) return () => 0.5;
  return (v: number) => (v - lo) / (hi - lo);
}

/** Strips along a cut, each colored by the profile at its own position. */
function paintCut(
  pt: Painter, p: ProfileParams, cargo: Cargo, dark: boolean,
  norm: (v: number) => number, sol: ReturnType<typeof solveProfile>,
) {
  const N = 48;
  // Neighbouring strips are nudged into each other: a hairline gap between
  // two filled quads reads as a lattice of seams once there are fifty of them.
  const OV = 1.6 / N;
  const half = p.geometry === 'slab' && p.inner.kind === 'symmetry';
  if (p.geometry === 'sphere') {
    // Concentric rings on an equatorial cut.
    for (let i = 0; i < N; i++) {
      const r0 = i / N;
      const r1 = (i + 1) / N + OV;
      const v = valueAt(p, ((i + 0.5) / N) * p.L, sol);
      const fill = ramp(norm(v), cargo, dark, 0.95);
      const M = 40;
      for (let j = 0; j < M; j++) {
        const a0 = (j / M) * Math.PI * 2;
        const a1 = ((j + 1) / M) * Math.PI * 2;
        pt.quad([
          [r0 * Math.cos(a0), 0, r0 * Math.sin(a0)],
          [r1 * Math.cos(a0), 0, r1 * Math.sin(a0)],
          [r1 * Math.cos(a1), 0, r1 * Math.sin(a1)],
          [r0 * Math.cos(a1), 0, r0 * Math.sin(a1)],
        ], fill);
      }
    }
    return;
  }
  if (p.geometry === 'cylinder') {
    // A diametral slice: strips across the diameter, mirrored about the axis.
    const hy = 0.85;
    for (let i = 0; i < N; i++) {
      const u0 = i / N;
      const u1 = (i + 1) / N + OV;
      const v = valueAt(p, ((i + 0.5) / N) * p.L, sol);
      const fill = ramp(norm(v), cargo, dark, 0.95);
      for (const s of [1, -1]) {
        pt.quad([
          [s * u0, -hy, 0], [s * u1, -hy, 0], [s * u1, hy, 0], [s * u0, hy, 0],
        ], fill);
      }
    }
    return;
  }
  // Slab: strips along the thickness, mirrored when there is a midplane.
  const hy = 0.8;
  const hz = 0.8;
  for (let i = 0; i < N; i++) {
    const u0 = i / N;
    const u1 = (i + 1) / N + OV;
    const v = valueAt(p, ((i + 0.5) / N) * p.L, sol);
    const fill = ramp(norm(v), cargo, dark, 0.95);
    const sides = half ? [1, -1] : [1];
    for (const s of sides) {
      pt.quad([[s * u0, -hy, hz], [s * u1, -hy, hz], [s * u1, hy, hz], [s * u0, hy, hz]], fill);
      pt.quad([[s * u0, hy, hz], [s * u1, hy, hz], [s * u1, hy, -hz], [s * u0, hy, -hz]], fill);
    }
  }
}

/** The outline of the body, so the cut reads as a cut through something. */
function paintShell(pt: Painter, p: ProfileParams, stroke: string) {
  const half = p.geometry === 'slab' && p.inner.kind === 'symmetry';
  if (p.geometry === 'sphere') {
    const M = 56;
    for (const plane of ['xy', 'xz', 'yz'] as const) {
      for (let j = 0; j < M; j++) {
        const a0 = (j / M) * Math.PI * 2;
        const a1 = ((j + 1) / M) * Math.PI * 2;
        const at = (a: number): Vec3 =>
          plane === 'xy' ? [Math.cos(a), Math.sin(a), 0]
            : plane === 'xz' ? [Math.cos(a), 0, Math.sin(a)]
            : [0, Math.cos(a), Math.sin(a)];
        pt.seg(at(a0), at(a1), stroke, 1);
      }
    }
    return;
  }
  if (p.geometry === 'cylinder') {
    const M = 48;
    const hy = 0.85;
    for (const y of [-hy, hy]) {
      for (let j = 0; j < M; j++) {
        const a0 = (j / M) * Math.PI * 2;
        const a1 = ((j + 1) / M) * Math.PI * 2;
        pt.seg([Math.cos(a0), y, Math.sin(a0)], [Math.cos(a1), y, Math.sin(a1)], stroke, 1);
      }
    }
    for (let j = 0; j < 4; j++) {
      const a = (j / 4) * Math.PI * 2;
      pt.seg([Math.cos(a), -hy, Math.sin(a)], [Math.cos(a), hy, Math.sin(a)], stroke, 1);
    }
    return;
  }
  wireBox(pt, half ? -1 : 0, -0.8, -0.8, 1, 0.8, 0.8, stroke);
}

export function BC3DCanvas({
  params,
  cargo,
  dark,
}: {
  params: ProfileParams;
  cargo: Cargo;
  dark: boolean;
}) {
  const cam = useOrbitCam(0.7, -0.32);
  const sol = solveProfile(params);
  const redrawKey = `${JSON.stringify(params)}|${cargo}|${dark}|${cam.camTick}`;

  const canvasRef = useCanvas((ctx, frame) => {
    const { width: W, height: H } = frame;
    const fit = Math.min(W, H) * 0.34;
    const pt = makePainter(ctx, W, H, cam.yawRef.current, cam.pitchRef.current, fit * cam.zoomRef.current);

    if (sol.closure === 'no-steady-state') {
      ctx.fillStyle = dark ? '#e2e8f0' : '#0f172a';
      ctx.font = '600 14px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No steady state to paint', W / 2, H / 2);
      return;
    }

    const norm = normalizer(params);
    paintCut(pt, params, cargo, dark, norm, sol);
    paintShell(pt, params, FAINT(dark));
    pt.flush();

    const surfaceLabel = params.outer.kind === 'value' ? 'held'
      : params.outer.kind === 'mixed' ? 'film' : 'sealed';
    pt.chip([params.geometry === 'slab' ? 1 : 1, 0, 0], surfaceLabel, dark);
    if (params.inner.kind === 'symmetry') {
      pt.chip([0, 0, 0], params.geometry === 'slab' ? 'midplane' : 'center', dark);
    }
    pt.hint(dark);
  }, { running: false, redrawKey });

  useOrbitControls(canvasRef, cam, false);

  return (
    <canvas
      role="img"
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[360px]"
      aria-label={`The ${params.geometry} with its ${cargo === 'heat' ? 'temperature' : 'concentration'} profile painted onto a cut through the body; drag to rotate.`}
    />
  );
}
