import { useEffect, useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { applyZoom, D_VIS, gauss, rampColor, useWheelZoom } from '../FicksLaw/FickCanvas';

/**
 * The capsule burst. At t = 0 every walker sits in a thin band at the
 * centre; press play and the cloud spreads. Nothing else happens — and that
 * is the module: concentration changing in time, before any talk of steady
 * state.
 *
 * Two independent measurements run side by side, house style:
 *   - the walkers themselves (their density shades the columns), and
 *   - the analytic Gaussian for an instantaneous release (amber curve),
 *     drawn from sqrt(4 pi D t) with the SAME visual D and the same clock.
 * The sigma readout below the canvas compares the measured spread of the
 * cloud against sqrt(2 D t) as the numbers.
 *
 * The walls reflect; the analytic curve assumes an open medium. They agree
 * until the cloud feels the walls — and the caption owns up the moment that
 * happens rather than hiding it.
 */

export interface PulseStats {
  /** Sample standard deviation of walker positions, px. */
  sigmaMeasured: number;
  /** sqrt(2 D_VIS t): what the random-walk theory predicts, px. */
  sigmaPredicted: number;
  /** Visual seconds since the burst. */
  t: number;
  /** True once the cloud is wide enough to feel the reflecting walls. */
  touchingWalls: boolean;
}

interface Particle {
  x: number;
  y: number;
}

const COUNT = 1200;
const BINS = 40;

export function UnsteadyCanvas({
  releaseTick,
  running,
  dark,
  onStats,
}: {
  /** Increment to re-burst the capsule. */
  releaseTick: number;
  running: boolean;
  dark: boolean;
  onStats?: (s: PulseStats) => void;
}) {
  const particlesRef = useRef<Particle[]>([]);
  const tRef = useRef(0);
  const emitRef = useRef(0);
  const zoomRef = useRef(1);
  const [zoomTick, setZoomTick] = useState(0);

  const redrawKey = `${dark}|${releaseTick}|${zoomTick}`;

  useEffect(() => {
    particlesRef.current = [];
    tRef.current = 0;
    emitRef.current = 0;
  }, [releaseTick]);

  const canvasRef = useCanvas((ctx, frame) => {
    const { width: W, height: H } = frame;
    applyZoom(ctx, zoomRef.current, W, H);
    const pad = 8;
    const x0 = pad + 10;
    const x1 = W - pad - 10;
    const y0 = pad + 26;
    const y1 = H - pad - 30;
    const slabW = x1 - x0;
    const slabH = y1 - y0;
    if (slabW <= 0 || slabH <= 0) return;
    const xc = (x0 + x1) / 2;

    const dt = running ? frame.dt : 0;
    const list = particlesRef.current;

    // The burst: all walkers in a thin band at the centre.
    if (list.length === 0) {
      for (let i = 0; i < COUNT; i++) {
        list.push({
          x: xc + (Math.random() - 0.5) * 6,
          y: y0 + Math.random() * slabH,
        });
      }
    }

    if (dt > 0) {
      tRef.current += dt;
      const sigmaStep = Math.sqrt(2 * D_VIS * dt);
      for (const q of list) {
        q.x += sigmaStep * gauss();
        q.y += sigmaStep * gauss();
        if (q.x < x0) q.x = x0 + (x0 - q.x);
        if (q.x > x1) q.x = x1 - (q.x - x1);
        if (q.y < y0) q.y = y0 + (y0 - q.y);
        if (q.y > y1) q.y = y1 - (q.y - y1);
        q.x = Math.min(x1, Math.max(x0, q.x));
        q.y = Math.min(y1, Math.max(y0, q.y));
      }
    }
    const t = Math.max(tRef.current, 0.02);

    // Column shading from the walkers' own density — the concentration
    // field here is emergent, not painted from a formula.
    const binW = slabW / BINS;
    const counts = new Array<number>(BINS).fill(0);
    for (const q of list) {
      const b = Math.min(BINS - 1, Math.max(0, Math.floor((q.x - x0) / binW)));
      counts[b]++;
    }
    // Fixed reference: the expected peak count one visual second in. Early
    // frames saturate (clamped); later the shading visibly dilutes as the
    // peak falls — that dilution is the 1/sqrt(t) law happening on screen.
    const refPeak = (COUNT * binW) / Math.sqrt(4 * Math.PI * D_VIS * 1);
    for (let b = 0; b < BINS; b++) {
      ctx.fillStyle = rampColor(Math.min(1, counts[b] / refPeak) * 0.9, dark);
      ctx.fillRect(x0 + b * binW, y0, binW + 0.5, slabH);
    }

    // The walkers.
    ctx.fillStyle = dark ? 'rgba(226,232,240,0.75)' : 'rgba(15,23,42,0.55)';
    for (const q of list) {
      ctx.beginPath();
      ctx.arc(q.x, q.y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // The analytic Gaussian for an instantaneous release, same D, same
    // clock. Height in walkers-per-bin, so the curve and the cloud share a
    // vertical scale and the peak visibly decays.
    const heightScale = (slabH * 0.85) / refPeak;
    ctx.strokeStyle = dark ? '#fbbf24' : '#d97706';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const x = x0 + (slabW * i) / 120;
      const expected =
        ((COUNT * binW) / Math.sqrt(4 * Math.PI * D_VIS * t)) *
        Math.exp(-((x - xc) ** 2) / (4 * D_VIS * t));
      const y = Math.max(y0 + 2, y1 - expected * heightScale);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // The release plane.
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = dark ? '#64748b' : '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xc, y0);
    ctx.lineTo(xc, y1);
    ctx.stroke();
    ctx.setLineDash([]);

    // Frame and labels.
    ctx.strokeStyle = dark ? '#475569' : '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0, y0, slabW, slabH);
    ctx.fillStyle = dark ? '#cbd5e1' : '#475569';
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('capsule bursts here at t = 0', xc, y0 - 10);
    ctx.textAlign = 'right';
    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
    ctx.fillText(`t = ${t.toFixed(1)} s (visual clock)`, x1, y1 + 20);

    // Stats.
    emitRef.current += frame.dt;
    if (emitRef.current >= 0.4 && onStats) {
      let sum = 0;
      let sumSq = 0;
      for (const q of list) {
        const d = q.x - xc;
        sum += d;
        sumSq += d * d;
      }
      const mean = sum / list.length;
      const sigmaM = Math.sqrt(Math.max(0, sumSq / list.length - mean * mean));
      const sigmaP = Math.sqrt(2 * D_VIS * t);
      onStats({
        sigmaMeasured: sigmaM,
        sigmaPredicted: sigmaP,
        t,
        touchingWalls: sigmaP > 0.27 * slabW,
      });
      emitRef.current = 0;
    }
  }, { running, redrawKey });

  useWheelZoom(canvasRef, zoomRef, setZoomTick);

  return (
    <canvas
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label="A burst capsule of particles spreading by random walk, compared against the analytic Gaussian"
    />
  );
}
