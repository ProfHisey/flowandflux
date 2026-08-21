import { useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { nusselt, sherwood, type CorrParams } from '../../lib/correlations';
import { applyZoom, useWheelZoom } from '../FicksLaw/FickCanvas';

/**
 * What a correlation is actually telling you: how thin the flow has shaved
 * the films. Two boundary layers are drawn around the object at their
 * relative thicknesses — amber for heat (delta ~ L/Nu) and cyan for mass
 * (delta ~ L/Sh) — on a log scale so five decades stay visible.
 *
 * In air the two films nearly coincide (Pr ~ Sc ~ 1). In water the mass
 * film is starved to a sliver while the thermal film stays fat (Sc ~ 1000
 * vs Pr ~ 7): the fastest possible demonstration of why Sh >> Nu in
 * liquids, and why "just use the heat answer" fails for mass.
 */

export function CorrCanvas({ params, dark }: { params: CorrParams; dark: boolean }) {
  const offsetRef = useRef(0);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const zoomRef = useRef(1);
  const [zoomTick, setZoomTick] = useState(0);

  const redrawKey = `${JSON.stringify({ ...params, fluid: params.fluid.name })}|${dark}|${zoomTick}`;

  const canvasRef = useCanvas((ctx, frame) => {
    const p = paramsRef.current;
    const { width: W, height: H } = frame;
    applyZoom(ctx, zoomRef.current, W, H);
    const pad = 8;
    const dt = frame.dt;

    const Nu = Math.max(1, nusselt(p));
    const Sh = Math.max(1, sherwood(p));
    // Log-mapped film thickness in px: Nu = 1 -> thick, Nu = 1e5 -> sliver.
    const filmPx = (N: number) => Math.max(3, 46 - 9 * Math.log10(N));
    const dT = filmPx(Nu);
    const dC = filmPx(Sh);

    const amber = dark ? 'rgba(251,191,36,0.75)' : 'rgba(217,119,6,0.7)';
    const cyanC = dark ? 'rgba(34,211,238,0.85)' : 'rgba(8,145,178,0.8)';
    const solid = dark ? '#64748b' : '#94a3b8';
    const body = dark ? '#475569' : '#cbd5e1';
    const label = dark ? '#cbd5e1' : '#475569';

    // Flow arrows marching left to right.
    offsetRef.current = (offsetRef.current + 40 * dt) % 60;
    ctx.strokeStyle = dark ? 'rgba(148,163,184,0.4)' : 'rgba(100,116,139,0.4)';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 1.5;
    for (let row = 0; row < 4; row++) {
      const y = pad + 30 + row * ((H - 70) / 3);
      for (let x = -60 + offsetRef.current; x < W; x += 60) {
        if (x < pad || x + 18 > W - pad) continue;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 14, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 18, y);
        ctx.lineTo(x + 12, y - 3);
        ctx.lineTo(x + 12, y + 3);
        ctx.closePath();
        ctx.fill();
      }
    }

    const cx = W * 0.46;
    const cy = H / 2;

    const drawFilms = (drawAt: (grow: number, style: string) => void) => {
      // Mass film first if thinner (drawn inside), heat outside — order by size.
      const pairs: [number, string][] = dC <= dT ? [[dT, amber], [dC, cyanC]] : [[dC, cyanC], [dT, amber]];
      for (const [g, s] of pairs) drawAt(g, s);
    };

    if (p.geometry === 'plate') {
      const px0 = W * 0.16;
      const px1 = W * 0.84;
      const py = cy + 30;
      ctx.fillStyle = body;
      ctx.fillRect(px0, py, px1 - px0, 10);
      ctx.strokeStyle = solid;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px0, py, px1 - px0, 10);
      // Films grow along the plate as sqrt(x): draw as wedges above it.
      drawFilms((g, s) => {
        ctx.strokeStyle = s;
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) {
          const x = px0 + ((px1 - px0) * i) / 40;
          const y = py - g * Math.sqrt(i / 40);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      });
      ctx.fillStyle = label;
      ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('flat plate, length L', (px0 + px1) / 2, py + 26);
    } else if (p.geometry === 'tube') {
      const px0 = W * 0.16;
      const px1 = W * 0.84;
      const half = 42;
      ctx.fillStyle = body;
      ctx.fillRect(px0, cy - half - 10, px1 - px0, 10);
      ctx.fillRect(px0, cy + half, px1 - px0, 10);
      ctx.strokeStyle = solid;
      ctx.strokeRect(px0, cy - half - 10, px1 - px0, 10);
      ctx.strokeRect(px0, cy + half, px1 - px0, 10);
      drawFilms((g, s) => {
        ctx.strokeStyle = s;
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 2;
        for (const sgn of [1, -1]) {
          ctx.beginPath();
          ctx.moveTo(px0, cy + sgn * (half - g));
          ctx.lineTo(px1, cy + sgn * (half - g));
          ctx.stroke();
        }
        ctx.setLineDash([]);
      });
      ctx.fillStyle = label;
      ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('tube, diameter L (section)', (px0 + px1) / 2, cy + half + 26);
    } else {
      // cylinder or sphere: a circle with concentric film rings.
      const R = 52;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = body;
      ctx.fill();
      ctx.strokeStyle = solid;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      drawFilms((g, s) => {
        ctx.strokeStyle = s;
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, R + g, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      });
      ctx.fillStyle = label;
      ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        p.geometry === 'sphere' ? 'sphere, diameter L' : 'cylinder in crossflow, diameter L',
        cx, cy + R + 26,
      );
    }

    // Legend, with the live thickness ratio spelled out.
    ctx.textAlign = 'left';
    ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = amber;
    ctx.fillText(`— — thermal film · δ ≈ L/Nu (Nu = ${fmt(Nu)})`, pad + 4, pad + 14);
    ctx.fillStyle = cyanC;
    ctx.fillText(`— — concentration film · δ ≈ L/Sh (Sh = ${fmt(Sh)})`, pad + 4, pad + 30);
    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('film thicknesses on a log scale — every dash is a decade fight', W - pad - 2, H - pad - 4);
  }, { running: true, redrawKey });

  useWheelZoom(canvasRef, zoomRef, setZoomTick);

  return (
    <canvas
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label="An object in a flow with its thermal and concentration boundary layers drawn at their relative thicknesses"
    />
  );
}

function fmt(v: number): string {
  return v >= 1000 ? v.toExponential(1) : String(Number(v.toPrecision(3)));
}
