import { useEffect, useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { applyZoom, gauss, useWheelZoom } from '../FicksLaw/FickCanvas';
import { rampWarm } from '../FourierLaw/FourierCanvas';

/**
 * The mixing box, heat edition: a hot half and a cold half of the same
 * solid, separated by an insulating divider. Pull the divider and the two
 * halves exchange energy until the jiggling evens out — the Fourier analog
 * of the two-species mixing box, with one crucial difference on display:
 * NO molecule ever crosses the middle. Only the energy does.
 *
 * Same energy-exchange lattice as the Fourier module (each bond hands
 * energy both ways, proportional to the giver's own energy), but insulated
 * on all sides: nothing is pinned, so the box relaxes to the average — it
 * does not sit in a steady state. Total energy is conserved to rounding.
 */

export interface HeatMixStats {
  /** Mean temperature of each half, degC. */
  TLeft: number;
  TRight: number;
}

interface Molecule {
  ax: number;
  ay: number;
  ox: number;
  oy: number;
}

const NX = 36;
const NY = 10;
const EX_RATE = 7;
const K0 = 273.15;

export function DividerHeatCanvas({
  TLeft,
  TRight,
  kScale,
  dividerIn,
  resetTick,
  running,
  dark,
  onStats,
}: {
  TLeft: number;
  TRight: number;
  /** Relative conductivity (1 = baseline): how readily neighbours hand
   *  energy across. Copper-like at 3, styrofoam-like at 0.2. */
  kScale: number;
  dividerIn: boolean;
  resetTick: number;
  running: boolean;
  dark: boolean;
  onStats?: (s: HeatMixStats) => void;
}) {
  const energyRef = useRef<Float64Array | null>(null);
  const moleculesRef = useRef<Molecule[]>([]);
  const emitRef = useRef(0);
  const dividerRef = useRef(dividerIn);
  dividerRef.current = dividerIn;
  const kRef = useRef(kScale);
  kRef.current = kScale;
  const boundsRef = useRef({ lo: 0, hi: 1 });
  const zoomRef = useRef(1);
  const [zoomTick, setZoomTick] = useState(0);

  const redrawKey = `${TLeft}|${TRight}|${dividerIn}|${resetTick}|${dark}|${zoomTick}`;

  useEffect(() => {
    energyRef.current = null;
    moleculesRef.current = [];
  }, [TLeft, TRight, resetTick]);

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

    let E = energyRef.current;
    if (!E) {
      E = new Float64Array(NX * NY);
      for (let i = 0; i < NX; i++) {
        const T = i < NX / 2 ? TLeft : TRight;
        for (let r = 0; r < NY; r++) E[r * NX + i] = T + K0;
      }
      energyRef.current = E;
      boundsRef.current = {
        lo: Math.min(TLeft, TRight) + K0,
        hi: Math.max(TLeft, TRight) + K0,
      };
    }

    const dt = running ? frame.dt : 0;
    if (dt > 0) {
      // kScale raises the exchange rate; sub-stepping keeps the explicit
      // scheme stable when the total per-frame transfer would get large.
      const total = Math.min(0.5, EX_RATE * kRef.current * dt);
      const nSub = Math.max(1, Math.ceil(total / 0.1));
      const eps = total / nSub;
      const blocked = dividerRef.current;
      for (let sub = 0; sub < nSub; sub++) {
        const dE = new Float64Array(NX * NY);
        for (let r = 0; r < NY; r++) {
          for (let i = 0; i < NX; i++) {
            const idx = r * NX + i;
            if (i < NX - 1) {
              // The divider is an insulator while it is in: the bond between
              // the two middle columns simply does not exist.
              if (!(blocked && i === NX / 2 - 1)) {
                const give = eps * E[idx] * (0.5 + Math.random());
                const take = eps * E[idx + 1] * (0.5 + Math.random());
                dE[idx] += take - give;
                dE[idx + 1] += give - take;
              }
            }
            if (r < NY - 1) {
              const give = eps * E[idx] * (0.5 + Math.random());
              const take = eps * E[idx + NX] * (0.5 + Math.random());
              dE[idx] += take - give;
              dE[idx + NX] += give - take;
            }
          }
        }
        for (let i = 0; i < E.length; i++) E[i] += dE[i];
      }
      // No pinning anywhere: the box is insulated, so it relaxes to the
      // average instead of holding a gradient. That contrast with the
      // Fourier module's pinned baths is the lesson.
    }

    // Faint cell wash from the lattice's own energies — muted, because the
    // MOLECULES carry the colour now (Aug 2026 review: background tinting
    // alone did not read, especially in 3D).
    const { lo, hi } = boundsRef.current;
    const span = hi - lo || 1;
    const cw = boxW / NX;
    const ch = boxH / NY;
    for (let r = 0; r < NY; r++) {
      for (let i = 0; i < NX; i++) {
        const u = (E[r * NX + i] - lo) / span;
        ctx.fillStyle = rampWarm(Math.min(1, Math.max(0, u)), dark, 0.2);
        ctx.fillRect(x0 + i * cw, y0 + r * ch, cw + 0.5, ch + 0.5);
      }
    }

    // Molecules jiggling in place, amplitude from their own site's energy.
    let list = moleculesRef.current;
    if (list.length === 0) {
      list = [];
      for (let r = 0; r < NY; r++) {
        for (let i = 0; i < NX; i++) {
          list.push({
            ax: x0 + (i + 0.5) * cw,
            ay: y0 + (r + 0.5) * ch,
            ox: 0,
            oy: 0,
          });
        }
      }
      moleculesRef.current = list;
    }
    // Advance the jiggle, then draw the bonds between CURRENT positions —
    // the solid reads as a bonded lattice whose springs carry the energy.
    for (let n = 0; n < list.length; n++) {
      const q = list[n];
      const u = Math.min(1, Math.max(0, (E[n] - lo) / span));
      const amp = 0.7 + 4.6 * u;
      if (dt > 0) {
        q.ox = 0.55 * q.ox + 0.45 * amp * gauss() * 0.8;
        q.oy = 0.55 * q.oy + 0.45 * amp * gauss() * 0.8;
      }
    }
    ctx.strokeStyle = dark ? 'rgba(148,163,184,0.35)' : 'rgba(100,116,139,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let r = 0; r < NY; r++) {
      for (let i = 0; i < NX; i++) {
        const n = r * NX + i;
        const q = list[n];
        // The divider severs the middle bonds while it is in — the missing
        // springs ARE the insulation, drawn.
        if (i < NX - 1 && !(dividerRef.current && i === NX / 2 - 1)) {
          const nb = list[n + 1];
          ctx.moveTo(q.ax + q.ox, q.ay + q.oy);
          ctx.lineTo(nb.ax + nb.ox, nb.ay + nb.oy);
        }
        if (r < NY - 1) {
          const nb = list[n + NX];
          ctx.moveTo(q.ax + q.ox, q.ay + q.oy);
          ctx.lineTo(nb.ax + nb.ox, nb.ay + nb.oy);
        }
      }
    }
    ctx.stroke();
    // Each molecule wears its own energy as colour.
    const edge = dark ? 'rgba(226,232,240,0.55)' : 'rgba(15,23,42,0.45)';
    for (let n = 0; n < list.length; n++) {
      const q = list[n];
      const u = Math.min(1, Math.max(0, (E[n] - lo) / span));
      ctx.fillStyle = rampWarm(u, dark);
      ctx.beginPath();
      ctx.arc(q.ax + q.ox, q.ay + q.oy, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // The divider.
    if (dividerRef.current) {
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

    ctx.strokeStyle = dark ? '#475569' : '#94a3b8';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, boxW, boxH);

    emitRef.current += frame.dt;
    if (emitRef.current >= 0.4 && onStats) {
      let sl = 0;
      let sr = 0;
      for (let r = 0; r < NY; r++) {
        for (let i = 0; i < NX; i++) {
          if (i < NX / 2) sl += E[r * NX + i];
          else sr += E[r * NX + i];
        }
      }
      const half = (NX / 2) * NY;
      onStats({ TLeft: sl / half - K0, TRight: sr / half - K0 });
      emitRef.current = 0;
    }
  }, { running, redrawKey });

  useWheelZoom(canvasRef, zoomRef, setZoomTick);

  return (
    <canvas
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label="A hot half and a cold half of a solid separated by a removable insulating divider"
    />
  );
}
