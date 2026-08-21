import { useEffect, useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { finEffectiveness, finHeat, finML, finTemp, type FinParams } from '../../lib/fin';
import { rampWarm } from '../FourierLaw/FourierCanvas';

/**
 * A pin fin in 3D, shaded ring by ring with its own temperature solution
 * theta(x) = cosh(m(L-x))/cosh(mL) — every colour on the rod is physical,
 * computed live from h, k, and the fin geometry.
 *
 * The same fluid tracers as the 2D flow view stream past it (along z,
 * across the fin), creep through the film at its surface, and carry off
 * warmth proportional to the LOCAL fin temperature — so the wake is strong
 * near the hot base and starves toward the tip. Change tabs and you have
 * only changed perspective on one system.
 */

type Vec3 = [number, number, number];

interface T3 {
  x: number;
  y: number;
  z: number;
  carry: number;
}

const COUNT = 170;
const FLOW3 = 55; // px/s on screen — cosmetic, like the 2D view

export function Fin3DCanvas({
  params,
  running,
  dark,
}: {
  params: FinParams;
  running: boolean;
  dark: boolean;
}) {
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const tracersRef = useRef<T3[]>([]);

  const yawRef = useRef(0.7);
  const pitchRef = useRef(-0.3);
  const zoomRef = useRef(1);
  const [rotTick, setRotTick] = useState(0);

  const redrawKey = `${JSON.stringify(params)}|${dark}|${rotTick}`;

  const canvasRef = useCanvas((ctx, frame) => {
    const p = paramsRef.current;
    const { width: W, height: H } = frame;
    const cx = W / 2;
    const cyc = H / 2;
    const dt = running ? frame.dt : 0;

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

    const fit = Math.min(W, H) / 2 - 26;
    const tLo = Math.min(p.T0, p.Tinf);
    const span = Math.abs(p.T0 - p.Tinf) || 1;
    const norm = (T: number) => (T - tLo) / span;

    // Model: a modest base flange on the left, the fin as the star.
    const FL = 1.5 * fit;
    const FR = 0.19 * fit;
    const baseW = 0.09 * fit;
    const baseH = 0.62 * fit;
    const xOff = -FL / 2 - baseW / 2;

    // Base flange at T0 — deliberately small and outlined, so it reads as
    // "the source" without upstaging the rod it feeds.
    const baseCol = rampWarm(norm(p.T0), dark);
    const edgeCol = dark ? 'rgba(226,232,240,0.55)' : 'rgba(51,65,85,0.55)';
    const B: Vec3[] = [
      [xOff - baseW, -baseH / 2, -baseH / 2], [xOff, -baseH / 2, -baseH / 2],
      [xOff, baseH / 2, -baseH / 2], [xOff - baseW, baseH / 2, -baseH / 2],
      [xOff - baseW, -baseH / 2, baseH / 2], [xOff, -baseH / 2, baseH / 2],
      [xOff, baseH / 2, baseH / 2], [xOff - baseW, baseH / 2, baseH / 2],
    ];
    quad([B[0], B[1], B[2], B[3]], baseCol);
    quad([B[4], B[5], B[6], B[7]], baseCol);
    quad([B[0], B[3], B[7], B[4]], baseCol);
    quad([B[1], B[2], B[6], B[5]], baseCol);
    quad([B[3], B[2], B[6], B[7]], baseCol);
    quad([B[0], B[1], B[5], B[4]], baseCol);
    const BE: [number, number][] = [
      [0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];
    for (const [a, b] of BE) seg(B[a], B[b], edgeCol, 1);

    // The fin: rings of quads, each coloured by ITS OWN temperature.
    const NX = 30;
    const NT = 18;
    const dth = (Math.PI * 2) / NT;
    for (let i = 0; i < NX; i++) {
      const xa = xOff + (FL * i) / NX;
      const xb = xOff + (FL * (i + 1)) / NX;
      const Tmid = finTemp(p, ((i + 0.5) / NX) * p.L);
      const col = rampWarm(norm(Tmid), dark);
      for (let j = 0; j < NT; j++) {
        const t0 = j * dth;
        const t1 = t0 + dth;
        quad(
          [
            [xa, FR * Math.sin(t0), FR * Math.cos(t0)],
            [xb, FR * Math.sin(t0), FR * Math.cos(t0)],
            [xb, FR * Math.sin(t1), FR * Math.cos(t1)],
            [xa, FR * Math.sin(t1), FR * Math.cos(t1)],
          ],
          col,
        );
      }
    }
    // Tip cap.
    const tipCol = rampWarm(norm(finTemp(p, p.L)), dark);
    for (let j = 0; j < NT; j++) {
      const t0 = j * dth;
      const t1 = t0 + dth;
      quad(
        [
          [xOff + FL, 0, 0],
          [xOff + FL, FR * Math.sin(t0), FR * Math.cos(t0)],
          [xOff + FL, FR * Math.sin(t1), FR * Math.cos(t1)],
          [xOff + FL, 0, 0],
        ],
        tipCol,
      );
    }
    // Silhouette lines so the cold end of the rod never dissolves into the
    // background, however dark theta gets.
    for (const [yy, zz] of [[FR, 0], [-FR, 0], [0, FR], [0, -FR]] as const) {
      seg([xOff, yy, zz], [xOff + FL, yy, zz], edgeCol, 1);
    }
    for (let j = 0; j < NT; j++) {
      const t0 = j * dth;
      const t1 = t0 + dth;
      seg(
        [xOff + FL, FR * Math.sin(t0), FR * Math.cos(t0)],
        [xOff + FL, FR * Math.sin(t1), FR * Math.cos(t1)],
        edgeCol, 1,
      );
    }

    // ---------------------------------------------------------- tracers
    // The same fluid as the 2D tab, seen from outside: streaming along z,
    // creeping through the film at the rod's surface, and hauling off
    // warmth that matches the LOCAL fin temperature.
    const ZB = 0.9 * fit;
    const YB = 0.55 * fit;
    const film = FR * 0.45;
    const list = tracersRef.current;
    if (list.length === 0) {
      for (let i = 0; i < COUNT; i++) {
        list.push({
          x: xOff + 4 + Math.random() * (FL + 0.25 * fit),
          y: -YB + Math.random() * 2 * YB,
          z: -ZB + Math.random() * 2 * ZB,
          carry: 0,
        });
      }
    }
    for (const q of list) {
      if (dt > 0) {
        // Radial standoff from the fin axis, in the (y, z) plane.
        const onFin = q.x >= xOff && q.x <= xOff + FL;
        const rho = Math.hypot(q.y, q.z);
        let slow = 1;
        if (onFin) {
          const gap = Math.max(0, rho - FR);
          if (rho < FR + 1.5) {
            const s = (FR + 1.5) / (rho || 1);
            q.y *= s;
            q.z *= s;
          }
          slow = gap > film * 2 ? 1 : Math.max(0.1, 1 - Math.exp(-(gap / film) * 1.4));
          if (gap < film) {
            const Tlocal = finTemp(p, ((q.x - xOff) / FL) * p.L);
            q.carry = Math.max(q.carry, norm(Tlocal) * (1 - gap / film));
          }
          // Shoulder around the rod as the stream passes.
          if (gap < film * 2 && Math.abs(q.y) > 1e-3) {
            q.y += Math.sign(q.y) * 14 * (1 - gap / (film * 2)) * dt;
          }
        }
        q.z += FLOW3 * slow * dt;
        q.y += (Math.random() - 0.5) * 4 * dt;
        if (q.z > ZB) {
          q.z = -ZB;
          q.y = -YB + Math.random() * 2 * YB;
          q.x = xOff + 4 + Math.random() * (FL + 0.25 * fit);
          q.carry = 0;
        }
      }
      const vv = view([q.x, q.y, q.z]);
      const depth = Math.min(1, Math.max(0, vv[2] / fit / 2 + 0.5));
      const carry = q.carry;
      items.push({
        z: vv[2],
        f: () => {
          if (carry > 0.04) {
            ctx.fillStyle = dark
              ? `rgba(251,146,60,${(0.2 + 0.7 * carry).toFixed(2)})`
              : `rgba(220,38,38,${(0.15 + 0.6 * carry).toFixed(2)})`;
          } else {
            ctx.fillStyle = dark
              ? `rgba(148,163,184,${(0.25 + 0.35 * depth).toFixed(2)})`
              : `rgba(100,116,139,${(0.2 + 0.35 * depth).toFixed(2)})`;
          }
          const [ax, ay] = px(vv);
          ctx.beginPath();
          ctx.arc(ax, ay, (1.4 + 1.1 * depth) * zm, 0, Math.PI * 2);
          ctx.fill();
        },
      });
    }

    items.sort((a, b) => a.z - b.z);
    for (const it of items) it.f();

    // Chips pinned to the geometry.
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
    chip([xOff - baseW / 2, baseH / 2 + 14, 0], `base at ${fmtT(p.T0)} °C`);
    chip([xOff + FL, -FR - 18, 0], `tip: ${fmtT(finTemp(p, p.L))} °C`);
    chip([xOff + FL / 2, FR + 22, 0], `mL = ${fmtT(finML(p))} · Q = ${fmtT(finHeat(p))} W · ε = ${fmtT(finEffectiveness(p))}×`);

    ctx.textAlign = 'right';
    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('drag to rotate · scroll to zoom · double-click to reset', W - 10, H - 10);
    ctx.textAlign = 'left';
    ctx.fillText(`fluid at ${fmtT(p.Tinf)} °C flowing past · same stream as the Flow tab`, 10, H - 10);
  }, { running, redrawKey });

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
      setRotTick((t) => t + 1);
    };
    const up = (e: PointerEvent) => {
      dragging = false;
      el.releasePointerCapture(e.pointerId);
      el.style.cursor = 'grab';
    };
    const reset = () => {
      yawRef.current = 0.7;
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
      setRotTick((t) => t + 1);
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
  }, [canvasRef]);

  return (
    <canvas
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label="A 3D pin fin shaded by its own temperature solution, with fluid tracers streaming past and carrying off its heat"
    />
  );
}

function fmtT(v: number): string {
  return String(Number(v.toPrecision(3)));
}
