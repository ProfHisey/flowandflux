import { useEffect, useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { applyZoom, gauss, useWheelZoom } from '../FicksLaw/FickCanvas';

/**
 * Two boxes of the same molecules at the same temperature — the only
 * difference is crowding. In the gas a molecule flies many diameters
 * between collisions; in the liquid it never escapes the cage of its
 * neighbours, and diffusion happens one rare cage-hop at a time. Same
 * random-walk mathematics downstream, four decades apart in D.
 *
 * The dynamics are real hard-disc collisions (elastic, equal mass), not a
 * scripted animation — the caging emerges from nothing but crowding. The
 * liquid is a BIDISPERSE mixture (radius ratio 1.4): in 2D a one-size
 * liquid crystallizes into a hexagonal solid at exactly the packings where
 * caging gets interesting, and the mixed sizes keep it honestly amorphous —
 * the standard trick of the glass-transition literature.
 *
 * SIZES and SPEEDS are schematic (a legible on-screen "gas" is still far
 * denser than a real one); the physics cards on the page carry the real
 * numbers, and the page says so.
 */

export interface WanderStats {
  /** Mean free flight of the tagged molecule, in its own diameters. */
  gasFlight: number;
  liqFlight: number;
  /** Collisions per second felt by the tagged molecule (screen time). */
  gasColRate: number;
  liqColRate: number;
  /** Net displacement of the tagged molecule over the last ~10 s, diameters. */
  gasWander: number;
  liqWander: number;
}

interface Mol {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

interface BoxSim {
  parts: Mol[];
  /** box interior, unzoomed px */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** rolling flight bookkeeping for the tagged molecule (index 0) */
  flightAcc: number;
  flights: number[];
  collisions: number;
  elapsed: number;
  trail: { x: number; y: number }[];
  history: { t: number; x: number; y: number }[];
  t: number;
}

const V0 = 90; // base thermal speed, px/s — schematic
const R_GAS = 5;
const R_LIQ = 8; // small species; big species is 1.4x
const TRAIL = 260;

function makeBox(x0: number, y0: number, x1: number, y1: number): BoxSim {
  return {
    parts: [], x0, y0, x1, y1,
    flightAcc: 0, flights: [], collisions: 0, elapsed: 0,
    trail: [], history: [], t: 0,
  };
}

function seedGas(box: BoxSim, n: number) {
  box.parts = [];
  const r = R_GAS;
  for (let i = 0; i < n; i++) {
    let x = 0;
    let y = 0;
    let ok = false;
    for (let tries = 0; tries < 200 && !ok; tries++) {
      x = box.x0 + r + Math.random() * (box.x1 - box.x0 - 2 * r);
      y = box.y0 + r + Math.random() * (box.y1 - box.y0 - 2 * r);
      ok = box.parts.every((q) => (q.x - x) ** 2 + (q.y - y) ** 2 > (2.2 * r) ** 2);
    }
    box.parts.push({ x, y, vx: V0 * gauss() * 0.7, vy: V0 * gauss() * 0.7, r });
  }
}

function seedLiquid(box: BoxSim, phi: number) {
  // Hexagonal lattice at the spacing that gives the requested packing
  // fraction, alternating small/big at random. Any residual big-big overlap
  // at the highest packings is a few percent of a radius; the collision
  // pass relaxes it in the first frames and the thermostat absorbs the kick.
  box.parts = [];
  const r1 = R_LIQ;
  const r2 = 1.4 * R_LIQ;
  const meanArea = (Math.PI * (r1 * r1 + r2 * r2)) / 2;
  const s = Math.sqrt((2 * meanArea) / (phi * Math.sqrt(3)));
  const rowH = (s * Math.sqrt(3)) / 2;
  let row = 0;
  const cells: { x: number; y: number }[] = [];
  for (let y = box.y0 + r2 + 1; y <= box.y1 - r2 - 1; y += rowH, row++) {
    const off = row % 2 === 0 ? 0 : s / 2;
    for (let x = box.x0 + r2 + 1 + off; x <= box.x1 - r2 - 1; x += s) {
      cells.push({ x, y });
    }
  }
  cells.forEach((c, i) => {
    const j = 0.05 * s;
    box.parts.push({
      x: c.x + (Math.random() - 0.5) * j,
      y: c.y + (Math.random() - 0.5) * j,
      vx: V0 * gauss() * 0.7,
      vy: V0 * gauss() * 0.7,
      // The TAGGED molecule (index 0) is a small one — give it its best
      // shot at escaping the cage; even so it barely gets anywhere.
      r: i === 0 || Math.random() < 0.5 ? r1 : r2,
    });
  });
}

/** One physics step: free flight, wall reflection, pairwise elastic
 *  collisions, gentle thermostat. Mutates the box. */
function step(box: BoxSim, dt: number, temp: number) {
  const { parts } = box;
  const nSub = 2;
  const h = dt / nSub;
  for (let sub = 0; sub < nSub; sub++) {
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.x += p.vx * h;
      p.y += p.vy * h;
      if (i === 0) box.flightAcc += Math.hypot(p.vx, p.vy) * h;
      if (p.x < box.x0 + p.r) { p.x = box.x0 + p.r; p.vx = Math.abs(p.vx); }
      if (p.x > box.x1 - p.r) { p.x = box.x1 - p.r; p.vx = -Math.abs(p.vx); }
      if (p.y < box.y0 + p.r) { p.y = box.y0 + p.r; p.vy = Math.abs(p.vy); }
      if (p.y > box.y1 - p.r) { p.y = box.y1 - p.r; p.vy = -Math.abs(p.vy); }
    }
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        const a = parts[i];
        const b = parts[j];
        const rr = a.r + b.r;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        // Separate overlapping discs to contact.
        const push = (rr - d) / 2;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        // Elastic equal-mass exchange of the normal velocity components,
        // only if approaching.
        const dvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (dvn < 0) {
          a.vx += dvn * nx; a.vy += dvn * ny;
          b.vx -= dvn * nx; b.vy -= dvn * ny;
          if (i === 0 || j === 0) {
            box.flights.push(box.flightAcc / (2 * parts[0].r));
            if (box.flights.length > 60) box.flights.shift();
            box.flightAcc = 0;
            box.collisions++;
          }
        }
      }
    }
  }
  // Thermostat: relax the rms speed toward the slider's target so the
  // temperature slider acts live and numerical drift never accumulates.
  const vT = V0 * Math.sqrt(temp);
  let sum = 0;
  for (const p of parts) sum += p.vx * p.vx + p.vy * p.vy;
  const rms = Math.sqrt(sum / Math.max(1, parts.length));
  if (rms > 1e-6) {
    const f = 1 + 0.08 * (vT / rms - 1);
    for (const p of parts) { p.vx *= f; p.vy *= f; }
  }
  box.elapsed += dt;
  box.t += dt;
  // Tagged-molecule bookkeeping for the readouts.
  const tag = parts[0];
  if (tag) {
    box.trail.push({ x: tag.x, y: tag.y });
    if (box.trail.length > TRAIL) box.trail.shift();
    const last = box.history[box.history.length - 1];
    if (!last || box.t - last.t > 0.2) box.history.push({ t: box.t, x: tag.x, y: tag.y });
    while (box.history.length && box.history[0].t < box.t - 10.5) box.history.shift();
  }
}

function meanFlight(box: BoxSim): number {
  if (box.flights.length === 0) return 0;
  return box.flights.reduce((s, f) => s + f, 0) / box.flights.length;
}

function wander(box: BoxSim): number {
  const tag = box.parts[0];
  const old = box.history[0];
  if (!tag || !old || box.t - old.t < 4) return 0;
  return Math.hypot(tag.x - old.x, tag.y - old.y) / (2 * tag.r);
}

export function GasLiquidCanvas({
  nGas,
  phi,
  temp,
  resetTick,
  running,
  dark,
  onStats,
}: {
  nGas: number;
  phi: number;
  temp: number;
  resetTick: number;
  running: boolean;
  dark: boolean;
  onStats?: (s: WanderStats) => void;
}) {
  const gasRef = useRef<BoxSim | null>(null);
  const liqRef = useRef<BoxSim | null>(null);
  const emitRef = useRef(0);
  const liveRef = useRef({ temp });
  liveRef.current = { temp };
  const zoomRef = useRef(1);
  const [zoomTick, setZoomTick] = useState(0);

  const redrawKey = `${nGas}|${phi}|${resetTick}|${dark}|${zoomTick}`;

  useEffect(() => {
    gasRef.current = null;
    liqRef.current = null;
  }, [nGas, phi, resetTick]);

  const canvasRef = useCanvas((ctx, frame) => {
    const { width: W, height: H } = frame;
    applyZoom(ctx, zoomRef.current, W, H);
    const pad = 8;
    const gap = 14;
    const bw = (W - 2 * pad - gap) / 2;
    const y0 = pad + 24;
    const y1 = H - pad - 18;

    if (!gasRef.current) {
      const g = makeBox(pad, y0, pad + bw, y1);
      seedGas(g, nGas);
      gasRef.current = g;
      const l = makeBox(pad + bw + gap, y0, pad + bw + gap + bw, y1);
      seedLiquid(l, phi);
      liqRef.current = l;
    }
    const gas = gasRef.current;
    const liq = liqRef.current!;

    const dt = running ? Math.min(frame.dt, 0.033) : 0;
    if (dt > 0) {
      step(gas, dt, liveRef.current.temp);
      step(liq, dt, liveRef.current.temp);
    }

    // ---- draw
    const border = dark ? '#334155' : '#cbd5e1';
    const labelCol = dark ? '#cbd5e1' : '#475569';
    for (const [box, name] of [[gas, 'GAS — long flights'], [liq, 'LIQUID — caged rattling']] as const) {
      ctx.strokeStyle = border;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
      ctx.fillStyle = labelCol;
      ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(name, (box.x0 + box.x1) / 2, box.y0 - 8);
    }

    // Trails first (under the molecules), fading toward the past.
    for (const box of [gas, liq]) {
      const tr = box.trail;
      for (let i = 1; i < tr.length; i++) {
        const a = (i / tr.length) * 0.75;
        ctx.strokeStyle = `rgba(249,115,22,${a.toFixed(3)})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(tr[i - 1].x, tr[i - 1].y);
        ctx.lineTo(tr[i].x, tr[i].y);
        ctx.stroke();
      }
    }

    for (const [box, fill] of [
      [gas, dark ? 'rgba(34,211,238,0.85)' : 'rgba(8,145,178,0.8)'],
      [liq, dark ? 'rgba(167,139,250,0.8)' : 'rgba(124,58,237,0.65)'],
    ] as const) {
      for (let i = 1; i < box.parts.length; i++) {
        const p = box.parts[i];
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      const tag = box.parts[0];
      if (tag) {
        ctx.fillStyle = 'rgb(249,115,22)';
        ctx.beginPath();
        ctx.arc(tag.x, tag.y, tag.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = dark ? '#fed7aa' : '#7c2d12';
        ctx.lineWidth = 1.25;
        ctx.stroke();
      }
    }

    // Honesty line: the picture is schematic; the cards carry real numbers.
    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('same kind of molecule, same temperature — only the crowding differs', pad + 2, H - pad + 4);
    ctx.textAlign = 'right';
    ctx.fillText('sizes & speeds schematic', W - pad - 2, H - pad + 4);

    emitRef.current += frame.dt;
    if (onStats && emitRef.current >= 0.5 && gas.elapsed > 0.5) {
      onStats({
        gasFlight: meanFlight(gas),
        liqFlight: meanFlight(liq),
        gasColRate: gas.collisions / gas.elapsed,
        liqColRate: liq.collisions / liq.elapsed,
        gasWander: wander(gas),
        liqWander: wander(liq),
      });
      emitRef.current = 0;
    }
  }, { running, redrawKey });

  useWheelZoom(canvasRef, zoomRef, setZoomTick);

  return (
    <canvas
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label="Two boxes of colliding molecules: a dilute gas whose tagged molecule flies long straight paths, and a dense liquid whose tagged molecule rattles in a cage of neighbours"
    />
  );
}
