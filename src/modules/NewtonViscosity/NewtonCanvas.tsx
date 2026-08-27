import { useEffect, useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import type { NewtonParams } from '../../lib/newton';
import { applyZoom, useWheelZoom } from '../FicksLaw/FickCanvas';

/**
 * Couette flow between plates: the top plate slides, the bottom one is
 * fixed, and the fluid in between shears.
 *
 * Design decision (Prof. Hisey): NO random walk here. In reality molecules
 * do diffuse while all this happens, but the jitter buries the thing this
 * module exists to show — layers of fluid sliding over one another, each
 * one dragging its neighbor. So the particles ride their layers cleanly,
 * and the momentum transfer is drawn instead as GRIP LINKS between adjacent
 * layers: each particle leans on the nearest particle in the layer below,
 * and because the upper layer is always pulling ahead, the links tilt
 * forward, stretch, let go, and catch the next partner. That repeated
 * tug-release-catch IS the viscous stress, made visible. The statistical
 * (momentum-diffusion) story returns in the momentum module proper.
 *
 * Cosmetic values, stated: the on-screen plate speed is fixed for
 * legibility (like D_VIS). The velocity PROFILE the layers ride is the
 * physical steady solution u(y) = U·y/H.
 */

const LANES = 9;
const PER_LANE = 12;
/** Top-plate speed on screen, px/s. Visual, like D_VIS. */
const U_VIS = 80;

/** Momentum ramp: low-to-high speed, the third color family (emerald),
 *  next to indigo/cyan for mass and red/amber for heat. */
export function rampFlow(u: number, dark: boolean, alpha = 1): string {
  const t = Math.min(1, Math.max(0, u));
  let r: number, g: number, b: number;
  if (dark) {
    // near-black slate -> emerald
    r = Math.round(15 + t * 37);
    g = Math.round(23 + t * 188);
    b = Math.round(42 + t * 111);
  } else {
    // near-white -> deep emerald
    r = Math.round(248 - t * 244);
    g = Math.round(250 - t * 130);
    b = Math.round(252 - t * 165);
  }
  return alpha < 1 ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
}

/**
 * Two tracer styles, selectable as tabs:
 *  - 'links': sliding lanes with grip links — the FORCE picture.
 *  - 'dye':   vertical dye stripes tilting into the profile, plus a marked
 *             fluid element shearing from square to parallelogram — the
 *             KINEMATICS picture, the classic flow-visualization view.
 */
export type NewtonView = 'links' | 'dye';

export function NewtonCanvas({
  params,
  view,
  showParticles,
  running,
  dark,
}: {
  params: NewtonParams;
  view: NewtonView;
  showParticles: boolean;
  running: boolean;
  dark: boolean;
}) {
  /** Per-lane scroll offset (px) plus each particle's fixed position within
   *  the lane's repeating pattern, as a fraction of the width. */
  const offsetsRef = useRef<number[]>([]);
  const patternRef = useRef<number[][]>([]);
  const plateRef = useRef(0);
  /** Dye clock and stripe birth times. */
  const timeRef = useRef(0);
  const stripesRef = useRef<number[]>([]);
  const lastInjectRef = useRef(-Infinity);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const zoomRef = useRef(1);
  const [zoomTick, setZoomTick] = useState(0);

  const redrawKey = `${params.mu}|${params.U}|${params.H}|${params.A}|${dark}|${showParticles}|${view}|${zoomTick}`;

  useEffect(() => {
    offsetsRef.current = [];
    patternRef.current = [];
    timeRef.current = 0;
    stripesRef.current = [];
    lastInjectRef.current = -Infinity;
  }, [view]);

  const canvasRef = useCanvas((ctx, frame) => {
    const p = paramsRef.current;
    const { width: W, height: H } = frame;
    applyZoom(ctx, zoomRef.current, W, H);
    const pad = 8;

    // The drawn gap tracks the H slider and the plate length tracks the
    // wetted area A (log-mapped) — sliders must move the picture.
    const x0 = pad + 46;
    const plateH = 13;
    const y0f = pad + 26 + plateH;
    const y1f = H - pad - 26 - plateH;
    const tH = Math.min(1, Math.max(0, (Math.log10(p.H) + 5) / 3)); // 1e-5..1e-2 m
    const tA = Math.min(1, Math.max(0, (Math.log10(p.A) + 4) / 4)); // 1e-4..1 m^2
    const x1 = x0 + (W - pad - 10 - x0) * (0.65 + 0.35 * tA);
    const ycS = (y0f + y1f) / 2;
    const halfG = ((y1f - y0f) / 2) * (0.45 + 0.55 * tH);
    const y0 = ycS - halfG;
    const y1 = ycS + halfG;
    const gapW = x1 - x0;
    const gapH = y1 - y0;
    if (gapW <= 0 || gapH <= 0) return;

    const dt = running && showParticles ? frame.dt : 0;

    // Velocity on screen: linear, U_VIS at the top plate, 0 at the bottom.
    const uAt = (y: number) => (U_VIS * (y1 - y)) / gapH;
    const normAt = (y: number) => (y1 - y) / gapH;

    // Shaded momentum field.
    for (let py = 0; py < gapH; py++) {
      ctx.fillStyle = rampFlow(normAt(y0 + py), dark);
      ctx.fillRect(x0, y0 + py, gapW, 1.5);
    }

    // Plates: the top one slides — its hatching marches — the bottom sits.
    plateRef.current = (plateRef.current + U_VIS * dt) % 14;
    drawPlate(ctx, x0, y0 - plateH, gapW, plateH, dark, plateRef.current);
    drawPlate(ctx, x0, y1, gapW, plateH, dark, 0);

    if (showParticles && view === 'dye') {
      timeRef.current += dt;
      const t = timeRef.current;

      // A stripe's top has crossed most of the gap by maxAge; three stripes
      // are in flight at staggered ages at any moment.
      const maxAge = (0.75 * gapW) / U_VIS;
      const injectEvery = maxAge / 3;
      if (t - lastInjectRef.current >= injectEvery) {
        stripesRef.current.push(t);
        lastInjectRef.current = t;
      }
      stripesRef.current = stripesRef.current.filter((b) => t - b <= maxAge);

      // Vertical dye stripes, painted at x_inj and left alone: after time a,
      // the fluid at height y has carried its bit of dye a distance u(y)·a,
      // so the straight stripe tilts into the velocity profile itself.
      const xInj = x0 + gapW * 0.1;
      const dye = dark ? '232,121,249' : '192,38,211';
      const SAMPLES = 36;
      for (const birth of stripesRef.current) {
        const age = t - birth;
        const alpha = 0.85 * (1 - age / maxAge) + 0.1;
        ctx.strokeStyle = `rgba(${dye},${alpha.toFixed(2)})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let s = 0; s <= SAMPLES; s++) {
          const y = y0 + (gapH * s) / SAMPLES;
          const x = xInj + uAt(y) * age;
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // Injection marker.
      ctx.strokeStyle = `rgba(${dye},0.35)`;
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(xInj, y0);
      ctx.lineTo(xInj, y1);
      ctx.stroke();
      ctx.setLineDash([]);

      // A marked fluid element: a square shearing into a parallelogram at
      // rate dγ/dt = du/dy, then resetting. The horizontal edges stay
      // horizontal and equal — pure shear, no rotation of the layers.
      const w0 = gapH * 0.3;
      const yTop = y0 + gapH * 0.35;
      const yBot = yTop + w0;
      const xSq = x0 + gapW * 0.72;
      const relRate = uAt(yTop) - uAt(yBot); // px/s of relative sliding
      const period = relRate > 0 ? (0.4 * gapW) / relRate : Infinity;
      const age2 = period === Infinity ? 0 : t % period;
      const shiftTop = uAt(yTop) * age2 - uAt((yTop + yBot) / 2) * age2;
      const shiftBot = uAt(yBot) * age2 - uAt((yTop + yBot) / 2) * age2;
      ctx.strokeStyle = `rgba(${dye},0.6)`;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.strokeRect(xSq, yTop, w0, w0);
      ctx.setLineDash([]);
      ctx.strokeStyle = `rgba(${dye},0.95)`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(xSq + shiftTop, yTop);
      ctx.lineTo(xSq + w0 + shiftTop, yTop);
      ctx.lineTo(xSq + w0 + shiftBot, yBot);
      ctx.lineTo(xSq + shiftBot, yBot);
      ctx.closePath();
      ctx.stroke();
    }

    if (showParticles && view === 'links') {
      // Lazy init: a fixed, lightly jittered pattern per lane, so particles
      // are individually trackable without ever diffusing.
      if (patternRef.current.length === 0) {
        for (let i = 0; i < LANES; i++) {
          const row: number[] = [];
          for (let k = 0; k < PER_LANE; k++) {
            row.push((k + 0.5 + (Math.random() - 0.5) * 0.5) / PER_LANE);
          }
          patternRef.current.push(row);
          offsetsRef.current.push(Math.random() * gapW);
        }
      }

      const laneY = (i: number) => y0 + (gapH * (i + 0.5)) / LANES;
      const xs: number[][] = [];
      for (let i = 0; i < LANES; i++) {
        offsetsRef.current[i] = (offsetsRef.current[i] + uAt(laneY(i)) * dt) % gapW;
        const off = offsetsRef.current[i];
        xs.push(
          patternRef.current[i].map((f) => x0 + ((f * gapW + off) % gapW)),
        );
      }

      // Grip links between adjacent layers: each particle leans on the
      // nearest particle in the layer below. The faster layer keeps pulling
      // ahead, so every link tilts, stretches, releases, and re-catches —
      // that tug is the shear stress.
      const linkMax = (gapW / PER_LANE) * 0.62;
      const linkColor = dark ? '52,211,153' : '4,120,87';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < LANES - 1; i++) {
        const yA = laneY(i);
        const yB = laneY(i + 1);
        for (const xa of xs[i]) {
          let best = Infinity;
          let bx = 0;
          for (const xbRaw of xs[i + 1]) {
            let d = xbRaw - xa;
            if (d > gapW / 2) d -= gapW;
            if (d < -gapW / 2) d += gapW;
            if (Math.abs(d) < Math.abs(best)) {
              best = d;
              bx = xa + d;
            }
          }
          if (Math.abs(best) < linkMax && bx > x0 && bx < x1) {
            const a = 0.45 * (1 - Math.abs(best) / linkMax) + 0.08;
            ctx.strokeStyle = `rgba(${linkColor},${a.toFixed(2)})`;
            ctx.beginPath();
            ctx.moveTo(xa, yA + 2);
            ctx.lineTo(bx, yB - 2);
            ctx.stroke();
          }
        }
      }

      // The particles themselves, riding their layers.
      ctx.fillStyle = dark ? 'rgba(226,232,240,0.85)' : 'rgba(15,23,42,0.65)';
      for (let i = 0; i < LANES; i++) {
        const y = laneY(i);
        for (const x of xs[i]) {
          ctx.beginPath();
          ctx.arc(x, y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Classic velocity-profile arrows down the left edge. Neutral slate, not
    // emerald: green arrows disappeared into the green momentum shading.
    const arrowColor = dark ? '#f1f5f9' : '#1e293b';
    ctx.strokeStyle = arrowColor;
    ctx.fillStyle = arrowColor;
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= 4; i++) {
      const y = y0 + (gapH * i) / 4;
      const len = (uAt(y) / U_VIS) * 42;
      if (len < 1) continue;
      ctx.beginPath();
      ctx.moveTo(x0 + 4, y);
      ctx.lineTo(x0 + 4 + len, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x0 + 4 + len, y);
      ctx.lineTo(x0 + len - 1, y - 3);
      ctx.lineTo(x0 + len - 1, y + 3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = dark ? '#475569' : '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0 + 4, y0);
    ctx.lineTo(x0 + 4, y1);
    ctx.stroke();

    // Labels.
    ctx.fillStyle = dark ? '#cbd5e1' : '#475569';
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`top plate → U = ${fmtU(p.U)} m/s`, x0, y0 - plateH - 6);
    ctx.fillText('bottom plate fixed — no slip, u = 0', x0, y1 + plateH + 16);
  }, { running: running && showParticles, redrawKey });

  useWheelZoom(canvasRef, zoomRef, setZoomTick);

  return (
    <canvas
      role="img"
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label="Couette flow between plates: layers of particles sliding over one another, linked by viscous grip"
    />
  );
}

/** A plate: solid bar with diagonal hatching. `shift` slides the hatch,
 *  which is how the top plate visibly moves. */
function drawPlate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  dark: boolean,
  shift: number,
) {
  ctx.fillStyle = dark ? '#334155' : '#e2e8f0';
  ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = dark ? 'rgba(226,232,240,0.25)' : 'rgba(100,116,139,0.35)';
  ctx.lineWidth = 1;
  for (let d = -h - 14; d < w + h; d += 7) {
    ctx.beginPath();
    ctx.moveTo(x + d + shift, y + h);
    ctx.lineTo(x + d + shift + h, y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = dark ? '#475569' : '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
}

function fmtU(U: number): string {
  return String(Number(U.toPrecision(3)));
}
