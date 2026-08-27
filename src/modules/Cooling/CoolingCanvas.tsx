import { useEffect, useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { rampWarm } from '../FourierLaw/FourierCanvas';
import { applyZoom, useWheelZoom } from '../FicksLaw/FickCanvas';

/**
 * The mechanism behind h: flow keeps REPLACING the fluid at the surface.
 *
 * A lumped object (one temperature everywhere — that is the assumption)
 * sits in a stream. Tracer particles sweep past; the ones that brush the
 * thin film around the object pick up its warmth and carry it off
 * downstream as a visible wake. As the object cools, the wake fades: the
 * exponential decay is watchable as a plume that starves.
 *
 * Cosmetic values, stated: the on-screen time constant is ~14 s regardless
 * of the physical tau (a mug takes 35 real minutes — the readouts carry the
 * true numbers). The film thickness drawn around the object shrinks with
 * the h slider as a cue, but its pixel size is illustrative, not to scale.
 */

interface Tracer {
  x: number;
  y: number;
  /** Warmth being carried, 0..1 — set when the tracer brushes the film. */
  carry: number;
}

const COUNT = 240;
const FLOW = 70; // px/s
/** Visual time constant, s: fast enough to watch, and labelled as such. */
const TAU_VIS = 14;

export function CoolingCanvas({
  h,
  lc,
  heating,
  resetTick,
  running,
  dark,
}: {
  /** Physical h, W/m^2 K — only used to size the drawn film (labelled cue). */
  h: number;
  /** Characteristic length V/A, m — sizes the drawn object (log-mapped). */
  lc: number;
  /** True when Tinf > T0 (a thermometer warming up): the wake runs cold. */
  heating: boolean;
  resetTick: number;
  running: boolean;
  dark: boolean;
}) {
  const tracersRef = useRef<Tracer[]>([]);
  const tRef = useRef(0);
  const zoomRef = useRef(1);
  const [zoomTick, setZoomTick] = useState(0);

  const redrawKey = `${dark}|${resetTick}|${h}|${heating}|${lc}|${zoomTick}`;

  useEffect(() => {
    tracersRef.current = [];
    tRef.current = 0;
  }, [resetTick]);

  const canvasRef = useCanvas((ctx, frame) => {
    const { width: W, height: H } = frame;
    applyZoom(ctx, zoomRef.current, W, H);
    const pad = 8;
    const x0 = pad;
    const x1 = W - pad;
    const y0 = pad + 24;
    const y1 = H - pad - 24;
    const boxH = y1 - y0;
    if (x1 - x0 <= 0 || boxH <= 0) return;

    const cx = x0 + (x1 - x0) * 0.32;
    const cyy = (y0 + y1) / 2;
    // Object size tracks V/A (log-mapped): a thermometer bulb draws small,
    // a roast draws big.
    const tLc = Math.min(1, Math.max(0, (Math.log10(Math.max(1e-6, lc)) + 4) / 3.5));
    const R = Math.max(11, Math.min(boxH * 0.34, boxH * (0.1 + 0.24 * tLc)));
    // Film thickness: a cue tied to h — bigger h, thinner film. Cosmetic.
    const film = Math.max(5, Math.min(24, 26 - 5 * Math.log10(Math.max(1, h))));

    const dt = running ? frame.dt : 0;
    tRef.current += dt;
    // Fraction of the initial excess still left, on the visual clock.
    const theta = Math.exp(-tRef.current / TAU_VIS);

    const list = tracersRef.current;
    if (list.length === 0) {
      for (let i = 0; i < COUNT; i++) {
        list.push({
          x: x0 + Math.random() * (x1 - x0),
          y: y0 + Math.random() * boxH,
          carry: 0,
        });
      }
    }

    // Advect tracers on the classic flow-around-a-cylinder field (uniform
    // stream + doublet), slowed inside a thin film hugging the surface —
    // the boundary layer, drawn the way it actually behaves: streamlines
    // bend smoothly around the body, creep through the film, and release
    // downstream carrying the object's warmth as a wake.
    for (const q of list) {
      if (dt > 0) {
        const dx = q.x - cx;
        const dy = q.y - cyy;
        const r2 = dx * dx + dy * dy;
        const r = Math.sqrt(r2);
        if (r < R + 1) {
          // Never inside the solid: project back onto the surface.
          q.x = cx + (dx / (r || 1)) * (R + 1.5);
          q.y = cyy + (dy / (r || 1)) * (R + 1.5);
        }
        const R2 = R * R;
        // Potential flow around a cylinder: no penetration, smooth wrap.
        let ux = FLOW * (1 - (R2 * (dx * dx - dy * dy)) / (r2 * r2));
        let uy = FLOW * (-(R2 * 2 * dx * dy) / (r2 * r2));
        // Viscous film: speed dies toward the wall (no-slip, in spirit).
        const gap = Math.max(0, r - R);
        const slow = gap > film * 2 ? 1 : Math.max(0.07, 1 - Math.exp(-(gap / film) * 1.4));
        ux *= slow;
        uy *= slow;
        q.x += ux * dt;
        q.y += uy * dt + (Math.random() - 0.5) * 3 * dt;
        // Brushing the film transfers the object's CURRENT warmth.
        if (gap < film) {
          q.carry = Math.max(q.carry, theta * (1 - gap / film));
        }
        if (q.x > x1) {
          q.x = x0;
          q.y = y0 + Math.random() * boxH;
          q.carry = 0;
        }
        if (q.y < y0) q.y = y0 + (y0 - q.y);
        if (q.y > y1) q.y = y1 - (q.y - y1);
      }
    }

    // Ambient fluid wash.
    ctx.fillStyle = dark ? 'rgba(30,41,59,0.5)' : 'rgba(241,245,249,0.7)';
    ctx.fillRect(x0, y0, x1 - x0, boxH);

    // Tracers: neutral when carrying nothing; warm (or cold-blue, when the
    // object is the one warming up) in proportion to their cargo.
    for (const q of list) {
      if (q.carry > 0.02) {
        ctx.fillStyle = heating
          ? `rgba(56,189,248,${(0.15 + 0.75 * q.carry).toFixed(2)})`
          : dark
            ? `rgba(251,146,60,${(0.15 + 0.8 * q.carry).toFixed(2)})`
            : `rgba(220,38,38,${(0.12 + 0.7 * q.carry).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(q.x, q.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = dark ? 'rgba(148,163,184,0.45)' : 'rgba(100,116,139,0.4)';
        ctx.beginPath();
        ctx.arc(q.x, q.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // The film h lives in.
    ctx.strokeStyle = dark ? 'rgba(251,191,36,0.5)' : 'rgba(217,119,6,0.45)';
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cyy, R + film, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // The object: ONE colour throughout — that uniformity IS the lumped
    // assumption, drawn.
    const u = heating ? 1 - theta : theta;
    ctx.beginPath();
    ctx.arc(cx, cyy, R, 0, Math.PI * 2);
    ctx.fillStyle = rampWarm(0.08 + 0.92 * u, dark);
    ctx.fill();
    ctx.strokeStyle = dark ? '#64748b' : '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Labels.
    ctx.fillStyle = dark ? '#cbd5e1' : '#475569';
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('flow →   fluid at T∞', x0 + 4, y0 - 8);
    ctx.textAlign = 'center';
    ctx.fillText(
      `one temperature everywhere (lumped) — ${Math.round((heating ? 1 - theta : theta) * 100)}% of the gap left`,
      cx, y1 + 16,
    );
    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
    ctx.textAlign = 'right';
    ctx.fillText(`visual clock: τ ≈ ${TAU_VIS} s on screen — real τ in the readouts`, x1 - 2, y0 - 8);

    // Film label with a leader tick.
    ctx.strokeStyle = dark ? 'rgba(251,191,36,0.6)' : 'rgba(217,119,6,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + (R + film) * 0.7071, cyy - (R + film) * 0.7071);
    ctx.lineTo(cx + (R + film) * 0.7071 + 14, cyy - (R + film) * 0.7071 - 10);
    ctx.stroke();
    ctx.fillStyle = dark ? '#fbbf24' : '#b45309';
    ctx.textAlign = 'left';
    ctx.fillText('the film h lives in', cx + (R + film) * 0.7071 + 17, cyy - (R + film) * 0.7071 - 7);
  }, { running, redrawKey });

  useWheelZoom(canvasRef, zoomRef, setZoomTick);

  return (
    <canvas
      role="img"
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label="A lumped object cooling in a stream: tracers brush the surface film and carry its heat downstream as a fading wake"
    />
  );
}
