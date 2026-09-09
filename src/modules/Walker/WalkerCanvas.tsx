import { useEffect, useRef } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { density, spread, stepWalker } from '../../lib/walker';
import { lengthCm, tick, timeS } from '../../lib/format';
import { gauss } from '../FicksLaw/FickCanvas';

/**
 * Time runs left to right; position runs up the page. Three things share
 * the frame, and the module's Segmented control chooses which are drawn:
 *
 *  - ONE walker (the tracer, in sky blue): a single life, a single draw.
 *    This is the Lagrangian view — the only one a person ever gets to live.
 *  - THE CLOUD (faint): many walkers with the same v and D, each on its own
 *    draw. Their heads keep landing inside the amber bell — the Eulerian
 *    concentration field, sliding at v and widening as sqrt(2Dt).
 *  - The analytic envelope (amber, always): mean line vt, ±1 and ±2 spread
 *    bands. The walkers have never seen it; they keep landing on it anyway.
 *
 * Every walker takes the SAME Euler–Maruyama step as the diffusion modules
 * (x += v dt + sqrt(2 D dt) Z); the only difference from the Péclet module is
 * that here we watch the path instead of the pile.
 *
 * One honest trick, as always: the playback clock runs the horizon T in a
 * few seconds regardless of whether T is 20 seconds or 20 years. Speed is
 * cosmetic; the drift-to-spread ratio on screen is real.
 */

const NSTEPS = 480;
const NCLOUD = 90;
/** Seconds of wall-clock to play the whole horizon. */
const PLAY_SECONDS = 7;

export type WalkerFace = 'transport' | 'prices';
export type WalkerView = 'one' | 'cloud' | 'both';

interface Paths {
  key: string;
  dt: number;
  tracer: Float64Array;
  cloud: Float64Array[];
}

function simulate(v: number, D: number, T: number, key: string): Paths {
  const dt = T / NSTEPS;
  const walk = () => {
    const x = new Float64Array(NSTEPS + 1);
    for (let i = 0; i < NSTEPS; i++) x[i + 1] = stepWalker(x[i], v, D, dt, gauss());
    return x;
  };
  const cloud: Float64Array[] = [];
  for (let k = 0; k < NCLOUD; k++) cloud.push(walk());
  return { key, dt, tracer: walk(), cloud };
}

export function WalkerCanvas({
  v,
  D,
  T,
  face,
  view,
  running,
  dark,
  replay,
}: {
  v: number;
  D: number;
  T: number;
  face: WalkerFace;
  view: WalkerView;
  running: boolean;
  dark: boolean;
  /** Bump to reseed every walker and restart the clock. */
  replay: number;
}) {
  const pathsRef = useRef<Paths | null>(null);
  const tauRef = useRef(0);
  const propsRef = useRef({ v, D, T, face, view, dark });
  propsRef.current = { v, D, T, face, view, dark };

  // New physics or an explicit replay: throw the walkers away and restart
  // the clock. Changing the VIEW or the theme must not (the same lives stay
  // on screen, just drawn differently).
  const seedKey = `${v}|${D}|${T}|${replay}`;
  useEffect(() => {
    pathsRef.current = null;
    tauRef.current = 0;
  }, [seedKey]);

  const canvasRef = useCanvas((ctx, frame) => {
    const { width: W, height: H } = frame;
    const { v, D, T, face, view, dark } = propsRef.current;
    if (T <= 0) return;

    let paths = pathsRef.current;
    if (!paths || paths.key !== seedKey) {
      paths = simulate(v, D, T, seedKey);
      pathsRef.current = paths;
      tauRef.current = 0;
    }

    // The playback clock: run to T, then hold.
    if (running && frame.dt > 0) {
      tauRef.current = Math.min(T, tauRef.current + (frame.dt * T) / PLAY_SECONDS);
    }
    const tau = tauRef.current;
    const stepsShown = Math.min(NSTEPS, Math.floor(tau / paths.dt));

    // Layout.
    const pad = { left: 62, right: 78, top: 26, bottom: 34 };
    const x0 = pad.left;
    const x1 = W - pad.right;
    const y0 = pad.top;
    const y1 = H - pad.bottom;
    const plotW = x1 - x0;
    const plotH = y1 - y0;
    if (plotW <= 0 || plotH <= 0) return;

    // Vertical range: symmetric about the start so the mean's slope is
    // legible, wide enough for ±3 spreads and for the drift itself.
    const sT = spread(D, T);
    const R = Math.max(3 * sT, 1.2 * Math.abs(v) * T, 1e-9) * 1.05;
    const x = (t: number) => x0 + (t / T) * plotW;
    const y = (pos: number) => y0 + plotH / 2 - (pos / R) * (plotH / 2);

    const axis = dark ? '#334155' : '#e2e8f0';
    const ink = dark ? '#cbd5e1' : '#475569';
    const faint = dark ? '#64748b' : '#94a3b8';
    const amber = dark ? '#fbbf24' : '#d97706';
    const sky = dark ? '#38bdf8' : '#0284c7';

    // Gridlines and tick labels.
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.strokeStyle = axis;
    ctx.lineWidth = 1;
    const yTicks = face === 'prices' ? priceTicks(R) : linearTicks(R);
    for (const tk of yTicks) {
      const yy = y(tk.value);
      if (yy < y0 || yy > y1) continue;
      ctx.beginPath();
      ctx.moveTo(x0, yy);
      ctx.lineTo(x1, yy);
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.textAlign = 'right';
      ctx.fillText(tk.label, x0 - 8, yy + 4);
    }
    ctx.textAlign = 'center';
    for (let i = 0; i <= 4; i++) {
      const t = (T * i) / 4;
      const xx = x(t);
      ctx.beginPath();
      ctx.moveTo(xx, y1);
      ctx.lineTo(xx, y1 + 4);
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.fillText(face === 'prices' ? yearLabel(t) : timeS(t), xx, y1 + 17);
    }
    // Start line.
    ctx.strokeStyle = faint;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(x0, y(0));
    ctx.lineTo(x1, y(0));
    ctx.stroke();
    ctx.setLineDash([]);

    // Analytic envelope: the Eulerian field's mean and spread, for all t.
    const band = (k: number, alpha: number) => {
      ctx.fillStyle = withAlpha(amber, alpha);
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const t = (T * i) / 80;
        ctx.lineTo(x(t), y(v * t + k * spread(D, t)));
      }
      for (let i = 80; i >= 0; i--) {
        const t = (T * i) / 80;
        ctx.lineTo(x(t), y(v * t - k * spread(D, t)));
      }
      ctx.closePath();
      ctx.fill();
    };
    band(2, dark ? 0.1 : 0.12);
    band(1, dark ? 0.18 : 0.2);
    ctx.strokeStyle = amber;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(x(0), y(0));
    ctx.lineTo(x(T), y(v * T));
    ctx.stroke();
    ctx.setLineDash([]);

    // The cloud: many lives, faintly, up to the current moment.
    if (view !== 'one') {
      ctx.strokeStyle = withAlpha(dark ? '#e2e8f0' : '#0f172a', dark ? 0.16 : 0.13);
      ctx.lineWidth = 1;
      for (const w of paths.cloud) {
        ctx.beginPath();
        ctx.moveTo(x(0), y(w[0]));
        for (let i = 1; i <= stepsShown; i++) ctx.lineTo(x(i * paths.dt), y(w[i]));
        ctx.stroke();
      }
      ctx.fillStyle = withAlpha(dark ? '#e2e8f0' : '#0f172a', 0.55);
      for (const w of paths.cloud) {
        ctx.beginPath();
        ctx.arc(x(stepsShown * paths.dt), y(w[stepsShown]), 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // The bell at the current moment: where the field says the heads
    // should be. Drawn sideways, growing to the right of the clock line.
    if (tau > 0 && D > 0) {
      const sNow = spread(D, tau);
      const peak = density(v * tau, v, D, tau);
      const reach = Math.min(64, plotW * 0.22);
      ctx.fillStyle = withAlpha(amber, 0.28);
      ctx.strokeStyle = amber;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const xc = x(tau);
      for (let i = 0; i <= 60; i++) {
        const pos = v * tau + (-3.5 + 7 * (i / 60)) * sNow;
        const d = density(pos, v, D, tau) / peak;
        ctx.lineTo(xc + d * reach, y(pos));
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // The clock line itself.
      ctx.strokeStyle = faint;
      ctx.beginPath();
      ctx.moveTo(xc, y0);
      ctx.lineTo(xc, y1);
      ctx.stroke();
    }

    // The tracer: one life, in full color.
    if (view !== 'cloud') {
      const w = paths.tracer;
      ctx.strokeStyle = sky;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x(0), y(w[0]));
      for (let i = 1; i <= stepsShown; i++) ctx.lineTo(x(i * paths.dt), y(w[i]));
      ctx.stroke();
      const hx = x(stepsShown * paths.dt);
      const hy = y(w[stepsShown]);
      ctx.fillStyle = dark ? '#0f172a' : '#ffffff';
      ctx.beginPath();
      ctx.arc(hx, hy, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = sky;
      ctx.beginPath();
      ctx.arc(hx, hy, 3.8, 0, Math.PI * 2);
      ctx.fill();
      // Where it stands, in words the face understands.
      ctx.fillStyle = sky;
      ctx.textAlign = 'left';
      ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
      const label =
        face === 'prices'
          ? `×${(Math.exp(w[stepsShown])).toFixed(2)}`
          : `${lengthCm(w[stepsShown])}`;
      ctx.fillText(label, Math.min(hx + 9, x1 + 4), hy + 4);
    }

    // Axis captions.
    ctx.fillStyle = ink;
    ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(face === 'prices' ? 'time →' : 'time →', (x0 + x1) / 2, H - 4);
    ctx.save();
    ctx.translate(14, (y0 + y1) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(face === 'prices' ? 'price, as a multiple of the start' : 'position from the start', 0, 0);
    ctx.restore();

    // Legend, top-left inside the plot.
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left';
    let lx = x0 + 8;
    const ly = y0 + 12;
    const key = (color: string, text: string, dashed = false) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash(dashed ? [5, 3] : []);
      ctx.beginPath();
      ctx.moveTo(lx, ly - 3);
      ctx.lineTo(lx + 16, ly - 3);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ink;
      ctx.fillText(text, lx + 21, ly);
      lx += 21 + ctx.measureText(text).width + 14;
    };
    if (view !== 'cloud') key(sky, 'one walker');
    if (view !== 'one') key(withAlpha(dark ? '#e2e8f0' : '#0f172a', 0.5), 'the cloud');
    key(amber, 'mean · ±1, ±2 spreads (predicted)', true);
  }, { running, redrawKey: `${seedKey}|${view}|${dark}` });

  return (
    <canvas
      role="img"
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[360px]"
      aria-label="One random walker with a drift, drawn as position against time, beside a faint cloud of walkers with the same drift and diffusivity and the analytic mean-and-spread envelope they keep landing inside"
    />
  );
}

// ------------------------------------------------------------------ helpers

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface Tick {
  value: number;
  label: string;
}

/** Round ticks for a symmetric ±R range of lengths, in cm. */
function linearTicks(R: number): Tick[] {
  const raw = R / 2.5;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? 10 * p;
  const out: Tick[] = [];
  for (let k = -Math.floor(R / step); k <= Math.floor(R / step); k++) {
    const val = k * step;
    out.push({ value: val, label: val === 0 ? 'start' : `${tick(val)} cm` });
  }
  return out;
}

/** Ticks at price multiples that are powers of two, for a log-price axis. */
function priceTicks(R: number): Tick[] {
  const out: Tick[] = [{ value: 0, label: '×1' }];
  for (let k = 1; k <= 12; k++) {
    const lnk = Math.log(2) * k;
    if (lnk > R) break;
    out.push({ value: lnk, label: `×${2 ** k}` });
    out.push({ value: -lnk, label: `×${1 / 2 ** k}` });
  }
  // Very narrow ranges (cash-like walkers) need finer marks than octaves.
  if (out.length === 1) {
    const raw = R / 2.5;
    const p = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? 10 * p;
    for (let k = 1; k * step <= R; k++) {
      out.push({ value: k * step, label: `×${Math.exp(k * step).toFixed(2)}` });
      out.push({ value: -k * step, label: `×${Math.exp(-k * step).toFixed(2)}` });
    }
  }
  return out;
}

function yearLabel(t: number): string {
  if (t === 0) return '0';
  if (t < 1) return `${Math.round(t * 12)} mo`;
  return `${Number(t.toPrecision(3))} yr`;
}
