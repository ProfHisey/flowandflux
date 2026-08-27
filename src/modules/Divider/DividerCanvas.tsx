import { useEffect, useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { applyZoom, D_VIS, gauss, useWheelZoom } from '../FicksLaw/FickCanvas';

/**
 * The mixing box, mass edition — deliberately in the spirit of PhET's
 * diffusion sim: two populations, a divider, and one irreversible button.
 * Zero equations. Set up an imbalance, pull the divider, watch what nature
 * does with it. This is the first thing a student sees on the site, so it
 * must need no instructions at all.
 *
 * Both species take identical unbiased steps (same D). Nothing in the code
 * knows which side is "crowded" — the spreading is pure statistics, which
 * is the entire point the later modules will build on.
 */

export interface MixStats {
  cyanLeft: number;
  cyanRight: number;
  orangeLeft: number;
  orangeRight: number;
}

interface Particle {
  x: number;
  y: number;
  /** 0 = cyan, 1 = orange */
  sp: 0 | 1;
}

export function DividerCanvas({
  nLeft,
  nRight,
  dCyan,
  dOrange,
  temp,
  dividerIn,
  resetTick,
  running,
  dark,
  onStats,
}: {
  /** Cyan particles, seeded on the left. */
  nLeft: number;
  /** Orange particles, seeded on the right. */
  nRight: number;
  /** Relative diffusion coefficient of each species (1 = baseline). A
   *  species' D is its own character; changing it changes only that color. */
  dCyan: number;
  dOrange: number;
  /** Relative temperature (1 = baseline): speeds up EVERY wanderer. */
  temp: number;
  dividerIn: boolean;
  resetTick: number;
  running: boolean;
  dark: boolean;
  onStats?: (s: MixStats) => void;
}) {
  const particlesRef = useRef<Particle[]>([]);
  const emitRef = useRef(0);
  const dividerRef = useRef(dividerIn);
  dividerRef.current = dividerIn;
  const scaleRef = useRef({ dCyan, dOrange, temp });
  scaleRef.current = { dCyan, dOrange, temp };
  const zoomRef = useRef(1);
  const [zoomTick, setZoomTick] = useState(0);

  const redrawKey = `${nLeft}|${nRight}|${dividerIn}|${resetTick}|${dark}|${zoomTick}`;

  useEffect(() => {
    particlesRef.current = [];
  }, [nLeft, nRight, resetTick]);

  const canvasRef = useCanvas((ctx, frame) => {
    const { width: W, height: H } = frame;
    applyZoom(ctx, zoomRef.current, W, H);
    const pad = 8;
    const x0 = pad + 10;
    const x1 = W - pad - 10;
    const y0 = pad + 14;
    const y1 = H - pad - 14;
    const boxW = x1 - x0;
    const boxH = y1 - y0;
    if (boxW <= 0 || boxH <= 0) return;
    const xc = (x0 + x1) / 2;

    const list = particlesRef.current;
    if (list.length === 0) {
      for (let i = 0; i < nLeft; i++) {
        list.push({
          x: x0 + 3 + Math.random() * (xc - x0 - 6),
          y: y0 + 3 + Math.random() * (boxH - 6),
          sp: 0,
        });
      }
      for (let i = 0; i < nRight; i++) {
        list.push({
          x: xc + 3 + Math.random() * (x1 - xc - 6),
          y: y0 + 3 + Math.random() * (boxH - 6),
          sp: 1,
        });
      }
    }

    const dt = running ? frame.dt : 0;
    const sc = scaleRef.current;
    const sigmaCyan = Math.sqrt(2 * D_VIS * sc.dCyan * sc.temp * dt);
    const sigmaOrange = Math.sqrt(2 * D_VIS * sc.dOrange * sc.temp * dt);
    const blocked = dividerRef.current;

    for (const q of list) {
      if (dt > 0) {
        const sigma = q.sp === 0 ? sigmaCyan : sigmaOrange;
        const xPrev = q.x;
        q.x += sigma * gauss();
        q.y += sigma * gauss();
        // The divider is a wall while it is in: reflect crossers back.
        if (blocked && xPrev < xc !== q.x < xc) q.x = 2 * xc - q.x;
        if (q.x < x0) q.x = x0 + (x0 - q.x);
        if (q.x > x1) q.x = x1 - (q.x - x1);
        if (q.y < y0) q.y = y0 + (y0 - q.y);
        if (q.y > y1) q.y = y1 - (q.y - y1);
        q.x = Math.min(x1, Math.max(x0, q.x));
        q.y = Math.min(y1, Math.max(y0, q.y));
      }
    }

    // Particles, PhET-sized: big enough to follow individually.
    const cyan = dark ? '#22d3ee' : '#0891b2';
    const orange = dark ? '#fb923c' : '#ea580c';
    for (const q of list) {
      ctx.fillStyle = q.sp === 0 ? cyan : orange;
      ctx.beginPath();
      ctx.arc(q.x, q.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // The divider: a solid wall while in, a ghost once removed.
    if (blocked) {
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(xc, y0);
      ctx.lineTo(xc, y1);
      ctx.stroke();
    } else {
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = dark ? 'rgba(148,163,184,0.4)' : 'rgba(148,163,184,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xc, y0);
      ctx.lineTo(xc, y1);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Box.
    ctx.strokeStyle = dark ? '#475569' : '#94a3b8';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, boxW, boxH);

    emitRef.current += frame.dt;
    if (emitRef.current >= 0.4 && onStats) {
      const s: MixStats = { cyanLeft: 0, cyanRight: 0, orangeLeft: 0, orangeRight: 0 };
      for (const q of list) {
        if (q.sp === 0) {
          if (q.x < xc) s.cyanLeft++;
          else s.cyanRight++;
        } else if (q.x < xc) s.orangeLeft++;
        else s.orangeRight++;
      }
      onStats(s);
      emitRef.current = 0;
    }
  }, { running, redrawKey });

  useWheelZoom(canvasRef, zoomRef, setZoomTick);

  return (
    <canvas
      role="img"
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label="A box of two particle species separated by a removable divider"
    />
  );
}
