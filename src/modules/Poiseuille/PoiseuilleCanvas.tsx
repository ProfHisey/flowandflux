import { useEffect, useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { vMax, velocity, type PoiseuilleParams } from '../../lib/poiseuille';
import { rampFlow } from '../NewtonViscosity/NewtonCanvas';
import { applyZoom, chip2d, useWheelZoom } from '../FicksLaw/FickCanvas';

/**
 * The conduit, in longitudinal section, with tracers riding the real
 * velocity profile shape. Tube and plates run left to right under a
 * pressure difference; the film runs DOWN a wall under nothing but its own
 * weight. Tracers do not diffuse (same design decision as the Newton
 * module: the profile is the lesson), and the on-screen peak speed is
 * fixed for legibility — the SHAPE of the profile and every readout are
 * physical.
 */

const COUNT = 130;
/** On-screen speed of the fastest fluid, px/s. Visual, like D_VIS. */
const V_VIS = 85;

interface Tracer {
  /** Streamwise position, px. */
  a: number;
  /** Transverse fraction 0..1 (fixed — no diffusion). */
  f: number;
}

export function PoiseuilleCanvas({
  params,
  showParticles,
  running,
  dark,
}: {
  params: PoiseuilleParams;
  showParticles: boolean;
  running: boolean;
  dark: boolean;
}) {
  const tracersRef = useRef<Tracer[]>([]);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const zoomRef = useRef(1);
  const [zoomTick, setZoomTick] = useState(0);

  const redrawKey = `${JSON.stringify(params)}|${dark}|${showParticles}|${zoomTick}`;

  useEffect(() => {
    tracersRef.current = [];
  }, [params.geometry]);

  const canvasRef = useCanvas((ctx, frame) => {
    const p = paramsRef.current;
    const { width: W, height: H } = frame;
    applyZoom(ctx, zoomRef.current, W, H);
    const pad = 8;
    const dt = running && showParticles ? frame.dt : 0;
    const vpk = Math.max(vMax(p), 1e-12);

    // Normalized speed at transverse fraction f in [0, 1].
    const speedAt = (f: number): number => {
      const s =
        p.geometry === 'tube' ? Math.abs(f * 2 - 1) * p.R : f * p.h;
      return velocity(p, s) / vpk;
    };

    const isFilm = p.geometry === 'film';

    // Drawn size tracks the sliders (log-mapped): bore/gap sets the channel
    // height, length sets its extent, film thickness sets the film width.
    const sDim = p.geometry === 'tube' ? p.R : p.h;
    const tS = Math.min(1, Math.max(0, (Math.log10(sDim) + 4.3) / 2)); // 5e-5..5e-3 m
    const tL = Math.min(1, Math.max(0, (Math.log10(p.L) + 2) / 2)); // 0.01..1 m

    if (!isFilm) {
      // ---------------- horizontal conduit: tube or plates ----------------
      const wallT = 13;
      const x0 = pad + 46;
      const x1 = x0 + (W - pad - 10 - x0) * (0.65 + 0.35 * tL);
      const y0f = pad + 26 + wallT;
      const y1f = H - pad - 26 - wallT;
      const ycS = (y0f + y1f) / 2;
      const halfG = ((y1f - y0f) / 2) * (0.4 + 0.6 * tS);
      const y0 = ycS - halfG;
      const y1 = ycS + halfG;
      const chW = x1 - x0;
      const chH = y1 - y0;
      if (chW <= 0 || chH <= 0) return;

      // Speed shading, row by row.
      for (let py = 0; py < chH; py++) {
        ctx.fillStyle = rampFlow(speedAt(py / chH), dark);
        ctx.fillRect(x0, y0 + py, chW, 1.5);
      }

      drawWall(ctx, x0, y0 - wallT, chW, wallT, dark);
      drawWall(ctx, x0, y1, chW, wallT, dark);

      if (showParticles) {
        stepTracers(tracersRef, chW, dt, speedAt);
        ctx.fillStyle = dark ? 'rgba(226,232,240,0.85)' : 'rgba(15,23,42,0.65)';
        for (const q of tracersRef.current) {
          ctx.beginPath();
          ctx.arc(x0 + q.a, y0 + q.f * chH, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Centreline (tube) / mid-gap marker.
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = dark ? '#64748b' : '#94a3b8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, (y0 + y1) / 2);
      ctx.lineTo(x1, (y0 + y1) / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Velocity-profile arrows down the left edge, contrast slate.
      const arrowCol = dark ? '#f1f5f9' : '#1e293b';
      ctx.strokeStyle = arrowCol;
      ctx.fillStyle = arrowCol;
      ctx.lineWidth = 1.6;
      for (let i = 0; i <= 6; i++) {
        const f = i / 6;
        const y = y0 + f * chH;
        const len = speedAt(f) * 46;
        if (len < 1.5) continue;
        ctx.beginPath();
        ctx.moveTo(x0 + 4, y);
        ctx.lineTo(x0 + 4 + len, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x0 + 4 + len, y);
        ctx.lineTo(x0 + len - 2, y - 3);
        ctx.lineTo(x0 + len - 2, y + 3);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = dark ? '#475569' : '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0 + 4, y0);
      ctx.lineTo(x0 + 4, y1);
      ctx.stroke();

      // Pressure ends.
      chip2d(ctx, x0 + 52, (y0 + y1) / 2, 'P + ΔP', dark);
      chip2d(ctx, x1 - 40, (y0 + y1) / 2, 'P', dark);

      ctx.fillStyle = dark ? '#cbd5e1' : '#475569';
      ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(
        p.geometry === 'tube'
          ? 'rigid tube wall — no slip, v = 0'
          : 'stationary plate — no slip, v = 0',
        x0, y0 - wallT - 6,
      );
      ctx.fillText('flow →  driven by the pressure difference', x0, y1 + wallT + 16);
    } else {
      // ------------------------- falling film -------------------------
      const wallT = 13;
      const y0 = pad + 24;
      const y1 = H - pad - 24;
      const filmW = Math.min(W * 0.34, 180) * (0.4 + 0.6 * tS);
      // Centre the whole group (wall + film + gravity annotation) in the
      // canvas — anchored hard-left it looked lost on wide screens.
      const annotW = 46 + 140; // g-arrow offset + its label
      const x0 = Math.max(
        pad + wallT,
        (W - (wallT + filmW + annotW)) / 2 + wallT,
      );
      const x1 = x0 + filmW;
      const chH = y1 - y0;
      if (chH <= 0) return;

      // Speed shading, column by column: zero at the wall, max at the
      // free surface.
      for (let px = 0; px < filmW; px++) {
        ctx.fillStyle = rampFlow(speedAt(px / filmW), dark);
        ctx.fillRect(x0 + px, y0, 1.5, chH);
      }

      // The wall (vertical) and the free surface (dashed).
      drawWall(ctx, x0 - wallT, y0, wallT, chH, dark, true);
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = dark ? '#7dd3fc' : '#0284c7';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x1, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.setLineDash([]);

      if (showParticles) {
        stepTracers(tracersRef, chH, dt, speedAt);
        ctx.fillStyle = dark ? 'rgba(226,232,240,0.85)' : 'rgba(15,23,42,0.65)';
        for (const q of tracersRef.current) {
          ctx.beginPath();
          ctx.arc(x0 + q.f * filmW, y0 + q.a, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Profile arrows along the top, pointing down.
      const arrowCol = dark ? '#f1f5f9' : '#1e293b';
      ctx.strokeStyle = arrowCol;
      ctx.fillStyle = arrowCol;
      ctx.lineWidth = 1.6;
      for (let i = 0; i <= 5; i++) {
        const f = i / 5;
        const x = x0 + f * filmW;
        const len = speedAt(f) * 40;
        if (len < 1.5) continue;
        ctx.beginPath();
        ctx.moveTo(x, y0 + 4);
        ctx.lineTo(x, y0 + 4 + len);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y0 + 4 + len);
        ctx.lineTo(x - 3, y0 + len - 2);
        ctx.lineTo(x + 3, y0 + len - 2);
        ctx.closePath();
        ctx.fill();
      }

      // Gravity arrow.
      const gx = x1 + 46;
      ctx.strokeStyle = dark ? '#fb923c' : '#dc2626';
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gx, (y0 + y1) / 2 - 26);
      ctx.lineTo(gx, (y0 + y1) / 2 + 26);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(gx, (y0 + y1) / 2 + 26);
      ctx.lineTo(gx - 4, (y0 + y1) / 2 + 19);
      ctx.lineTo(gx + 4, (y0 + y1) / 2 + 19);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = dark ? '#cbd5e1' : '#475569';
      ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('g — the only driver', gx + 8, (y0 + y1) / 2 + 4);

      ctx.textAlign = 'center';
      ctx.fillText('wall · no slip', x0 - wallT / 2, y0 - 8);
      ctx.fillText('free surface · zero shear, max speed', x1, y1 + 16);
    }
  }, { running: running && showParticles, redrawKey });

  useWheelZoom(canvasRef, zoomRef, setZoomTick);

  return (
    <canvas
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label={`Laminar ${params.geometry} flow with tracers riding the velocity profile`}
    />
  );
}

function stepTracers(
  tracersRef: React.RefObject<Tracer[]>,
  span: number,
  dt: number,
  speedAt: (f: number) => number,
) {
  const list = tracersRef.current!;
  if (list.length === 0) {
    for (let i = 0; i < COUNT; i++) {
      list.push({ a: Math.random() * span, f: Math.random() });
    }
  }
  if (dt > 0) {
    for (const q of list) {
      q.a += speedAt(q.f) * V_VIS * dt;
      if (q.a > span) {
        q.a -= span;
        q.f = Math.random();
      }
    }
  }
}

/** A stationary wall: solid bar with static hatching (the no-slip anchor). */
function drawWall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  dark: boolean,
  vertical = false,
) {
  ctx.fillStyle = dark ? '#334155' : '#e2e8f0';
  ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = dark ? 'rgba(226,232,240,0.3)' : 'rgba(100,116,139,0.4)';
  ctx.lineWidth = 1;
  const t = vertical ? h : w;
  const d0 = vertical ? w : h;
  for (let d = -d0; d < t + d0; d += 7) {
    ctx.beginPath();
    if (vertical) {
      ctx.moveTo(x, y + d);
      ctx.lineTo(x + w, y + d + w);
    } else {
      ctx.moveTo(x + d, y + h);
      ctx.lineTo(x + d + h, y);
    }
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = dark ? '#475569' : '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
}
