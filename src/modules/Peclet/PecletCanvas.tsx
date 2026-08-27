import { useEffect, useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { theta } from '../../lib/peclet';
import { applyZoom, D_VIS, gauss, rampColor, useWheelZoom } from '../FicksLaw/FickCanvas';

/**
 * The two motions, finally in one canvas: every walker takes the SAME
 * unbiased diffusive steps as in the Fick module, AND rides the flow. The
 * one honest trick this canvas pulls: the on-screen drift speed is chosen
 * so that the VISUAL Peclet number equals the physical one (clamped to
 * +-60 so the picture stays watchable at Pe = 10^7 — the caption owns up
 * when clamping). Speeds are cosmetic; the RATIO, which is the entire
 * subject of this module, is real.
 *
 * Left bath at C0, right bath at CL, edge bins resampled Dirichlet-style;
 * the interior profile emerges from the walking + drifting and is compared
 * against the analytic exponential (amber curve) — the house
 * measured-vs-predicted pattern, now with convection in the mix.
 */

const BINS = 36;
const BUDGET = 1100;
const PE_CAP = 60;

interface P {
  x: number;
  y: number;
}

export function PecletCanvas({
  Pe,
  running,
  dark,
}: {
  /** Physical Peclet number (the canvas clamps its visual copy to ±60). */
  Pe: number;
  running: boolean;
  dark: boolean;
}) {
  const particlesRef = useRef<P[]>([]);
  const peRef = useRef(Pe);
  peRef.current = Pe;

  const zoomRef = useRef(1);
  const [zoomTick, setZoomTick] = useState(0);

  const peVis = Math.max(-PE_CAP, Math.min(PE_CAP, Pe));
  // Reseeding keys on the PHYSICS only — zooming must not reset the cloud.
  const seedKey = `${peVis.toFixed(3)}|${dark}`;
  const redrawKey = `${seedKey}|${zoomTick}`;

  useEffect(() => {
    particlesRef.current = [];
  }, [seedKey]);

  const canvasRef = useCanvas((ctx, frame) => {
    const { width: W, height: H } = frame;
    applyZoom(ctx, zoomRef.current, W, H);
    const pad = 8;
    const x0 = pad + 56;
    const x1 = W - pad - 56;
    const y0 = pad + 26;
    const y1 = H - pad - 30;
    const slabW = x1 - x0;
    const slabH = y1 - y0;
    if (slabW <= 0 || slabH <= 0) return;
    const dt = running ? frame.dt : 0;

    const peV = Math.max(-PE_CAP, Math.min(PE_CAP, peRef.current));
    // Visual drift chosen so v_vis * slabW / D_VIS = Pe exactly.
    const vVis = (peV * D_VIS) / slabW;
    const th = (xi: number) => theta(peV, xi);
    // theta runs 1 -> 0 in concentration terms when C0 > CL; shade with
    // 1 - theta so the left (C0) side is dark like the Fick module.
    const norm = (xi: number) => 1 - th(xi);

    // Field shading from the analytic profile (the reservoirs pin it).
    for (let px = 0; px < slabW; px++) {
      ctx.fillStyle = rampColor(norm(px / slabW) * 0.9, dark);
      ctx.fillRect(x0 + px, y0, 1.5, slabH);
    }
    // Baths.
    ctx.fillStyle = rampColor(norm(0) * 0.9, dark);
    ctx.fillRect(pad, y0, 56 - pad, slabH);
    ctx.fillStyle = rampColor(norm(1) * 0.9, dark);
    ctx.fillRect(x1, y0, 56 - pad, slabH);
    hatch(ctx, pad, y0, 56 - pad, slabH, dark);
    hatch(ctx, x1, y0, 56 - pad, slabH, dark);

    // Walkers: diffuse AND drift.
    const list = particlesRef.current;
    const binW = slabW / BINS;
    const perBin = BUDGET / BINS;
    const targetFor = (bin: number) =>
      Math.round(perBin * norm((bin + 0.5) / BINS) * 2);

    if (list.length === 0) {
      for (let bin = 0; bin < BINS; bin++) {
        const want = targetFor(bin);
        for (let k = 0; k < want; k++) {
          list.push({
            x: x0 + binW * (bin + Math.random()),
            y: y0 + Math.random() * slabH,
          });
        }
      }
    }

    const sigma = Math.sqrt(2 * D_VIS * dt);
    for (const q of list) {
      if (dt > 0) {
        q.x += vVis * dt + sigma * gauss(); // drift + unbiased wander
        q.y += sigma * gauss();
        if (q.y < y0) q.y = y0 + (y0 - q.y);
        if (q.y > y1) q.y = y1 - (q.y - y1);
      }
    }
    // Dirichlet edge bins (and anything swept past the ends).
    for (let i = list.length - 1; i >= 0; i--) {
      const bin = Math.floor((list[i].x - x0) / binW);
      if (bin <= 0 || bin >= BINS - 1) list.splice(i, 1);
    }
    for (const bin of [0, BINS - 1]) {
      const want = targetFor(bin);
      for (let k = 0; k < want; k++) {
        list.push({
          x: x0 + binW * (bin + Math.random()),
          y: y0 + Math.random() * slabH,
        });
      }
    }

    ctx.fillStyle = dark ? 'rgba(226,232,240,0.75)' : 'rgba(15,23,42,0.55)';
    for (const q of list) {
      ctx.beginPath();
      ctx.arc(q.x, q.y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // The analytic profile the walkers should be carrying (amber), drawn
    // as expected walkers-per-bin, sharing the vertical scale with reality.
    const heightScale = (slabH * 0.85) / (perBin * 2);
    ctx.strokeStyle = dark ? '#fbbf24' : '#d97706';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const xi = i / 120;
      const y = y1 - targetForXi(norm, xi, perBin) * heightScale;
      const x = x0 + xi * slabW;
      if (i === 0) ctx.moveTo(x, Math.max(y0 + 2, y));
      else ctx.lineTo(x, Math.max(y0 + 2, y));
    }
    ctx.stroke();

    // Flow arrow, sized by how hard convection is winning.
    const dir = peV >= 0 ? 1 : -1;
    const mag = 20 + 50 * (Math.abs(peV) / PE_CAP);
    const ay = y0 + 14;
    ctx.strokeStyle = dark ? '#34d399' : '#047857';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo((x0 + x1) / 2 - dir * mag, ay);
    ctx.lineTo((x0 + x1) / 2 + dir * mag, ay);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo((x0 + x1) / 2 + dir * mag, ay);
    ctx.lineTo((x0 + x1) / 2 + dir * (mag - 7), ay - 4);
    ctx.lineTo((x0 + x1) / 2 + dir * (mag - 7), ay + 4);
    ctx.closePath();
    ctx.fill();

    // Labels.
    ctx.fillStyle = dark ? '#cbd5e1' : '#475569';
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('C₀ bath', (pad + x0) / 2, y0 - 10);
    ctx.fillText('C_L bath', (x1 + W - pad) / 2, y0 - 10);
    ctx.fillText(`flow — the walkers drift AND wander`, (x0 + x1) / 2, ay + 16);
    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
    ctx.textAlign = 'right';
    ctx.fillText(
      Math.abs(peRef.current) > PE_CAP
        ? `visual Pe clamped to ${PE_CAP} (physical Pe = ${fmtPe(peRef.current)}); the regime is the same`
        : `visual Pe = physical Pe = ${fmtPe(peRef.current)} — the ratio on screen is real`,
      x1, y1 + 20,
    );
  }, { running, redrawKey });

  useWheelZoom(canvasRef, zoomRef, setZoomTick);

  return (
    <canvas
      role="img"
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label="Walkers that both diffuse and ride a flow, between two baths, compared against the analytic convection-diffusion profile"
    />
  );
}

function targetForXi(norm: (xi: number) => number, xi: number, perBin: number): number {
  return perBin * norm(xi) * 2;
}

function fmtPe(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e4) return v.toExponential(1).replace('e+', '×10^');
  return String(Number(v.toPrecision(3)));
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
