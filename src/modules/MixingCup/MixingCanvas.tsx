import { useEffect, useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { applyZoom, useWheelZoom } from '../FicksLaw/FickCanvas';
import { rampWarm } from '../FourierLaw/FourierCanvas';
import { tempAt, mixingCupT, type MixingCupParams } from '../../lib/mixingcup';

/**
 * The cup does the integral. Tracers ride the Poiseuille profile through a
 * heated tube — fast in the core, crawling at the wall, each carrying the
 * temperature of its own radius — and fall into a cup at the outlet. The
 * cup's running average converges to the mixing-cup temperature for free,
 * because fast lanes deliver more tracers per second: the velocity
 * weighting is not programmed in, it HAPPENS. That is the whole lesson.
 *
 * Tracer speeds are visual; the arrival statistics are the physics, and
 * the canvas says so.
 */

export interface CupStats {
  /** Running mean temperature of everything the cup has collected, degC. */
  cupT: number;
  /** How many tracers the cup has collected. */
  samples: number;
}

interface Tracer {
  x: number;
  /** radial position, r/R in [-1, 1] — fixed for the transit */
  rho: number;
}

const COUNT = 150;

/** Area-weighted radius, P(r) ∝ r — the STANDING population of a steady
 *  pipe (used for the initial fill). */
function seedRho(): number {
  const u = Math.sqrt(Math.random());
  return (Math.random() < 0.5 ? -1 : 1) * Math.min(0.985, u);
}

/** Flux-weighted radius, P(r) ∝ v(r)·r — what actually crosses the inlet
 *  per second (used on respawn). Inverse CDF of 2u² − u⁴. The two together
 *  keep the on-screen population area-uniform, exactly like real fluid,
 *  because slow lanes hold their tracers longer: injection ∝ v·r times
 *  residence ∝ 1/v gives standing density ∝ r. Get this wrong (respawn
 *  area-weighted) and the cup quietly converges to the area average —
 *  arrival radii would be i.i.d. area draws no matter how long slow
 *  transits take. */
function respawnRho(): number {
  const u = Math.sqrt(1 - Math.sqrt(1 - Math.random()));
  return (Math.random() < 0.5 ? -1 : 1) * Math.min(0.985, u);
}

export function MixingCanvas({
  params,
  speed,
  resetTick,
  running,
  dark,
  onStats,
}: {
  params: MixingCupParams;
  /** Visual pace multiplier — cancels out of every physical number. */
  speed: number;
  resetTick: number;
  running: boolean;
  dark: boolean;
  onStats?: (s: CupStats) => void;
}) {
  const tracersRef = useRef<Tracer[]>([]);
  const cupSumRef = useRef(0);
  const cupNRef = useRef(0);
  const emitRef = useRef(0);
  const liveRef = useRef({ params, speed });
  liveRef.current = { params, speed };
  const zoomRef = useRef(1);
  const [zoomTick, setZoomTick] = useState(0);

  const redrawKey = `${JSON.stringify(params)}|${resetTick}|${dark}|${zoomTick}`;

  // New profile = new experiment: the cup empties.
  useEffect(() => {
    tracersRef.current = [];
    cupSumRef.current = 0;
    cupNRef.current = 0;
  }, [params.Tw, params.Tc, params.n, resetTick]);

  const canvasRef = useCanvas((ctx, frame) => {
    const p = liveRef.current.params;
    const { width: W, height: H } = frame;
    applyZoom(ctx, zoomRef.current, W, H);
    const pad = 8;

    // Tube: left three-quarters. Cup: right, under the outlet.
    const x0 = pad + 6;
    const x1 = W - pad - 96;
    const yc = pad + 24 + (H - 2 * pad - 60) / 2;
    const halfH = (H - 2 * pad - 60) / 2;
    const y0 = yc - halfH;
    const y1 = yc + halfH;
    if (x1 - x0 <= 0 || halfH <= 0) return;

    const tLo = Math.min(p.Tw, p.Tc);
    const span = Math.abs(p.Tw - p.Tc) || 1;
    const norm = (T: number) => Math.min(1, Math.max(0, (T - tLo) / span));

    // ---- physics: advance tracers, collect arrivals
    const dt = running ? Math.min(frame.dt, 0.033) : 0;
    const list = tracersRef.current;
    if (list.length === 0) {
      for (let i = 0; i < COUNT; i++) {
        list.push({ x: x0 + Math.random() * (x1 - x0), rho: seedRho() });
      }
    }
    const vMax = 130 * liveRef.current.speed;
    if (dt > 0) {
      for (const q of list) {
        q.x += vMax * (1 - q.rho * q.rho) * dt;
        if (q.x > x1) {
          cupSumRef.current += tempAt(p, q.rho);
          cupNRef.current++;
          q.x = x0;
          q.rho = respawnRho();
        }
      }
    }

    // ---- draw: temperature field inside the tube (translucent bands)
    const NB = 48;
    for (let b = 0; b < NB; b++) {
      const ya = y0 + (b / NB) * 2 * halfH;
      const rho = (ya + halfH / NB - yc) / halfH;
      ctx.fillStyle = rampWarm(norm(tempAt(p, rho)), dark, 0.32);
      ctx.fillRect(x0, ya, x1 - x0, (2 * halfH) / NB + 0.5);
    }

    // Velocity profile at the inlet — the other half of the weighting.
    ctx.strokeStyle = dark ? '#34d399' : '#059669';
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    const vScale = 52;
    for (let i = 0; i <= 40; i++) {
      const rho = -1 + (2 * i) / 40;
      const y = yc + rho * halfH;
      const x = x0 + vScale * (1 - rho * rho);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = dark ? 'rgba(52,211,153,0.5)' : 'rgba(5,150,105,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0, y1);
    ctx.stroke();
    ctx.setLineDash([]);

    // Tracers, coloured by the temperature of their radius.
    for (const q of list) {
      ctx.fillStyle = rampWarm(norm(tempAt(p, q.rho)), dark);
      ctx.beginPath();
      ctx.arc(q.x, yc + q.rho * halfH, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tube walls.
    ctx.strokeStyle = dark ? '#475569' : '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y0);
    ctx.moveTo(x0, y1);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    // ---- the cup
    const cupW = 58;
    const cupX = x1 + 22;
    const cupY0 = yc - 4;
    const cupY1 = y1 + 26;
    const cupT = cupNRef.current > 0 ? cupSumRef.current / cupNRef.current : NaN;
    // Spout: outlet funnels into the cup.
    ctx.strokeStyle = dark ? '#475569' : '#94a3b8';
    ctx.lineWidth = 1.25;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x1, y0);
    ctx.lineTo(cupX + cupW / 2, cupY0);
    ctx.moveTo(x1, y1);
    ctx.lineTo(cupX + cupW / 2, cupY0);
    ctx.stroke();
    ctx.setLineDash([]);
    // The liquid: coloured by what has actually been collected.
    if (cupNRef.current > 0) {
      ctx.fillStyle = rampWarm(norm(cupT), dark, 0.85);
      ctx.fillRect(cupX + 3, cupY0 + 8, cupW - 6, cupY1 - cupY0 - 11);
    }
    // The cup itself.
    ctx.strokeStyle = dark ? '#94a3b8' : '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cupX, cupY0);
    ctx.lineTo(cupX + 4, cupY1 - 3);
    ctx.lineTo(cupX + cupW - 4, cupY1 - 3);
    ctx.lineTo(cupX + cupW, cupY0);
    ctx.stroke();

    // ---- labels
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = dark ? '#cbd5e1' : '#475569';
    ctx.textAlign = 'left';
    ctx.fillText(`wall at ${fmt(p.Tw)} °C — and v = 0 there (no-slip)`, x0 + 2, y0 - 8);
    ctx.fillText(`centreline at ${fmt(p.Tc)} °C — moving at 2v̄`, x0 + 2, y1 + 16);
    ctx.fillStyle = dark ? '#34d399' : '#059669';
    ctx.fillText('v(r)', x0 + vScale + 6, yc + 4);
    ctx.textAlign = 'center';
    ctx.fillStyle = dark ? '#cbd5e1' : '#475569';
    ctx.fillText(
      cupNRef.current > 0 ? `cup: ${fmt(cupT)} °C` : 'cup: —',
      cupX + cupW / 2,
      cupY1 + 14,
    );
    ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
    ctx.fillText(`${cupNRef.current} samples`, cupX + cupW / 2, cupY1 + 27);
    ctx.textAlign = 'right';
    ctx.fillText('tracer pace is visual — the arrival statistics are the physics', x1, H - pad - 2);

    // ---- stats
    emitRef.current += frame.dt;
    if (onStats && emitRef.current >= 0.4) {
      onStats({ cupT: cupNRef.current > 0 ? cupT : mixingCupT(p), samples: cupNRef.current });
      emitRef.current = 0;
    }
  }, { running, redrawKey });

  useWheelZoom(canvasRef, zoomRef, setZoomTick);

  return (
    <canvas
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label="Tracers riding a parabolic velocity profile through a heated tube and collecting in a cup, whose temperature converges to the mixing-cup average"
    />
  );
}

function fmt(v: number): string {
  return String(Number(v.toPrecision(3)));
}
