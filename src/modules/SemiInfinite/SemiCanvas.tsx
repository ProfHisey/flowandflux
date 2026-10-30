import { useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { applyZoom, useWheelZoom } from '../FicksLaw/FickCanvas';
import { penetration, surfaceFilm, thetaFilm, thetaHeld } from '../../lib/semiinf';

/**
 * A surface condition switched on at t = 0, and the front it sends into an
 * untouched body.
 *
 * The picture is the body itself, shaded by theta, with the profile drawn
 * over it and the penetration depth marked. Played forward, the front visibly
 * DECELERATES: delta grows as sqrt(t), so it covers the first millimeter fast
 * and every further one more slowly. That deceleration is the single most
 * useful intuition about unsteady diffusion, and it is easier to watch than
 * to derive.
 *
 * Two surface conditions, matching the two semi-infinite entries on the
 * course sheet:
 *   held  the face jumps to Cs at once and stays there (a stirred bath)
 *   film  the face is fed through a transfer coefficient h, so it starts at
 *         C0 and creeps up toward C_inf on its own clock, D/h^2
 *
 * Everything is read from lib/semiinf, which verify.ts checks against the
 * PDE, both boundary conditions, the flux and amount integrals, and the
 * sheet's erf table.
 */

export type Cargo = 'heat' | 'mass';
export type Surface = 'held' | 'film';

export interface SemiView {
  cargo: Cargo;
  surface: Surface;
  /** Diffusivity in the length unit of `depthMax`, squared, per second. */
  D: number;
  /** Film coefficient h and the flux-law coefficient kappa (D for mass,
   *  k for heat), consistent units. Ignored for a held surface. */
  h: number;
  kappa: number;
  /** Physical time now, s, and the end of the playback window. */
  t: number;
  tMax: number;
  /** Initial value and surface/bulk value, in display units. */
  v0: number;
  vS: number;
  unit: string;
  /** Depth shown, and the factor converting it to millimeters for labels. */
  depthMax: number;
  toMm: number;
  /** Optional finite thickness: where a real slab ends. */
  L: number | null;
}

export function thetaAt(v: SemiView, x: number, t: number): number {
  return v.surface === 'held' ? thetaHeld(x, v.D, t) : thetaFilm(x, v.D, v.h, v.kappa, t);
}

export function paletteFor(cargo: Cargo, dark: boolean) {
  return cargo === 'heat'
    ? {
        curve: dark ? '#f87171' : '#dc2626',
        // low -> high theta, as an rgb pair to interpolate
        lo: dark ? [30, 41, 59] : [241, 245, 249],
        hi: dark ? [248, 113, 113] : [252, 165, 165],
      }
    : {
        curve: dark ? '#818cf8' : '#4f46e5',
        lo: dark ? [30, 41, 59] : [241, 245, 249],
        hi: dark ? [129, 140, 248] : [165, 180, 252],
      };
}

export function mix(a: number[], b: number[], u: number, alpha = 1): string {
  const t = Math.max(0, Math.min(1, u));
  const c = a.map((ai, i) => Math.round(ai + (b[i] - ai) * t));
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

function fmtMm(mm: number): string {
  if (mm >= 100) return `${mm.toFixed(0)} mm`;
  if (mm >= 10) return `${mm.toFixed(1)} mm`;
  return `${mm.toFixed(2)} mm`;
}

export function SemiCanvas({ view, dark }: { view: SemiView; dark: boolean }) {
  const zoomRef = useRef(1);
  const [zoomTick, setZoomTick] = useState(0);
  const pal = paletteFor(view.cargo, dark);
  const redrawKey = `${JSON.stringify(view)}|${dark}|${zoomTick}`;

  const canvasRef = useCanvas((ctx, frame) => {
    const { width: W, height: H } = frame;
    applyZoom(ctx, zoomRef.current, W, H);

    const faint = dark ? '#64748b' : '#94a3b8';
    const label = dark ? '#cbd5e1' : '#475569';
    const accent = dark ? '#fbbf24' : '#b45309';
    const ink = dark ? '#e2e8f0' : '#0f172a';

    const surrW = view.surface === 'film' ? 92 : 64;
    const xS = 16 + surrW;            // the face, x = 0
    const xE = W - 18;                // deepest point drawn
    const yTop = 30;
    const yBot = H - 34;
    const toX = (x: number) => xS + (x / view.depthMax) * (xE - xS);
    const toY = (theta: number) => yBot - theta * (yBot - yTop);
    const t = view.t;

    // ---- the body, shaded by theta column by column
    const cols = Math.max(40, Math.round(xE - xS));
    for (let i = 0; i < cols; i++) {
      const x = ((i + 0.5) / cols) * view.depthMax;
      const th = t > 0 ? thetaAt(view, x, t) : 0;
      ctx.fillStyle = mix(pal.lo, pal.hi, th, 0.85);
      ctx.fillRect(xS + (i / cols) * (xE - xS), yTop, (xE - xS) / cols + 1, yBot - yTop);
    }

    // ---- the surroundings: a bath, or a film in front of the bulk
    const bathFill = dark ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.18)';
    ctx.fillStyle = bathFill;
    ctx.fillRect(16, yTop, surrW, yBot - yTop);
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = faint;
    if (view.surface === 'held') {
      ctx.fillText('stirred bath', 16 + surrW / 2, yTop + 14);
      ctx.fillText('held at', 16 + surrW / 2, yBot - 22);
      ctx.fillText(`${view.vS} ${view.unit}`, 16 + surrW / 2, yBot - 8);
    } else {
      ctx.fillText('bulk', 16 + surrW * 0.28, yTop + 14);
      ctx.fillText('film', 16 + surrW * 0.76, yTop + 14);
      ctx.fillText(`${view.vS} ${view.unit}`, 16 + surrW * 0.28, yBot - 8);
      ctx.strokeStyle = faint;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(16 + surrW * 0.55, yTop);
      ctx.lineTo(16 + surrW * 0.55, yBot);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = faint;
    ctx.fillText('material  →  ∞', (xS + xE) / 2, yTop + 14);

    // ---- the face
    ctx.strokeStyle = dark ? '#cbd5e1' : '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(xS, yTop);
    ctx.lineTo(xS, yBot);
    ctx.stroke();

    // ---- an optional finite thickness: where the semi-infinite idea expires
    if (view.L != null && view.L < view.depthMax) {
      const xl = toX(view.L);
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = faint;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(xl, yTop);
      ctx.lineTo(xl, yBot);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = faint;
      ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('a real slab ends here', xl + 4, yBot - 8);
    }

    // ---- the profile, theta(x, t), drawn over the body
    if (t > 0) {
      ctx.strokeStyle = pal.curve;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const x = (i / 200) * view.depthMax;
        const px = toX(x);
        const py = toY(thetaAt(view, x, t));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      // The film's face value, continuous with the profile through the film.
      if (view.surface === 'film') {
        const ths = surfaceFilm(view.D, view.h, view.kappa, t);
        ctx.strokeStyle = pal.curve;
        ctx.beginPath();
        ctx.moveTo(16 + surrW * 0.55, toY(1));
        ctx.lineTo(xS, toY(ths));
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(16, toY(1));
        ctx.lineTo(16 + surrW * 0.55, toY(1));
        ctx.stroke();
      } else {
        ctx.strokeStyle = pal.curve;
        ctx.beginPath();
        ctx.moveTo(16, toY(1));
        ctx.lineTo(xS, toY(1));
        ctx.stroke();
      }
    }

    // ---- the penetration depth, marching in as sqrt(t)
    const d = penetration(view.D, t);
    if (t > 0 && d < view.depthMax) {
      const xd = toX(d);
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(xd, yTop + 22);
      ctx.lineTo(xd, yBot);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = accent;
      ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = xd > (xS + xE) * 0.6 ? 'right' : 'left';
      const off = ctx.textAlign === 'right' ? -6 : 6;
      ctx.fillText(`δ = 3.65√(Dt) = ${fmtMm(d * view.toMm)}`, xd + off, yTop + 34);
      if (view.surface === 'film') {
        ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
        ctx.fillStyle = faint;
        ctx.fillText('(the held-face front, for scale)', xd + off, yTop + 48);
      }
    }

    // ---- axis and labels
    ctx.strokeStyle = faint;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xS, yBot);
    ctx.lineTo(xE, yBot);
    ctx.stroke();
    ctx.fillStyle = faint;
    ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      const xp = xS + f * (xE - xS);
      // The last tick hugs the edge, so it is right-aligned rather than clipped.
      ctx.textAlign = f === 1 ? 'right' : 'center';
      ctx.fillText(f === 0 ? 'x = 0' : fmtMm(f * view.depthMax * view.toMm), xp, yBot + 14);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = label;
    ctx.fillText('θ = 1', xS + 4, toY(1) + 12);
    ctx.fillText('θ = 0', xS + 4, toY(0) - 4);

    ctx.fillStyle = ink;
    ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`t = ${fmtTime(t)}`, xE, H - 8);
  }, { running: false, redrawKey });

  useWheelZoom(canvasRef, zoomRef, setZoomTick);

  return (
    <canvas
      role="img"
      ref={canvasRef}
      className="block h-[280px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[320px]"
      aria-label={`A semi-infinite body whose surface is ${view.surface === 'held' ? 'suddenly held at a new value' : 'fed through a film from a bulk at a new value'}. The ${view.cargo === 'heat' ? 'temperature' : 'concentration'} front advances into the body, slowing as the square root of time.`}
    />
  );
}

export function fmtTime(t: number): string {
  if (t <= 0) return '0 s';
  if (t < 60) return `${t.toFixed(t < 10 ? 1 : 0)} s`;
  if (t < 3600) return `${(t / 60).toFixed(t < 600 ? 1 : 0)} min`;
  if (t < 86400) return `${(t / 3600).toFixed(t < 36000 ? 1 : 0)} h`;
  return `${(t / 86400).toFixed(1)} d`;
}
