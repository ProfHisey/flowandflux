import { useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import {
  deathOnset,
  minC,
  supplyC,
  tissueC,
  type PerfusionParams,
} from '../../lib/perfusion';
import { applyZoom, chip2d, rampColor, useWheelZoom } from '../FicksLaw/FickCanvas';

/**
 * The whole design problem in one picture: flow enters rich on the left,
 * the cell layer below drains it as it goes, and the far-bottom corner is
 * the last to be fed and the first to starve. Every colour comes from the
 * analytic solution; the red hatched region is where C has fallen below
 * C_crit — the corner where a bad design quietly fails.
 */

export function PerfusionCanvas({ params, dark }: { params: PerfusionParams; dark: boolean }) {
  const offsetRef = useRef(0);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const zoomRef = useRef(1);
  const [zoomTick, setZoomTick] = useState(0);

  const redrawKey = `${JSON.stringify(params)}|${dark}|${zoomTick}`;

  const canvasRef = useCanvas((ctx, frame) => {
    const p = paramsRef.current;
    const { width: W, height: H } = frame;
    applyZoom(ctx, zoomRef.current, W, H);
    const pad = 8;
    const x0 = pad + 10;
    const x1 = W - pad - 10;
    const yTop = pad + 26;
    // Band heights split by the REAL h1:h2 ratio — resize either layer and
    // the picture resizes with it.
    const totalH = H - pad * 2 - 66;
    const frac = p.h1 / (p.h1 + p.h2);
    const chanH = totalH * Math.min(0.75, Math.max(0.2, frac));
    const tisH = totalH - chanH;
    const yMid = yTop + chanH; // fluid-tissue interface
    const yBot = yMid + tisH;
    const boxW = x1 - x0;
    if (boxW <= 0 || chanH <= 0) return;

    const norm = (C: number) => Math.min(1, Math.max(0, C / p.C0));

    // Channel: well-mixed vertically, draining along x.
    for (let px = 0; px < boxW; px++) {
      const x = (px / boxW) * p.L;
      ctx.fillStyle = rampColor(norm(supplyC(p, x)) * 0.9, dark);
      ctx.fillRect(x0 + px, yTop, 1.5, chanH);
    }
    // Tissue: the parabolic sag into the layer, column by column.
    const NYT = Math.max(24, Math.floor(tisH / 3));
    for (let px = 0; px < boxW; px += 2) {
      const x = (px / boxW) * p.L;
      for (let iy = 0; iy < NYT; iy++) {
        const y = ((iy + 0.5) / NYT) * p.h2;
        const C = tissueC(p, x, y);
        ctx.fillStyle = rampColor(norm(C) * 0.9, dark);
        ctx.fillRect(x0 + px, yMid + (iy / NYT) * tisH, 2.5, tisH / NYT + 0.5);
      }
    }

    // The death region: C < Ccrit. Boundary from the quadratic in y.
    // C(x,y) = Cs - (R/D)(h2 y - y^2/2) = Ccrit
    ctx.save();
    ctx.beginPath();
    let anyDead = false;
    let started = false;
    for (let px = 0; px <= boxW; px += 2) {
      const x = (px / boxW) * p.L;
      const Cs = supplyC(p, x);
      let yd = Infinity;
      if (minC(p, x) < p.Ccrit) {
        anyDead = true;
        // Death depth: solve (R/D)(h2 y - y^2/2) = Cs - Ccrit for the
        // shallower root (the parabola's first crossing).
        const k = ((Cs - p.Ccrit) * p.D) / p.R; // = h2 y - y^2/2 at the boundary
        const inner = p.h2 * p.h2 - 2 * k;
        yd = inner <= 0 ? p.h2 : p.h2 - Math.sqrt(inner);
      }
      const sy = yMid + Math.min(1, yd / p.h2) * tisH;
      if (!started) {
        ctx.moveTo(x0 + px, Math.min(sy, yBot));
        started = true;
      } else {
        ctx.lineTo(x0 + px, Math.min(sy, yBot));
      }
    }
    ctx.lineTo(x1, yBot);
    ctx.lineTo(x0, yBot);
    ctx.closePath();
    if (anyDead) {
      ctx.fillStyle = dark ? 'rgba(239,68,68,0.22)' : 'rgba(220,38,38,0.16)';
      ctx.fill();
      ctx.clip();
      ctx.strokeStyle = dark ? 'rgba(248,113,113,0.5)' : 'rgba(220,38,38,0.4)';
      ctx.lineWidth = 1;
      for (let d = -tisH; d < boxW + tisH; d += 8) {
        ctx.beginPath();
        ctx.moveTo(x0 + d, yBot);
        ctx.lineTo(x0 + d + tisH, yMid);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Interface and walls.
    ctx.strokeStyle = dark ? '#64748b' : '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, yMid);
    ctx.lineTo(x1, yMid);
    ctx.stroke();
    ctx.strokeStyle = dark ? '#475569' : '#cbd5e1';
    ctx.strokeRect(x0, yTop, boxW, chanH + tisH);

    // Flow arrows in the channel.
    offsetRef.current = (offsetRef.current + 45 * frame.dt) % 70;
    ctx.strokeStyle = dark ? 'rgba(226,232,240,0.5)' : 'rgba(15,23,42,0.35)';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 1.5;
    const ay = yTop + chanH / 2;
    for (let x = -70 + offsetRef.current; x < boxW; x += 70) {
      if (x < 4 || x + 20 > boxW - 4) continue;
      ctx.beginPath();
      ctx.moveTo(x0 + x, ay);
      ctx.lineTo(x0 + x + 16, ay);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x0 + x + 20, ay);
      ctx.lineTo(x0 + x + 13, ay - 3.5);
      ctx.lineTo(x0 + x + 13, ay + 3.5);
      ctx.closePath();
      ctx.fill();
    }

    // Labels.
    ctx.fillStyle = dark ? '#cbd5e1' : '#475569';
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('flow in at C₀ →', x0 + 4, yTop - 8);
    ctx.textAlign = 'right';
    ctx.fillText('outlet', x1 - 4, yTop - 8);
    ctx.textAlign = 'left';
    ctx.fillText('cell layer — consuming at R, no flux through the floor', x0 + 4, yBot + 16);

    const xs = deathOnset(p);
    if (xs < p.L) {
      chip2d(
        ctx,
        Math.max(x0 + 80, Math.min(x1 - 90, x0 + (Math.max(0, xs) / p.L) * boxW)),
        yBot - 12,
        xs <= 0 ? 'starved from the very inlet' : `starvation begins here (x = ${fmtCm(xs)})`,
        dark,
      );
    } else {
      chip2d(ctx, x1 - 110, yBot - 12, 'every cell fed — margin in hand', dark);
    }
  }, { running: true, redrawKey });

  useWheelZoom(canvasRef, zoomRef, setZoomTick);

  return (
    <canvas
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label="A perfused channel over a cell layer: concentration field with the starved corner hatched in red"
    />
  );
}

function fmtCm(v: number): string {
  return `${Number(v.toPrecision(3))} cm`;
}
