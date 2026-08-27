import { useRef } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { finEffectiveness, finHeat, finML, finTemp, type FinParams } from '../../lib/fin';
import { useOrbitCam, useOrbitControls, type OrbitCam } from '../shared/paint3d';
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
  cam: camProp,
}: {
  params: FinParams;
  running: boolean;
  dark: boolean;
  /** Optional shared camera for the seamless 2D-to-3D handoff. */
  cam?: OrbitCam;
}) {
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const tracersRef = useRef<T3[]>([]);

  const internalCam = useOrbitCam(0.7, -0.3);
  const cam = camProp ?? internalCam;
  const { yawRef, pitchRef, zoomRef } = cam;

  const redrawKey = `${JSON.stringify(params)}|${dark}|${cam.camTick}`;

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
    const isRect = p.shape === 'rect';
    const FL = 1.5 * fit;
    const FR = 0.19 * fit; // pin radius (visual)
    const TH = 0.055 * fit; // plate half-thickness (visual — thin is the point)
    const WD = 0.5 * fit; // plate half-width, spanwise along the flow (z)
    const topR = isRect ? TH : FR; // surface standoff in y, both shapes
    const baseW = 0.09 * fit;
    const baseH = 0.62 * fit;
    const baseZ = isRect ? WD + 0.05 * fit : baseH / 2;
    const xOff = -FL / 2 - baseW / 2;

    // Base flange at T0 — deliberately small and outlined, so it reads as
    // "the source" without upstaging the rod it feeds.
    const baseCol = rampWarm(norm(p.T0), dark);
    const edgeCol = dark ? 'rgba(226,232,240,0.55)' : 'rgba(51,65,85,0.55)';
    const B: Vec3[] = [
      [xOff - baseW, -baseH / 2, -baseZ], [xOff, -baseH / 2, -baseZ],
      [xOff, baseH / 2, -baseZ], [xOff - baseW, baseH / 2, -baseZ],
      [xOff - baseW, -baseH / 2, baseZ], [xOff, -baseH / 2, baseZ],
      [xOff, baseH / 2, baseZ], [xOff - baseW, baseH / 2, baseZ],
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

    // The fin: slices along x, each coloured by ITS OWN temperature.
    const NX = 30;
    const tipCol = rampWarm(norm(finTemp(p, p.L)), dark);
    if (isRect) {
      // Plate fin: thin in y, wide along the flow (z) — a heat-sink blade.
      for (let i = 0; i < NX; i++) {
        const xa = xOff + (FL * i) / NX;
        const xb = xOff + (FL * (i + 1)) / NX;
        const col = rampWarm(norm(finTemp(p, ((i + 0.5) / NX) * p.L)), dark);
        quad([[xa, TH, -WD], [xb, TH, -WD], [xb, TH, WD], [xa, TH, WD]], col);
        quad([[xa, -TH, -WD], [xb, -TH, -WD], [xb, -TH, WD], [xa, -TH, WD]], col);
        quad([[xa, -TH, -WD], [xb, -TH, -WD], [xb, TH, -WD], [xa, TH, -WD]], col);
        quad([[xa, -TH, WD], [xb, -TH, WD], [xb, TH, WD], [xa, TH, WD]], col);
      }
      quad(
        [[xOff + FL, -TH, -WD], [xOff + FL, TH, -WD], [xOff + FL, TH, WD], [xOff + FL, -TH, WD]],
        tipCol,
      );
      // Silhouette edges so the cold end never dissolves.
      for (const [yy, zz] of [[TH, -WD], [TH, WD], [-TH, -WD], [-TH, WD]] as const) {
        seg([xOff, yy, zz], [xOff + FL, yy, zz], edgeCol, 1);
      }
      for (const s of [-1, 1] as const) {
        seg([xOff + FL, -TH, s * WD], [xOff + FL, TH, s * WD], edgeCol, 1);
        seg([xOff + FL, s * TH, -WD], [xOff + FL, s * TH, WD], edgeCol, 1);
      }
    } else {
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
    }

    // ---------------------------------------------------------- tracers
    // The same fluid as the 2D tab, seen from outside: streaming along z,
    // creeping through the film at the rod's surface, and hauling off
    // warmth that matches the LOCAL fin temperature.
    const ZB = 0.9 * fit;
    const YB = 0.55 * fit;
    const film = (isRect ? 2 * TH : FR) * 0.45;
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
        // Standoff from the fin surface: radial for the pin, |y|-based for
        // the plate (the stream runs along the plate's wide faces).
        const onFin =
          q.x >= xOff && q.x <= xOff + FL && (!isRect || Math.abs(q.z) < WD + 2);
        let slow = 1;
        if (onFin) {
          const gap = isRect
            ? Math.max(0, Math.abs(q.y) - TH)
            : Math.max(0, Math.hypot(q.y, q.z) - FR);
          if (isRect) {
            if (Math.abs(q.y) < TH + 1.5) {
              q.y = Math.sign(q.y || 1) * (TH + 1.5);
            }
          } else {
            const rho = Math.hypot(q.y, q.z);
            if (rho < FR + 1.5) {
              const s = (FR + 1.5) / (rho || 1);
              q.y *= s;
              q.z *= s;
            }
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
    chip([xOff + FL, -topR - 18, 0], `tip: ${fmtT(finTemp(p, p.L))} °C`);
    chip([xOff + FL / 2, topR + 22, 0], `mL = ${fmtT(finML(p))} · Q = ${fmtT(finHeat(p))} W · ε = ${fmtT(finEffectiveness(p))}×`);

    ctx.textAlign = 'right';
    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('drag to rotate · scroll to zoom · double-click to reset', W - 10, H - 10);
    ctx.textAlign = 'left';
    ctx.fillText(`fluid at ${fmtT(p.Tinf)} °C flowing past · same stream as the Flow tab`, 10, H - 10);
  }, { running, redrawKey });

  useOrbitControls(canvasRef, cam, running);

  return (
    <canvas
      role="img"
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label={
        params.shape === 'rect'
          ? 'A 3D rectangular plate fin shaded by its own temperature solution, with fluid tracers streaming along its faces'
          : 'A 3D pin fin shaded by its own temperature solution, with fluid tracers streaming past and carrying off its heat'
      }
    />
  );
}

function fmtT(v: number): string {
  return String(Number(v.toPrecision(3)));
}
