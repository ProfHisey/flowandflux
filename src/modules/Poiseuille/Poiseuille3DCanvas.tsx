import { useEffect, useRef } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import type { PoiseuilleParams } from '../../lib/poiseuille';
import { useOrbitCam, useOrbitControls, type OrbitCam } from '../shared/paint3d';
import { rampFlow } from '../NewtonViscosity/NewtonCanvas';

/**
 * The three canonical Navier-Stokes solutions in 3D: tube, parallel
 * plates, falling film. Tracers ride the real profile SHAPE, and a dye
 * front is released periodically — a flat disk (or sheet) of dye that the
 * flow immediately deforms into the classic bullet (or curtain): the
 * velocity profile made solid, the single most photographed demo in
 * viscous flow.
 *
 * Drag to orbit, scroll to zoom. On-screen speeds are fixed for
 * legibility; the SHAPES are the physics.
 */

type Vec3 = [number, number, number];

const V3 = 55; // px/s at the profile peak — cosmetic
const N_TRACE = 150;

interface Tr {
  /** streamwise position, px */
  a: number;
  /** transverse fraction(s) */
  f1: number;
  f2: number;
}

export function Poiseuille3DCanvas({
  params,
  showParticles,
  running,
  dark,
  cam: camProp,
}: {
  params: PoiseuilleParams;
  showParticles: boolean;
  running: boolean;
  dark: boolean;
  /** Optional shared camera for the seamless 2D-to-3D handoff. */
  cam?: OrbitCam;
}) {
  const tracersRef = useRef<Tr[]>([]);
  const dyeAgeRef = useRef(0);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const internalCam = useOrbitCam(0.65, -0.3);
  const cam = camProp ?? internalCam;
  const { yawRef, pitchRef, zoomRef } = cam;

  const redrawKey = `${JSON.stringify(params)}|${dark}|${showParticles}|${cam.camTick}`;

  useEffect(() => {
    tracersRef.current = [];
    dyeAgeRef.current = 0;
  }, [params.geometry]);

  const loopRunning = running && showParticles;

  const canvasRef = useCanvas((ctx, frame) => {
    const p = paramsRef.current;
    const { width: W, height: H } = frame;
    const cx = W / 2;
    const cyc = H / 2;
    const dt = loopRunning ? frame.dt : 0;

    const cy = Math.cos(yawRef.current);
    const sy = Math.sin(yawRef.current);
    const cp = Math.cos(pitchRef.current);
    const sp = Math.sin(pitchRef.current);
    const view = (v: Vec3): Vec3 => {
      const x = cy * v[0] + sy * v[2];
      const z1 = -sy * v[0] + cy * v[2];
      const y = cp * v[1] - sp * z1;
      const z = sp * v[1] + cp * z1;
      return [x, y, z];
    };
    const zm = zoomRef.current;
    const px = (v: Vec3): [number, number] => [cx + v[0] * zm, cyc - v[1] * zm];

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
          ctx.arc(ax, ay, (1.2 + 1.1 * depth) * zm, 0, Math.PI * 2);
          ctx.fill();
        },
      });
    };

    const faint = dark ? 'rgba(148,163,184,0.35)' : 'rgba(148,163,184,0.55)';
    const solid = dark ? '#64748b' : '#94a3b8';
    const dye = dark ? 'rgba(232,121,249,0.9)' : 'rgba(192,38,211,0.85)';
    const fit = Math.min(W, H) / 2 - 26;

    // Drawn size tracks the sliders (log-mapped), same policy as 2D.
    const sDim = p.geometry === 'tube' ? p.R : p.h;
    const tS = Math.min(1, Math.max(0, (Math.log10(sDim) + 4.3) / 2));
    const tLs = Math.min(1, Math.max(0, (Math.log10(p.L) + 2) / 2));
    const tW = Math.min(1, Math.max(0, (Math.log10(p.W) + 2.3) / 2.3)); // 0.005..1 m

    // Dye front clock: reset when the fastest dye reaches ~80% of the run.
    const TL = 1.7 * fit * (p.geometry === 'film' ? 1 : 0.75 + 0.25 * tLs);
    const maxAge = (0.8 * TL) / V3;
    dyeAgeRef.current = (dyeAgeRef.current + dt) % maxAge;
    const age = dyeAgeRef.current;
    const xStart = -TL / 2 + 0.06 * TL;

    const chipQueue: [Vec3, string][] = [];

    if (p.geometry === 'tube') {
      const R = 0.42 * fit * (0.5 + 0.5 * tS);
      const vfrac = (r: number) => 1 - (r / R) ** 2;

      // Wireframe tube.
      const NC = 40;
      for (const end of [-TL / 2, TL / 2]) {
        for (let j = 0; j < NC; j++) {
          const t0 = (j / NC) * Math.PI * 2;
          const t1 = ((j + 1) / NC) * Math.PI * 2;
          seg(
            [end, R * Math.sin(t0), R * Math.cos(t0)],
            [end, R * Math.sin(t1), R * Math.cos(t1)],
            solid,
          );
        }
      }
      for (let k = 0; k < 6; k++) {
        const t = (k / 6) * Math.PI * 2;
        seg([-TL / 2, R * Math.sin(t), R * Math.cos(t)], [TL / 2, R * Math.sin(t), R * Math.cos(t)], faint);
      }

      // Tracers.
      if (showParticles) {
        const list = tracersRef.current;
        if (list.length === 0) {
          for (let i = 0; i < N_TRACE; i++) {
            list.push({
              a: -TL / 2 + Math.random() * TL,
              f1: Math.sqrt(Math.random()) * 0.96, // r/R, area-uniform
              f2: Math.random() * Math.PI * 2,
            });
          }
        }
        for (const q of list) {
          if (dt > 0) {
            q.a += vfrac(q.f1 * R) * V3 * dt;
            if (q.a > TL / 2) q.a = -TL / 2;
          }
          dot([q.a, q.f1 * R * Math.sin(q.f2), q.f1 * R * Math.cos(q.f2)], fit);
        }

        // The dye front: released flat, deformed into the bullet.
        const NR = 12;
        const NT = 24;
        for (let i = 0; i < NR; i++) {
          const rA = (i / NR) * R * 0.97;
          const rB = ((i + 1) / NR) * R * 0.97;
          const xa = xStart + vfrac(rA) * V3 * age;
          const xb = xStart + vfrac(rB) * V3 * age;
          for (let j = 0; j < NT; j++) {
            const t0 = (j / NT) * Math.PI * 2;
            const t1 = ((j + 1) / NT) * Math.PI * 2;
            quad(
              [
                [xa, rA * Math.sin(t0), rA * Math.cos(t0)],
                [xb, rB * Math.sin(t0), rB * Math.cos(t0)],
                [xb, rB * Math.sin(t1), rB * Math.cos(t1)],
                [xa, rA * Math.sin(t1), rA * Math.cos(t1)],
              ],
              dark ? 'rgba(232,121,249,0.35)' : 'rgba(192,38,211,0.3)',
            );
          }
        }
        seg([xStart, -R, 0], [xStart, R, 0], dye, 1.5);
      }
      chipQueue.push([[0, -R - 18, 0], 'rigid wall all around · no slip']);
      chipQueue.push([[TL / 2 - 30, R + 18, 0], 'v_max = 2v̄ on the axis']);
    } else if (p.geometry === 'plates') {
      const G = 0.5 * fit * (0.5 + 0.5 * tS); // gap height
      const BD = 0.8 * fit * (0.6 + 0.4 * tW);
      const vfrac = (yf: number) => 4 * yf * (1 - yf); // y/h in 0..1

      // Plates as thin slabs.
      const plateT = 0.07 * fit;
      const plate = (yA: number, yB: number) => {
        const V: Vec3[] = [
          [-TL / 2, yA, -BD / 2], [TL / 2, yA, -BD / 2], [TL / 2, yB, -BD / 2], [-TL / 2, yB, -BD / 2],
          [-TL / 2, yA, BD / 2], [TL / 2, yA, BD / 2], [TL / 2, yB, BD / 2], [-TL / 2, yB, BD / 2],
        ];
        const fill = dark ? 'rgba(63,76,99,0.95)' : 'rgba(221,227,236,0.95)';
        quad([V[0], V[1], V[2], V[3]], fill);
        quad([V[4], V[5], V[6], V[7]], fill);
        quad([V[0], V[3], V[7], V[4]], fill);
        quad([V[1], V[2], V[6], V[5]], fill);
        quad([V[3], V[2], V[6], V[7]], fill);
        quad([V[0], V[1], V[5], V[4]], fill);
        for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]] as const) {
          seg(V[a], V[b], faint, 1);
        }
      };
      plate(G / 2, G / 2 + plateT);
      plate(-G / 2 - plateT, -G / 2);

      if (showParticles) {
        const list = tracersRef.current;
        if (list.length === 0) {
          for (let i = 0; i < N_TRACE; i++) {
            list.push({
              a: -TL / 2 + Math.random() * TL,
              f1: Math.random(), // y fraction
              f2: Math.random(), // z fraction
            });
          }
        }
        for (const q of list) {
          if (dt > 0) {
            q.a += vfrac(q.f1) * V3 * dt;
            if (q.a > TL / 2) q.a = -TL / 2;
          }
          dot([q.a, -G / 2 + q.f1 * G, -BD / 2 + q.f2 * BD], fit);
        }
        // Dye curtain: flat sheet deforming into a parabola.
        const NY = 16;
        for (let i = 0; i < NY; i++) {
          const yA = i / NY;
          const yB = (i + 1) / NY;
          const xa = xStart + vfrac(yA) * V3 * age;
          const xb = xStart + vfrac(yB) * V3 * age;
          quad(
            [
              [xa, -G / 2 + yA * G, -BD / 2],
              [xa, -G / 2 + yA * G, BD / 2],
              [xb, -G / 2 + yB * G, BD / 2],
              [xb, -G / 2 + yB * G, -BD / 2],
            ],
            dark ? 'rgba(232,121,249,0.32)' : 'rgba(192,38,211,0.28)',
          );
        }
      }
      chipQueue.push([[0, G / 2 + plateT + 14, 0], 'both plates fixed · no slip top and bottom']);
      chipQueue.push([[TL / 2 - 40, -G / 2 - plateT - 14, 0], 'v_max = 1.5v̄ at mid-gap']);
    } else {
      // Falling film: a vertical wall, flow downward (-y).
      const FH = 1.5 * fit; // fall height
      const FT = 0.34 * fit * (0.45 + 0.55 * tS); // film thickness on screen
      const BD = 0.7 * fit * (0.6 + 0.4 * tW);
      const wallT = 0.08 * fit;
      const vfrac = (zf: number) => 2 * zf - zf * zf; // z/h in 0..1, max at surface

      // The wall (at z in [-FT/2 - wallT, -FT/2]).
      const V: Vec3[] = [
        [-BD / 2, -FH / 2, -FT / 2 - wallT], [BD / 2, -FH / 2, -FT / 2 - wallT],
        [BD / 2, FH / 2, -FT / 2 - wallT], [-BD / 2, FH / 2, -FT / 2 - wallT],
        [-BD / 2, -FH / 2, -FT / 2], [BD / 2, -FH / 2, -FT / 2],
        [BD / 2, FH / 2, -FT / 2], [-BD / 2, FH / 2, -FT / 2],
      ];
      const wallFill = dark ? 'rgba(63,76,99,0.95)' : 'rgba(221,227,236,0.95)';
      quad([V[0], V[1], V[2], V[3]], wallFill);
      quad([V[4], V[5], V[6], V[7]], wallFill);
      quad([V[0], V[3], V[7], V[4]], wallFill);
      quad([V[1], V[2], V[6], V[5]], wallFill);
      quad([V[3], V[2], V[6], V[7]], wallFill);
      quad([V[0], V[1], V[5], V[4]], wallFill);
      // Free surface, dashed-ish (thin translucent sheet).
      quad(
        [
          [-BD / 2, -FH / 2, FT / 2], [BD / 2, -FH / 2, FT / 2],
          [BD / 2, FH / 2, FT / 2], [-BD / 2, FH / 2, FT / 2],
        ],
        dark ? 'rgba(56,189,248,0.12)' : 'rgba(2,132,199,0.1)',
      );
      for (const zz of [FT / 2]) {
        seg([-BD / 2, -FH / 2, zz], [-BD / 2, FH / 2, zz], rampFlow(1, dark, 0.6), 1);
        seg([BD / 2, -FH / 2, zz], [BD / 2, FH / 2, zz], rampFlow(1, dark, 0.6), 1);
      }

      if (showParticles) {
        const list = tracersRef.current;
        if (list.length === 0) {
          for (let i = 0; i < N_TRACE; i++) {
            list.push({
              a: -FH / 2 + Math.random() * FH, // vertical position
              f1: Math.random(), // z fraction across the film
              f2: Math.random(), // x fraction across the breadth
            });
          }
        }
        for (const q of list) {
          if (dt > 0) {
            q.a -= vfrac(q.f1) * V3 * dt; // downward
            if (q.a < -FH / 2) q.a = FH / 2;
          }
          dot([-BD / 2 + q.f2 * BD, q.a, -FT / 2 + q.f1 * FT], fit);
        }
        // Dye sheet: a horizontal line of dye sagging into the half-parabola.
        const NZ = 14;
        const yStart = FH / 2 - 0.06 * FH;
        for (let i = 0; i < NZ; i++) {
          const zA = i / NZ;
          const zB = (i + 1) / NZ;
          const ya = yStart - vfrac(zA) * V3 * age;
          const yb = yStart - vfrac(zB) * V3 * age;
          quad(
            [
              [-BD / 2, ya, -FT / 2 + zA * FT],
              [BD / 2, ya, -FT / 2 + zA * FT],
              [BD / 2, yb, -FT / 2 + zB * FT],
              [-BD / 2, yb, -FT / 2 + zB * FT],
            ],
            dark ? 'rgba(232,121,249,0.32)' : 'rgba(192,38,211,0.28)',
          );
        }
      }
      chipQueue.push([[0, FH / 2 + 14, -FT / 2 - wallT / 2], 'wall · no slip']);
      chipQueue.push([[0, -FH / 2 - 14, FT / 2], 'free surface · zero shear, max speed']);
    }

    items.sort((a, b) => a.z - b.z);
    for (const it of items) it.f();

    // Chips.
    const chip = (v: Vec3, text: string) => {
      const [sx2, sy2] = px(view(v));
      ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
      const w = ctx.measureText(text).width;
      ctx.fillStyle = dark ? 'rgba(15,23,42,0.78)' : 'rgba(255,255,255,0.85)';
      ctx.fillRect(sx2 - w / 2 - 5, sy2 - 10, w + 10, 19);
      ctx.fillStyle = dark ? '#e2e8f0' : '#334155';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, sx2, sy2);
      ctx.textBaseline = 'alphabetic';
    };
    for (const [v, t] of chipQueue) chip(v, t);

    ctx.textAlign = 'right';
    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('drag to rotate · scroll to zoom · double-click to reset', W - 10, H - 10);
    ctx.textAlign = 'left';
    ctx.fillText('fuchsia: a flat dye front, deformed by the profile itself', 10, H - 10);
  }, { running: loopRunning, redrawKey });

  useOrbitControls(canvasRef, cam, loopRunning);

  return (
    <canvas
      role="img"
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label={`Rotatable 3D ${params.geometry} flow with tracers and a dye front deforming into the velocity profile`}
    />
  );
}
