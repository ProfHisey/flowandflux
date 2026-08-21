import { useEffect, useRef } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { concentration, molPerCm3TomM, type FickParams } from '../../lib/fick';

/**
 * The physical picture: the transporting region, shaded by the steady-state
 * concentration field, with an optional cloud of random walkers moving on top
 * of it.
 *
 * The walkers matter pedagogically. Every one of them takes UNBIASED steps —
 * there is no term in the update that knows which way is "downhill". The net
 * transport you can watch at the midplane emerges purely because there are
 * more particles on the high-concentration side to wander across. That is the
 * statistical content of Fick's law (Lecture 3), and it is the one thing a
 * static slide cannot show.
 */

export interface CrossingStats {
  /** Walkers crossing the midplane left-to-right, per second. */
  right: number;
  /** Walkers crossing right-to-left, per second. */
  left: number;
  /** right − left. The quantity Fick's law is actually about. */
  net: number;
  /** What j = −D ∂C/∂x gives when fed the particle density gradient these
   *  same walkers are carrying. Measured, not assumed. */
  predicted: number;
  /** Seconds of counting behind these figures. The net is a small difference
   *  of two large numbers, so it only sharpens with time. */
  elapsed: number;
}

interface Particle {
  /** Slab: x in px. Curved: radius in px. */
  a: number;
  /** Slab: y in px. Curved: angle in radians. */
  b: number;
  /** Previous `a`, for midplane crossing detection. */
  aPrev: number;
}

const BINS = 28;
/** Visual diffusivity in px^2/s. Decoupled from the physical D on purpose:
 *  D spans ten decades in this course, and we want the animation legible at
 *  every one of them. The *shape* of the profile is physical; the *speed* of
 *  the animation is not, and the UI says so. */
const D_VIS = 2500;
const PARTICLE_BUDGET = 1400;

function gauss(): number {
  // Box-Muller, one of the two normals discarded.
  let u = 0;
  while (u === 0) u = Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Perceptually reasonable low-to-high concentration ramp, legible on both
 *  a light and a dark page. */
function rampColor(u: number, dark: boolean): string {
  const t = Math.min(1, Math.max(0, u));
  if (dark) {
    // near-black slate -> saturated cyan
    const r = Math.round(15 + t * 22);
    const g = Math.round(23 + t * 175);
    const b = Math.round(42 + t * 175);
    return `rgb(${r},${g},${b})`;
  }
  // near-white -> deep indigo
  const r = Math.round(248 - t * 199);
  const g = Math.round(250 - t * 172);
  const b = Math.round(252 - t * 76);
  return `rgb(${r},${g},${b})`;
}

export function FickCanvas({
  params,
  showParticles,
  running,
  dark,
  onStats,
}: {
  params: FickParams;
  showParticles: boolean;
  running: boolean;
  dark: boolean;
  onStats?: (s: CrossingStats) => void;
}) {
  const particlesRef = useRef<Particle[]>([]);
  const rightRef = useRef(0);
  const leftRef = useRef(0);
  const elapsedRef = useRef(0);
  const emitRef = useRef(0);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  // Anything that changes the picture but not the motion.
  const redrawKey = `${params.geometry}|${params.D}|${params.C1}|${params.C2}|${params.L}|${params.A}|${params.r1}|${params.r2}|${dark}|${showParticles}`;

  // Reseed whenever anything that defines the steady-state profile changes.
  // Geometry matters because the coordinate meaning of a particle's (a, b) is
  // different in each one; the boundary values and dimensions matter because
  // the walkers should land on the new steady state immediately rather than
  // spend minutes relaxing onto it.
  useEffect(() => {
    particlesRef.current = [];
    rightRef.current = 0;
    leftRef.current = 0;
    elapsedRef.current = 0;
    emitRef.current = 0;
  }, [params.geometry, params.C1, params.C2, params.L, params.r1, params.r2]);

  const canvasRef = useCanvas((ctx, frame) => {
    const p = paramsRef.current;
    const { width: W, height: H } = frame;
    const pad = 8;

    const cLo = Math.min(p.C1, p.C2);
    const cHi = Math.max(p.C1, p.C2);
    const span = cHi - cLo || 1;
    /** Normalized concentration at position s, for coloring. */
    const norm = (s: number) => (concentration(p, s) - cLo) / span;

    if (p.geometry === 'slab') {
      const geom = drawSlab(
        ctx, W, H, pad, p, norm, dark, showParticles, running, frame.dt,
        particlesRef, rightRef, leftRef,
      );

      // Close the loop. Two independent measurements of the same thing:
      // what the walkers did (counted at the midplane) and what Fick's law
      // says they should do (from the density gradient they are carrying).
      // Counts are cumulative, because the net is a small difference between
      // two large one-way traffic figures and only sharpens with time.
      if (running && showParticles) elapsedRef.current += frame.dt;
      emitRef.current += frame.dt;

      if (emitRef.current >= 0.4 && onStats && geom && elapsedRef.current > 0) {
        const T = elapsedRef.current;
        const slope = densitySlope(geom.counts, geom.binW, geom.slabH);
        // j = -D dρ/dx in walkers per px per second; times the slab height
        // gives crossings per second through the midplane line.
        onStats({
          right: rightRef.current / T,
          left: leftRef.current / T,
          net: (rightRef.current - leftRef.current) / T,
          predicted: -D_VIS * slope * geom.slabH,
          elapsed: T,
        });
        emitRef.current = 0;
      }
    } else {
      drawCurved(ctx, W, H, pad, p, norm, dark, showParticles, running, frame.dt, particlesRef);
    }
  }, { running: running && showParticles, redrawKey });

  return (
    <canvas
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label={`Concentration field in a ${params.geometry}, with diffusing particles`}
    />
  );
}

// ---------------------------------------------------------------- slab

function drawSlab(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  pad: number,
  p: FickParams,
  norm: (s: number) => number,
  dark: boolean,
  showParticles: boolean,
  running: boolean,
  dt: number,
  particlesRef: React.RefObject<Particle[]>,
  rightRef: React.RefObject<number>,
  leftRef: React.RefObject<number>,
): SlabGeom | null {
  const x0 = pad + 56;
  const x1 = W - pad - 56;
  const y0 = pad + 26;
  const y1 = H - pad - 30;
  const slabW = x1 - x0;
  const slabH = y1 - y0;
  if (slabW <= 0 || slabH <= 0) return null;

  // Shaded concentration field, one strip per pixel column.
  for (let px = 0; px < slabW; px++) {
    const s = (px / slabW) * p.L;
    ctx.fillStyle = rampColor(norm(s), dark);
    ctx.fillRect(x0 + px, y0, 1.5, slabH);
  }

  // Reservoir cheeks either side, at the two boundary concentrations.
  ctx.fillStyle = rampColor(norm(0), dark);
  ctx.fillRect(pad, y0, 56 - pad, slabH);
  ctx.fillStyle = rampColor(norm(p.L), dark);
  ctx.fillRect(x1, y0, 56 - pad, slabH);
  // Hatch the baths so they read as reservoirs rather than as more wall,
  // without lying about their concentration by washing the colour out.
  hatch(ctx, pad, y0, 56 - pad, slabH, dark);
  hatch(ctx, x1, y0, 56 - pad, slabH, dark);

  let counts: number[] | null = null;
  if (showParticles) {
    counts = stepSlabParticles(
      p, x0, x1, y0, y1, norm, running ? dt : 0, particlesRef, rightRef, leftRef,
    );
    drawParticles(ctx, particlesRef.current!, dark, (q) => [q.a, q.b]);
  }

  // Boundary rules and the midplane.
  const stroke = dark ? '#475569' : '#cbd5e1';
  ctx.strokeStyle = stroke;
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

  // Flux arrow, pointing the way the species actually goes.
  const dir = p.C1 >= p.C2 ? 1 : -1;
  const ay = y1 + 16;
  const ax0 = (x0 + x1) / 2 - dir * 34;
  const ax1 = (x0 + x1) / 2 + dir * 34;
  ctx.strokeStyle = dark ? '#38bdf8' : '#0284c7';
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

  // Labels.
  const label = dark ? '#cbd5e1' : '#475569';
  ctx.fillStyle = label;
  ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`C₁ = ${fmtmM(p.C1)} mM`, (pad + x0) / 2, y0 - 10);
  ctx.fillText(`C₂ = ${fmtmM(p.C2)} mM`, (x1 + W - pad) / 2, y0 - 10);
  ctx.fillText('x = 0', x0, y1 + 26);
  ctx.fillText(`x = L`, x1, y1 + 26);

  return counts ? { counts, binW: slabW / BINS, slabH } : null;
}

function stepSlabParticles(
  p: FickParams,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  norm: (s: number) => number,
  dt: number,
  particlesRef: React.RefObject<Particle[]>,
  rightRef: React.RefObject<number>,
  leftRef: React.RefObject<number>,
): number[] {
  const list = particlesRef.current!;
  const slabW = x1 - x0;
  const binW = slabW / BINS;
  const mid = (x0 + x1) / 2;

  const sigma = Math.sqrt(2 * D_VIS * dt);

  // Unbiased walk. Nothing here consults the gradient.
  for (let i = list.length - 1; i >= 0; i--) {
    const q = list[i];
    q.aPrev = q.a;
    if (dt > 0) {
      q.a += sigma * gauss();
      q.b += sigma * gauss();
      if (q.b < y0) q.b = y0 + (y0 - q.b);
      if (q.b > y1) q.b = y1 - (q.b - y1);
    }
    // Tally both directions separately. Keeping them apart is the point:
    // the two-way traffic is enormous and the net is what diffusion delivers.
    if (q.aPrev < mid && q.a >= mid) rightRef.current! += 1;
    else if (q.aPrev >= mid && q.a < mid) leftRef.current! += 1;

    if (q.a < x0) q.a = x0 + (x0 - q.a);
    if (q.a > x1) q.a = x1 - (q.a - x1);
  }

  const counts = new Array<number>(BINS).fill(0);
  for (const q of list) {
    const bin = Math.min(BINS - 1, Math.max(0, Math.floor((q.a - x0) / binW)));
    counts[bin]++;
  }

  const perBin = PARTICLE_BUDGET / BINS;
  const targetFor = (bin: number) => {
    const s = ((bin + 0.5) / BINS) * p.L;
    return Math.round(perBin * norm(s) * 2);
  };

  // Cold start: lay the walkers down on the steady-state profile directly.
  // Filling from the reservoirs instead would be more "honest" as a transient,
  // but the relaxation time across the full canvas is minutes, and this module
  // is about the steady state, not the approach to it. Unsteady diffusion gets
  // its own module.
  if (list.length === 0) {
    for (let bin = 0; bin < BINS; bin++) {
      const want = targetFor(bin);
      for (let k = 0; k < want; k++) {
        const a = x0 + binW * (bin + Math.random());
        list.push({ a, b: y0 + Math.random() * (y1 - y0), aPrev: a });
      }
      counts[bin] = want;
    }
    return counts;
  }

  // Thereafter, resample the two bath bins to their Dirichlet populations and
  // leave the interior strictly alone. The profile between the baths is
  // maintained by the walking itself, not by us — which is the only reason
  // the flux measurement below means anything.
  const edges = new Set([0, BINS - 1]);
  for (let i = list.length - 1; i >= 0; i--) {
    const bin = Math.min(BINS - 1, Math.max(0, Math.floor((list[i].a - x0) / binW)));
    if (edges.has(bin)) list.splice(i, 1);
  }
  for (const bin of edges) {
    const want = targetFor(bin);
    for (let k = 0; k < want; k++) {
      const a = x0 + binW * (bin + Math.random());
      list.push({ a, b: y0 + Math.random() * (y1 - y0), aPrev: a });
    }
    counts[bin] = want;
  }

  return counts;
}

interface SlabGeom {
  counts: number[];
  binW: number;
  slabH: number;
}

/**
 * Least-squares slope of particle number density against x, in
 * particles / px^3, taken over the interior bins only. The two edge bins are
 * excluded because they are pinned by the boundary condition rather than
 * free to relax, so including them would be measuring our own input.
 */
function densitySlope(counts: number[], binW: number, slabH: number): number {
  const n = counts.length;
  const lo = 2;
  const hi = n - 2;
  const m = hi - lo;
  if (m < 4) return 0;

  const cellVolume = binW * slabH;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = lo; i < hi; i++) {
    const x = (i + 0.5) * binW;
    const y = counts[i] / cellVolume;
    sx += x; sy += y; sxx += x * x; sxy += x * y;
  }
  const denom = m * sxx - sx * sx;
  if (Math.abs(denom) < 1e-9) return 0;
  return (m * sxy - sx * sy) / denom;
}

// ------------------------------------------------------- cylinder / sphere

function drawCurved(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  pad: number,
  p: FickParams,
  norm: (s: number) => number,
  dark: boolean,
  showParticles: boolean,
  running: boolean,
  dt: number,
  particlesRef: React.RefObject<Particle[]>,
) {
  const cx = W / 2;
  const cy = H / 2;
  const maxR = Math.min(W, H) / 2 - pad - 22;
  if (maxR <= 4) return;

  const rIn = maxR * (p.r1 / p.r2);
  const rOut = maxR;
  const toPhys = (px: number) => (px / maxR) * p.r2;

  // Shade the annulus ring by ring.
  for (let r = rOut; r >= rIn; r -= 1) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = rampColor(norm(toPhys(r)), dark);
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  // The inner cavity is a well-mixed bath held at C₁. Hatch it rather than
  // washing it out — a white veil made the *strongest* concentration in the
  // picture read as the weakest.
  ctx.beginPath();
  ctx.arc(cx, cy, rIn, 0, Math.PI * 2);
  ctx.fillStyle = rampColor(norm(p.r1), dark);
  ctx.fill();
  ctx.save();
  ctx.clip();
  hatch(ctx, cx - rIn, cy - rIn, rIn * 2, rIn * 2, dark);
  ctx.restore();

  if (showParticles) {
    stepCurvedParticles(rIn, rOut, toPhys, norm, running ? dt : 0, particlesRef);
    drawParticles(ctx, particlesRef.current!, dark, (q) => [
      cx + q.a * Math.cos(q.b),
      cy + q.a * Math.sin(q.b),
    ]);
  }

  // Boundary circles.
  ctx.strokeStyle = dark ? '#475569' : '#cbd5e1';
  ctx.lineWidth = 1.5;
  for (const r of [rIn, rOut]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Radial flux arrow.
  const dir = p.C1 >= p.C2 ? 1 : -1;
  ctx.strokeStyle = dark ? '#38bdf8' : '#0284c7';
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

  const label = dark ? '#cbd5e1' : '#475569';
  ctx.fillStyle = label;
  ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`C₁ = ${fmtmM(p.C1)} mM  at r₁`, cx, cy - rOut - 10);
  ctx.fillText(`C₂ = ${fmtmM(p.C2)} mM  at r₂`, cx, cy + rOut + 18);
}

function stepCurvedParticles(
  rIn: number,
  rOut: number,
  toPhys: (px: number) => number,
  norm: (s: number) => number,
  dt: number,
  particlesRef: React.RefObject<Particle[]>,
) {
  const list = particlesRef.current!;
  const sigma = Math.sqrt(2 * D_VIS * dt);

  for (let i = list.length - 1; i >= 0; i--) {
    const q = list[i];
    q.aPrev = q.a;
    if (dt > 0) {
      q.a += sigma * gauss();
      // Equal arc-length step in the tangential direction.
      q.b += (sigma * gauss()) / Math.max(q.a, 1);
    }
    if (q.a < rIn || q.a > rOut) list.splice(i, 1);
  }

  // Same Dirichlet trick, but on the innermost and outermost shells. Targets
  // are weighted by shell area so the *density* matches, not the count.
  const shell = (rOut - rIn) / BINS;
  const budget = PARTICLE_BUDGET;
  const totalArea = Math.PI * (rOut * rOut - rIn * rIn);
  const wantIn = (i: number) => {
    const rA = rIn + shell * i;
    const rB = rA + shell;
    const area = Math.PI * (rB * rB - rA * rA);
    return Math.round(((budget * area) / totalArea) * norm(toPhys((rA + rB) / 2)) * 2);
  };

  if (list.length === 0) {
    for (let i = 0; i < BINS; i++) {
      const rA = rIn + shell * i;
      const rB = rA + shell;
      for (let k = 0; k < wantIn(i); k++) {
        list.push({
          a: Math.sqrt(rA * rA + Math.random() * (rB * rB - rA * rA)),
          b: Math.random() * Math.PI * 2,
          aPrev: rA,
        });
      }
    }
    return;
  }

  for (const edge of [0, BINS - 1]) {
    const rA = rIn + shell * edge;
    const rB = rA + shell;
    const want = wantIn(edge);
    let have = 0;
    for (const q of list) if (q.a >= rA && q.a < rB) have++;
    while (have < want) {
      const a = Math.sqrt(rA * rA + Math.random() * (rB * rB - rA * rA));
      list.push({ a, b: Math.random() * Math.PI * 2, aPrev: a });
      have++;
    }
    if (have > want) {
      for (let i = list.length - 1; i >= 0 && have > want; i--) {
        if (list[i].a >= rA && list[i].a < rB) {
          list.splice(i, 1);
          have--;
        }
      }
    }
  }
}

// ---------------------------------------------------------------- shared

function drawParticles(
  ctx: CanvasRenderingContext2D,
  list: Particle[],
  dark: boolean,
  project: (q: Particle) => [number, number],
) {
  ctx.fillStyle = dark ? 'rgba(226,232,240,0.75)' : 'rgba(15,23,42,0.55)';
  for (const q of list) {
    const [px, py] = project(q);
    ctx.beginPath();
    ctx.arc(px, py, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Diagonal hatching, used to mark the well-mixed reservoirs. */
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

function fmtmM(molPerCm3: number): string {
  const v = molPerCm3TomM(molPerCm3);
  return String(Number(v.toPrecision(3)));
}
