import { useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import {
  biotOf,
  centerTemp,
  fourierOf,
  tempAt,
  type HeislerParams,
} from '../../lib/transient';
import { rampWarm } from '../FourierLaw/FourierCanvas';
import { applyZoom, chip2d, useWheelZoom } from '../FicksLaw/FickCanvas';

/**
 * The finite body at time t, drawn straight from the one-term solution: a
 * wall (full thickness 2L, symmetric about the midplane) or a sphere
 * (cross-section, shaded ring by ring). Static — the time slider drives it,
 * and every number is physical. This canvas is the picture the Heisler
 * charts always wanted to be.
 */

export function HeislerCanvas({ params, dark }: { params: HeislerParams; dark: boolean }) {
  const zoomRef = useRef(1);
  const [zoomTick, setZoomTick] = useState(0);
  const redrawKey = JSON.stringify(params) + dark + zoomTick;

  const canvasRef = useCanvas((ctx, frame) => {
    const p = params;
    const { width: W, height: H } = frame;
    applyZoom(ctx, zoomRef.current, W, H);
    const pad = 8;

    const tLo = Math.min(p.Ti, p.Tinf);
    const tHi = Math.max(p.Ti, p.Tinf);
    const span = tHi - tLo || 1;
    const norm = (T: number) => (T - tLo) / span;

    const T0 = centerTemp(p);
    const Tsurf = tempAt(p, 1);
    const Bi = biotOf(p);
    const Fo = fourierOf(p);

    // Drawn size tracks the L slider (log-mapped, 1e-3..0.3 m): a pea and
    // a wall should not look the same size.
    const tL = Math.min(1, Math.max(0, (Math.log10(p.L) + 3) / 2.48));

    if (p.geometry === 'wall') {
      const x0f = pad + 56;
      const x1f = W - pad - 56;
      const y0 = pad + 26;
      const y1 = H - pad - 30;
      const xc = (x0f + x1f) / 2;
      const halfW = ((x1f - x0f) / 2) * (0.45 + 0.55 * tL);
      const x0 = xc - halfW;
      const x1 = xc + halfW;
      const wallW = x1 - x0;
      const wallH = y1 - y0;
      if (wallW <= 0 || wallH <= 0) return;

      // Fluid cheeks at Tinf.
      ctx.fillStyle = rampWarm(norm(p.Tinf), dark);
      ctx.fillRect(pad, y0, x0 - pad, wallH);
      ctx.fillRect(x1, y0, W - pad - x1, wallH);
      hatch(ctx, pad, y0, x0 - pad, wallH, dark);
      hatch(ctx, x1, y0, W - pad - x1, wallH, dark);

      // The wall, shaded by T(x*) — symmetric about the midplane.
      for (let px = 0; px < wallW; px++) {
        const xStar = Math.abs((px - wallW / 2) / (wallW / 2));
        ctx.fillStyle = rampWarm(norm(tempAt(p, xStar)), dark);
        ctx.fillRect(x0 + px, y0, 1.5, wallH);
      }

      // Profile line.
      const ty = (T: number) => y1 - 6 - (wallH - 12) * norm(T);
      ctx.strokeStyle = dark ? '#f1f5f9' : '#0f172a';
      ctx.lineWidth = 2.25;
      ctx.beginPath();
      for (let px = 0; px <= wallW; px += 2) {
        const xStar = Math.abs((px - wallW / 2) / (wallW / 2));
        const y = ty(tempAt(p, xStar));
        if (px === 0) ctx.moveTo(x0 + px, y);
        else ctx.lineTo(x0 + px, y);
      }
      ctx.stroke();

      // Boundaries and midplane.
      ctx.strokeStyle = dark ? '#475569' : '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x0, y0, wallW, wallH);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = dark ? '#64748b' : '#94a3b8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xc, y0);
      ctx.lineTo(xc, y1);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = dark ? '#cbd5e1' : '#475569';
      ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`fluid at ${fmtT(p.Tinf)} °C · h`, (pad + x0) / 2, y0 - 9);
      ctx.fillText(`fluid at ${fmtT(p.Tinf)} °C · h`, (x1 + W - pad) / 2, y0 - 9);
      ctx.fillText('2L', xc, y1 + 20);

      chip2d(ctx, xc, (y0 + y1) / 2, `centre: ${fmtT(T0)} °C`, dark);
      chip2d(ctx, x1 - 40, y0 + 18, `surface: ${fmtT(Tsurf)} °C`, dark);
    } else {
      // Sphere cross-section.
      const cx = W / 2;
      const cy = H / 2;
      const maxR = (Math.min(W, H) / 2 - pad - 24) * (0.5 + 0.5 * tL);
      if (maxR <= 4) return;

      // Ambient wash.
      ctx.fillStyle = rampWarm(norm(p.Tinf), dark, 0.35);
      ctx.fillRect(pad, pad + 14, W - 2 * pad, H - 2 * pad - 24);

      for (let r = maxR; r >= 1; r -= 1) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = rampWarm(norm(tempAt(p, r / maxR)), dark);
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      ctx.strokeStyle = dark ? '#475569' : '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = dark ? '#cbd5e1' : '#475569';
      ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`fluid at ${fmtT(p.Tinf)} °C · h everywhere on the surface`, cx, pad + 10);

      chip2d(ctx, cx, cy, `centre: ${fmtT(T0)} °C`, dark);
      chip2d(ctx, cx, cy - maxR + 16, `surface: ${fmtT(Tsurf)} °C`, dark);
    }

    // Bi/Fo corner tag — the two numbers a Heisler chart asks for.
    ctx.textAlign = 'right';
    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(`Bi = ${fmtT(Bi)} · Fo = ${fmtT(Fo)}${Fo < 0.2 ? ' (one-term shaky below 0.2)' : ''}`, W - pad - 2, H - pad - 4);
  }, { running: false, redrawKey });

  useWheelZoom(canvasRef, zoomRef, setZoomTick);

  return (
    <canvas
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label={`A ${params.geometry} at time t, shaded by the one-term transient temperature solution`}
    />
  );
}

function hatch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  dark: boolean,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = dark ? 'rgba(226,232,240,0.22)' : 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  for (let d = -h; d < w + h; d += 7) {
    ctx.beginPath();
    ctx.moveTo(x + d, y + h);
    ctx.lineTo(x + d + h, y);
    ctx.stroke();
  }
  ctx.restore();
}

function fmtT(v: number): string {
  return String(Number(v.toPrecision(3)));
}
