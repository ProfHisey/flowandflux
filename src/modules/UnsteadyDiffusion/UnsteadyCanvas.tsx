import { useEffect, useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { applyZoom, D_VIS, gauss, rampColor, useWheelZoom } from '../FicksLaw/FickCanvas';

/**
 * The capsule burst. At t = 0 every walker sits at the release site; press
 * play and the cloud spreads. Nothing else happens — and that is the
 * module: concentration changing in time, before any talk of steady state.
 *
 * Two release geometries share the canvas:
 *   - 'plane': a thin band across the middle, columns shaded by walker
 *     density, against the 1D Gaussian (amber curve);
 *   - 'point': everything starts at the centre and spreads radially,
 *     against the rms-radius prediction (amber ring). The screen has two
 *     axes, so the ring grows as sqrt(4Dt) and the caption says so — a
 *     real 3D burst adds the third axis: sqrt(6Dt), which the 3D tab and
 *     the readouts carry.
 *
 * The walls reflect; the analytic overlay assumes an open medium. They
 * agree until the cloud feels the walls — and the caption owns up the
 * moment that happens rather than hiding it.
 */

export type ReleaseMode = 'plane' | 'point';

export interface PulseStats {
  /** Plane: sample std dev of walker x. Point: rms distance from centre. Px. */
  sigmaMeasured: number;
  /** Plane: sqrt(2 D_VIS t). Point: sqrt(4 D_VIS t). Px. */
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
  mode,
  releaseTick,
  running,
  dark,
  onStats,
}: {
  mode: ReleaseMode;
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

  const redrawKey = `${mode}|${dark}|${releaseTick}|${zoomTick}`;

  useEffect(() => {
    particlesRef.current = [];
    tRef.current = 0;
    emitRef.current = 0;
  }, [releaseTick, mode]);

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
    const yc = (y0 + y1) / 2;

    const dt = running ? frame.dt : 0;
    const list = particlesRef.current;

    // The burst: a thin band (plane) or a pinpoint (point) at the centre.
    if (list.length === 0) {
      for (let i = 0; i < COUNT; i++) {
        list.push(
          mode === 'plane'
            ? { x: xc + (Math.random() - 0.5) * 6, y: y0 + Math.random() * slabH }
            : { x: xc + (Math.random() - 0.5) * 6, y: yc + (Math.random() - 0.5) * 6 },
        );
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

    if (mode === 'plane') {
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
    }

    // The walkers.
    ctx.fillStyle = dark ? 'rgba(226,232,240,0.75)' : 'rgba(15,23,42,0.55)';
    for (const q of list) {
      ctx.beginPath();
      ctx.arc(q.x, q.y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    const amber = dark ? '#fbbf24' : '#d97706';
    if (mode === 'plane') {
      // The analytic Gaussian for an instantaneous release, same D, same
      // clock. Height in walkers-per-bin, so the curve and the cloud share a
      // vertical scale and the peak visibly decays.
      const binW = slabW / BINS;
      const refPeak = (COUNT * binW) / Math.sqrt(4 * Math.PI * D_VIS * 1);
      const heightScale = (slabH * 0.85) / refPeak;
      ctx.strokeStyle = amber;
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
    } else {
      // Radial prediction: rms radius now, ghosts at t/2 and t/4. On a
      // two-axis screen the rms radius is sqrt(4Dt); the caption owns that.
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0, slabW, slabH);
      ctx.clip();
      for (const [tt, alpha] of [[t / 4, 0.3], [t / 2, 0.5], [t, 1]] as const) {
        const rr = Math.sqrt(4 * D_VIS * tt);
        ctx.strokeStyle = amber;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = tt === t ? 2 : 1.25;
        ctx.beginPath();
        ctx.arc(xc, yc, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      // The release point.
      ctx.strokeStyle = dark ? '#64748b' : '#94a3b8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xc - 6, yc);
      ctx.lineTo(xc + 6, yc);
      ctx.moveTo(xc, yc - 6);
      ctx.lineTo(xc, yc + 6);
      ctx.stroke();
    }

    // Frame and labels.
    ctx.strokeStyle = dark ? '#475569' : '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0, y0, slabW, slabH);
    ctx.fillStyle = dark ? '#cbd5e1' : '#475569';
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      mode === 'plane' ? 'capsule bursts here at t = 0' : 'depot releases here at t = 0',
      xc,
      y0 - 10,
    );
    ctx.textAlign = 'right';
    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
    ctx.fillText(`t = ${t.toFixed(1)} s (visual clock)`, x1, y1 + 20);
    if (mode === 'point') {
      ctx.textAlign = 'left';
      ctx.fillText('amber ring: rms radius √(4Dt) — two axes on screen; 3D adds one more', x0, y1 + 20);
    }

    // Stats.
    emitRef.current += frame.dt;
    if (emitRef.current >= 0.4 && onStats) {
      let sigmaM = 0;
      let sigmaP = 0;
      if (mode === 'plane') {
        let sum = 0;
        let sumSq = 0;
        for (const q of list) {
          const d = q.x - xc;
          sum += d;
          sumSq += d * d;
        }
        const mean = sum / list.length;
        sigmaM = Math.sqrt(Math.max(0, sumSq / list.length - mean * mean));
        sigmaP = Math.sqrt(2 * D_VIS * t);
      } else {
        let sumR2 = 0;
        for (const q of list) sumR2 += (q.x - xc) ** 2 + (q.y - yc) ** 2;
        sigmaM = Math.sqrt(sumR2 / list.length);
        sigmaP = Math.sqrt(4 * D_VIS * t);
      }
      onStats({
        sigmaMeasured: sigmaM,
        sigmaPredicted: sigmaP,
        t,
        touchingWalls:
          mode === 'plane' ? sigmaP > 0.27 * slabW : sigmaP > 0.42 * Math.min(slabW, slabH),
      });
      emitRef.current = 0;
    }
  }, { running, redrawKey });

  useWheelZoom(canvasRef, zoomRef, setZoomTick);

  return (
    <canvas
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label={
        mode === 'plane'
          ? 'A burst capsule of particles spreading by random walk, compared against the analytic Gaussian'
          : 'A point burst of particles spreading radially by random walk, compared against the predicted rms radius'
      }
    />
  );
}
