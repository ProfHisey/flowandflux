import { useEffect, useRef } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { temperature, type FourierParams } from '../../lib/fourier';
import { useOrbitCam, useOrbitControls, type OrbitCam } from '../shared/paint3d';
import { gauss } from '../FicksLaw/FickCanvas';
import { rampWarm } from './FourierCanvas';

/**
 * Rotatable 3D view for conduction, sharing the Fick 3D view's approach:
 * orthographic projection, drag-to-orbit, depth-sorted painter's algorithm
 * on the plain 2D canvas.
 *
 * The one deliberate difference from the mass version: molecules here are
 * ANCHORED. They jiggle around fixed positions, harder where it is hot, and
 * their density is uniform everywhere — because in a conducting solid the
 * matter stays put and only energy travels. Spin the two views side by side
 * and the mass/heat distinction is visible rather than asserted.
 */

type Vec3 = [number, number, number];

interface M3 {
  /** Anchor. */
  x: number;
  y: number;
  z: number;
  /** Jiggle offset. */
  ox: number;
  oy: number;
  oz: number;
  /** 0..1 temperature at the anchor, cached for amplitude and tint. */
  u: number;
}

const SLAB_COUNT = 750;
const CYL_COUNT = 800;
const SPH_COUNT = 1000;

export function Fourier3DCanvas({
  params,
  showMolecules,
  running,
  dark,
  cam: camProp,
}: {
  params: FourierParams;
  showMolecules: boolean;
  running: boolean;
  dark: boolean;
  /** Optional shared camera for the seamless 2D-to-3D handoff. */
  cam?: OrbitCam;
}) {
  const molsRef = useRef<M3[]>([]);
  const geomKeyRef = useRef('');
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const internalCam = useOrbitCam(0.6, -0.35);
  const cam = camProp ?? internalCam;
  const { yawRef, pitchRef, zoomRef } = cam;

  const redrawKey = `${params.geometry}|${params.k}|${params.T1}|${params.T2}|${params.L}|${params.r1}|${params.r2}|${dark}|${showMolecules}|${cam.camTick}`;

  useEffect(() => {
    molsRef.current = [];
  }, [params.geometry, params.T1, params.T2, params.r1, params.r2]);

  const loopRunning = running && showMolecules;

  const canvasRef = useCanvas((ctx, frame) => {
    const p = paramsRef.current;
    const { width: W, height: H } = frame;
    const cx = W / 2;
    const cyc = H / 2;

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
    // Molecules wear their own temperature as color (Aug 2026 review: the
    // face-shading alone did not carry the field in 3D).
    const dot = (v: Vec3, R: number, u = -1) => {
      const vv = view(v);
      const depth = Math.min(1, Math.max(0, vv[2] / R / 2 + 0.5));
      items.push({
        z: vv[2],
        f: () => {
          if (u >= 0) {
            ctx.fillStyle = rampWarm(u, dark, 0.45 + 0.55 * depth);
          } else {
            const dotColor = dark ? '226,232,240' : '15,23,42';
            ctx.fillStyle = `rgba(${dotColor},${(0.3 + 0.55 * depth).toFixed(2)})`;
          }
          ctx.beginPath();
          const [ax, ay] = px(vv);
          ctx.arc(ax, ay, (1.3 + 1.3 * depth) * zm, 0, Math.PI * 2);
          ctx.fill();
        },
      });
    };

    const tLo = Math.min(p.T1, p.T2);
    const span = Math.abs(p.T1 - p.T2) || 1;
    const normAt = (s: number) => (temperature(p, s) - tLo) / span;

    const faint = dark ? 'rgba(148,163,184,0.35)' : 'rgba(148,163,184,0.55)';
    const solid = dark ? '#64748b' : '#94a3b8';
    const fit = Math.min(W, H) / 2 - 26;
    const dt = loopRunning ? frame.dt : 0;

    const jiggle = (q: M3) => {
      const amp = 0.7 + 4.2 * q.u;
      if (dt > 0) {
        q.ox = 0.55 * q.ox + 0.45 * amp * gauss() * 0.8;
        q.oy = 0.55 * q.oy + 0.45 * amp * gauss() * 0.8;
        q.oz = 0.55 * q.oz + 0.45 * amp * gauss() * 0.8;
      }
    };

    if (p.geometry === 'slab') {
      // Width tracks the thickness slider (log-mapped, 1e-3..1 m).
      const tL = Math.min(1, Math.max(0, (Math.log10(p.L) + 3) / 3));
      const u = fit / 0.96;
      const BW = (0.9 + 0.7 * tL) * u;
      const BH = 0.75 * u;
      const BD = 0.75 * u;
      const normAtX = (x: number) => normAt((x / BW) * p.L);
      const ctr = (v: Vec3): Vec3 => [v[0] - BW / 2, v[1] - BH / 2, v[2] - BD / 2];

      const alpha = 0.25;
      const NS = 18;
      const sw = BW / NS;
      for (let i = 0; i < NS; i++) {
        const xa = i * sw;
        const xb = xa + sw;
        const col = rampWarm(normAtX(xa + sw / 2), dark, alpha);
        quad([ctr([xa, 0, 0]), ctr([xb, 0, 0]), ctr([xb, 0, BD]), ctr([xa, 0, BD])], col);
        quad([ctr([xa, BH, 0]), ctr([xb, BH, 0]), ctr([xb, BH, BD]), ctr([xa, BH, BD])], col);
        quad([ctr([xa, 0, 0]), ctr([xb, 0, 0]), ctr([xb, BH, 0]), ctr([xa, BH, 0])], col);
        quad([ctr([xa, 0, BD]), ctr([xb, 0, BD]), ctr([xb, BH, BD]), ctr([xa, BH, BD])], col);
      }
      quad(
        [ctr([0, 0, 0]), ctr([0, BH, 0]), ctr([0, BH, BD]), ctr([0, 0, BD])],
        rampWarm(normAtX(0), dark, alpha),
      );
      quad(
        [ctr([BW, 0, 0]), ctr([BW, BH, 0]), ctr([BW, BH, BD]), ctr([BW, 0, BD])],
        rampWarm(normAtX(BW), dark, alpha),
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

      if (showMolecules) {
        const key = `slab|${BW.toFixed(0)}|${BH.toFixed(0)}|${BD.toFixed(0)}`;
        if (molsRef.current.length === 0 || geomKeyRef.current !== key) {
          geomKeyRef.current = key;
          const list: M3[] = [];
          for (let n = 0; n < SLAB_COUNT; n++) {
            const x = Math.random() * BW;
            list.push({
              x, y: Math.random() * BH, z: Math.random() * BD,
              ox: 0, oy: 0, oz: 0, u: Math.min(1, Math.max(0, normAtX(x))),
            });
          }
          molsRef.current = list;
        }
        for (const q of molsRef.current) {
          jiggle(q);
          dot(ctr([q.x + q.ox, q.y + q.oy, q.z + q.oz]), fit, q.u);
        }
      }
    } else if (p.geometry === 'cylinder') {
      // Axial length tracks its slider (log-mapped, 0.1..10 m).
      const tAx = Math.min(1, Math.max(0, (Math.log10(p.L) + 1) / 2));
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
          // Translucent so the vibrating molecules stay visible through the
          // surface at any rotation.
          const col = rampWarm(normAt(toPhys(rA + dr / 2)), dark, 0.55);
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

      if (showMolecules) {
        const key = `cyl|${rOut.toFixed(0)}|${rIn.toFixed(0)}`;
        if (molsRef.current.length === 0 || geomKeyRef.current !== key) {
          geomKeyRef.current = key;
          const list: M3[] = [];
          for (let n = 0; n < CYL_COUNT; n++) {
            const rad = Math.sqrt(rIn * rIn + Math.random() * (rOut * rOut - rIn * rIn));
            const th = Math.random() * Math.PI * 2;
            list.push({
              x: (Math.random() - 0.5) * AL,
              y: rad * Math.sin(th),
              z: rad * Math.cos(th),
              ox: 0, oy: 0, oz: 0,
              u: Math.min(1, Math.max(0, normAt(toPhys(rad)))),
            });
          }
          molsRef.current = list;
        }
        for (const q of molsRef.current) {
          jiggle(q);
          dot([q.x + q.ox, q.y + q.oy, q.z + q.oz], fit, q.u);
        }
      }
    } else {
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
        const col = rampWarm(normAt(toPhys(rA + dr / 2)), dark);
        for (let j = 0; j < NA; j++) {
          const a0 = -Math.PI / 2 + j * da;
          const a1 = a0 + da;
          quad(
            [
              [0, rA * Math.sin(a0), rA * Math.cos(a0)],
              [0, rB * Math.sin(a0), rB * Math.cos(a0)],
              [0, rB * Math.sin(a1), rB * Math.cos(a1)],
              [0, rA * Math.sin(a1), rA * Math.cos(a1)],
            ],
            col,
          );
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

      if (showMolecules) {
        const key = `sph|${rOut.toFixed(0)}|${rIn.toFixed(0)}`;
        if (molsRef.current.length === 0 || geomKeyRef.current !== key) {
          geomKeyRef.current = key;
          const list: M3[] = [];
          let guard = 0;
          while (list.length < SPH_COUNT && guard < SPH_COUNT * 40) {
            guard++;
            const r = Math.cbrt(rIn ** 3 + Math.random() * (rOut ** 3 - rIn ** 3));
            const u = Math.random() * 2 - 1;
            const phi = Math.random() * Math.PI * 2;
            const s = Math.sqrt(1 - u * u);
            const x = r * s * Math.cos(phi);
            const z = r * s * Math.sin(phi);
            if (x > 0 && z > 0) continue; // stay out of the cutaway wedge
            list.push({
              x, y: r * u, z, ox: 0, oy: 0, oz: 0,
              u: Math.min(1, Math.max(0, normAt(toPhys(r)))),
            });
          }
          molsRef.current = list;
        }
        for (const q of molsRef.current) {
          jiggle(q);
          dot([q.x + q.ox, q.y + q.oy, q.z + q.oz], fit, q.u);
        }
      }
    }

    items.sort((a, b) => a.z - b.z);
    for (const it of items) it.f();

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
    // Short symbol chips on the geometry; numbers in the corner legend so
    // the labels never bury the object (Aug 2026 review).
    if (p.geometry === 'slab') {
      const tL = Math.min(1, Math.max(0, (Math.log10(p.L) + 3) / 3));
      const half = ((0.9 + 0.7 * tL) * (fit / 0.96)) / 2;
      chip([-half, 0, 0], 'x = 0');
      chip([half, 0, 0], 'x = L');
    } else {
      const tAx = Math.min(1, Math.max(0, (Math.log10(p.L) + 1) / 2));
      const ALf = 0.8 + 0.9 * tAx;
      const rOut =
        p.geometry === 'sphere' ? fit : fit / Math.sqrt(1 + (ALf / 2) ** 2);
      chip([0, 0, 0], 'r₁');
      chip([0, rOut, 0], 'r₂');
    }

    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      p.geometry === 'slab'
        ? `T₁ = ${fmtT(p.T1)} °C at x = 0 · T₂ = ${fmtT(p.T2)} °C at x = L`
        : `T₁ = ${fmtT(p.T1)} °C at r₁ (inner) · T₂ = ${fmtT(p.T2)} °C at r₂ (outer)`,
      10,
      H - 10,
    );
    ctx.textAlign = 'right';
    ctx.fillText('drag to rotate · scroll to zoom · double-click to reset', W - 10, H - 28);
  }, { running: loopRunning, redrawKey });

  useOrbitControls(canvasRef, cam, loopRunning);

  return (
    <canvas
      role="img"
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label={`Rotatable 3D view of the temperature field in a ${params.geometry}, with molecules vibrating in place`}
    />
  );
}

function fmtT(T: number): string {
  return String(Number(T.toPrecision(4)));
}
