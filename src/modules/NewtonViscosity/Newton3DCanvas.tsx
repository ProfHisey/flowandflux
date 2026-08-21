import { useEffect, useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import type { NewtonParams } from '../../lib/newton';
import { rampFlow, type NewtonView } from './NewtonCanvas';

/**
 * Rotatable 3D view for Couette flow, on the same machinery as the Fick and
 * Fourier 3D views (orthographic, drag-to-orbit, scroll zoom, depth-sorted
 * painter on plain canvas 2D).
 *
 * The 2D lanes become what they always secretly were: SHEETS. And the two
 * design points Prof. Hisey asked for are built in deliberately:
 *
 *  - The plates are OPAQUE and heavily textured (cross-hatched, top and
 *    front), because the no-slip grip at the moving plate is what drives
 *    the whole system — the eye must land on that plate first.
 *  - The outermost fluid sheets sit flush against the plates and move at
 *    exactly the plate speeds: the top sheet rides with the marching
 *    hatching, the bottom sheet sits dead still. That IS the no-slip
 *    condition, drawn rather than asserted.
 *
 * Two tracer styles, matching the 2D tabs: 'links' (grip curtains between
 * sheets — the force picture) and 'dye' (dye curtains tilting into the
 * profile plus a cube shearing into a parallelepiped — the kinematics
 * picture).
 */

type Vec3 = [number, number, number];

const LAYERS = 7;
const PER_X = 9;
const PER_Z = 5;
/** Top-sheet speed on screen, px/s. Visual, like D_VIS. */
const U_VIS3 = 55;

export function Newton3DCanvas({
  params,
  view,
  showParticles,
  running,
  dark,
}: {
  params: NewtonParams;
  view: NewtonView;
  showParticles: boolean;
  running: boolean;
  dark: boolean;
}) {
  const offsetsRef = useRef<number[]>([]);
  const patternRef = useRef<number[][]>([]);
  const zRowsRef = useRef<number[]>([]);
  const plateShiftRef = useRef(0);
  /** Dye clock and curtain birth times. */
  const timeRef = useRef(0);
  const stripesRef = useRef<number[]>([]);
  const lastInjectRef = useRef(-Infinity);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const yawRef = useRef(0.6);
  const pitchRef = useRef(-0.3);
  const zoomRef = useRef(1);
  const [rotTick, setRotTick] = useState(0);

  const redrawKey = `${params.mu}|${params.U}|${params.H}|${params.A}|${dark}|${showParticles}|${view}|${rotTick}`;

  useEffect(() => {
    offsetsRef.current = [];
    patternRef.current = [];
    zRowsRef.current = [];
    timeRef.current = 0;
    stripesRef.current = [];
    lastInjectRef.current = -Infinity;
  }, [view]);

  const loopRunning = running && showParticles;

  const canvasRef = useCanvas((ctx, frame) => {
    const p = paramsRef.current;
    const { width: W, height: H } = frame;
    const cx = W / 2;
    const cyc = H / 2;

    const cy = Math.cos(yawRef.current);
    const sy = Math.sin(yawRef.current);
    const cp = Math.cos(pitchRef.current);
    const sp = Math.sin(pitchRef.current);
    const view3 = (v: Vec3): Vec3 => {
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
      const vs = pts.map(view3) as Vec3[];
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
      const va = view3(a);
      const vb = view3(b);
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
      const vv = view3(v);
      const depth = Math.min(1, Math.max(0, vv[2] / R / 2 + 0.5));
      items.push({
        z: vv[2],
        f: () => {
          ctx.fillStyle = `rgba(${dotColor},${(0.35 + 0.55 * depth).toFixed(2)})`;
          ctx.beginPath();
          const [ax, ay] = px(vv);
          ctx.arc(ax, ay, (1.3 + 1.2 * depth) * zm, 0, Math.PI * 2);
          ctx.fill();
        },
      });
    };

    const faint = dark ? 'rgba(148,163,184,0.35)' : 'rgba(148,163,184,0.55)';
    const fit = Math.min(W, H) / 2 - 26;
    const dt = loopRunning ? frame.dt : 0;

    const u = fit / 0.96;
    const BW = 1.6 * u;
    // The gap height tracks the H slider (log-mapped).
    const tH = Math.min(1, Math.max(0, (Math.log10(p.H) + 5) / 3));
    const BH = 0.75 * u * (0.45 + 0.55 * tH);
    const BD = 0.75 * u;
    const plateT = 0.11 * u;
    const ctr = (v: Vec3): Vec3 => [v[0] - BW / 2, v[1] - BH / 2, v[2] - BD / 2];

    const uVisAt = (y: number) => (U_VIS3 * y) / BH;

    // ------------------------------------------------------------ plates
    // Opaque and heavily textured on purpose: the no-slip grip at the
    // moving plate is what drives everything, so the plate must read as a
    // real, rough surface — not a ghost.
    const plateFill = dark ? '#3f4c63' : '#dde3ec';
    const hatchCol = dark ? 'rgba(226,232,240,0.5)' : 'rgba(71,85,105,0.5)';
    plateShiftRef.current = (plateShiftRef.current + U_VIS3 * dt) % 16;
    // Parametric clip of the segment (xa,pa)->(xb,pb) to x in [0, BW]:
    // returns the clipped endpoints or null.
    const clipX = (
      xa: number, pa: number, xb: number, pb: number,
    ): [number, number, number, number] | null => {
      const dx = xb - xa;
      if (Math.abs(dx) < 1e-9) {
        return xa >= 0 && xa <= BW ? [xa, pa, xb, pb] : null;
      }
      const tA = (0 - xa) / dx;
      const tB = (BW - xa) / dx;
      const t0 = Math.max(0, Math.min(tA, tB));
      const t1 = Math.min(1, Math.max(tA, tB));
      if (t0 >= t1) return null;
      return [
        xa + dx * t0, pa + (pb - pa) * t0,
        xa + dx * t1, pa + (pb - pa) * t1,
      ];
    };
    // A face and its hatch stripes must be ONE sorted item: stripes pushed
    // as independent segments get their own depths, and every stripe that
    // sorts behind the face's centroid is painted first and then buried
    // under the fill — half the hatching vanished along a camera-dependent
    // diagonal. Fill-then-stroke in a single callback cannot self-occlude.
    const hatchedQuad = (pts: [Vec3, Vec3, Vec3, Vec3], stripes: [Vec3, Vec3][]) => {
      const vs = pts.map(view3) as Vec3[];
      const svs = stripes.map(([a, b]) => [view3(a), view3(b)] as [Vec3, Vec3]);
      items.push({
        z: (vs[0][2] + vs[1][2] + vs[2][2] + vs[3][2]) / 4,
        f: () => {
          ctx.fillStyle = plateFill;
          ctx.beginPath();
          const [ax, ay] = px(vs[0]);
          ctx.moveTo(ax, ay);
          for (let i = 1; i < 4; i++) {
            const [bx, by] = px(vs[i]);
            ctx.lineTo(bx, by);
          }
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = hatchCol;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          for (const [va, vb] of svs) {
            const [sx, sy2] = px(va);
            const [ex, ey] = px(vb);
            ctx.moveTo(sx, sy2);
            ctx.lineTo(ex, ey);
          }
          ctx.stroke();
        },
      });
    };
    // One plate: cross-hatch the outward horizontal face plus BOTH front
    // and back faces (so it stays a real, rough surface from any angle).
    // The top plate's texture marches at the plate speed; the bottom
    // plate's sits still — the driving boundary condition, visible.
    const plate = (yA: number, yB: number, yOut: number, offset: number) => {
      const flat: [Vec3, Vec3][] = [];
      const front: [Vec3, Vec3][] = [];
      const back: [Vec3, Vec3][] = [];
      for (const dir of [1, -1] as const) {
        for (let d = -2 * BD; d < BW + 2 * BD; d += 16) {
          const s0 = d + offset;
          const fl = clipX(s0, 0, s0 + dir * BD, BD);
          if (fl) flat.push([ctr([fl[0], yOut, fl[1]]), ctr([fl[2], yOut, fl[3]])]);
          const fr = clipX(s0, yA, s0 + dir * plateT, yB);
          if (fr) {
            front.push([ctr([fr[0], fr[1], 0]), ctr([fr[2], fr[3], 0])]);
            back.push([ctr([fr[0], fr[1], BD]), ctr([fr[2], fr[3], BD])]);
          }
        }
      }
      const V: Vec3[] = [
        [0, yA, 0], [BW, yA, 0], [BW, yB, 0], [0, yB, 0],
        [0, yA, BD], [BW, yA, BD], [BW, yB, BD], [0, yB, BD],
      ];
      hatchedQuad([ctr(V[0]), ctr(V[1]), ctr(V[2]), ctr(V[3])], front);
      hatchedQuad([ctr(V[4]), ctr(V[5]), ctr(V[6]), ctr(V[7])], back);
      quad([ctr(V[0]), ctr(V[3]), ctr(V[7]), ctr(V[4])], plateFill);
      quad([ctr(V[1]), ctr(V[2]), ctr(V[6]), ctr(V[5])], plateFill);
      const topFace: [Vec3, Vec3, Vec3, Vec3] = [ctr(V[3]), ctr(V[2]), ctr(V[6]), ctr(V[7])];
      const botFace: [Vec3, Vec3, Vec3, Vec3] = [ctr(V[0]), ctr(V[1]), ctr(V[5]), ctr(V[4])];
      if (yOut === yB) {
        hatchedQuad(topFace, flat);
        quad(botFace, plateFill);
      } else {
        hatchedQuad(botFace, flat);
        quad(topFace, plateFill);
      }
    };
    // Top plate scrolls; bottom plate sits still.
    plate(BH, BH + plateT, BH + plateT, plateShiftRef.current);
    plate(-plateT, 0, -plateT, 0);

    // Sheets span the full gap INCLUSIVE of the walls: the outermost sheets
    // hug the plates and move at exactly the plate speeds — no slip, drawn.
    const layerY = (i: number) => 2 + ((BH - 4) * i) / (LAYERS - 1);

    if (showParticles && view === 'links') {
      if (patternRef.current.length === 0) {
        for (let i = 0; i < LAYERS; i++) {
          const row: number[] = [];
          for (let k = 0; k < PER_X; k++) {
            row.push((k + 0.5 + (Math.random() - 0.5) * 0.4) / PER_X);
          }
          patternRef.current.push(row);
          offsetsRef.current.push(Math.random() * BW);
        }
        // The top sheet is glued to the plate: same phase as the hatching.
        offsetsRef.current[LAYERS - 1] = 0;
        for (let j = 0; j < PER_Z; j++) {
          zRowsRef.current.push(((j + 0.5) / PER_Z) * BD);
        }
      }

      for (let i = 0; i < LAYERS; i++) {
        quad(
          [
            ctr([0, layerY(i), 0]), ctr([BW, layerY(i), 0]),
            ctr([BW, layerY(i), BD]), ctr([0, layerY(i), BD]),
          ],
          rampFlow(layerY(i) / BH, dark, 0.16),
        );
      }

      const xs: number[][] = [];
      for (let i = 0; i < LAYERS; i++) {
        offsetsRef.current[i] = (offsetsRef.current[i] + uVisAt(layerY(i)) * dt) % BW;
        const off = offsetsRef.current[i];
        xs.push(patternRef.current[i].map((f) => (f * BW + off) % BW));
      }

      const linkMax = (BW / PER_X) * 0.62;
      const linkColor = dark ? 'rgba(52,211,153,0.4)' : 'rgba(4,120,87,0.35)';
      for (let i = 0; i < LAYERS - 1; i++) {
        const yA = layerY(i + 1);
        const yB = layerY(i);
        for (const z of zRowsRef.current) {
          for (const xa of xs[i + 1]) {
            let best = Infinity;
            for (const xbRaw of xs[i]) {
              let d = xbRaw - xa;
              if (d > BW / 2) d -= BW;
              if (d < -BW / 2) d += BW;
              if (Math.abs(d) < Math.abs(best)) best = d;
            }
            if (Math.abs(best) < linkMax) {
              seg(ctr([xa, yA, z]), ctr([xa + best, yB, z]), linkColor, 1.1);
            }
          }
        }
      }

      for (let i = 0; i < LAYERS; i++) {
        const y = layerY(i);
        for (const x of xs[i]) {
          for (const z of zRowsRef.current) {
            dot(ctr([x, y, z]), fit);
          }
        }
      }
    }

    if (showParticles && view === 'dye') {
      timeRef.current += dt;
      const t = timeRef.current;

      // Faint sheets for depth reference.
      for (let i = 0; i < LAYERS; i++) {
        quad(
          [
            ctr([0, layerY(i), 0]), ctr([BW, layerY(i), 0]),
            ctr([BW, layerY(i), BD]), ctr([0, layerY(i), BD]),
          ],
          rampFlow(layerY(i) / BH, dark, 0.1),
        );
      }

      const maxAge = (0.7 * BW) / U_VIS3;
      const injectEvery = maxAge / 3;
      if (t - lastInjectRef.current >= injectEvery) {
        stripesRef.current.push(t);
        lastInjectRef.current = t;
      }
      stripesRef.current = stripesRef.current.filter((b) => t - b <= maxAge);

      // Dye curtains: a vertical plane of dye painted at x_inj tilts into
      // the profile — a ruled surface, drawn as horizontal ribbons.
      const xInj = BW * 0.12;
      const dyeC = dark ? '232,121,249' : '192,38,211';
      const NY = 12;
      for (const birth of stripesRef.current) {
        const age = t - birth;
        const alpha = 0.34 * (1 - age / maxAge) + 0.06;
        for (let r = 0; r < NY; r++) {
          const yA2 = (BH * r) / NY;
          const yB2 = (BH * (r + 1)) / NY;
          quad(
            [
              ctr([xInj + uVisAt(yA2) * age, yA2, 0]),
              ctr([xInj + uVisAt(yA2) * age, yA2, BD]),
              ctr([xInj + uVisAt(yB2) * age, yB2, BD]),
              ctr([xInj + uVisAt(yB2) * age, yB2, 0]),
            ],
            `rgba(${dyeC},${alpha.toFixed(2)})`,
          );
        }
      }

      // A marked cube shearing into a parallelepiped, drawn next to its
      // resting ghost (translation removed, so only the shear shows).
      const s0 = BH * 0.34;
      const yTop = BH * 0.62;
      const yBot = yTop - s0;
      const xC = BW * 0.62;
      const zC = (BD - s0) / 2;
      const relRate = uVisAt(yTop) - uVisAt(yBot);
      const period = relRate > 0 ? (0.35 * BW) / relRate : Infinity;
      const age2 = period === Infinity ? 0 : t % period;
      const yMid = (yTop + yBot) / 2;
      const sh = (y: number) => (uVisAt(y) - uVisAt(yMid)) * age2;
      const cubeEdge = (a: Vec3, b: Vec3, col: string, w: number) =>
        seg(ctr(a), ctr(b), col, w);
      const ghost = `rgba(${dyeC},0.45)`;
      const solidDye = `rgba(${dyeC},0.95)`;
      const corners = (shear: boolean): Vec3[] => {
        const out: Vec3[] = [];
        for (const yy of [yBot, yTop]) {
          for (const [dx, dz] of [[0, 0], [s0, 0], [s0, s0], [0, s0]] as const) {
            out.push([xC + dx + (shear ? sh(yy) : 0), yy, zC + dz]);
          }
        }
        return out;
      };
      const E12: [number, number][] = [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7],
      ];
      const G = corners(false);
      const S = corners(true);
      for (const [a, b] of E12) cubeEdge(G[a], G[b], ghost, 1.2);
      for (const [a, b] of E12) cubeEdge(S[a], S[b], solidDye, 2.2);
    }

    // Velocity-profile arrows up the front-left edge, in contrast slate.
    const arrowCol = dark ? '#f1f5f9' : '#1e293b';
    for (let i = 0; i <= 4; i++) {
      const y = (BH * i) / 4;
      const len = (uVisAt(y) / U_VIS3) * BW * 0.16;
      if (len < 2) continue;
      seg(ctr([4, y, 2]), ctr([4 + len, y, 2]), arrowCol, 1.6);
      seg(ctr([4 + len, y, 2]), ctr([4 + len - 6, y + 4, 2]), arrowCol, 1.6);
      seg(ctr([4 + len, y, 2]), ctr([4 + len - 6, y - 4, 2]), arrowCol, 1.6);
    }
    seg(ctr([4, 0, 2]), ctr([4, BH, 2]), faint, 1);

    // Gap wireframe.
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

    items.sort((a, b) => a.z - b.z);
    for (const it of items) it.f();

    // Labels pinned to the plates themselves.
    const chip = (v: Vec3, text: string) => {
      const [sx, sy] = px(view3(v));
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
    chip(ctr([BW / 2, BH + plateT, BD / 2]), `top plate → U = ${fmtU(p.U)} m/s · fluid sticks to it`);
    chip(ctr([BW / 2, -plateT, BD / 2]), 'bottom plate fixed · fluid sticks here too: u = 0');

    ctx.textAlign = 'right';
    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('drag to rotate · scroll to zoom · double-click to reset', W - 10, H - 10);
  }, { running: loopRunning, redrawKey });

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
      pitchRef.current = -0.3;
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
      aria-label="Rotatable 3D view of Couette flow: sheets of fluid sliding between two textured plates"
    />
  );
}

function fmtU(U: number): string {
  return String(Number(U.toPrecision(3)));
}
