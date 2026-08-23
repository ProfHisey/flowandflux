import { useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { finEffectiveness, finHeat, finML, finTemp, type FinParams } from '../../lib/fin';
import { rampWarm } from '../FourierLaw/FourierCanvas';
import { applyZoom, chip2d, useWheelZoom } from '../FicksLaw/FickCanvas';

/**
 * The fin side-on: a small base flange at T0 on the left, the fin running
 * right, every column shaded by its own solution θ(x) = cosh(m(L−x))/cosh(mL),
 * and the temperature profile drawn above it as a curve — the instrumented
 * view the 3D tab deliberately leaves out. The pin draws as a rod, the
 * plate as the thin blade it is (side view shows its 2 mm thickness); the
 * shape enters the physics only through m = √(hP/kA), and the picture makes
 * that visible: same equation, different silhouette, different reach.
 *
 * Matches the 3D view's face-on pose (base left, fin along +x), so the
 * seamless drag reads as the same object gaining depth.
 */
export function FinCanvas({ params, dark }: { params: FinParams; dark: boolean }) {
  const zoomRef = useRef(1);
  const [zoomTick, setZoomTick] = useState(0);
  const redrawKey = `${JSON.stringify(params)}|${dark}|${zoomTick}`;

  const canvasRef = useCanvas((ctx, frame) => {
    const p = params;
    const { width: W, height: H } = frame;
    applyZoom(ctx, zoomRef.current, W, H);
    const pad = 8;

    const tLo = Math.min(p.T0, p.Tinf);
    const span = Math.abs(p.T0 - p.Tinf) || 1;
    const norm = (T: number) => Math.min(1, Math.max(0, (T - tLo) / span));
    const isRect = p.shape === 'rect';

    // Layout mirrors the 3D model: small outlined base flange, fin as the
    // star. The profile curve gets the band above the fin.
    const baseW = 26;
    const x0 = pad + 46;
    const x1 = W - pad - 30;
    const finX0 = x0 + baseW;
    const finL = x1 - finX0;
    const yc = H * 0.62;
    const halfPin = 0.115 * H;
    const halfPlate = 0.035 * H;
    const half = isRect ? halfPlate : halfPin;
    const baseHalf = 0.19 * H;
    if (finL <= 0) return;

    const edgeCol = dark ? 'rgba(226,232,240,0.55)' : 'rgba(51,65,85,0.55)';

    // Base flange at T0 — small and outlined, the source, not the star.
    ctx.fillStyle = rampWarm(norm(p.T0), dark);
    ctx.fillRect(x0, yc - baseHalf, baseW, 2 * baseHalf);
    ctx.strokeStyle = edgeCol;
    ctx.lineWidth = 1;
    ctx.strokeRect(x0, yc - baseHalf, baseW, 2 * baseHalf);

    // The fin, column by column at its own temperature.
    for (let px = 0; px < finL; px++) {
      const T = finTemp(p, (px / finL) * p.L);
      ctx.fillStyle = rampWarm(norm(T), dark);
      ctx.fillRect(finX0 + px, yc - half, 1.5, 2 * half);
    }
    ctx.strokeStyle = edgeCol;
    ctx.lineWidth = 1;
    ctx.strokeRect(finX0, yc - half, finL, 2 * half);

    // The temperature profile above the fin — the equation, as a line.
    const bandTop = pad + 26;
    const bandBot = yc - baseHalf - 16;
    const bandH = bandBot - bandTop;
    if (bandH > 30) {
      const ty = (T: number) => bandBot - bandH * norm(T);
      // Faint guides at T0 and Tinf.
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = dark ? '#334155' : '#e2e8f0';
      ctx.lineWidth = 1;
      for (const T of [p.T0, p.Tinf]) {
        ctx.beginPath();
        ctx.moveTo(finX0, ty(T));
        ctx.lineTo(x1, ty(T));
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
      ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`T₀ = ${fmtT(p.T0)} °C`, finX0 + 2, ty(p.T0) - 3);
      ctx.fillText(`T∞ = ${fmtT(p.Tinf)} °C`, finX0 + 2, ty(p.Tinf) - 3);

      ctx.strokeStyle = dark ? '#fbbf24' : '#d97706';
      ctx.lineWidth = 2.25;
      ctx.beginPath();
      for (let px = 0; px <= finL; px += 2) {
        const y = ty(finTemp(p, (px / finL) * p.L));
        if (px === 0) ctx.moveTo(finX0 + px, y);
        else ctx.lineTo(finX0 + px, y);
      }
      ctx.stroke();
      ctx.fillStyle = dark ? '#fbbf24' : '#b45309';
      ctx.textAlign = 'right';
      ctx.fillText('T(x) = T∞ + θ₀·cosh(m(L−x))/cosh(mL)', x1, bandTop - 6);
    }

    // Chips, matching the 3D view's.
    chip2d(ctx, x0 + baseW / 2, yc - baseHalf - 14, `base at ${fmtT(p.T0)} °C`, dark);
    chip2d(ctx, x1 - 34, yc + half + 16, `tip: ${fmtT(finTemp(p, p.L))} °C`, dark);
    chip2d(
      ctx,
      finX0 + finL / 2,
      yc + half + 16,
      `mL = ${fmtT(finML(p))} · Q = ${fmtT(finHeat(p))} W · ε = ${fmtT(finEffectiveness(p))}×`,
      dark,
    );

    ctx.textAlign = 'left';
    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(
      `fluid at ${fmtT(p.Tinf)} °C · h on every exposed face${isRect ? ' · the blade seen edge-on: 2 mm thin' : ''}`,
      pad + 2,
      H - pad - 2,
    );
  }, { running: false, redrawKey });

  useWheelZoom(canvasRef, zoomRef, setZoomTick);

  return (
    <canvas
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label={
        params.shape === 'rect'
          ? 'A rectangular plate fin seen side-on, shaded by its temperature solution, with the T(x) profile drawn above it'
          : 'A pin fin seen side-on, shaded by its temperature solution, with the T(x) profile drawn above it'
      }
    />
  );
}

function fmtT(v: number): string {
  return String(Number(v.toPrecision(3)));
}
