import { useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { applyZoom, useWheelZoom } from '../FicksLaw/FickCanvas';
import {
  solveProfile, valueAt,
  type BCSpec, type ProfileParams,
} from '../../lib/bcprofile';

/**
 * The profile, drawn on the picture that produced it.
 *
 * The lecture slides this mirrors put three conditions side by side as three
 * little drawings — a stirred bath, a sealed face, a fluid film — each with
 * the profile meeting it in its own characteristic way. The point of making
 * it interactive is that the characteristic way stops being a thing to
 * memorize: hold the face and the curve pins to it; seal the face and the
 * curve flattens into it; put a film there and neither the value nor the
 * slope is yours to choose — h decides where the curve lands.
 *
 * Everything drawn here is read from lib/bcprofile, which carries the closed
 * forms and is checked against the hand-worked slab in verify.ts. The canvas
 * does no algebra of its own; it only decides where things sit in pixels.
 *
 * WHAT IS DRAWN, by piece:
 *   material band      the body, tinted by cargo (heat warm, mass cool)
 *   surroundings       a stirred bath, a hatched sealed wall, or a film
 *                      plus the bulk beyond it
 *   the profile        solid, in the cargo color, across the material
 *   the mirror         when the inner face is a symmetry plane, the other
 *                      half drawn as a dotted ghost — the reason the slope
 *                      must vanish there is that the two halves have to meet
 *   level lines        dashed, at the surface value and the bulk value
 *   the film drop      annotated between them, because that gap IS j/h
 *   the ghost h        an optional second curve at a smaller h, to show that
 *                      a poor film lifts the whole body rather than steepening
 *                      anything inside it
 */

export type Cargo = 'heat' | 'mass';

export interface BCCanvasProps {
  params: ProfileParams;
  cargo: Cargo;
  /** Draw a second, lighter profile at this h to contrast films. */
  ghostH?: number | null;
  dark: boolean;
}

interface Palette {
  curve: string;
  band: string;
  bandEdge: string;
  ghost: string;
}

function palette(cargo: Cargo, dark: boolean): Palette {
  if (cargo === 'heat') {
    return dark
      ? { curve: '#f87171', band: 'rgba(248,113,113,0.13)', bandEdge: 'rgba(248,113,113,0.45)', ghost: 'rgba(252,165,165,0.55)' }
      : { curve: '#dc2626', band: 'rgba(220,38,38,0.10)', bandEdge: 'rgba(220,38,38,0.35)', ghost: 'rgba(220,38,38,0.40)' };
  }
  return dark
    ? { curve: '#818cf8', band: 'rgba(129,140,248,0.14)', bandEdge: 'rgba(129,140,248,0.45)', ghost: 'rgba(165,180,252,0.55)' }
    : { curve: '#4f46e5', band: 'rgba(79,70,229,0.10)', bandEdge: 'rgba(79,70,229,0.35)', ghost: 'rgba(79,70,229,0.40)' };
}

/** Hatching for a sealed or insulated wall — the one surface nothing crosses. */
function hatchWall(
  ctx: CanvasRenderingContext2D,
  x: number, y0: number, y1: number, width: number, color: string,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y0, width, y1 - y0);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let yy = y0 - width; yy < y1 + width; yy += 6) {
    ctx.beginPath();
    ctx.moveTo(x, yy + width);
    ctx.lineTo(x + width, yy);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.stroke();
}


/** A text chip with its own backing, so a note stays readable wherever the
 *  curve happens to run. The canvas has no z-order to hide behind. */
function chip(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, lines: { text: string; color: string; bold?: boolean }[],
  dark: boolean,
) {
  ctx.textAlign = 'left';
  let w = 0;
  for (const l of lines) {
    ctx.font = `${l.bold ? 600 : 500} ${l.bold ? 11 : 10}px ui-sans-serif, system-ui, sans-serif`;
    w = Math.max(w, ctx.measureText(l.text).width);
  }
  const padX = 7;
  const padY = 6;
  const lh = 15;
  const h = padY * 2 + lh * lines.length - 3;
  ctx.fillStyle = dark ? 'rgba(15,23,42,0.88)' : 'rgba(255,255,255,0.90)';
  ctx.strokeStyle = dark ? 'rgba(148,163,184,0.35)' : 'rgba(100,116,139,0.30)';
  ctx.lineWidth = 1;
  const r = 5;
  ctx.beginPath();
  ctx.roundRect(x, y, w + padX * 2, h, r);
  ctx.fill();
  ctx.stroke();
  lines.forEach((l, i) => {
    ctx.font = `${l.bold ? 600 : 500} ${l.bold ? 11 : 10}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = l.color;
    ctx.fillText(l.text, x + padX, y + padY + 11 + i * lh);
  });
}
function dashLine(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  color: string, dash: number[] = [4, 4], width = 1.25,
) {
  ctx.save();
  ctx.setLineDash(dash);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

/** The value range the drawing has to cover, padded. Includes the bulk and
 *  the ghost so the frame never jumps when a curve is toggled on. */
function valueRange(
  p: ProfileParams, ghost: ProfileParams | null,
): { lo: number; hi: number } {
  const vals: number[] = [];
  const sample = (q: ProfileParams) => {
    const sol = solveProfile(q);
    if (sol.closure === 'no-steady-state') return;
    for (let i = 0; i <= 24; i++) vals.push(valueAt(q, (i / 24) * q.L, sol));
    if (q.outer.kind === 'mixed') vals.push((q.outer.inf ?? 0) * (q.outer.phi ?? 1));
    if (q.inner.kind === 'mixed') vals.push((q.inner.inf ?? 0) * (q.inner.phi ?? 1));
  };
  sample(p);
  if (ghost) sample(ghost);
  const finite = vals.filter(Number.isFinite);
  if (!finite.length) return { lo: 0, hi: 1 };
  let lo = Math.min(...finite);
  let hi = Math.max(...finite);
  if (hi - lo < 1e-12) { hi = lo + 1; }
  const pad = (hi - lo) * 0.18;
  return { lo: lo - pad, hi: hi + pad };
}

/** How wide the surroundings strip needs to be, as a fraction of the plot. */
function surroundFraction(outer: BCSpec): number {
  if (outer.kind === 'mixed') return 0.34;
  if (outer.kind === 'value') return 0.26;
  return 0.1; // a sealed wall needs only its hatching
}

interface Layout {
  /** material: s = 0 at xIn, s = L at xOut */
  xIn: number;
  xOut: number;
  /** mirrored half, drawn when the inner face is a symmetry plane */
  xMirror: number;
  showMirror: boolean;
  /** surroundings */
  xFilmEnd: number;
  xRight: number;
  yTop: number;
  yBot: number;
  toY: (v: number) => number;
}

function layout(
  W: number, H: number, p: ProfileParams, range: { lo: number; hi: number },
): Layout {
  const left = 44;
  const right = W - 10;
  const yTop = 26;
  const yBot = H - 30;
  const span = right - left;
  const surrW = span * surroundFraction(p.outer);
  const xOut = right - surrW;
  const showMirror = p.inner.kind === 'symmetry';
  // With a mirror the body is drawn whole: the solved half on the right of
  // the center line, its reflection on the left.
  const xIn = showMirror ? left + (xOut - left) * 0.5 : left;
  const xMirror = showMirror ? left + (xOut - left) * 0.5 - (xOut - xIn) : xIn;
  const xFilmEnd = p.outer.kind === 'mixed' ? xOut + surrW * 0.45 : xOut;
  const toY = (v: number) =>
    yBot - ((v - range.lo) / (range.hi - range.lo)) * (yBot - yTop);
  return { xIn, xOut, xMirror, showMirror, xFilmEnd, xRight: right, yTop, yBot, toY };
}

/** Sample the profile into screen points across the material. */
function profilePoints(
  p: ProfileParams, lay: Layout, n = 160,
): { x: number; y: number }[] {
  const sol = solveProfile(p);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * p.L;
    const v = valueAt(p, s, sol);
    if (!Number.isFinite(v)) continue;
    pts.push({ x: lay.xIn + (s / p.L) * (lay.xOut - lay.xIn), y: lay.toY(v) });
  }
  return pts;
}

function stroke(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  color: string, width: number, dash: number[] | null = null,
) {
  if (pts.length < 2) return;
  ctx.save();
  if (dash) ctx.setLineDash(dash);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.restore();
}

export function BCCanvas({ params, cargo, ghostH, dark }: BCCanvasProps) {
  const zoomRef = useRef(1);
  const [zoomTick, setZoomTick] = useState(0);
  const pal = palette(cargo, dark);

  const ghost: ProfileParams | null =
    ghostH != null && params.outer.kind === 'mixed'
      ? { ...params, outer: { ...params.outer, h: ghostH } }
      : null;

  const redrawKey = `${JSON.stringify(params)}|${cargo}|${ghostH}|${dark}|${zoomTick}`;

  const canvasRef = useCanvas((ctx, frame) => {
    const { width: W, height: H } = frame;
    applyZoom(ctx, zoomRef.current, W, H);

    const sol = solveProfile(params);
    const ink = dark ? '#e2e8f0' : '#0f172a';
    const faint = dark ? '#64748b' : '#94a3b8';
    const label = dark ? '#cbd5e1' : '#475569';
    const accent = dark ? '#fbbf24' : '#b45309';
    const bathFill = dark ? 'rgba(148,163,184,0.10)' : 'rgba(148,163,184,0.14)';

    if (sol.closure === 'no-steady-state') {
      ctx.fillStyle = ink;
      ctx.font = '600 14px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No steady state', W / 2, H / 2 - 18);
      ctx.fillStyle = label;
      ctx.font = '500 12px ui-sans-serif, system-ui, sans-serif';
      const why = params.gen === 0
        ? 'Two flux conditions that disagree: more is pushed in than is let out.'
        : 'Everything made inside has to leave somewhere. Sealed all round, it cannot.';
      ctx.fillText(why, W / 2, H / 2 + 4);
      ctx.fillText('The value just climbs — there is no profile to draw.', W / 2, H / 2 + 22);
      return;
    }

    const range = valueRange(params, ghost);
    const lay = layout(W, H, params, range);
    const { xIn, xOut, xMirror, showMirror, xFilmEnd, xRight, yTop, yBot, toY } = lay;

    // ---- bands
    ctx.fillStyle = pal.band;
    ctx.fillRect(showMirror ? xMirror : xIn, yTop, xOut - (showMirror ? xMirror : xIn), yBot - yTop);
    if (params.outer.kind === 'value') {
      ctx.fillStyle = bathFill;
      ctx.fillRect(xOut, yTop, xRight - xOut, yBot - yTop);
    } else if (params.outer.kind === 'mixed') {
      ctx.fillStyle = bathFill;
      ctx.fillRect(xOut, yTop, xFilmEnd - xOut, yBot - yTop);
    }

    // ---- band captions
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = faint;
    ctx.fillText(cargo === 'heat' ? 'solid' : 'material',
      ((showMirror ? xMirror : xIn) + xOut) / 2, yTop + 14);
    if (params.outer.kind === 'value') {
      ctx.fillText('stirred bath', (xOut + xRight) / 2, yTop + 14);
    } else if (params.outer.kind === 'mixed') {
      ctx.fillText('film', (xOut + xFilmEnd) / 2, yTop + 14);
      ctx.fillText('bulk', (xFilmEnd + xRight) / 2, yTop + 14);
    }

    // ---- axis
    ctx.strokeStyle = faint;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(showMirror ? xMirror : xIn, yBot);
    ctx.lineTo(xRight, yBot);
    ctx.stroke();
    ctx.fillStyle = faint;
    ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(params.geometry === 'slab' ? 'x' : 'r', xRight - 10, yBot + 14);

    // ---- the mirror: the other half of a symmetric body
    if (showMirror) {
      const pts = profilePoints(params, lay);
      const mirrored = pts.map((q) => ({ x: 2 * xIn - q.x, y: q.y }));
      stroke(ctx, mirrored, pal.ghost, 1.6, [2, 3]);
      dashLine(ctx, xIn, yTop + 20, xIn, yBot, accent, [3, 3], 1);
      ctx.fillStyle = accent;
      ctx.font = '600 10px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(params.geometry === 'slab' ? 'midplane' : 'center, r = 0', xIn, yTop + 12);
      ctx.fillStyle = faint;
      ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('mirror', (xMirror + xIn) / 2, yBot - 8);
    }

    const vSurf = valueAt(params, params.L, sol);
    const vIn = valueAt(params, 0, sol);

    // ---- what happens beyond the outer face
    if (params.outer.kind === 'value') {
      // A stirred bath holds the value, so the profile simply continues flat.
      stroke(ctx, [{ x: xOut, y: toY(vSurf) }, { x: xRight, y: toY(vSurf) }], pal.curve, 2);
      dashLine(ctx, showMirror ? xMirror : xIn, toY(vSurf), xRight, toY(vSurf), faint, [3, 4], 1);
    } else if (params.outer.kind === 'mixed') {
      const bulk = (params.outer.inf ?? 0) * (params.outer.phi ?? 1);
      // Across a thin film the profile is drawn straight: the film is where
      // the whole convective drop lives, and its size is j/h.
      stroke(ctx, [{ x: xOut, y: toY(vSurf) }, { x: xFilmEnd, y: toY(bulk) }], pal.curve, 2);
      stroke(ctx, [{ x: xFilmEnd, y: toY(bulk) }, { x: xRight, y: toY(bulk) }], pal.curve, 2);
      dashLine(ctx, showMirror ? xMirror : xIn, toY(vSurf), xFilmEnd, toY(vSurf), faint, [3, 4], 1);
      dashLine(ctx, xOut, toY(bulk), xRight, toY(bulk), faint, [3, 4], 1);
      // The film drop, annotated — this gap IS the convective resistance.
      const xd = xOut + (xFilmEnd - xOut) * 0.52;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(xd, toY(vSurf));
      ctx.lineTo(xd, toY(bulk));
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.font = '600 10px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('film drop = j / h', xd + 5, (toY(vSurf) + toY(bulk)) / 2 + 3);
    } else {
      // Sealed: nothing crosses, and the profile meets it flat.
      hatchWall(ctx, xOut, yTop, yBot, 9, faint);
      const flat = Math.abs(params.outer.flux ?? 0) < 1e-12;
      if (flat) {
        dashLine(ctx, xOut - 34, toY(vSurf), xOut + 2, toY(vSurf), accent, [5, 3], 1.5);
        ctx.fillStyle = accent;
        ctx.font = '600 10px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('slope = 0', xOut - 38, toY(vSurf) + 3);
      }
    }

    // ---- what happens at the inner face
    if (params.inner.kind === 'flux' && !showMirror) {
      hatchWall(ctx, xIn - 9, yTop, yBot, 9, faint);
      if (Math.abs(params.inner.flux ?? 0) < 1e-12) {
        dashLine(ctx, xIn - 2, toY(vIn), xIn + 34, toY(vIn), accent, [5, 3], 1.5);
        ctx.fillStyle = accent;
        ctx.font = '600 10px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('slope = 0', xIn + 38, toY(vIn) + 3);
      }
    } else if (params.inner.kind === 'value') {
      dashLine(ctx, xIn, toY(vIn), xRight, toY(vIn), faint, [3, 4], 1);
    }

    // ---- the ghost: the same body behind a worse film
    if (ghost) {
      const gsol = solveProfile(ghost);
      if (gsol.closure !== 'no-steady-state') {
        const gpts = profilePoints(ghost, lay);
        stroke(ctx, gpts, pal.ghost, 2, [5, 4]);
        const gSurf = valueAt(ghost, ghost.L, gsol);
        const gbulk = (ghost.outer.inf ?? 0) * (ghost.outer.phi ?? 1);
        stroke(ctx, [{ x: xOut, y: toY(gSurf) }, { x: xFilmEnd, y: toY(gbulk) }], pal.ghost, 2, [5, 4]);
        if (showMirror) {
          stroke(ctx, gpts.map((q) => ({ x: 2 * xIn - q.x, y: q.y })), pal.ghost, 1.2, [2, 4]);
        }
        ctx.fillStyle = pal.ghost;
        ctx.font = '600 10px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('small h', xIn + 8, toY(valueAt(ghost, 0, gsol)) - 6);
        ctx.fillStyle = pal.curve;
        ctx.fillText('large h', xIn + 8, toY(vIn) + 14);
      }
    }

    // ---- the profile itself
    stroke(ctx, profilePoints(params, lay), pal.curve, 2.4);

    // ---- face markers and the floating caveat
    ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = faint;
    ctx.textAlign = 'center';
    ctx.fillText(params.geometry === 'slab' ? 'x = 0' : 'r = 0', xIn, yBot + 14);
    ctx.fillText(params.geometry === 'slab' ? 'x = L' : 'r = R', xOut, yBot + 14);

    if (sol.closure === 'floating') {
      chip(ctx, (showMirror ? xMirror : xIn) + 8, yTop + 26, [
        { text: 'shape fixed, level not', color: accent, bold: true },
        { text: 'two flux conditions pin only slopes;', color: faint },
        { text: 'one value anywhere would set the datum', color: faint },
      ], dark);
    }
  }, { running: false, redrawKey });

  useWheelZoom(canvasRef, zoomRef, setZoomTick);

  const sol = solveProfile(params);
  const aria =
    sol.closure === 'no-steady-state'
      ? 'The chosen boundary conditions admit no steady state: everything generated inside has nowhere to leave, so no profile is drawn.'
      : `A ${params.geometry} with uniform generation. The ${cargo === 'heat' ? 'temperature' : 'concentration'} profile is drawn across the material, meeting a ${
          params.outer.kind === 'value' ? 'held surface value at a stirred bath'
            : params.outer.kind === 'mixed' ? 'fluid film, across which it drops to the bulk value'
            : 'sealed face, which it meets flat'
        }.`;

  return (
    <canvas
      role="img"
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[360px]"
      aria-label={aria}
    />
  );
}
