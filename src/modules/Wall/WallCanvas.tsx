import { useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { applyZoom, useWheelZoom } from '../FicksLaw/FickCanvas';
import {
  dominant,
  elements,
  heatRate,
  nodeTemps,
  type WallParams,
} from '../../lib/network';
import { rampWarm } from '../FourierLaw/FourierCanvas';
import { sci } from '../../lib/format';

/**
 * The wall and its circuit, drawn from the same numbers so they cannot
 * disagree.
 *
 * Top: the physical stack — every layer shaded by its local temperature,
 * with the piecewise-linear T(x) polyline riding on top. The slope changes
 * at every interface: steep through insulators, flat through conductors,
 * and the convection films appear as temperature CLIFFS at the two faces —
 * a drop with no thickness to spend it in.
 *
 * Bottom: the equivalent series circuit, resistor by resistor, with the
 * node temperatures between them. Same Q through every element; each drops
 * exactly Q·R. The dominant resistor is highlighted, because "who eats the
 * ΔT budget" is the entire point of drawing circuits at all.
 *
 * Static picture — no clock, nothing cosmetic. Every number shown is
 * physical.
 */

export function WallCanvas({ params, dark }: { params: WallParams; dark: boolean }) {
  const zoomRef = useRef(1);
  const [zoomTick, setZoomTick] = useState(0);
  const redrawKey = JSON.stringify(params) + dark + zoomTick;

  const canvasRef = useCanvas((ctx, frame) => {
    const p = params;
    const { width: W, height: H } = frame;
    applyZoom(ctx, zoomRef.current, W, H);
    const pad = 10;
    const els = elements(p);
    if (els.length === 0) return;
    const temps = nodeTemps(p);
    const Q = heatRate(p);
    const dom = dominant(p).index;

    const tLo = Math.min(p.Tin, p.Tout);
    const tHi = Math.max(p.Tin, p.Tout);
    const span = tHi - tLo || 1;
    const norm = (T: number) => (T - tLo) / span;

    // ------------------------------------------------------------- wall
    const wx0 = pad + 34;
    const wx1 = W - pad - 34;
    const wy0 = pad + 20;
    // Wall height tracks the area slider (log-mapped, 0.1..100 m^2).
    const tA = Math.min(1, Math.max(0, (Math.log10(p.A) + 1) / 3));
    const wy1 = wy0 + (H * 0.52 - wy0) * (0.55 + 0.45 * tA);
    const wallW = wx1 - wx0;
    const wallH = wy1 - wy0;
    if (wallW <= 0 || wallH <= 0) return;

    // Horizontal slots: films get a fixed sliver, layers share the rest in
    // proportion to thickness (with a floor so thin layers stay visible).
    const filmW = 26;
    const nFilms = els.filter((e) => e.kind === 'film').length;
    const layerSpace = wallW - nFilms * filmW;
    const totalL = els.reduce((s, e) => s + e.L, 0) || 1;
    const widths = els.map((e) =>
      e.kind === 'film' ? filmW : Math.max(0.07 * layerSpace, (e.L / totalL) * layerSpace),
    );
    const wSum = widths.reduce((s, w) => s + w, 0);
    const scale = wallW / wSum;
    for (let i = 0; i < widths.length; i++) widths[i] *= scale;

    // Reservoir cheeks: the two fluids.
    ctx.fillStyle = rampWarm(norm(p.Tin), dark);
    ctx.fillRect(pad, wy0, wx0 - pad, wallH);
    ctx.fillStyle = rampWarm(norm(p.Tout), dark);
    ctx.fillRect(wx1, wy0, W - pad - wx1, wallH);
    hatchRect(ctx, pad, wy0, wx0 - pad, wallH, dark);
    hatchRect(ctx, wx1, wy0, W - pad - wx1, wallH, dark);

    // Elements, shaded strip by strip between their node temperatures.
    let x = wx0;
    const edgesX: number[] = [x];
    for (let i = 0; i < els.length; i++) {
      const w = widths[i];
      const Ta = temps[i];
      const Tb = temps[i + 1];
      for (let px = 0; px < w; px++) {
        const T = Ta + ((Tb - Ta) * px) / w;
        ctx.fillStyle = rampWarm(norm(T), dark);
        ctx.fillRect(x + px, wy0, 1.5, wallH);
      }
      if (els[i].kind === 'film') hatchRect(ctx, x, wy0, w, wallH, dark);
      x += w;
      edgesX.push(x);
    }

    // Interface lines.
    ctx.strokeStyle = dark ? '#475569' : '#cbd5e1';
    ctx.lineWidth = 1.25;
    for (const ex of edgesX) {
      ctx.beginPath();
      ctx.moveTo(ex, wy0 - 4);
      ctx.lineTo(ex, wy1 + 4);
      ctx.stroke();
    }

    // T(x) polyline over the wall: linear inside each element.
    const ty = (T: number) => wy1 - 6 - (wallH - 12) * norm(T);
    ctx.strokeStyle = dark ? '#f1f5f9' : '#0f172a';
    ctx.lineWidth = 2.25;
    ctx.beginPath();
    ctx.moveTo(pad + 2, ty(p.Tin));
    ctx.lineTo(wx0, ty(temps[0]));
    for (let i = 0; i < els.length; i++) ctx.lineTo(edgesX[i + 1], ty(temps[i + 1]));
    ctx.lineTo(W - pad - 2, ty(p.Tout));
    ctx.stroke();

    // Layer names under the wall.
    ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < els.length; i++) {
      const cxE = (edgesX[i] + edgesX[i + 1]) / 2;
      ctx.fillStyle = i === dom ? (dark ? '#fbbf24' : '#b45309') : dark ? '#94a3b8' : '#64748b';
      ctx.fillText(shorten(els[i].label, widths[i]), cxE, wy1 + 16);
    }
    ctx.fillStyle = dark ? '#cbd5e1' : '#475569';
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(`${fmtT(p.Tin)} °C`, (pad + wx0) / 2, wy0 - 8);
    ctx.fillText(`${fmtT(p.Tout)} °C`, (wx1 + W - pad) / 2, wy0 - 8);

    // ------------------------------------------------------------ circuit
    const cy = H * 0.78;
    const cx0 = pad + 30;
    const cx1 = W - pad - 30;
    const slot = (cx1 - cx0) / els.length;

    ctx.strokeStyle = dark ? '#94a3b8' : '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad + 4, cy);
    ctx.lineTo(cx0, cy);
    ctx.stroke();

    for (let i = 0; i < els.length; i++) {
      const xa = cx0 + i * slot;
      const xb = xa + slot;
      const zx0 = xa + slot * 0.18;
      const zx1 = xb - slot * 0.18;
      const amp = 7;
      const col =
        i === dom ? (dark ? '#fbbf24' : '#d97706') : dark ? '#94a3b8' : '#475569';
      // lead-in, zigzag, lead-out
      ctx.strokeStyle = col;
      ctx.lineWidth = i === dom ? 2.25 : 1.5;
      ctx.beginPath();
      ctx.moveTo(xa, cy);
      ctx.lineTo(zx0, cy);
      const nZig = 6;
      for (let z = 0; z < nZig; z++) {
        const zx = zx0 + ((z + 0.5) / nZig) * (zx1 - zx0);
        ctx.lineTo(zx, cy + (z % 2 === 0 ? -amp : amp));
      }
      ctx.lineTo(zx1, cy);
      ctx.lineTo(xb, cy);
      ctx.stroke();

      // R value above, name below.
      ctx.textAlign = 'center';
      ctx.font = '600 10px ui-monospace, monospace';
      ctx.fillStyle = col;
      ctx.fillText(fmtR(els[i].R), (xa + xb) / 2, cy - 14);
      // Node dot + temperature after this element.
      ctx.fillStyle = dark ? '#e2e8f0' : '#0f172a';
      ctx.beginPath();
      ctx.arc(xb, cy, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
      ctx.fillStyle = dark ? '#94a3b8' : '#64748b';
      ctx.fillText(`${fmtT(temps[i + 1])}°`, xb, cy + 20);
    }
    // First node.
    ctx.fillStyle = dark ? '#e2e8f0' : '#0f172a';
    ctx.beginPath();
    ctx.arc(cx0, cy, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = dark ? '#94a3b8' : '#64748b';
    ctx.textAlign = 'center';
    ctx.fillText(`${fmtT(temps[0])}°`, cx0, cy + 20);

    ctx.strokeStyle = dark ? '#94a3b8' : '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx1, cy);
    ctx.lineTo(W - pad - 4, cy);
    ctx.stroke();

    // Q arrow and caption.
    const qCol = dark ? '#fb923c' : '#dc2626';
    ctx.strokeStyle = qCol;
    ctx.fillStyle = qCol;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad + 6, cy - 26);
    ctx.lineTo(pad + 40, cy - 26);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pad + 40, cy - 26);
    ctx.lineTo(pad + 33, cy - 30);
    ctx.lineTo(pad + 33, cy - 22);
    ctx.closePath();
    ctx.fill();
    ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Q = ${sci(Q)} W — the same through every element`, pad + 46, cy - 22);
  }, { running: false, redrawKey });

  useWheelZoom(canvasRef, zoomRef, setZoomTick);

  return (
    <canvas
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label="A composite wall shaded by temperature, with its equivalent series resistor circuit drawn beneath it"
    />
  );
}

function hatchRect(
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

function shorten(s: string, w: number): string {
  const maxChars = Math.max(3, Math.floor(w / 6));
  return s.length > maxChars ? s.slice(0, maxChars - 1) + '…' : s;
}

function fmtT(T: number): string {
  return String(Number(T.toPrecision(3)));
}

function fmtR(R: number): string {
  if (R >= 0.01 && R < 1000) return String(Number(R.toPrecision(2)));
  return sci(R, 2);
}
