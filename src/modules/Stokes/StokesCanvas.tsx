import { useEffect, useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import {
  dragForce,
  gEff,
  terminalVelocity,
  type StokesParams,
} from '../../lib/stokes';
import { applyZoom, chip2d, useWheelZoom } from '../FicksLaw/FickCanvas';

/**
 * A settling column. A cloud of small particles drifts down at terminal
 * velocity, and one big "specimen" particle carries its free-body diagram:
 * weight down, buoyancy and drag up, drawn to their true relative
 * magnitudes — so at terminal velocity the arrows visibly balance.
 *
 * A strobe trail behind the specimen shows equally spaced dots: constant
 * velocity, because tau is microseconds and the approach to terminal speed
 * happened before the first frame. (On-screen fall speed is fixed for
 * legibility; the physical v-inf spans nine decades across the presets and
 * lives in the readouts.)
 */

const COUNT = 46;
const V_VIS = 34; // px/s on screen — cosmetic, stated in the caption

interface P {
  x: number;
  y: number;
}

export function StokesCanvas({
  params,
  running,
  dark,
}: {
  params: StokesParams;
  running: boolean;
  dark: boolean;
}) {
  const cloudRef = useRef<P[]>([]);
  const strobeRef = useRef(0);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const zoomRef = useRef(1);
  const [zoomTick, setZoomTick] = useState(0);

  const redrawKey = `${JSON.stringify(params)}|${dark}|${zoomTick}`;

  useEffect(() => {
    cloudRef.current = [];
  }, []);

  const canvasRef = useCanvas((ctx, frame) => {
    const p = paramsRef.current;
    const { width: W, height: H } = frame;
    applyZoom(ctx, zoomRef.current, W, H);
    const pad = 8;
    const x0 = pad + 10;
    const x1 = W - pad - 10;
    const y0 = pad + 24;
    const y1 = H - pad - 26;
    const boxW = x1 - x0;
    const boxH = y1 - y0;
    if (boxW <= 0 || boxH <= 0) return;
    const dt = running ? frame.dt : 0;

    const vinf = terminalVelocity(p);
    const dir = vinf >= 0 ? 1 : -1; // negative: the particle floats

    // Fluid.
    ctx.fillStyle = dark ? 'rgba(30,41,59,0.5)' : 'rgba(241,245,249,0.8)';
    ctx.fillRect(x0, y0, boxW, boxH);

    // The settling cloud.
    const list = cloudRef.current;
    if (list.length === 0) {
      for (let i = 0; i < COUNT; i++) {
        list.push({ x: x0 + 8 + Math.random() * (boxW - 16), y: y0 + Math.random() * boxH });
      }
    }
    ctx.fillStyle = dark ? 'rgba(148,163,184,0.7)' : 'rgba(100,116,139,0.6)';
    for (const q of list) {
      if (dt > 0) {
        q.y += dir * V_VIS * dt;
        if (dir > 0 && q.y > y1 - 3) q.y = y0 + 3;
        if (dir < 0 && q.y < y0 + 3) q.y = y1 - 3;
      }
      ctx.beginPath();
      ctx.arc(q.x, q.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // The specimen with its free-body diagram, held mid-column while the
    // strobe dots stream past it (a co-moving frame, in effect). Its drawn
    // size tracks the radius slider on a log scale — 10 nm to 2 mm can't be
    // to scale, but bigger should LOOK bigger.
    const sx = (x0 + x1) / 2;
    const sy = (y0 + y1) / 2;
    const R = 9 + 21 * Math.min(1, Math.max(0, (Math.log10(p.a) + 8) / 5.3));

    strobeRef.current = (strobeRef.current + dir * V_VIS * dt) % 26;
    ctx.fillStyle = dark ? 'rgba(226,232,240,0.35)' : 'rgba(15,23,42,0.25)';
    for (let i = 1; i <= 6; i++) {
      const yy = sy - dir * (i * 26 + strobeRef.current - 26);
      if (yy > y0 + 4 && yy < y1 - 4 && Math.abs(yy - sy) > R + 4) {
        ctx.beginPath();
        ctx.arc(sx, yy, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.beginPath();
    ctx.arc(sx, sy, R, 0, Math.PI * 2);
    ctx.fillStyle = dark ? '#94a3b8' : '#64748b';
    ctx.fill();
    ctx.strokeStyle = dark ? '#e2e8f0' : '#334155';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Motion arrow painted ON the sphere: no ambiguity about which way it
    // is going, however subtle the strobe trail is.
    const mvCol = dark ? '#0f172a' : '#f8fafc';
    ctx.strokeStyle = mvCol;
    ctx.fillStyle = mvCol;
    ctx.lineWidth = 3;
    const aLen = Math.max(10, R * 0.9);
    ctx.beginPath();
    ctx.moveTo(sx, sy - dir * aLen * 0.6);
    ctx.lineTo(sx, sy + dir * aLen * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx, sy + dir * (aLen * 0.6 + 5));
    ctx.lineTo(sx - 5.5, sy + dir * (aLen * 0.6 - 4));
    ctx.lineTo(sx + 5.5, sy + dir * (aLen * 0.6 - 4));
    ctx.closePath();
    ctx.fill();

    // Force arrows, true relative magnitudes. At terminal velocity:
    // Drag opposes the motion: settling (v down) puts drag UP beside
    // buoyancy, W = B + D; floating (v up) puts drag DOWN beside weight,
    // B = W + D. Either way the two stacks are equal at terminal velocity
    // and the drawn lengths balance.
    const Wg = p.rhoP * (4 / 3) * Math.PI * p.a ** 3 * gEff(p);
    const B = p.rhoF * (4 / 3) * Math.PI * p.a ** 3 * gEff(p);
    const Dg = Math.abs(dragForce(p.mu, p.a, vinf));
    const downSum = Wg + (dir < 0 ? Dg : 0);
    const upSum = B + (dir > 0 ? Dg : 0);
    const K = 92 / Math.max(downSum, upSum);

    const arrow = (x: number, yA: number, yB: number, color: string, w = 2.5) => {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x, yA);
      ctx.lineTo(x, yB);
      ctx.stroke();
      const d = yB > yA ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(x, yB);
      ctx.lineTo(x - 4.5, yB - d * 7);
      ctx.lineTo(x + 4.5, yB - d * 7);
      ctx.closePath();
      ctx.fill();
    };

    // Weight, down from the center; buoyancy up on the other side; drag
    // beside whichever of them it reinforces (always opposing the motion).
    arrow(sx - 34, sy, sy + Wg * K, dark ? '#f87171' : '#dc2626');
    arrow(sx + 34, sy, sy - B * K, dark ? '#38bdf8' : '#0284c7');
    arrow(sx + 58, sy, sy - dir * Dg * K, dark ? '#34d399' : '#047857');

    // Symbols at the arrows; the formulas live in the corner legend so the
    // free-body picture stays clean (Aug 2026 review).
    ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = dark ? '#f87171' : '#dc2626';
    ctx.fillText('W', sx - 34, sy + Wg * K + 16);
    ctx.fillStyle = dark ? '#38bdf8' : '#0284c7';
    ctx.fillText('B', sx + 34, sy - B * K - 8);
    ctx.fillStyle = dark ? '#34d399' : '#047857';
    ctx.fillText('F_D', sx + 58 + 4, dir > 0 ? sy - Dg * K - 8 : sy + Dg * K + 16);

    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = dark ? '#f87171' : '#dc2626';
    ctx.fillText('W = ρ_p·V·g', x0 + 8, y0 + boxH - 34);
    ctx.fillStyle = dark ? '#38bdf8' : '#0284c7';
    ctx.fillText('B = ρ_f·V·g', x0 + 8, y0 + boxH - 20);
    ctx.fillStyle = dark ? '#34d399' : '#047857';
    ctx.fillText('F_D = 6πμav', x0 + 8, y0 + boxH - 6);

    // Box and labels.
    ctx.strokeStyle = dark ? '#475569' : '#94a3b8';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, boxW, boxH);

    chip2d(
      ctx, sx, y0 + 16,
      p.gFactor > 1.5
        ? `spinning at ${fmtG(p.gFactor)} × g`
        : dir > 0 ? 'settling at terminal velocity' : 'floating upward (ρp < ρf)',
      dark,
    );
    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(
      'strobe dots equally spaced: constant v — τ passed before the first frame',
      x1 - 4, y1 + 18,
    );
    ctx.textAlign = 'left';
    ctx.fillText('on-screen speed fixed; the real v∞ is in the readouts', x0, y1 + 18);
  }, { running, redrawKey });

  useWheelZoom(canvasRef, zoomRef, setZoomTick);

  return (
    <canvas
      role="img"
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label="Particles settling at terminal velocity, with a free-body diagram of weight, buoyancy, and Stokes drag"
    />
  );
}

function fmtG(g: number): string {
  return g >= 1000 ? `${Math.round(g).toLocaleString()}` : String(Number(g.toPrecision(3)));
}
