import { useEffect, useRef } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { gauss } from '../FicksLaw/FickCanvas';
import {
  FAINT,
  makePainter,
  useOrbitCam,
  useOrbitControls,
  wireBox,
  type OrbitCam,
  type Vec3,
} from '../shared/paint3d';

/**
 * The same two boxes in 3D: real hard-SPHERE dynamics this time, same
 * elastic collisions, same emergent caging. Bidisperse liquid here too
 * (ratio 1.3) so it stays amorphous instead of crystallizing. The tagged
 * molecule's trail is the star — a 3D flight path in the gas, a knot in
 * the liquid.
 */

interface Mol3 {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  r: number;
}

interface BoxSim3 {
  parts: Mol3[];
  cx: number; // box centre x
  h: number;  // half-size
  trail: Vec3[];
}

const V0 = 55; // schematic thermal speed in model units/s

function seedGas3(box: BoxSim3, n: number, r: number) {
  box.parts = [];
  const { cx, h } = box;
  for (let i = 0; i < n; i++) {
    box.parts.push({
      x: cx - h + r + Math.random() * 2 * (h - r),
      y: -h + r + Math.random() * 2 * (h - r),
      z: -h + r + Math.random() * 2 * (h - r),
      vx: V0 * gauss() * 0.6, vy: V0 * gauss() * 0.6, vz: V0 * gauss() * 0.6,
      r,
    });
  }
}

function seedLiquid3(box: BoxSim3, phi: number, r1: number) {
  // Simple cubic at the spacing for the requested packing, alternating two
  // sizes at random; small residual overlaps relax in the first frames.
  box.parts = [];
  const { cx, h } = box;
  const r2 = 1.3 * r1;
  const meanVol = ((4 / 3) * Math.PI * (r1 ** 3 + r2 ** 3)) / 2;
  const s = Math.cbrt(meanVol / phi);
  for (let x = cx - h + r2; x <= cx + h - r2 && box.parts.length < 240; x += s) {
    for (let y = -h + r2; y <= h - r2 && box.parts.length < 240; y += s) {
      for (let z = -h + r2; z <= h - r2 && box.parts.length < 240; z += s) {
        const j = 0.1 * s;
        const first = box.parts.length === 0;
        box.parts.push({
          x: x + (Math.random() - 0.5) * j,
          y: y + (Math.random() - 0.5) * j,
          z: z + (Math.random() - 0.5) * j,
          vx: V0 * gauss() * 0.6, vy: V0 * gauss() * 0.6, vz: V0 * gauss() * 0.6,
          // Tagged molecule (index 0) is a small one, as in 2D.
          r: first || Math.random() < 0.5 ? r1 : r2,
        });
      }
    }
  }
}

function step3(box: BoxSim3, dt: number, temp: number) {
  const { parts, cx, h } = box;
  const nSub = 2;
  const hh = dt / nSub;
  for (let sub = 0; sub < nSub; sub++) {
    for (const p of parts) {
      p.x += p.vx * hh; p.y += p.vy * hh; p.z += p.vz * hh;
      if (p.x < cx - h + p.r) { p.x = cx - h + p.r; p.vx = Math.abs(p.vx); }
      if (p.x > cx + h - p.r) { p.x = cx + h - p.r; p.vx = -Math.abs(p.vx); }
      if (p.y < -h + p.r) { p.y = -h + p.r; p.vy = Math.abs(p.vy); }
      if (p.y > h - p.r) { p.y = h - p.r; p.vy = -Math.abs(p.vy); }
      if (p.z < -h + p.r) { p.z = -h + p.r; p.vz = Math.abs(p.vz); }
      if (p.z > h - p.r) { p.z = h - p.r; p.vz = -Math.abs(p.vz); }
    }
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        const a = parts[i];
        const b = parts[j];
        const rr = a.r + b.r;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= rr * rr || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        const nz = dz / d;
        const push = (rr - d) / 2;
        a.x -= nx * push; a.y -= ny * push; a.z -= nz * push;
        b.x += nx * push; b.y += ny * push; b.z += nz * push;
        const dvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny + (b.vz - a.vz) * nz;
        if (dvn < 0) {
          a.vx += dvn * nx; a.vy += dvn * ny; a.vz += dvn * nz;
          b.vx -= dvn * nx; b.vy -= dvn * ny; b.vz -= dvn * nz;
        }
      }
    }
  }
  const vT = V0 * Math.sqrt(temp);
  let sum = 0;
  for (const p of parts) sum += p.vx ** 2 + p.vy ** 2 + p.vz ** 2;
  const rms = Math.sqrt(sum / Math.max(1, parts.length));
  if (rms > 1e-6) {
    const f = 1 + 0.08 * (vT / rms - 1);
    for (const p of parts) { p.vx *= f; p.vy *= f; p.vz *= f; }
  }
  const tag = parts[0];
  if (tag) {
    box.trail.push([tag.x, tag.y, tag.z]);
    if (box.trail.length > 150) box.trail.shift();
  }
}

export function GasLiquid3DCanvas({
  nGas,
  phi,
  temp,
  resetTick,
  running,
  dark,
  cam: camProp,
}: {
  nGas: number;
  phi: number;
  temp: number;
  resetTick: number;
  running: boolean;
  dark: boolean;
  /** Optional shared camera for the seamless 2D-to-3D handoff. */
  cam?: OrbitCam;
}) {
  const gasRef = useRef<BoxSim3 | null>(null);
  const liqRef = useRef<BoxSim3 | null>(null);
  const liveRef = useRef({ temp });
  liveRef.current = { temp };
  const internalCam = useOrbitCam(0.55, -0.32);
  const cam = camProp ?? internalCam;

  const redrawKey = `${nGas}|${phi}|${resetTick}|${dark}|${cam.camTick}`;

  useEffect(() => {
    gasRef.current = null;
    liqRef.current = null;
  }, [nGas, phi, resetTick]);

  const canvasRef = useCanvas((ctx, frame) => {
    const { width: W, height: H } = frame;
    const pt = makePainter(ctx, W, H, cam.yawRef.current, cam.pitchRef.current, cam.zoomRef.current);
    const fit = Math.min(W, H) / 2 - 26;
    const faint = FAINT(dark);
    const u = fit / 0.96;
    const h = 0.42 * u; // half-size of each box
    const cxGas = -0.52 * u;
    const cxLiq = 0.52 * u;

    if (!gasRef.current) {
      const g: BoxSim3 = { parts: [], cx: cxGas, h, trail: [] };
      // Scale the 2D slider's crowding into the 3D box (same feel).
      seedGas3(g, Math.round(nGas * 0.8), 0.045 * u);
      gasRef.current = g;
      const l: BoxSim3 = { parts: [], cx: cxLiq, h, trail: [] };
      // The 2D packing slider maps to a comparable 3D crowding: 3D freezes
      // near phi = 0.49, 2D near 0.70, so scale by ~0.68.
      seedLiquid3(l, Math.min(0.53, phi * 0.68), 0.07 * u);
      liqRef.current = l;
    }
    const gas = gasRef.current;
    const liq = liqRef.current!;

    const dt = running ? Math.min(frame.dt, 0.033) : 0;
    if (dt > 0) {
      step3(gas, dt, liveRef.current.temp);
      step3(liq, dt, liveRef.current.temp);
    }

    for (const [box, rgb] of [
      [gas, dark ? '34,211,238' : '8,145,178'],
      [liq, dark ? '167,139,250' : '124,58,237'],
    ] as const) {
      wireBox(pt, box.cx - box.h, -box.h, -box.h, box.cx + box.h, box.h, box.h, faint);
      for (let i = 1; i < box.parts.length; i++) {
        const p = box.parts[i];
        pt.dot([p.x, p.y, p.z], fit, rgb, p.r / 2.2, 0.9);
      }
      for (let i = 1; i < box.trail.length; i++) {
        const a = (i / box.trail.length) * 0.8;
        pt.seg(box.trail[i - 1], box.trail[i], `rgba(249,115,22,${a.toFixed(3)})`, 1.3);
      }
      const tag = box.parts[0];
      if (tag) pt.dot([tag.x, tag.y, tag.z], fit, '249,115,22', tag.r / 1.9, 1.3);
    }
    pt.flush();

    pt.chip([cxGas, h + 14, 0], 'gas — long flights', dark);
    pt.chip([cxLiq, h + 14, 0], 'liquid — caged', dark);
    pt.hint(dark, 'same temperature in both boxes — only the crowding differs');
  }, { running, redrawKey });

  useOrbitControls(canvasRef, cam, running);

  return (
    <canvas
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label="Two 3D boxes of colliding molecules: a dilute gas with long straight flight paths and a dense liquid whose tagged molecule stays knotted in place"
    />
  );
}
