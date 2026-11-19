import { useEffect, useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { theta, trackWindow } from '../../lib/peclet';
import { applyZoom, D_VIS, gauss, rampColor, useWheelZoom } from '../FicksLaw/FickCanvas';

/**
 * The two motions, finally in one canvas: every walker takes the SAME
 * unbiased diffusive steps as in the Fick module, AND rides the flow. The
 * one honest trick this canvas pulls: the on-screen drift speed is chosen
 * so that the VISUAL Peclet number equals the physical one (clamped to
 * +-60 so the picture stays watchable at Pe = 10^7 — the caption owns up
 * when clamping). Speeds are cosmetic; the RATIO, which is the entire
 * subject of this module, is real.
 *
 * Left bath at C0, right bath at CL, edge bins resampled Dirichlet-style;
 * the interior profile emerges from the walking + drifting and is compared
 * against the analytic exponential (amber curve) — the house
 * measured-vs-predicted pattern, now with convection in the mix.
 *
 * TRACKED WALKERS. A cloud cannot show which mechanism did what: over any
 * short stretch the jitter dwarfs the drift (diffusion always wins small
 * distances; Pe is a statement about the whole channel). So a few walkers,
 * running exactly the cloud's physics, draw their path over a window of
 * tau = L^2/8D (trackWindow), each beside a dashed arrow for where the flow
 * ALONE would have carried it in the same time. Over that window the arrow
 * is Pe L/8 and the wandering L/2, so arrow : wander = Pe/4 exactly —
 * tangles below Pe ~ 4, streaks along the arrows above. Their history is
 * pre-run on every reseed, so the paths are there at once rather than
 * after minutes of watching.
 */

const BINS = 36;
const BUDGET = 1100;
const PE_CAP = 60;
const N_TRACKS = 3;
/** Path sampling interval, s of screen time. Coarse on purpose: a random walk
 *  sampled sparsely is still a random walk (it is self-similar), and finer
 *  sampling only adds ink that buries the cloud and the profile. */
const SAMPLE_DT = 0.5;
/** Pre-run step, s — fine enough that the pre-run path matches the live one. */
const PRE_DT = 1 / 30;

interface Track {
  x: number;
  y: number;
  /** Recorded path, oldest first, stamped with the canvas clock (s). */
  pts: { x: number; y: number; t: number }[];
  /** Time since the last sample, s. */
  acc: number;
}

interface P {
  x: number;
  y: number;
}

export function PecletCanvas({
  Pe,
  running,
  dark,
  showTracks,
}: {
  /** Physical Peclet number (the canvas clamps its visual copy to ±60). */
  Pe: number;
  running: boolean;
  dark: boolean;
  /** Draw the tracked walkers' paths and their flow-only arrows. */
  showTracks: boolean;
}) {
  const particlesRef = useRef<P[]>([]);
  const tracksRef = useRef<Track[]>([]);
  const clockRef = useRef(0);
  const peRef = useRef(Pe);
  peRef.current = Pe;

  const zoomRef = useRef(1);
  const [zoomTick, setZoomTick] = useState(0);

  const peVis = Math.max(-PE_CAP, Math.min(PE_CAP, Pe));
  // Reseeding keys on the PHYSICS only — zooming must not reset the cloud.
  const seedKey = `${peVis.toFixed(3)}|${dark}`;
  const redrawKey = `${seedKey}|${zoomTick}|${showTracks}`;

  useEffect(() => {
    particlesRef.current = [];
    tracksRef.current = [];
  }, [seedKey]);

  const canvasRef = useCanvas((ctx, frame) => {
    const { width: W, height: H } = frame;
    applyZoom(ctx, zoomRef.current, W, H);
    const pad = 8;
    const x0 = pad + 56;
    const x1 = W - pad - 56;
    const y0 = pad + 26;
    const y1 = H - pad - 30;
    const slabW = x1 - x0;
    const slabH = y1 - y0;
    if (slabW <= 0 || slabH <= 0) return;
    const dt = running ? frame.dt : 0;

    const peV = Math.max(-PE_CAP, Math.min(PE_CAP, peRef.current));
    // Visual drift chosen so v_vis * slabW / D_VIS = Pe exactly.
    const vVis = (peV * D_VIS) / slabW;
    const th = (xi: number) => theta(peV, xi);
    // theta runs 1 -> 0 in concentration terms when C0 > CL; shade with
    // 1 - theta so the left (C0) side is dark like the Fick module.
    const norm = (xi: number) => 1 - th(xi);

    // Field shading from the analytic profile (the reservoirs pin it).
    for (let px = 0; px < slabW; px++) {
      ctx.fillStyle = rampColor(norm(px / slabW) * 0.9, dark);
      ctx.fillRect(x0 + px, y0, 1.5, slabH);
    }
    // Baths.
    ctx.fillStyle = rampColor(norm(0) * 0.9, dark);
    ctx.fillRect(pad, y0, 56 - pad, slabH);
    ctx.fillStyle = rampColor(norm(1) * 0.9, dark);
    ctx.fillRect(x1, y0, 56 - pad, slabH);
    hatch(ctx, pad, y0, 56 - pad, slabH, dark);
    hatch(ctx, x1, y0, 56 - pad, slabH, dark);

    // Walkers: diffuse AND drift.
    const list = particlesRef.current;
    const binW = slabW / BINS;
    const perBin = BUDGET / BINS;
    const targetFor = (bin: number) =>
      Math.round(perBin * norm((bin + 0.5) / BINS) * 2);

    if (list.length === 0) {
      for (let bin = 0; bin < BINS; bin++) {
        const want = targetFor(bin);
        for (let k = 0; k < want; k++) {
          list.push({
            x: x0 + binW * (bin + Math.random()),
            y: y0 + Math.random() * slabH,
          });
        }
      }
    }

    const sigma = Math.sqrt(2 * D_VIS * dt);
    for (const q of list) {
      if (dt > 0) {
        q.x += vVis * dt + sigma * gauss(); // drift + unbiased wander
        q.y += sigma * gauss();
        if (q.y < y0) q.y = y0 + (y0 - q.y);
        if (q.y > y1) q.y = y1 - (q.y - y1);
      }
    }
    // Dirichlet edge bins (and anything swept past the ends).
    for (let i = list.length - 1; i >= 0; i--) {
      const bin = Math.floor((list[i].x - x0) / binW);
      if (bin <= 0 || bin >= BINS - 1) list.splice(i, 1);
    }
    for (const bin of [0, BINS - 1]) {
      const want = targetFor(bin);
      for (let k = 0; k < want; k++) {
        list.push({
          x: x0 + binW * (bin + Math.random()),
          y: y0 + Math.random() * slabH,
        });
      }
    }

    // The cloud steps back a little when walkers are tracked, so the paths read.
    ctx.fillStyle = showTracks
      ? dark ? 'rgba(226,232,240,0.5)' : 'rgba(15,23,42,0.38)'
      : dark ? 'rgba(226,232,240,0.75)' : 'rgba(15,23,42,0.55)';
    for (const q of list) {
      ctx.beginPath();
      ctx.arc(q.x, q.y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // The analytic profile the walkers should be carrying (amber), drawn
    // as expected walkers-per-bin, sharing the vertical scale with reality.
    const heightScale = (slabH * 0.85) / (perBin * 2);
    ctx.strokeStyle = dark ? '#fbbf24' : '#d97706';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const xi = i / 120;
      const y = y1 - targetForXi(norm, xi, perBin) * heightScale;
      const x = x0 + xi * slabW;
      if (i === 0) ctx.moveTo(x, Math.max(y0 + 2, y));
      else ctx.lineTo(x, Math.max(y0 + 2, y));
    }
    ctx.stroke();

    // ---- tracked walkers: the same physics as the cloud, with a memory.
    const tWin = trackWindow(slabW, D_VIS);
    if (dt > 0) clockRef.current += dt;
    const now = clockRef.current;
    const tracks = tracksRef.current;
    // WHERE a tracked walker starts is a presentation choice, not physics:
    // mid-channel at low Pe, where a tangle lives longest, sliding toward the
    // inlet as Pe grows, so a streak gets the whole channel to run in.
    const spawnMid = 0.5 - 0.38 * (Math.abs(peV) / (Math.abs(peV) + 4)) * Math.sign(peV || 1);
    const spawnAt = (t: number): Track => {
      const f = Math.min(0.92, Math.max(0.08, spawnMid + 0.15 * (2 * Math.random() - 1)));
      const x = x0 + slabW * f;
      const y = y0 + slabH * (0.15 + 0.7 * Math.random());
      return { x, y, pts: [{ x, y, t }], acc: 0 };
    };
    /** One step of drift + wander; true if a bath has absorbed the walker. */
    const stepTrack = (tr: Track, h: number, t: number): boolean => {
      const s = Math.sqrt(2 * D_VIS * h);
      tr.x += vVis * h + s * gauss();
      tr.y += s * gauss();
      if (tr.y < y0) tr.y = y0 + (y0 - tr.y);
      if (tr.y > y1) tr.y = y1 - (tr.y - y1);
      tr.acc += h;
      if (tr.acc >= SAMPLE_DT) {
        tr.acc = 0;
        tr.pts.push({ x: tr.x, y: tr.y, t });
      }
      return tr.x <= x0 + binW || tr.x >= x1 - binW;
    };
    if (tracks.length === 0) {
      for (let k = 0; k < N_TRACKS; k++) {
        let t = now - tWin * (0.4 + 0.6 * Math.random());
        let tr = spawnAt(t);
        while (t < now) {
          const h = Math.min(PRE_DT, now - t);
          t += h;
          if (stepTrack(tr, h, t)) tr = spawnAt(t);
        }
        tracks.push(tr);
      }
    } else if (dt > 0) {
      for (let k = 0; k < tracks.length; k++) {
        if (stepTrack(tracks[k], dt, now)) tracks[k] = spawnAt(now);
      }
    }
    for (const tr of tracks) {
      let cut = 0;
      while (cut < tr.pts.length - 1 && tr.pts[cut].t < now - tWin) cut++;
      if (cut > 0) tr.pts.splice(0, cut);
    }

    if (showTracks) {
      const rgb = dark ? '232,121,249' : '162,28,175';
      const flowCol = dark ? '#34d399' : '#047857';
      for (const tr of tracks) {
        // Arrow first, path on top: at high Pe the path's remaining wiggle must
        // stay visible as it weaves along the arrow — that IS "streaks laid
        // along their arrows". The path is faint enough not to hide the arrow.
        // Where the flow ALONE would have carried it over the same time.
        const a = tr.pts[0];
        const tip = Math.min(x1, a.x + vVis * (now - a.t));
        // A dark halo first, so the arrow reads on top of its own path.
        ctx.strokeStyle = dark ? 'rgba(2,6,23,0.7)' : 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(tip, a.y);
        ctx.stroke();
        ctx.strokeStyle = flowCol;
        ctx.fillStyle = flowCol;
        ctx.lineWidth = 2.2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(tip, a.y);
        ctx.stroke();
        ctx.setLineDash([]);
        if (tip - a.x > 7) {
          ctx.beginPath();
          ctx.moveTo(tip, a.y);
          ctx.lineTo(tip - 7, a.y - 4.5);
          ctx.lineTo(tip - 7, a.y + 4.5);
          ctx.closePath();
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(a.x, a.y, 2.6, 0, Math.PI * 2);
        ctx.stroke();
        const pts = [...tr.pts, { x: tr.x, y: tr.y, t: now }];
        // The path, fading with age — drawn in a few bands, not per segment.
        const BANDS = 6;
        const per = Math.max(1, Math.ceil((pts.length - 1) / BANDS));
        ctx.lineWidth = 1.25;
        ctx.lineJoin = 'round';
        for (let b = 0; b * per < pts.length - 1; b++) {
          const i0 = b * per;
          const i1 = Math.min(pts.length - 1, i0 + per);
          const age = Math.min(1, (now - pts[i1].t) / tWin);
          ctx.strokeStyle = `rgba(${rgb},${0.12 + 0.6 * (1 - age)})`;
          ctx.beginPath();
          ctx.moveTo(pts[i0].x, pts[i0].y);
          for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.stroke();
        }
        // The walker itself.
        ctx.fillStyle = `rgb(${rgb})`;
        ctx.strokeStyle = dark ? '#0f172a' : '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(tr.x, tr.y, 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Flow arrow, sized by how hard convection is winning.
    const dir = peV >= 0 ? 1 : -1;
    const mag = 20 + 50 * (Math.abs(peV) / PE_CAP);
    const ay = y0 + 14;
    ctx.strokeStyle = dark ? '#34d399' : '#047857';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo((x0 + x1) / 2 - dir * mag, ay);
    ctx.lineTo((x0 + x1) / 2 + dir * mag, ay);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo((x0 + x1) / 2 + dir * mag, ay);
    ctx.lineTo((x0 + x1) / 2 + dir * (mag - 7), ay - 4);
    ctx.lineTo((x0 + x1) / 2 + dir * (mag - 7), ay + 4);
    ctx.closePath();
    ctx.fill();

    // Labels.
    ctx.fillStyle = dark ? '#cbd5e1' : '#475569';
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('C₀ bath', (pad + x0) / 2, y0 - 10);
    ctx.fillText('C_L bath', (x1 + W - pad) / 2, y0 - 10);
    ctx.fillText(`flow — the walkers drift AND wander`, (x0 + x1) / 2, ay + 16);
    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
    ctx.textAlign = 'right';
    // Full sentence where it fits; a short form on narrow (phone) canvases,
    // where the long one ran off the left edge.
    const clamped = Math.abs(peRef.current) > PE_CAP;
    const long = clamped
      ? `visual Pe clamped to ${PE_CAP} (physical Pe = ${fmtPe(peRef.current)}); the regime is the same`
      : `visual Pe = physical Pe = ${fmtPe(peRef.current)} — the ratio on screen is real`;
    const short = clamped
      ? `visual Pe clamped to ${PE_CAP} (Pe = ${fmtPe(peRef.current)})`
      : `visual Pe = physical Pe = ${fmtPe(peRef.current)}`;
    ctx.fillText(ctx.measureText(long).width <= x1 - pad ? long : short, x1, y1 + 20);
  }, { running, redrawKey });

  useWheelZoom(canvasRef, zoomRef, setZoomTick);

  return (
    <canvas
      role="img"
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label="Walkers that both diffuse and ride a flow, between two baths, compared against the analytic convection-diffusion profile"
    />
  );
}

function targetForXi(norm: (xi: number) => number, xi: number, perBin: number): number {
  return perBin * norm(xi) * 2;
}

function fmtPe(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e4) return v.toExponential(1).replace('e+', '×10^');
  return String(Number(v.toPrecision(3)));
}

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
