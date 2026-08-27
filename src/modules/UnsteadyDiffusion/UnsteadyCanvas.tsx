import { useEffect, useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { applyZoom, D_VIS, gauss, rampColor, useWheelZoom } from '../FicksLaw/FickCanvas';
import { rampWarm } from '../FourierLaw/FourierCanvas';

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
export type BolusCargo = 'mass' | 'heat';

export interface PulseStats {
  /** Plane: sample std dev of walker x. Point: rms distance from centre. Px.
   *  Heat cargo: the same, but ENERGY-weighted over the anchored lattice. */
  sigmaMeasured: number;
  /** Plane: sqrt(2 D t). Point: sqrt(4 D t). Px, on the relevant visual D. */
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

// ---- heat cargo: the anchored energy-exchange lattice --------------------
// For heat the matter is ALREADY everywhere and never moves — only the
// energy travels, exactly as in the Fourier and Divider heat views. Same
// exchange rule (each bond hands energy both ways, proportional to the
// giver's own energy); the pulse is a spike of energy dropped on the
// centre sites at t = 0. Nothing consults a gradient; the spreading
// Gaussian emerges. Effective visual diffusivity: D_lat = EXH * cell^2.
interface LatticeMol {
  ax: number;
  ay: number;
  ox: number;
  oy: number;
}
// Exchange rate, 1/s — visual, like D_VIS. D_lat = EXH·cell² ≈ 750 px²/s at
// the default cell size, about 2.5x the mass walkers' D_VIS = 300. The pulse
// then takes ~30 s to feel the walls in plane mode on a desktop-width canvas,
// and ~4 s in point mode, where the height is the tight dimension.
const EXH = 1.5;
const E0 = 1; // baseline site energy ("room temperature")
const SPIKE = 9; // excess energy per spiked site at t = 0

export function UnsteadyCanvas({
  mode,
  cargo = 'mass',
  releaseTick,
  running,
  dark,
  onStats,
}: {
  mode: ReleaseMode;
  /** Mass (walkers are molecules) or heat (walkers are energy packets —
   *  same random walk, different cargo and colour family). */
  cargo?: BolusCargo;
  /** Increment to re-burst the capsule. */
  releaseTick: number;
  running: boolean;
  dark: boolean;
  onStats?: (s: PulseStats) => void;
}) {
  const particlesRef = useRef<Particle[]>([]);
  const latERef = useRef<Float64Array | null>(null);
  const latMolsRef = useRef<LatticeMol[]>([]);
  const latDimsRef = useRef({ nx: 0, ny: 0, cell: 0, x0: 0, y0: 0 });
  const tRef = useRef(0);
  const emitRef = useRef(0);
  const zoomRef = useRef(1);
  const [zoomTick, setZoomTick] = useState(0);

  const redrawKey = `${mode}|${cargo}|${dark}|${releaseTick}|${zoomTick}`;

  useEffect(() => {
    particlesRef.current = [];
    latERef.current = null;
    latMolsRef.current = [];
    tRef.current = 0;
    emitRef.current = 0;
  }, [releaseTick, mode, cargo]);

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

    // ---------------------------------------------------- heat cargo
    // Anchored lattice, energy spike, neighbour exchange — the matter is
    // already there and never moves. See the constants block up top.
    if (cargo === 'heat') {
      const dtH = running ? Math.min(frame.dt, 0.05) : 0;
      let dims = latDimsRef.current;
      let E = latERef.current;
      // Reseed only on a REAL layout change. dims.x0 is the (centred) grid
      // origin, NOT the canvas x0 — compare against the recomputed origin,
      // or the check fires every frame and the pulse restarts forever (the
      // frozen-peak bug of Aug 2026).
      const wantNy = 12;
      const wantCell = slabH / wantNy;
      const wantNx = Math.max(8, Math.floor(slabW / wantCell));
      const wantX0 = x0 + (slabW - wantNx * wantCell) / 2;
      if (
        !E ||
        dims.nx !== wantNx ||
        Math.abs(dims.x0 - wantX0) > 2 ||
        Math.abs(dims.cell - wantCell) > 1
      ) {
        const ny = wantNy;
        const cell = wantCell;
        const nx = wantNx;
        dims = { nx, ny, cell, x0: wantX0, y0 };
        latDimsRef.current = dims;
        E = new Float64Array(nx * ny);
        E.fill(E0);
        if (mode === 'plane') {
          const ic = Math.floor(nx / 2);
          for (let r = 0; r < ny; r++) E[r * nx + ic] = E0 + SPIKE;
        } else {
          const ic = Math.floor(nx / 2);
          const rc = Math.floor(ny / 2);
          E[rc * nx + ic] = E0 + SPIKE * 3;
          for (const [di, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            E[(rc + dr) * nx + (ic + di)] = E0 + SPIKE;
          }
        }
        latERef.current = E;
        latMolsRef.current = [];
      }
      const { nx, ny, cell } = dims;
      const gx0 = dims.x0;
      const DLAT = EXH * cell * cell;

      if (dtH > 0) {
        tRef.current += dtH;
        const total = Math.min(0.5, EXH * dtH);
        const nSub = Math.max(1, Math.ceil(total / 0.1));
        const eps = total / nSub;
        for (let sub = 0; sub < nSub; sub++) {
          const dE = new Float64Array(nx * ny);
          for (let r = 0; r < ny; r++) {
            for (let i = 0; i < nx; i++) {
              const idx = r * nx + i;
              if (i < nx - 1) {
                const give = eps * E[idx] * (0.5 + Math.random());
                const take = eps * E[idx + 1] * (0.5 + Math.random());
                dE[idx] += take - give;
                dE[idx + 1] += give - take;
              }
              if (r < ny - 1) {
                const give = eps * E[idx] * (0.5 + Math.random());
                const take = eps * E[idx + nx] * (0.5 + Math.random());
                dE[idx] += take - give;
                dE[idx + nx] += give - take;
              }
            }
          }
          for (let i = 0; i < E.length; i++) E[i] += dE[i];
        }
      }
      const t = Math.max(tRef.current, 0.02);

      // Anchored molecules + bonds, coloured by their own excess energy.
      let mols = latMolsRef.current;
      if (mols.length === 0) {
        mols = [];
        for (let r = 0; r < ny; r++) {
          for (let i = 0; i < nx; i++) {
            mols.push({
              ax: gx0 + (i + 0.5) * cell,
              ay: y0 + (r + 0.5) * cell,
              ox: 0,
              oy: 0,
            });
          }
        }
        latMolsRef.current = mols;
      }
      const uRef = SPIKE * 0.25; // fixed reference: early frames saturate,
      const uOf = (n: number) => Math.min(1, Math.max(0, (E[n] - E0) / uRef));
      for (let n = 0; n < mols.length; n++) {
        const q = mols[n];
        const amp = 0.6 + 4.4 * uOf(n);
        if (dtH > 0) {
          q.ox = 0.55 * q.ox + 0.45 * amp * gauss() * 0.8;
          q.oy = 0.55 * q.oy + 0.45 * amp * gauss() * 0.8;
        }
      }
      ctx.strokeStyle = dark ? 'rgba(148,163,184,0.3)' : 'rgba(100,116,139,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let r = 0; r < ny; r++) {
        for (let i = 0; i < nx; i++) {
          const n = r * nx + i;
          const q = mols[n];
          if (i < nx - 1) {
            const nb = mols[n + 1];
            ctx.moveTo(q.ax + q.ox, q.ay + q.oy);
            ctx.lineTo(nb.ax + nb.ox, nb.ay + nb.oy);
          }
          if (r < ny - 1) {
            const nb = mols[n + nx];
            ctx.moveTo(q.ax + q.ox, q.ay + q.oy);
            ctx.lineTo(nb.ax + nb.ox, nb.ay + nb.oy);
          }
        }
      }
      ctx.stroke();
      const edge = dark ? 'rgba(226,232,240,0.5)' : 'rgba(15,23,42,0.4)';
      for (let n = 0; n < mols.length; n++) {
        const q = mols[n];
        ctx.fillStyle = rampWarm(uOf(n), dark);
        ctx.beginPath();
        ctx.arc(q.ax + q.ox, q.ay + q.oy, 2.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = edge;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // The analytic overlay, on the lattice's own clock (D_lat = EXH·a²).
      const amber = dark ? '#fbbf24' : '#d97706';
      if (mode === 'plane') {
        let tot = 0;
        for (let i = 0; i < E.length; i++) tot += E[i] - E0;
        const refPeak = (tot * cell) / Math.sqrt(4 * Math.PI * DLAT * 1);
        const heightScale = (slabH * 0.85) / refPeak;
        ctx.strokeStyle = amber;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= 120; i++) {
          const x = x0 + (slabW * i) / 120;
          const expected =
            ((tot * cell) / Math.sqrt(4 * Math.PI * DLAT * t)) *
            Math.exp(-((x - xc) ** 2) / (4 * DLAT * t));
          const y = Math.max(y0 + 2, y1 - expected * heightScale);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, y0, slabW, slabH);
        ctx.clip();
        for (const [tt, alpha] of [[t / 4, 0.3], [t / 2, 0.5], [t, 1]] as const) {
          const rr = Math.sqrt(4 * DLAT * tt);
          ctx.strokeStyle = amber;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = tt === t ? 2 : 1.25;
          ctx.beginPath();
          ctx.arc(xc, yc, rr, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      // Frame and labels.
      ctx.strokeStyle = dark ? '#475569' : '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x0, y0, slabW, slabH);
      ctx.fillStyle = dark ? '#cbd5e1' : '#475569';
      ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        mode === 'plane'
          ? 'a sheet of energy is deposited here at t = 0'
          : 'a hot spot is deposited here at t = 0',
        xc,
        y0 - 10,
      );
      ctx.textAlign = 'left';
      ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
      ctx.fillText(
        mode === 'plane'
          ? 'the molecules never move — the energy hops the bonds'
          : 'the molecules never move — amber ring: rms radius √(4Dt), two axes on screen',
        x0,
        y1 + 20,
      );
      ctx.textAlign = 'right';
      ctx.fillText(`t = ${t.toFixed(1)} s (visual clock)`, x1, y1 + 20);

      // Stats: energy-weighted spread vs the lattice's own prediction.
      emitRef.current += frame.dt;
      if (emitRef.current >= 0.4 && onStats) {
        let wSum = 0;
        let m1 = 0;
        for (let r = 0; r < ny; r++) {
          for (let i = 0; i < nx; i++) {
            const w = E[r * nx + i] - E0;
            const x = gx0 + (i + 0.5) * cell;
            const y = y0 + (r + 0.5) * cell;
            wSum += w;
            m1 += mode === 'plane' ? w * (x - xc) ** 2 : w * ((x - xc) ** 2 + (y - yc) ** 2);
          }
        }
        const sigmaM = wSum > 0 ? Math.sqrt(m1 / wSum) : 0;
        const sigmaP =
          mode === 'plane' ? Math.sqrt(2 * DLAT * t) : Math.sqrt(4 * DLAT * t);
        onStats({
          sigmaMeasured: sigmaM,
          sigmaPredicted: sigmaP,
          t,
          touchingWalls:
            mode === 'plane' ? sigmaP > 0.27 * slabW : sigmaP > 0.42 * Math.min(slabW, slabH),
        });
        emitRef.current = 0;
      }
      return;
    }

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
      role="img"
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label={
        cargo === 'heat'
          ? 'An anchored lattice of molecules with an energy pulse spreading through the bonds, compared against the analytic prediction'
          : mode === 'plane'
            ? 'A burst capsule of particles spreading by random walk, compared against the analytic Gaussian'
            : 'A point burst of particles spreading radially by random walk, compared against the predicted rms radius'
      }
    />
  );
}
