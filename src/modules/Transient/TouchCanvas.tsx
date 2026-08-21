import { useEffect, useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { alphaOf, contactTemp, erf, type ContactBody } from '../../lib/transient';
import { rampWarm } from '../FourierLaw/FourierCanvas';
import { applyZoom, chip2d, useWheelZoom } from '../FicksLaw/FickCanvas';

/**
 * The moment of touch. Two semi-infinite bodies meet at t = 0; the
 * interface temperature jumps INSTANTLY to the effusivity-weighted value
 * and never moves again — only the thermal fronts march inward, each as
 * erf(x / 2 sqrt(alpha t)), each at its own pace.
 *
 * The contact temperature shown in the chip is the physical value for the
 * chosen materials — that number is the module's payload. The clock and
 * the front speeds are visual (real alpha values differ by 10^4 between
 * carpet and copper; the RATIO of the two front speeds is preserved on a
 * compressed scale, and the caption says so).
 */

const TAU_REF = 30; // visual seconds for the reference front to cross ~40% of a side

export function TouchCanvas({
  left,
  right,
  resetTick,
  running,
  dark,
}: {
  left: ContactBody;
  right: ContactBody;
  resetTick: number;
  running: boolean;
  dark: boolean;
}) {
  const tRef = useRef(0.02);
  const zoomRef = useRef(1);
  const [zoomTick, setZoomTick] = useState(0);

  const redrawKey = `${JSON.stringify(left)}|${JSON.stringify(right)}|${resetTick}|${dark}|${zoomTick}`;

  useEffect(() => {
    tRef.current = 0.02;
  }, [resetTick, left.name, right.name, left.T, right.T]);

  const canvasRef = useCanvas((ctx, frame) => {
    const { width: W, height: H } = frame;
    applyZoom(ctx, zoomRef.current, W, H);
    const pad = 8;
    const x0 = pad + 6;
    const x1 = W - pad - 6;
    const y0 = pad + 26;
    const y1 = H - pad - 30;
    const boxH = y1 - y0;
    if (x1 - x0 <= 0 || boxH <= 0) return;
    const xc = (x0 + x1) / 2;
    const sideW = xc - x0;

    if (running) tRef.current += frame.dt;
    const t = tRef.current;

    // Visual diffusivities: preserve the REAL ratio, compressed to a legible
    // range so carpet still visibly moves while copper does not teleport.
    const aL = alphaOf(left.k, left.rho, left.c);
    const aR = alphaOf(right.k, right.rho, right.c);
    const ratio = Math.sqrt(aR / aL);
    const comp = Math.pow(ratio, 0.5); // compress: keep ordering, tame extremes
    const base = (sideW * 0.16) ** 2 / TAU_REF; // px^2 per visual second
    const aVisL = base / Math.max(comp, 1 / 4);
    const aVisR = base * Math.min(Math.max(comp, 1 / 4), 4);

    const Tc = contactTemp(left, right);
    const tLo = Math.min(left.T, right.T, Tc);
    const tHi = Math.max(left.T, right.T, Tc);
    const span = tHi - tLo || 1;
    const norm = (T: number) => (T - tLo) / span;

    const Tat = (px: number): number => {
      if (px < xc) {
        const d = xc - px;
        return Tc + (left.T - Tc) * erf(d / (2 * Math.sqrt(aVisL * t)));
      }
      const d = px - xc;
      return Tc + (right.T - Tc) * erf(d / (2 * Math.sqrt(aVisR * t)));
    };

    // Shaded field.
    for (let px = x0; px < x1; px++) {
      ctx.fillStyle = rampWarm(norm(Tat(px)), dark);
      ctx.fillRect(px, y0, 1.5, boxH);
    }

    // T(x) polyline.
    const ty = (T: number) => y1 - 6 - (boxH - 12) * norm(T);
    ctx.strokeStyle = dark ? '#f1f5f9' : '#0f172a';
    ctx.lineWidth = 2.25;
    ctx.beginPath();
    for (let px = x0; px <= x1; px += 2) {
      const y = ty(Tat(px));
      if (px === x0) ctx.moveTo(px, y);
      else ctx.lineTo(px, y);
    }
    ctx.stroke();

    // Penetration front markers, each side at its own pace.
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = dark ? 'rgba(251,191,36,0.65)' : 'rgba(217,119,6,0.6)';
    ctx.lineWidth = 1.5;
    for (const fx of [
      xc - 3.6428 * Math.sqrt(aVisL * t),
      xc + 3.6428 * Math.sqrt(aVisR * t),
    ]) {
      if (fx > x0 && fx < x1) {
        ctx.beginPath();
        ctx.moveTo(fx, y0);
        ctx.lineTo(fx, y1);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // Interface.
    ctx.strokeStyle = dark ? '#475569' : '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xc, y0 - 5);
    ctx.lineTo(xc, y1 + 5);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0, y0, x1 - x0, boxH);

    // Labels.
    ctx.fillStyle = dark ? '#cbd5e1' : '#475569';
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${left.name} · started at ${fmtT(left.T)} °C`, x0 + sideW / 2, y0 - 9);
    ctx.fillText(`${right.name} · started at ${fmtT(right.T)} °C`, xc + sideW / 2, y0 - 9);
    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
    ctx.textAlign = 'right';
    ctx.fillText(`t = ${t.toFixed(1)} s (visual clock; front-speed ratio is real)`, x1, y1 + 20);

    // The payload: the contact temperature, pinned to the interface.
    chip2d(ctx, xc, (y0 + y1) / 2, `contact: ${fmtT(Tc)} °C — instantly, and it stays`, dark);
  }, { running, redrawKey });

  useWheelZoom(canvasRef, zoomRef, setZoomTick);

  return (
    <canvas
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label="Two bodies at different temperatures touching: thermal fronts spread from an interface pinned at the contact temperature"
    />
  );
}

function fmtT(T: number): string {
  return String(Number(T.toPrecision(3)));
}
