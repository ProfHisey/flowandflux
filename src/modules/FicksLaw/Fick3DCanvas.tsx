import { useEffect, useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { concentration, molPerCm3TomM, type FickParams } from '../../lib/fick';
import { D_VIS, gauss, rampColor } from './FickCanvas';

/**
 * Rotatable 3D view: the same unbiased random walk as the 2D canvas, in three
 * dimensions, drawn with an orthographic projection you can orbit by dragging.
 *
 * Rendering is a plain painter's algorithm on the 2D canvas — every shaded
 * patch and every walker becomes a depth-sorted drawable each frame. No 3D
 * library, no new dependencies; ~2000 sorted items per frame is comfortable.
 *
 * The rotation is purely a camera move. Nothing about the walk, the shading,
 * or the boundary bookkeeping changes with the view angle, so there is
 * nothing dishonest about letting students spin it.
 *
 * This view deliberately carries no readouts. All measurement lives on the
 * 2D tab; this tab exists to build geometric intuition — especially for the
 * curved geometries, where "area grows with radius" is the whole story.
 */

type Vec3 = [number, number, number];

interface P3 {
  x: number;
  y: number;
  z: number;
}

/** Cylinder walkers: radius, angle, axial position (centered on 0). */
interface PCyl {
  rad: number;
  th: number;
  ax: number;
}

const SLAB_BINS = 24;
const SLAB_BUDGET = 900;
const CYL_BINS = 16;
const CYL_BUDGET = 900;
const SPH_BINS = 14;
const SPH_BUDGET = 1200;

export function Fick3DCanvas({
  params,
  showParticles,
  running,
  dark,
}: {
  params: FickParams;
  showParticles: boolean;
  running: boolean;
  dark: boolean;
}) {
  const slabRef = useRef<P3[]>([]);
  const cylRef = useRef<PCyl[]>([]);
  const sphRef = useRef<P3[]>([]);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const yawRef = useRef(0.6);
  const pitchRef = useRef(-0.35);
  const zoomRef = useRef(1);
  // Bumped during a drag while the animation loop is not running, so the
  // static picture still tracks the pointer.
  const [rotTick, setRotTick] = useState(0);

  const redrawKey = `${params.geometry}|${params.D}|${params.C1}|${params.C2}|${params.L}|${params.r1}|${params.r2}|${dark}|${showParticles}|${rotTick}`;

  // Reseed on anything that changes the steady-state profile, same as 2D.
  useEffect(() => {
    slabRef.current = [];
    cylRef.current = [];
    sphRef.current = [];
  }, [params.geometry, params.C1, params.C2, params.L, params.r1, params.r2]);

  const loopRunning = running && showParticles;

  const canvasRef = useCanvas((ctx, frame) => {
    const p = paramsRef.current;
    const { width: W, height: H } = frame;
    const cx = W / 2;
    const cyc = H / 2;

    // View rotation: yaw about the vertical axis, then pitch.
    const cy = Math.cos(yawRef.current);
    const sy = Math.sin(yawRef.current);
    const cp = Math.cos(pitchRef.current);
    const sp = Math.sin(pitchRef.current);
    const view = (v: Vec3): Vec3 => {
      const x = cy * v[0] + sy * v[2];
      const z1 = -sy * v[0] + cy * v[2];
      const y = cp * v[1] - sp * z1;
      const z = sp * v[1] + cp * z1;
      return [x, y, z]; // +z toward the viewer
    };
    const zm = zoomRef.current;
    const px = (v: Vec3): [number, number] => [cx + v[0] * zm, cyc - v[1] * zm];

    // Depth-sorted drawables: far first, near last.
    const items: { z: number; f: () => void }[] = [];
    const quad = (pts: [Vec3, Vec3, Vec3, Vec3], fill: string) => {
      const vs = pts.map(view) as Vec3[];
      items.push({
        z: (vs[0][2] + vs[1][2] + vs[2][2] + vs[3][2]) / 4,
        f: () => {
          ctx.fillStyle = fill;
          ctx.beginPath();
          const [ax, ay] = px(vs[0]);
          ctx.moveTo(ax, ay);
          for (let i = 1; i < 4; i++) {
            const [bx, by] = px(vs[i]);
            ctx.lineTo(bx, by);
          }
          ctx.closePath();
          ctx.fill();
        },
      });
    };
    const seg = (a: Vec3, b: Vec3, stroke: string, w = 1) => {
      const va = view(a);
      const vb = view(b);
      items.push({
        z: (va[2] + vb[2]) / 2,
        f: () => {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = w;
          ctx.beginPath();
          const [ax, ay] = px(va);
          ctx.moveTo(ax, ay);
          const [bx, by] = px(vb);
          ctx.lineTo(bx, by);
          ctx.stroke();
        },
      });
    };
    const dotColor = dark ? '226,232,240' : '15,23,42';
    const dot = (v: Vec3, R: number) => {
      const vv = view(v);
      const depth = Math.min(1, Math.max(0, vv[2] / R / 2 + 0.5));
      items.push({
        z: vv[2],
        f: () => {
          ctx.fillStyle = `rgba(${dotColor},${(0.3 + 0.55 * depth).toFixed(2)})`;
          ctx.beginPath();
          const [ax, ay] = px(vv);
          ctx.arc(ax, ay, (1.0 + 1.2 * depth) * zm, 0, Math.PI * 2);
          ctx.fill();
        },
      });
    };

    const cLo = Math.min(p.C1, p.C2);
    const span = Math.abs(p.C1 - p.C2) || 1;
    const normAt = (s: number) => (concentration(p, s) - cLo) / span;

    const faint = dark ? 'rgba(148,163,184,0.35)' : 'rgba(148,163,184,0.55)';
    const solid = dark ? '#64748b' : '#94a3b8';
    const fit = Math.min(W, H) / 2 - 26;
    const dt = loopRunning ? frame.dt : 0;

    if (p.geometry === 'slab') {
      // Glass box, faces shaded by C(x), walkers inside. Width tracks the
      // thickness slider (log-mapped, 1e-4..1 cm).
      const tL = Math.min(1, Math.max(0, (Math.log10(p.L) + 4) / 4));
      const u = fit / 0.96; // half-diagonal of the 1.6 : 0.75 : 0.75 box
      const BW = (0.9 + 0.7 * tL) * u;
      const BH = 0.75 * u;
      const BD = 0.75 * u;
      const normAtX = (x: number) => normAt((x / BW) * p.L);
      const ctr = (v: Vec3): Vec3 => [v[0] - BW / 2, v[1] - BH / 2, v[2] - BD / 2];

      const alpha = 0.5;
      const NS = 18;
      const sw = BW / NS;
      for (let i = 0; i < NS; i++) {
        const xa = i * sw;
        const xb = xa + sw;
        const col = rampColor(normAtX(xa + sw / 2), dark, alpha);
        quad([ctr([xa, 0, 0]), ctr([xb, 0, 0]), ctr([xb, 0, BD]), ctr([xa, 0, BD])], col);
        quad([ctr([xa, BH, 0]), ctr([xb, BH, 0]), ctr([xb, BH, BD]), ctr([xa, BH, BD])], col);
        quad([ctr([xa, 0, 0]), ctr([xb, 0, 0]), ctr([xb, BH, 0]), ctr([xa, BH, 0])], col);
        quad([ctr([xa, 0, BD]), ctr([xb, 0, BD]), ctr([xb, BH, BD]), ctr([xa, BH, BD])], col);
      }
      quad(
        [ctr([0, 0, 0]), ctr([0, BH, 0]), ctr([0, BH, BD]), ctr([0, 0, BD])],
        rampColor(normAtX(0), dark, alpha),
      );
      quad(
        [ctr([BW, 0, 0]), ctr([BW, BH, 0]), ctr([BW, BH, BD]), ctr([BW, 0, BD])],
        rampColor(normAtX(BW), dark, alpha),
      );

      const V: Vec3[] = [
        [0, 0, 0], [BW, 0, 0], [BW, BH, 0], [0, BH, 0],
        [0, 0, BD], [BW, 0, BD], [BW, BH, BD], [0, BH, BD],
      ];
      const E: [number, number][] = [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7],
      ];
      for (const [a, b] of E) seg(ctr(V[a]), ctr(V[b]), faint);

      if (showParticles) {
        stepSlab3D(normAtX, BW, BH, BD, dt, slabRef);
        for (const q of slabRef.current) dot(ctr([q.x, q.y, q.z]), fit);
      }
    } else if (p.geometry === 'cylinder') {
      // Annular wall, axis horizontal; end caps shaded ring by ring so the
      // 1/r fall-off is visible as color. Axial length tracks its slider
      // (log-mapped, 0.01..100 cm), with the radius shrinking to keep the
      // whole shape inside the view.
      const tAx = Math.min(1, Math.max(0, (Math.log10(p.L) + 2) / 4));
      const ALf = 0.8 + 0.9 * tAx;
      const rOut = fit / Math.sqrt(1 + (ALf / 2) ** 2);
      const AL = ALf * rOut;
      const rIn = rOut * (p.r1 / p.r2);
      const toPhys = (rho: number) => (rho / rOut) * p.r2;

      const NR = 10;
      const NT = 26;
      const dr = (rOut - rIn) / NR;
      const dth = (Math.PI * 2) / NT;
      for (const end of [-AL / 2, AL / 2]) {
        for (let i = 0; i < NR; i++) {
          const rA = rIn + i * dr;
          const rB = rA + dr;
          // Translucent so the walkers stay visible through the surface at
          // any rotation — losing the particles was worse than losing a
          // little colour saturation.
          const col = rampColor(normAt(toPhys(rA + dr / 2)), dark, 0.55);
          for (let j = 0; j < NT; j++) {
            const t0 = j * dth;
            const t1 = t0 + dth;
            quad(
              [
                [end, rA * Math.sin(t0), rA * Math.cos(t0)],
                [end, rB * Math.sin(t0), rB * Math.cos(t0)],
                [end, rB * Math.sin(t1), rB * Math.cos(t1)],
                [end, rA * Math.sin(t1), rA * Math.cos(t1)],
              ],
              col,
            );
          }
        }
      }

      // Wireframe: boundary circles at each end plus a few generators.
      const NC = 48;
      for (const end of [-AL / 2, AL / 2]) {
        for (const r of [rIn, rOut]) {
          for (let j = 0; j < NC; j++) {
            const t0 = (j / NC) * Math.PI * 2;
            const t1 = ((j + 1) / NC) * Math.PI * 2;
            seg(
              [end, r * Math.sin(t0), r * Math.cos(t0)],
              [end, r * Math.sin(t1), r * Math.cos(t1)],
              r === rOut ? solid : faint,
            );
          }
        }
      }
      for (let k = 0; k < 4; k++) {
        const t = (k / 4) * Math.PI * 2;
        for (const r of [rIn, rOut]) {
          seg(
            [-AL / 2, r * Math.sin(t), r * Math.cos(t)],
            [AL / 2, r * Math.sin(t), r * Math.cos(t)],
            faint,
          );
        }
      }

      if (showParticles) {
        stepCyl3D((rho) => normAt(toPhys(rho)), rIn, rOut, AL, dt, cylRef);
        for (const q of cylRef.current) {
          dot([q.ax, q.rad * Math.sin(q.th), q.rad * Math.cos(q.th)], fit);
        }
      }
    } else {
      // Sphere with a quarter wedge cut away (model-space, so rotating the
      // view swings you around the cut). The two exposed flat faces are
      // shaded shell by shell.
      const rOut = fit;
      const rIn = rOut * (p.r1 / p.r2);
      const toPhys = (rho: number) => (rho / rOut) * p.r2;

      const NR = 10;
      const NA = 16;
      const dr = (rOut - rIn) / NR;
      const da = Math.PI / NA;
      for (let i = 0; i < NR; i++) {
        const rA = rIn + i * dr;
        const rB = rA + dr;
        const col = rampColor(normAt(toPhys(rA + dr / 2)), dark);
        for (let j = 0; j < NA; j++) {
          const a0 = -Math.PI / 2 + j * da;
          const a1 = a0 + da;
          // Face in the x = 0 plane (exposed toward +z).
          quad(
            [
              [0, rA * Math.sin(a0), rA * Math.cos(a0)],
              [0, rB * Math.sin(a0), rB * Math.cos(a0)],
              [0, rB * Math.sin(a1), rB * Math.cos(a1)],
              [0, rA * Math.sin(a1), rA * Math.cos(a1)],
            ],
            col,
          );
          // Face in the z = 0 plane (exposed toward +x).
          quad(
            [
              [rA * Math.cos(a0), rA * Math.sin(a0), 0],
              [rB * Math.cos(a0), rB * Math.sin(a0), 0],
              [rB * Math.cos(a1), rB * Math.sin(a1), 0],
              [rA * Math.cos(a1), rA * Math.sin(a1), 0],
            ],
            col,
          );
        }
      }

      if (showParticles) {
        stepSph3D((rho) => normAt(toPhys(rho)), rIn, rOut, dt, sphRef);
        for (const q of sphRef.current) dot([q.x, q.y, q.z], fit);
      }
    }

    items.sort((a, b) => a.z - b.z);
    for (const it of items) it.f();

    // Screen-space silhouettes for the sphere, so its outline stays a circle
    // no matter the rotation.
    if (p.geometry === 'sphere') {
      const rOut = fit;
      const rIn = rOut * (p.r1 / p.r2);
      ctx.strokeStyle = solid;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cyc, rOut * zm, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = faint;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cyc, rIn * zm, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Boundary labels pinned to the geometry itself, so they rotate with it
    // and there is never a question of which face is which.
    const chip = (v: Vec3, text: string) => {
      const [sx, sy] = px(view(v));
      ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
      const w = ctx.measureText(text).width;
      ctx.fillStyle = dark ? 'rgba(15,23,42,0.78)' : 'rgba(255,255,255,0.85)';
      ctx.fillRect(sx - w / 2 - 5, sy - 10, w + 10, 19);
      ctx.fillStyle = dark ? '#e2e8f0' : '#334155';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, sx, sy);
      ctx.textBaseline = 'alphabetic';
    };
    if (p.geometry === 'slab') {
      const tL = Math.min(1, Math.max(0, (Math.log10(p.L) + 4) / 4));
      const half = ((0.9 + 0.7 * tL) * (fit / 0.96)) / 2;
      chip([-half, 0, 0], `C₁ = ${fmtmM(p.C1)} mM · x = 0`);
      chip([half, 0, 0], `C₂ = ${fmtmM(p.C2)} mM · x = L`);
    } else {
      const tAx = Math.min(1, Math.max(0, (Math.log10(p.L) + 2) / 4));
      const ALf = 0.8 + 0.9 * tAx;
      const rOut =
        p.geometry === 'sphere' ? fit : fit / Math.sqrt(1 + (ALf / 2) ** 2);
      chip([0, 0, 0], `C₁ = ${fmtmM(p.C1)} mM · r₁ inner`);
      chip([0, rOut, 0], `C₂ = ${fmtmM(p.C2)} mM · r₂ outer`);
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('drag to rotate · scroll to zoom · double-click to reset', W - 10, H - 10);
  }, { running: loopRunning, redrawKey });

  // Pointer-driven orbit. Rotation lives in refs; while the animation loop is
  // off we bump rotTick so the static repaint path tracks the drag.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      yawRef.current += (e.clientX - lastX) * 0.008;
      pitchRef.current = Math.min(
        1.35,
        Math.max(-1.35, pitchRef.current - (e.clientY - lastY) * 0.008),
      );
      lastX = e.clientX;
      lastY = e.clientY;
      if (!loopRunning) setRotTick((t) => t + 1);
    };
    const up = (e: PointerEvent) => {
      dragging = false;
      el.releasePointerCapture(e.pointerId);
      el.style.cursor = 'grab';
    };
    const reset = () => {
      yawRef.current = 0.6;
      pitchRef.current = -0.35;
      zoomRef.current = 1;
      setRotTick((t) => t + 1);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomRef.current = Math.min(
        3,
        Math.max(0.5, zoomRef.current * Math.exp(-e.deltaY * 0.0012)),
      );
      if (!loopRunning) setRotTick((t) => t + 1);
    };

    el.style.cursor = 'grab';
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('dblclick', reset);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('dblclick', reset);
      el.removeEventListener('wheel', wheel);
    };
  }, [canvasRef, loopRunning]);

  return (
    <canvas
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label={`Rotatable 3D view of the concentration field in a ${params.geometry}, with diffusing particles`}
    />
  );
}

// ------------------------------------------------------------- walkers

function stepSlab3D(
  normAtX: (x: number) => number,
  BW: number,
  BH: number,
  BD: number,
  dt: number,
  ref: React.RefObject<P3[]>,
) {
  const list = ref.current!;
  const sigma = Math.sqrt(2 * D_VIS * dt);
  const binW = BW / SLAB_BINS;

  for (const q of list) {
    if (dt > 0) {
      q.x += sigma * gauss();
      q.y += sigma * gauss();
      q.z += sigma * gauss();
    }
    // Reflect off every wall; clamp so a resize cannot strand a walker.
    if (q.x < 0) q.x = -q.x;
    if (q.x > BW) q.x = 2 * BW - q.x;
    if (q.y < 0) q.y = -q.y;
    if (q.y > BH) q.y = 2 * BH - q.y;
    if (q.z < 0) q.z = -q.z;
    if (q.z > BD) q.z = 2 * BD - q.z;
    q.x = Math.min(BW, Math.max(0, q.x));
    q.y = Math.min(BH, Math.max(0, q.y));
    q.z = Math.min(BD, Math.max(0, q.z));
  }

  const targetFor = (bin: number) =>
    Math.round((SLAB_BUDGET / SLAB_BINS) * normAtX(binW * (bin + 0.5)) * 2);
  const spawn = (bin: number): P3 => ({
    x: binW * (bin + Math.random()),
    y: Math.random() * BH,
    z: Math.random() * BD,
  });

  if (list.length === 0) {
    for (let bin = 0; bin < SLAB_BINS; bin++) {
      const want = targetFor(bin);
      for (let k = 0; k < want; k++) list.push(spawn(bin));
    }
    return;
  }

  // Dirichlet edge bins, interior strictly untouched — same contract as 2D.
  for (let i = list.length - 1; i >= 0; i--) {
    const bin = Math.floor(list[i].x / binW);
    if (bin <= 0 || bin >= SLAB_BINS - 1) list.splice(i, 1);
  }
  for (const bin of [0, SLAB_BINS - 1]) {
    const want = targetFor(bin);
    for (let k = 0; k < want; k++) list.push(spawn(bin));
  }
}

function stepCyl3D(
  normAtR: (rho: number) => number,
  rIn: number,
  rOut: number,
  AL: number,
  dt: number,
  ref: React.RefObject<PCyl[]>,
) {
  const list = ref.current!;
  const sigma = Math.sqrt(2 * D_VIS * dt);
  const shell = (rOut - rIn) / CYL_BINS;

  for (let i = list.length - 1; i >= 0; i--) {
    const q = list[i];
    if (dt > 0) {
      q.rad += sigma * gauss();
      q.th += (sigma * gauss()) / Math.max(q.rad, 1);
      q.ax += sigma * gauss();
      if (q.ax < -AL / 2) q.ax = -AL - q.ax;
      if (q.ax > AL / 2) q.ax = AL - q.ax;
    }
    if (q.rad < rIn || q.rad > rOut) list.splice(i, 1);
  }

  // Targets weighted by shell area so density matches the profile.
  const totalArea = rOut * rOut - rIn * rIn;
  const want = (bin: number) => {
    const rA = rIn + shell * bin;
    const rB = rA + shell;
    return Math.round(
      ((CYL_BUDGET * (rB * rB - rA * rA)) / totalArea) *
        normAtR(rA + shell / 2) * 2,
    );
  };
  const spawn = (bin: number): PCyl => {
    const rA = rIn + shell * bin;
    const rB = rA + shell;
    return {
      rad: Math.sqrt(rA * rA + Math.random() * (rB * rB - rA * rA)),
      th: Math.random() * Math.PI * 2,
      ax: (Math.random() - 0.5) * AL,
    };
  };

  if (list.length === 0) {
    for (let bin = 0; bin < CYL_BINS; bin++) {
      for (let k = 0; k < want(bin); k++) list.push(spawn(bin));
    }
    return;
  }

  for (const bin of [0, CYL_BINS - 1]) {
    const rA = rIn + shell * bin;
    const rB = rA + shell;
    const target = want(bin);
    let have = 0;
    for (const q of list) if (q.rad >= rA && q.rad < rB) have++;
    while (have < target) {
      list.push(spawn(bin));
      have++;
    }
    for (let i = list.length - 1; i >= 0 && have > target; i--) {
      if (list[i].rad >= rA && list[i].rad < rB) {
        list.splice(i, 1);
        have--;
      }
    }
  }
}

function stepSph3D(
  normAtR: (rho: number) => number,
  rIn: number,
  rOut: number,
  dt: number,
  ref: React.RefObject<P3[]>,
) {
  const list = ref.current!;
  const sigma = Math.sqrt(2 * D_VIS * dt);
  const shell = (rOut - rIn) / SPH_BINS;
  const inWedge = (q: P3) => q.x > 0 && q.z > 0;

  for (let i = list.length - 1; i >= 0; i--) {
    const q = list[i];
    if (dt > 0) {
      q.x += sigma * gauss();
      q.y += sigma * gauss();
      q.z += sigma * gauss();
      // The cutaway wedge is solid wall as far as walkers are concerned:
      // reflect the shallower coordinate back across its cut plane.
      if (inWedge(q)) {
        if (q.x < q.z) q.x = -q.x;
        else q.z = -q.z;
      }
    }
    const r = Math.hypot(q.x, q.y, q.z);
    if (r < rIn || r > rOut) list.splice(i, 1);
  }

  // Targets weighted by shell volume (minus the quarter wedge, which scales
  // every shell equally and therefore drops out of the weighting).
  const totalVol = rOut ** 3 - rIn ** 3;
  const want = (bin: number) => {
    const rA = rIn + shell * bin;
    const rB = rA + shell;
    return Math.round(
      ((SPH_BUDGET * (rB ** 3 - rA ** 3)) / totalVol) *
        normAtR(rA + shell / 2) * 2,
    );
  };
  const spawn = (bin: number): P3 => {
    const rA = rIn + shell * bin;
    const rB = rA + shell;
    for (let tries = 0; tries < 16; tries++) {
      const r = Math.cbrt(rA ** 3 + Math.random() * (rB ** 3 - rA ** 3));
      const u = Math.random() * 2 - 1;
      const phi = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const q: P3 = { x: r * s * Math.cos(phi), y: r * u, z: r * s * Math.sin(phi) };
      if (!inWedge(q)) return q;
    }
    return { x: -rA, y: 0, z: 0 };
  };
  const radius = (q: P3) => Math.hypot(q.x, q.y, q.z);

  if (list.length === 0) {
    for (let bin = 0; bin < SPH_BINS; bin++) {
      for (let k = 0; k < want(bin); k++) list.push(spawn(bin));
    }
    return;
  }

  for (const bin of [0, SPH_BINS - 1]) {
    const rA = rIn + shell * bin;
    const rB = rA + shell;
    const target = want(bin);
    let have = 0;
    for (const q of list) if (radius(q) >= rA && radius(q) < rB) have++;
    while (have < target) {
      list.push(spawn(bin));
      have++;
    }
    for (let i = list.length - 1; i >= 0 && have > target; i--) {
      const r = radius(list[i]);
      if (r >= rA && r < rB) {
        list.splice(i, 1);
        have--;
      }
    }
  }
}

function fmtmM(molPerCm3: number): string {
  const v = molPerCm3TomM(molPerCm3);
  return String(Number(v.toPrecision(3)));
}
