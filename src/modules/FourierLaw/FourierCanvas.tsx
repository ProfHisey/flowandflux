import { useEffect, useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { temperature, type FourierParams } from '../../lib/fourier';
import { applyZoom, chip2d, gauss, useWheelZoom } from '../FicksLaw/FickCanvas';

/**
 * The physical picture for conduction: the wall, shaded by the steady-state
 * temperature field, with a lattice of molecules jiggling in place on top.
 *
 * The contrast with the Fick canvas is the whole lesson. There, the dots
 * MOVE and the density varies — matter migrates. Here, every molecule is
 * bonded to its lattice site and the density is uniform; only the VIGOUR of
 * the jiggling varies. What travels is energy, handed from neighbour to
 * neighbour in collisions. Same mathematics, physically different carrier.
 *
 * In the slab, that hand-off is simulated honestly: every site holds an
 * energy, and every frame each pair of neighbours exchanges energy in BOTH
 * directions — the amount each side gives is proportional to its own energy,
 * never to the difference. Net conduction emerges as the small imbalance
 * between two enormous one-way flows, exactly as net diffusion emerged from
 * unbiased walkers. The counter at the midplane makes that visible.
 *
 * Cosmetic compromises, stated: jiggle amplitude is normalized to the current
 * temperature range (physically, amplitude scales with sqrt of absolute
 * temperature, so 0 degC vs 100 degC would be a ~16% difference — invisible).
 * The exchange rate is a visual constant, like D_VIS. The energy ledger the
 * counter reports is in lattice units, and is labelled as such.
 */

export interface EnergyStats {
  /** Energy handed left-to-right across the midplane, lattice units/s. */
  right: number;
  /** Energy handed right-to-left, lattice units/s. */
  left: number;
  /** right − left: net conduction. */
  net: number;
  /** What Fourier's law predicts from the energy profile the lattice is
   *  actually carrying. Measured, not assumed. */
  predicted: number;
  /** Seconds of counting behind these figures. */
  elapsed: number;
}

interface Molecule {
  /** Anchor position, px (slab) or (radius px, angle rad) (curved). */
  ax: number;
  ay: number;
  /** Current jiggle offset, px. */
  ox: number;
  oy: number;
}

/** Lattice size for the slab's energy-exchange simulation. */
const NXL = 36;
const NYL = 10;
/** Exchange rate constant, 1/s. Visual, like D_VIS: it sets how lively the
 *  hand-off looks, not any physical conductivity. */
const EX_RATE = 7;

/** Warm ramp for temperature, the counterpart of the indigo/cyan mass ramp.
 *  Low-to-high T, legible on light and dark pages. */
export function rampWarm(u: number, dark: boolean, alpha = 1): string {
  const t = Math.min(1, Math.max(0, u));
  let r: number, g: number, b: number;
  if (dark) {
    // near-black slate -> glowing amber
    r = Math.round(15 + t * 236);
    g = Math.round(23 + t * 123);
    b = Math.round(42 + t * 18);
  } else {
    // near-white -> deep red
    r = Math.round(252 - t * 67);
    g = Math.round(250 - t * 222);
    b = Math.round(248 - t * 220);
  }
  return alpha < 1 ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
}

export function FourierCanvas({
  params,
  showMolecules,
  running,
  dark,
  onStats,
}: {
  params: FourierParams;
  showMolecules: boolean;
  running: boolean;
  dark: boolean;
  onStats?: (s: EnergyStats) => void;
}) {
  const energyRef = useRef<Float64Array | null>(null);
  const moleculesRef = useRef<Molecule[]>([]);
  const rightRef = useRef(0);
  const leftRef = useRef(0);
  const predictedRef = useRef(0);
  const elapsedRef = useRef(0);
  const emitRef = useRef(0);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const zoomRef = useRef(1);
  const [zoomTick, setZoomTick] = useState(0);

  const redrawKey = `${params.geometry}|${params.k}|${params.T1}|${params.T2}|${params.L}|${params.A}|${params.r1}|${params.r2}|${dark}|${showMolecules}|${zoomTick}`;

  useEffect(() => {
    energyRef.current = null;
    moleculesRef.current = [];
    rightRef.current = 0;
    leftRef.current = 0;
    predictedRef.current = 0;
    elapsedRef.current = 0;
    emitRef.current = 0;
  }, [params.geometry, params.T1, params.T2, params.L, params.A, params.r1, params.r2]);

  const canvasRef = useCanvas((ctx, frame) => {
    const p = paramsRef.current;
    const { width: W, height: H } = frame;
    applyZoom(ctx, zoomRef.current, W, H);
    const pad = 8;

    const tLo = Math.min(p.T1, p.T2);
    const tHi = Math.max(p.T1, p.T2);
    const span = tHi - tLo || 1;
    const norm = (s: number) => (temperature(p, s) - tLo) / span;

    if (p.geometry === 'slab') {
      drawSlab(
        ctx, W, H, pad, p, norm, dark, showMolecules, running, frame.dt,
        energyRef, moleculesRef, rightRef, leftRef, predictedRef,
      );

      if (running && showMolecules) elapsedRef.current += frame.dt;
      emitRef.current += frame.dt;
      if (emitRef.current >= 0.4 && onStats && elapsedRef.current > 0) {
        const T = elapsedRef.current;
        onStats({
          right: rightRef.current / T,
          left: leftRef.current / T,
          net: (rightRef.current - leftRef.current) / T,
          predicted: predictedRef.current / T,
          elapsed: T,
        });
        emitRef.current = 0;
      }
    } else {
      drawCurved(ctx, W, H, pad, p, norm, dark, showMolecules, running, frame.dt, moleculesRef);
    }
  }, { running: running && showMolecules, redrawKey });

  useWheelZoom(canvasRef, zoomRef, setZoomTick);

  return (
    <canvas
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label={`Temperature field in a ${params.geometry}, with molecules vibrating in place`}
    />
  );
}

// ---------------------------------------------------------------- slab

function drawSlab(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  pad: number,
  p: FourierParams,
  norm: (s: number) => number,
  dark: boolean,
  showMolecules: boolean,
  running: boolean,
  dt: number,
  energyRef: React.RefObject<Float64Array | null>,
  moleculesRef: React.RefObject<Molecule[]>,
  rightRef: React.RefObject<number>,
  leftRef: React.RefObject<number>,
  predictedRef: React.RefObject<number>,
) {
  // Thicker walls draw wider, bigger faces draw taller (log-mapped) — the
  // same slider-responsiveness rule as the Fick canvas.
  const x0f = pad + 56;
  const x1f = W - pad - 56;
  const y0 = pad + 26;
  const y1f = H - pad - 30;
  const tL = Math.min(1, Math.max(0, (Math.log10(p.L) + 3) / 3)); // 1e-3..1 m
  const tA = Math.min(1, Math.max(0, (Math.log10(p.A) + 2) / 3)); // 0.01..10 m^2
  const cxS = (x0f + x1f) / 2;
  const halfW = ((x1f - x0f) / 2) * (0.35 + 0.65 * tL);
  const x0 = cxS - halfW;
  const x1 = cxS + halfW;
  const y1 = y0 + (y1f - y0) * (0.55 + 0.45 * tA);
  const slabW = x1 - x0;
  const slabH = y1 - y0;
  if (slabW <= 0 || slabH <= 0) return;

  // Shaded temperature field.
  for (let px = 0; px < slabW; px++) {
    const s = (px / slabW) * p.L;
    ctx.fillStyle = rampWarm(norm(s), dark);
    ctx.fillRect(x0 + px, y0, 1.5, slabH);
  }

  // Reservoir cheeks: the two boundary baths, hatched.
  ctx.fillStyle = rampWarm(norm(0), dark);
  ctx.fillRect(pad, y0, x0 - pad, slabH);
  ctx.fillStyle = rampWarm(norm(p.L), dark);
  ctx.fillRect(x1, y0, W - pad - x1, slabH);
  hatch(ctx, pad, y0, x0 - pad, slabH, dark);
  hatch(ctx, x1, y0, W - pad - x1, slabH, dark);

  if (showMolecules) {
    stepLattice(p, running ? dt : 0, energyRef, rightRef, leftRef, predictedRef);
    drawLatticeMolecules(
      ctx, x0, y0, slabW, slabH, energyRef.current!, running ? dt : 0, dark, moleculesRef, p,
    );
  }

  // Boundary lines and midplane.
  ctx.strokeStyle = dark ? '#475569' : '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, y0 - 6);
  ctx.lineTo(x0, y1 + 6);
  ctx.moveTo(x1, y0 - 6);
  ctx.lineTo(x1, y1 + 6);
  ctx.stroke();

  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = dark ? '#64748b' : '#94a3b8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo((x0 + x1) / 2, y0);
  ctx.lineTo((x0 + x1) / 2, y1);
  ctx.stroke();
  ctx.setLineDash([]);

  // Heat-flow arrow, warm-coloured, pointing the way the energy goes.
  const dir = p.T1 >= p.T2 ? 1 : -1;
  const ay = y1 + 16;
  const ax0 = (x0 + x1) / 2 - dir * 34;
  const ax1 = (x0 + x1) / 2 + dir * 34;
  ctx.strokeStyle = dark ? '#fb923c' : '#dc2626';
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ax0, ay);
  ctx.lineTo(ax1, ay);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ax1, ay);
  ctx.lineTo(ax1 - dir * 7, ay - 4);
  ctx.lineTo(ax1 - dir * 7, ay + 4);
  ctx.closePath();
  ctx.fill();

  const label = dark ? '#cbd5e1' : '#475569';
  ctx.fillStyle = label;
  ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`T₁ = ${fmtT(p.T1)} °C`, (pad + x0) / 2, y0 - 10);
  ctx.fillText(`T₂ = ${fmtT(p.T2)} °C`, (x1 + W - pad) / 2, y0 - 10);
  ctx.fillText('x = 0', x0, y1 + 26);
  ctx.fillText('x = L', x1, y1 + 26);
}

/**
 * The energy-exchange lattice. Each site holds an energy (seeded as absolute
 * temperature, in kelvin, so every site has plenty to give). Every frame,
 * each pair of neighbours exchanges energy in both directions; each side's
 * contribution is proportional to its OWN energy, with multiplicative noise.
 * Nothing consults the gradient — net flow emerges because hot sites give
 * more than they get back.
 */
function stepLattice(
  p: FourierParams,
  dt: number,
  energyRef: React.RefObject<Float64Array | null>,
  rightRef: React.RefObject<number>,
  leftRef: React.RefObject<number>,
  predictedRef: React.RefObject<number>,
) {
  const K = 273.15;
  const Ehot = p.T1 + K;
  const Ecold = p.T2 + K;

  let E = energyRef.current;
  if (!E) {
    // Cold start on the steady profile, same policy as the walkers: this
    // module is about the steady state, not the approach to it.
    E = new Float64Array(NXL * NYL);
    for (let i = 0; i < NXL; i++) {
      const T = p.T1 + ((p.T2 - p.T1) * i) / (NXL - 1);
      for (let r = 0; r < NYL; r++) E[r * NXL + i] = T + K;
    }
    energyRef.current = E;
  }
  if (dt <= 0) return;

  const eps = Math.min(0.12, EX_RATE * dt);
  const dE = new Float64Array(NXL * NYL);
  const mid = NXL / 2; // count across the bond between columns mid-1 and mid

  for (let r = 0; r < NYL; r++) {
    for (let i = 0; i < NXL; i++) {
      const idx = r * NXL + i;
      // Horizontal bond to the right neighbour.
      if (i < NXL - 1) {
        const give = eps * E[idx] * (0.5 + Math.random());
        const take = eps * E[idx + 1] * (0.5 + Math.random());
        dE[idx] += take - give;
        dE[idx + 1] += give - take;
        if (i === mid - 1) {
          rightRef.current! += give;
          leftRef.current! += take;
        }
      }
      // Vertical bond to the neighbour below (visual mixing).
      if (r < NYL - 1) {
        const give = eps * E[idx] * (0.5 + Math.random());
        const take = eps * E[idx + NXL] * (0.5 + Math.random());
        dE[idx] += take - give;
        dE[idx + NXL] += give - take;
      }
    }
  }
  for (let i = 0; i < E.length; i++) E[i] += dE[i];

  // Dirichlet columns: the baths re-thermalize the edges every frame.
  for (let r = 0; r < NYL; r++) {
    E[r * NXL] = Ehot;
    E[r * NXL + NXL - 1] = Ecold;
  }

  // Close the loop: least-squares slope of column-mean energy over the
  // interior, fed through the same exchange rule. Two measurements of one
  // quantity, like the Fick counter's "predicts" figure.
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  const lo = 2;
  const hi = NXL - 2;
  const m = hi - lo;
  for (let i = lo; i < hi; i++) {
    let col = 0;
    for (let r = 0; r < NYL; r++) col += E[r * NXL + i];
    const y = col / NYL;
    sx += i; sy += y; sxx += i * i; sxy += i * y;
  }
  const denom = m * sxx - sx * sx;
  if (Math.abs(denom) > 1e-9) {
    const slope = (m * sxy - sx * sy) / denom; // energy units per column
    predictedRef.current! += -eps * slope * NYL;
  }
}

function drawLatticeMolecules(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  slabW: number,
  slabH: number,
  E: Float64Array,
  dt: number,
  dark: boolean,
  moleculesRef: React.RefObject<Molecule[]>,
  p: FourierParams,
) {
  let list = moleculesRef.current;
  if (list.length === 0) {
    list = [];
    for (let r = 0; r < NYL; r++) {
      for (let i = 0; i < NXL; i++) {
        list.push({
          ax: x0 + ((i + 0.5) / NXL) * slabW,
          ay: y0 + ((r + 0.5) / NYL) * slabH,
          ox: 0,
          oy: 0,
        });
      }
    }
    moleculesRef.current = list;
  }

  // Jiggle amplitude, normalized to the CURRENT temperature range — a
  // labelled exaggeration, since the honest sqrt(T_abs) ratio would be
  // invisible. The energy field decides who jiggles hardest.
  const tLo = Math.min(p.T1, p.T2) + 273.15;
  const tHi = Math.max(p.T1, p.T2) + 273.15;
  const span = tHi - tLo || 1;

  ctx.fillStyle = dark ? 'rgba(226,232,240,0.8)' : 'rgba(15,23,42,0.6)';
  for (let n = 0; n < list.length; n++) {
    const q = list[n];
    const u = Math.min(1, Math.max(0, (E[n] - tLo) / span));
    const amp = 0.7 + 4.6 * u;
    if (dt > 0) {
      q.ox = 0.55 * q.ox + 0.45 * amp * gauss() * 0.8;
      q.oy = 0.55 * q.oy + 0.45 * amp * gauss() * 0.8;
    }
    ctx.beginPath();
    ctx.arc(q.ax + q.ox, q.ay + q.oy, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ------------------------------------------------------- cylinder / sphere

function drawCurved(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  pad: number,
  p: FourierParams,
  norm: (s: number) => number,
  dark: boolean,
  showMolecules: boolean,
  running: boolean,
  dt: number,
  moleculesRef: React.RefObject<Molecule[]>,
) {
  const cx = W / 2;
  const cy = H / 2;
  const maxR = Math.min(W, H) / 2 - pad - 22;
  if (maxR <= 4) return;

  const rIn = maxR * (p.r1 / p.r2);
  const rOut = maxR;
  const toPhys = (px: number) => (px / maxR) * p.r2;

  for (let r = rOut; r >= rIn; r -= 1) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = rampWarm(norm(toPhys(r)), dark);
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  // Inner cavity: a bath held at T1, hatched like every other reservoir.
  ctx.beginPath();
  ctx.arc(cx, cy, rIn, 0, Math.PI * 2);
  ctx.fillStyle = rampWarm(norm(p.r1), dark);
  ctx.fill();
  ctx.save();
  ctx.clip();
  hatch(ctx, cx - rIn, cy - rIn, rIn * 2, rIn * 2, dark);
  ctx.restore();

  if (showMolecules) {
    let list = moleculesRef.current;
    if (list.length === 0) {
      list = [];
      for (let n = 0; n < 380; n++) {
        list.push({
          ax: Math.sqrt(rIn * rIn + Math.random() * (rOut * rOut - rIn * rIn)),
          ay: Math.random() * Math.PI * 2,
          ox: 0,
          oy: 0,
        });
      }
      moleculesRef.current = list;
    }
    ctx.fillStyle = dark ? 'rgba(226,232,240,0.8)' : 'rgba(15,23,42,0.6)';
    for (const q of list) {
      const amp = 0.7 + 4.6 * Math.min(1, Math.max(0, norm(toPhys(q.ax))));
      if (running && dt > 0) {
        q.ox = 0.55 * q.ox + 0.45 * amp * gauss() * 0.8;
        q.oy = 0.55 * q.oy + 0.45 * amp * gauss() * 0.8;
      }
      ctx.beginPath();
      ctx.arc(
        cx + q.ax * Math.cos(q.ay) + q.ox,
        cy + q.ax * Math.sin(q.ay) + q.oy,
        1.6, 0, Math.PI * 2,
      );
      ctx.fill();
    }
  }

  ctx.strokeStyle = dark ? '#475569' : '#cbd5e1';
  ctx.lineWidth = 1.5;
  for (const r of [rIn, rOut]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  const dir = p.T1 >= p.T2 ? 1 : -1;
  ctx.strokeStyle = dark ? '#fb923c' : '#dc2626';
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 2;
  const a0 = dir > 0 ? rIn + 6 : rOut - 6;
  const a1 = dir > 0 ? rOut - 6 : rIn + 6;
  ctx.beginPath();
  ctx.moveTo(cx + a0, cy);
  ctx.lineTo(cx + a1, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + a1, cy);
  ctx.lineTo(cx + a1 - dir * 7, cy - 4);
  ctx.lineTo(cx + a1 - dir * 7, cy + 4);
  ctx.closePath();
  ctx.fill();

  // Labels embedded where the boundaries actually are, matching the mass
  // module: T₁ inside its cavity, T₂ tied to the outer rim by a tick.
  chip2d(ctx, cx, cy, `T₁ = ${fmtT(p.T1)} °C · r₁ inner`, dark);
  ctx.strokeStyle = dark ? '#64748b' : '#94a3b8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy + rOut);
  ctx.lineTo(cx, cy + rOut + 7);
  ctx.stroke();
  chip2d(ctx, cx, cy + rOut + 15, `T₂ = ${fmtT(p.T2)} °C · r₂ outer`, dark);
}

// ---------------------------------------------------------------- shared

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

function fmtT(T: number): string {
  return String(Number(T.toPrecision(4)));
}
